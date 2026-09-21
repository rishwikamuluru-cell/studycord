const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Robust absolute storage path for Render & Local
const DATA_DIR = process.env.RENDER ? '/opt/render/project/src' : __dirname;
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const RESET_CODES = {};

function loadData(file, defaultVal) {
    if (!fs.existsSync(file)) {
        saveData(file, defaultVal);
        return defaultVal;
    }
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return defaultVal;
    }
}

function saveData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Critical storage write error:", e);
    }
}

// Initialize Storage Files
if (!fs.existsSync(USERS_FILE)) saveData(USERS_FILE, []);
if (!fs.existsSync(CHANNELS_FILE)) saveData(CHANNELS_FILE, ['general-lounge', 'announcements', 'study-hall']);
if (!fs.existsSync(MESSAGES_FILE)) saveData(MESSAGES_FILE, { 'general-lounge': [] });

// Nodemailer setup with secure fallback logging
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    let users = loadData(USERS_FILE, []);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), username, email, password: hashedPassword };
        users.push(newUser);
        saveData(USERS_FILE, users);
        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (e) {
        res.status(500).json({ error: 'Server registration error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields are required' });

    let users = loadData(USERS_FILE, []);
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
});

// Facebook-grade secure code verification trigger
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    let users = loadData(USERS_FILE, []);
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(404).json({ error: 'No account found with this email address' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    RESET_CODES[email] = {
        code: verificationCode,
        expires: Date.now() + 15 * 60 * 1000 // 15 mins expiry
    };

    const mailOptions = {
        from: '"StudyCord Security" <no-reply@studycord.com>',
        to: email,
        subject: 'Your StudyCord Verification Code',
        text: `Hello,\n\nYour security verification code is: ${verificationCode}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.`
    };

    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error("Email credentials not configured");
        }
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Verification code sent successfully to your email.' });
    } catch (error) {
        // Fallback safety log so code is always accessible if mail credentials aren't set
        console.log(`\n==================================================`);
        console.log(`[FACEBOOK AUTH FALLBACK] Code for ${email}: ${verificationCode}`);
        console.log(`==================================================\n`);
        
        res.json({ 
            success: true, 
            message: 'Verification code generated! (Note: Check server console logs if email service is unconfigured).' 
        });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const record = RESET_CODES[email];

    if (!record || record.code !== code || Date.now() > record.expires) {
        return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    let users = loadData(USERS_FILE, []);
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return res.status(404).json({ error: 'User account not found.' });

    try {
        users[idx].password = await bcrypt.hash(newPassword, 10);
        saveData(USERS_FILE, users);
        delete RESET_CODES[email];
        res.json({ success: true, message: 'Password successfully updated.' });
    } catch (e) {
        res.status(500).json({ error: 'Error updating password.' });
    }
});

app.get('/ping', (req, res) => res.send('OK'));

const activeUsers = {};

io.on('connection', (socket) => {
    let channels = loadData(CHANNELS_FILE, ['general-lounge']);
    socket.emit('load_channels', channels);

    socket.on('join_channel', ({ channel, username }) => {
        socket.join(channel);
        socket.username = username;
        socket.currentChannel = channel;

        if (!activeUsers[channel]) activeUsers[channel] = new Set();
        activeUsers[channel].add(username);

        io.to(channel).emit('update_active_users', Array.from(activeUsers[channel]));

        let messagesObj = loadData(MESSAGES_FILE, {});
        socket.emit('load_history', (messagesObj[channel] || []).slice(-100));
    });

    socket.on('typing', ({ channel, username }) => {
        socket.to(channel).emit('display_typing', username);
    });

    socket.on('stop_typing', ({ channel }) => {
        socket.to(channel).emit('hide_typing');
    });

    socket.on('create_channel', (name) => {
        let clean = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        let channels = loadData(CHANNELS_FILE, ['general-lounge']);
        if (!channels.includes(clean)) {
            channels.push(clean);
            saveData(CHANNELS_FILE, channels);
            io.emit('load_channels', channels);
        }
    });

    socket.on('chat_message', (data) => {
        const { channel, username, text, file } = data;
        if (!channel || !username) return;

        let messagesObj = loadData(MESSAGES_FILE, {});
        if (!messagesObj[channel]) messagesObj[channel] = [];

        const newMsg = {
            username,
            text: text || '',
            file: file || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        messagesObj[channel].push(newMsg);
        saveData(MESSAGES_FILE, messagesObj);
        io.to(channel).emit('chat_message', newMsg);
    });

    socket.on('disconnect', () => {
        if (socket.currentChannel && socket.username) {
            if (activeUsers[socket.currentChannel]) {
                activeUsers[socket.currentChannel].delete(socket.username);
                io.to(socket.currentChannel).emit('update_active_users', Array.from(activeUsers[socket.currentChannel]));
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Continuous uptime keeper (pings every 8 minutes)
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL;
        if (url) {
            http.get(`${url}/ping`, (res) => {}).on('error', () => {});
        }
    }, 8 * 60 * 1000);
});