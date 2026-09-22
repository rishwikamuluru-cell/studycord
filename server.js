const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Absolute path persistence for Render (survives restarts/refreshes)
const DATA_DIR = process.env.RENDER ? '/opt/render/project/src' : __dirname;
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.error("Directory initialization error:", e);
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const RESET_CODES = {};

function loadData(file, defaultVal) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2), 'utf8');
            return defaultVal;
        }
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error loading ${file}:`, e);
        return defaultVal;
    }
}

function saveData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Critical error saving ${file}:`, e);
    }
}

// Initialize files securely on startup
loadData(USERS_FILE, []);
loadData(CHANNELS_FILE, ['general-lounge', 'announcements', 'study-hall']);
loadData(MESSAGES_FILE, { 'general-lounge': [] });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    }
});

// SIGNUP: Normalized email to prevent case-sensitivity login failures
app.post('/api/signup', async (req, res) => {
    try {
        const username = req.body.username ? req.body.username.trim() : '';
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const password = req.body.password ? req.body.password.trim() : '';

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        let users = loadData(USERS_FILE, []);
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already registered. Please log in.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), username, email, password: hashedPassword };
        users.push(newUser);
        saveData(USERS_FILE, users);

        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (e) {
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// LOGIN: Normalized email lookup
app.post('/api/login', async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const password = req.body.password ? req.body.password.trim() : '';

        if (!email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        let users = loadData(USERS_FILE, []);
        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ error: 'Account not found. Please check your email or sign up.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password. Please try again.' });
        }

        res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    } catch (e) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        let users = loadData(USERS_FILE, []);
        const user = users.find(u => u.email === email);
        
        if (!user) return res.status(404).json({ error: 'No account found with this email' });

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        RESET_CODES[email] = { code: verificationCode, expires: Date.now() + 15 * 60 * 1000 };

        try {
            await transporter.sendMail({
                from: '"StudyCord Security" <no-reply@studycord.com>',
                to: email,
                subject: 'Your StudyCord Verification Code',
                text: `Your security code is: ${verificationCode}`
            });
            res.json({ success: true, message: 'Verification code sent to your email.' });
        } catch (mailErr) {
            console.log(`[VERIFICATION CODE FOR ${email}]: ${verificationCode}`);
            res.json({ success: true, message: 'Code generated! (Check Render logs if email service is unconfigured).' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error processing password recovery' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const { code, newPassword } = req.body;
        const record = RESET_CODES[email];
        
        if (!record || record.code !== code || Date.now() > record.expires) {
            return res.status(400).json({ error: 'Invalid or expired verification code.' });
        }

        let users = loadData(USERS_FILE, []);
        const idx = users.findIndex(u => u.email === email);
        if (idx === -1) return res.status(404).json({ error: 'User account not found.' });

        users[idx].password = await bcrypt.hash(newPassword, 10);
        saveData(USERS_FILE, users);
        delete RESET_CODES[email];
        res.json({ success: true, message: 'Password successfully updated.' });
    } catch (e) {
        res.status(500).json({ error: 'Server error resetting password' });
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
        socket.emit('load_history', messagesObj[channel] || []);
    });

    socket.on('typing', ({ channel, username }) => socket.to(channel).emit('display_typing', username));
    socket.on('stop_typing', ({ channel }) => socket.to(channel).emit('hide_typing'));

    socket.on('create_channel', (name) => {
        let clean = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        let channels = loadData(CHANNELS_FILE, ['general-lounge']);
        if (!channels.includes(clean)) {
            channels.push(clean);
            saveData(CHANNELS_FILE, channels);
            let messagesObj = loadData(MESSAGES_FILE, {});
            if (!messagesObj[clean]) messagesObj[clean] = [];
            saveData(MESSAGES_FILE, messagesObj);
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
        if (socket.currentChannel && socket.username && activeUsers[socket.currentChannel]) {
            activeUsers[socket.currentChannel].delete(socket.username);
            io.to(socket.currentChannel).emit('update_active_users', Array.from(activeUsers[socket.currentChannel]));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`StudyCord backend running on port ${PORT}`);
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL;
        if (url) {
            http.get(`${url}/ping`, (res) => {}).on('error', () => {});
        }
    }, 8 * 60 * 1000);
});