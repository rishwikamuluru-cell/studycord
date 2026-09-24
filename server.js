const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Absolute storage path for Render persistence (survives restarts)[cite: 3]
const DATA_DIR = process.env.RENDER ? '/opt/render/project/src' : __dirname;
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

function loadData(file, defaultVal) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2), 'utf8');
            return defaultVal;
        }
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) { return defaultVal; }
}

function saveData(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); } catch (e) {}
}

loadData(GUILDS_FILE, [
    {
        id: 'guild-1',
        name: 'StudyCord Official',
        icon: 'SC',
        channels: [
            { id: 'c-gen', name: 'general', type: 'text' },
            { id: 'c-code', name: 'coding-help', type: 'text' },
            { id: 'c-voice', name: 'Lounge Voice', type: 'voice' }
        ]
    }
]);
loadData(USERS_FILE, []);
loadData(MESSAGES_FILE, { 'c-gen': [], 'c-code': [] });

app.post('/api/signup', async (req, res) => {
    try {
        const username = req.body.username?.trim() || '';
        const email = req.body.email?.trim().toLowerCase() || '';
        const password = req.body.password?.trim() || '';
        if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

        let users = loadData(USERS_FILE, []);
        if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), username, email, password: hashedPassword };
        users.push(newUser);
        saveData(USERS_FILE, users);
        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase() || '';
        const password = req.body.password?.trim() || '';
        let users = loadData(USERS_FILE, []);
        const user = users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/ping', (req, res) => res.send('OK'));

const activeUsers = {};

io.on('connection', (socket) => {
    socket.emit('load_guilds', loadData(GUILDS_FILE, []));

    socket.on('join_channel', ({ channelId, username }) => {
        socket.join(channelId);
        socket.username = username;
        socket.currentChannel = channelId;

        if (!activeUsers[channelId]) activeUsers[channelId] = new Set();
        activeUsers[channelId].add(username);
        io.to(channelId).emit('update_active_users', Array.from(activeUsers[channelId]));

        let messagesObj = loadData(MESSAGES_FILE, {});
        socket.emit('load_history', messagesObj[channelId] || []);
    });

    socket.on('chat_message', ({ channelId, username, text }) => {
        if (!channelId || !username || !text) return;
        let messagesObj = loadData(MESSAGES_FILE, {});
        if (!messagesObj[channelId]) messagesObj[channelId] = [];

        const newMsg = {
            id: Date.now(),
            username,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        messagesObj[channelId].push(newMsg);
        saveData(MESSAGES_FILE, messagesObj);
        io.to(channelId).emit('chat_message', newMsg);
    });

    // WebRTC Signaling Exchange for Video/Audio
    socket.on('voice_join', ({ channelId, username }) => {
        socket.join(`voice-${channelId}`);
        socket.to(`voice-${channelId}`).emit('voice_peer_joined', { socketId: socket.id, username });
    });

    socket.on('voice_signal', ({ toSocketId, signal }) => {
        io.to(toSocketId).emit('voice_signal', { fromSocketId: socket.id, signal });
    });

    socket.on('disconnect', () => {
        if (socket.currentChannel && socket.username && activeUsers[socket.currentChannel]) {
            activeUsers[socket.currentChannel].delete(socket.username);
            io.to(socket.currentChannel).emit('update_active_users', Array.from(activeUsers[socket.currentChannel]));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Discord clone running on port ${PORT}`));