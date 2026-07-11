const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('ChitChat API is running smoothly.');
});

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('socketio', io);

// Map to track online users: userId -> socket.id
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  
  if (userId && userId !== 'undefined') {
    onlineUsers.set(userId, socket.id);
    socket.join(userId); // Join personal room for notifications
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);
    
    // Broadcast online status to everyone
    io.emit('online_users', Array.from(onlineUsers.keys()));
  }

  // Join a specific chat room (private or group)
  socket.on('join_chat', (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined chat room: ${conversationId}`);
  });

  // Leave a specific chat room
  socket.on('leave_chat', (conversationId) => {
    socket.leave(conversationId);
    console.log(`Socket ${socket.id} left chat room: ${conversationId}`);
  });

  // Handle typing status
  socket.on('typing', ({ conversationId, userId, isTyping, userName }) => {
    socket.to(conversationId).emit('typing_status', {
      conversationId,
      userId,
      isTyping,
      userName
    });
  });

  // Handle sending messages
  socket.on('send_message', async ({ conversationId, senderId, text, receiverId, isGroup, replyTo }) => {
    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');

      // 1. Save message to DB
      const newMessage = new Message({
        conversationId,
        sender: senderId,
        text,
        replyTo
      });
      await newMessage.save();

      // 2. Populate sender details for the UI
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'firstName lastName email');

      // 3. Update Conversation last message and updated timestamp
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: newMessage._id,
        updatedAt: Date.now()
      });

      // 4. Emit the message to the active chat room
      io.to(conversationId).emit('new_message', populatedMessage);

      // 5. If it's a private chat, send notification to recipient's personal room
      // in case they are logged in but not currently in the chat room viewport
      if (!isGroup && receiverId) {
        socket.to(receiverId).emit('new_message_notification', {
          conversationId,
          message: populatedMessage
        });
      } else if (isGroup) {
        // For groups, alert participants who are not in the socket room
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.participants.forEach(participant => {
            const pId = participant.toString();
            if (pId !== senderId) {
              socket.to(pId).emit('new_message_notification', {
                conversationId,
                message: populatedMessage,
                isGroup: true
              });
            }
          });
        }
      }

    } catch (err) {
      console.error('Error handling send_message socket event:', err);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (userId) {
      onlineUsers.delete(userId);
      console.log(`User disconnected: ${userId}`);
      io.emit('online_users', Array.from(onlineUsers.keys()));
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
