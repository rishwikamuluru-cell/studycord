const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware (Increased payload limit for file sharing)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Storage Files
const USERS_FILE = path.join(__dirname, 'users.json');
const CHANNELS_FILE = path.join(__dirname, 'channels.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

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

// Initialize default files if missing
if (!fs.existsSync(USERS_FILE)) saveData(USERS_FILE, []);
if (!fs.existsSync(CHANNELS_FILE)) saveData(CHANNELS_FILE, ['general-study', 'javascript', 'python-help']);
if (!fs.existsSync(MESSAGES_FILE)) saveData(MESSAGES_FILE, {});

// Auth Routes
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    let users = loadData(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), username, email, password: hashedPassword };
        users.push(newUser);
        saveData(USERS_FILE, users);
        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields are required' });

    let users = loadData(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
});

// Socket.io Real-time Chat & Channels
io.on('connection', (socket) => {
    // Send channels list
    let channels = loadData(CHANNELS_FILE, ['general-study']);
    socket.emit('load_channels', channels);

    // Join channel
    socket.on('join_channel', (channel) => {
        socket.join(channel);
        let messagesObj = loadData(MESSAGES_FILE, {});
        let channelMessages = messagesObj[channel] || [];
        socket.emit('load_history', channelMessages.slice(-100));
    });

    // Create new channel / topic
    socket.on('create_channel', (newChannelName) => {
        let cleanName = newChannelName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        let channels = loadData(CHANNELS_FILE, ['general-study']);
        if (!channels.includes(cleanName)) {
            channels.push(cleanName);
            saveData(CHANNELS_FILE, channels);
            io.emit('load_channels', channels);
        }
    });

    // Handle chat messages & files
    socket.on('chat_message', (data) => {
        const { channel, username, text, file } = data;
        if (!channel || !username) return;

        let messagesObj = loadData(MESSAGES_FILE, {});
        if (!messagesObj[channel]) messagesObj[channel] = [];

        const newMsg = {
            username,
            text: text || '',
            file: file || null, // { name, type, data }
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        messagesObj[channel].push(newMsg);
        saveData(MESSAGES_FILE, messagesObj);

        io.to(channel).emit('chat_message', newMsg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});