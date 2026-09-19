const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize SQLite Database
const db = new sqlite3.Database(path.join(__dirname, 'studycord.db'), (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create messages table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            text TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Load past messages from database and send to the newly connected user
    db.all(`SELECT username, text, timestamp FROM messages ORDER BY id ASC LIMIT 100`, [], (err, rows) => {
        if (!err) {
            socket.emit('load_history', rows);
        } else {
            console.error('Error loading history:', err.message);
        }
    });

    // Listen for incoming chat messages
    socket.on('chat_message', (data) => {
        if (!data.text || !data.username) return;
        
        // Save message to database
        db.run(`INSERT INTO messages (username, text) VALUES (?, ?)`, [data.username, data.text], function(err) {
            if (!err) {
                // Broadcast message to everyone including sender
                io.emit('chat_message', { 
                    username: data.username, 
                    text: data.text,
                    timestamp: new Date().toLocaleTimeString()
                });
            } else {
                console.error('Error saving message:', err.message);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});