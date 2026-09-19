const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// JSON File Database Paths
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Helper functions to read/write JSON storage safely
function loadData(file) {
    if (!fs.existsSync(file)) return [];
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Ensure storage files exist on startup
if (!fs.existsSync(USERS_FILE)) saveData(USERS_FILE, []);
if (!fs.existsSync(MESSAGES_FILE)) saveData(MESSAGES_FILE, []);

// Authentication: Sign Up Route
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    let users = loadData(USERS_FILE);
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: Date.now(), username, email, password: hashedPassword };
        users.push(newUser);
        saveData(USERS_FILE, users);

        res.json({ success: true, user: { id: newUser.id, username, email } });
    } catch (e) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Authentication: Login Route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    let users = loadData(USERS_FILE);
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
});

// Socket.io Real-time Chat & History
io.on('connection', (socket) => {
    // Send recent history upon connection
    let messages = loadData(MESSAGES_FILE);
    socket.emit('load_history', messages.slice(-100));

    // Handle incoming chat messages
    socket.on('chat_message', (data) => {
        if (!data.text || !data.username) return;

        let messages = loadData(MESSAGES_FILE);
        const newMsg = { 
            username: data.username, 
            text: data.text, 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };
        
        messages.push(newMsg);
        saveData(MESSAGES_FILE, messages);

        io.emit('chat_message', newMsg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`StudyCord server running on port ${PORT}`);
});