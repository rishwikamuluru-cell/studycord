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

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
const CHANNELS_FILE = path.join(__dirname, 'channels.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const RESET_CODES = {};

function loadData(file, defaultVal = []) {
    if (!fs.existsSync(file)) return defaultVal;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return defaultVal;
    }
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(USERS_FILE)) saveData(USERS_FILE, []);
if (!fs.existsSync(CHANNELS_FILE)) saveData(CHANNELS_FILE, ['general-chat', 'development', 'memes-media']);
if (!fs.existsSync(MESSAGES_FILE)) saveData(MESSAGES_FILE, {});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    let users = loadData(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ id: Date.now(), username, email, password: hashedPassword });
        saveData(USERS_FILE, users);
        res.json({ success: true, user: { id: Date.now(), username, email } });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let users = loadData(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    let users = loadData(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'Email not found' });

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    RESET_CODES[email] = { code: verificationCode, expires: Date.now() + 15 * 60 * 1000 };

    try {
        await transporter.sendMail({
            from: '"StudyCord" <no-reply@studycord.com>',
            to: email,
            subject: 'Password Reset Code',
            text: `Your verification code is: ${verificationCode}`
        });
        res.json({ success: true, message: 'Verification code sent to email' });
    } catch (error) {
        console.log(`[DEV FALLBACK] Code for ${email}: ${verificationCode}`);
        res.json({ success: true, message: 'Code generated (check server console if mail failed)' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const record = RESET_CODES[email];
    if (!record || record.code !== code || Date.now() > record.expires) {
        return res.status(400).json({ error: 'Invalid or expired code' });
    }

    let users = loadData(USERS_FILE);
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });

    users[idx].password = await bcrypt.hash(newPassword, 10);
    saveData(USERS_FILE, users);
    delete RESET_CODES[email];
    res.json({ success: true, message: 'Password reset successful' });
});

io.on('connection', (socket) => {
    let channels = loadData(CHANNELS_FILE, ['general-chat']);
    socket.emit('load_channels', channels);

    socket.on('join_channel', (channel) => {
        socket.join(channel);
        let messagesObj = loadData(MESSAGES_FILE, {});
        socket.emit('load_history', (messagesObj[channel] || []).slice(-100));
    });

    socket.on('create_channel', (name) => {
        let clean = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        let channels = loadData(CHANNELS_FILE, ['general-chat']);
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));