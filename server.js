const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static frontend files from the 'public' folder
app.use(express.static('public'));

// Store history per room dynamically so messages persist on refresh
const roomHistories = {
    'python': [],
    'web-dev': [],
    'exams': []
};

// Track online users count
let onlineUsers = 0;

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('update_user_count', onlineUsers);
    console.log('A user connected:', socket.id, '| Total online:', onlineUsers);

    // Handle joining a specific study room
    socket.on('join_room', (room) => {
        socket.rooms.forEach(r => {
            if (r !== socket.id) socket.leave(r);
        });
        socket.join(room);
        
        if (!roomHistories[room]) {
            roomHistories[room] = [];
        }
        // Send history for that specific room immediately
        socket.emit('load_history', roomHistories[room]);
    });

    // Handle creating a brand new dynamic channel
    socket.on('create_room', (roomName) => {
        const sanitized = roomName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        if (sanitized && !roomHistories[sanitized]) {
            roomHistories[sanitized] = [];
            io.emit('room_created', sanitized); // Broadcast new room to everyone
        }
    });

    // Handle incoming chat messages within a room
    socket.on('chat_message', (data) => {
        const { room } = data;
        if (!roomHistories[room]) roomHistories[room] = [];
        roomHistories[room].push(data);
        io.to(room).emit('chat_message', data);
    });

    // Handle file sharing within a room
    socket.on('file_share', (data) => {
        const { room } = data;
        if (!roomHistories[room]) roomHistories[room] = [];
        roomHistories[room].push(data);
        io.to(room).emit('file_share', data);
    });

    // Handle live typing indicator
    socket.on('typing', (data) => {
        socket.to(data.room).emit('typing', data);
    });

    socket.on('disconnect', () => {
        onlineUsers--;
        io.emit('update_user_count', onlineUsers);
        console.log('A user disconnected:', socket.id, '| Total online:', onlineUsers);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`StudyCord server is running live at http://localhost:${PORT}`);
});