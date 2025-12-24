const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

// Import services for socket handling
const ChatSupportService = require('./services/chatSupportService');
const UserStatus = require('./models/UserStatus');
const ChatRoom = require('./models/ChatRoom');
const { startOfflineChecker, checkOfflineUsers } = require('./middlewares/userActivity');

// 1. Tắt cache cho toàn bộ response (fix lỗi 304 thường gặp ở trình duyệt)
app.use((req, res, next) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

const server = http.createServer(app);

// 2. Cấu hình Socket.io với danh sách CORS đầy đủ nhất từ cả 2 bản
const io = new Server(server, {
  cors: {
    origin: [
      "http://172.20.10.3:5001",
      "http://192.168.100.215",
      "http://192.168.0.103:5001",
      "http://192.168.0.103:5002",
      "http://192.168.100.127",
      "http://localhost:3000",
      "http://localhost:5002",
      "http://localhost:5003",
      "http://localhost:19006",
      "http://192.168.1.9:5002",
      "http://192.168.1.2:5002",
      "http://192.168.1.4:5001",
      "http://192.168.1.4:5002",
      "http://10.158.14.189",
      "http://10.0.2.2:5001",      // Cho Android Emulator
      "exp://192.168.1.9:8081",    // Expo
      "exp://localhost:8081",      // Expo Local
      "https://md-08-firestore-admin.vercel.app",
      "*"                          // Cho phép tất cả (tùy chọn nếu vẫn bị lỗi CORS)
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// 🟢 Quản lý người dùng đang kết nối: userId -> Set(socketIds)
const connectedUsers = new Map();

// Gắn io và connectedUsers vào app để có thể dùng ở các file Controller/Route khác
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// 3. Xử lý các sự kiện Socket.io
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // ========================================
  // USER REGISTRATION & STATUS
  // ========================================
  
  // Helper function to check if a string is a valid MongoDB ObjectId
  const isValidObjectId = (id) => {
    if (!id) return false;
    const mongoose = require('mongoose');
    return mongoose.Types.ObjectId.isValid(id) && 
           (String(new mongoose.Types.ObjectId(id)) === String(id));
  };

  // Đăng ký User khi vừa kết nối
  socket.on("register", async (userId) => {
    if (!userId) return;
    
    try {
      // Update connectedUsers map
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId).add(socket.id);
      socket.data.userId = userId;
      socket.data.isGuest = !isValidObjectId(userId);
      socket.join(userId);
      
      // Only update user status in database for registered users (valid ObjectId)
      if (isValidObjectId(userId)) {
        const userStatus = await UserStatus.findOrCreateStatus(userId, 'user');
        await userStatus.addSocketId(socket.id);
      }
      
      console.log(`👤 Registered user ${userId} with socket ${socket.id}${socket.data.isGuest ? ' (guest)' : ''}`);
      
      // Notify others that user is online
      socket.broadcast.emit('userOnline', {
        userId: userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error registering user:', error.message);
    }
  });

  // Admin registration
  socket.on("adminConnect", async (data) => {
    try {
      const { adminId } = data;
      console.log(`👨‍💼 Admin ${adminId} connected`);
      
      socket.data.userId = adminId;
      socket.data.userType = 'admin';
      socket.join('admin_room');
      
      // Update admin status
      const adminStatus = await UserStatus.findOrCreateStatus(adminId, 'admin');
      await adminStatus.addSocketId(socket.id);
      
      // Notify about admin online
      io.emit('adminOnline', {
        adminId: adminId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error connecting admin:', error.message);
    }
  });

  // Tham gia phòng cá nhân để nhận thông báo chat
  socket.on("joinUser", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room user_${userId}`);
  });

  // ========================================
  // CHAT SUPPORT SOCKET EVENTS
  // ========================================

  // Join a chat support room
  socket.on("joinChatSupportRoom", async (data) => {
    try {
      const { roomId, userId, userType = 'User' } = data;
      const isGuestUser = !isValidObjectId(userId);
      const actualUserType = isGuestUser ? 'Guest' : userType;
      
      // Find or verify the room exists
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) {
        socket.emit('error', { message: 'Chat room not found' });
        return;
      }
      
      // Join the socket room
      socket.join(room.socket_room);
      
      // Add participant to room (works with both ObjectId and string userIds now)
      await room.addParticipant(userId, actualUserType, socket.id);
      
      // Only update UserStatus in database for registered users (valid ObjectId)
      if (!isGuestUser) {
        const userStatus = await UserStatus.findOrCreateStatus(userId, userType.toLowerCase());
        await userStatus.joinRoom(room.socket_room);
      }
      
      console.log(`💬 ${actualUserType} ${userId} joined chat room: ${room.socket_room}`);
      
      // Notify room about new participant
      socket.to(room.socket_room).emit('userJoinedRoom', {
        userId: userId,
        userType: actualUserType,
        roomId: roomId,
        timestamp: new Date()
      });
      
      // Send confirmation to the user
      socket.emit('joinedRoom', {
        roomId: roomId,
        socketRoom: room.socket_room,
        success: true
      });
    } catch (error) {
      console.error('Error joining chat support room:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  // Leave a chat support room
  socket.on("leaveChatSupportRoom", async (data) => {
    try {
      const { roomId, userId } = data;
      const isGuestUser = !isValidObjectId(userId);
      
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (!room) return;
      
      // Leave the socket room
      socket.leave(room.socket_room);
      
      // Remove participant
      await room.removeParticipant(userId, socket.id);
      
      // Only update UserStatus for registered users
      if (!isGuestUser) {
        const userStatus = await UserStatus.findOne({ user_id: userId });
        if (userStatus) {
          await userStatus.leaveRoom(room.socket_room);
        }
      }
      
      console.log(`💬 User ${userId} left chat room: ${room.socket_room}`);
      
      // Notify room
      socket.to(room.socket_room).emit('userLeftRoom', {
        userId: userId,
        roomId: roomId,
        reason: 'left',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error leaving chat support room:', error.message);
    }
  });

  // Handle typing indicator
  socket.on("typing", async (data) => {
    const { roomId, userId, isTyping = true } = data;
    
    try {
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (room) {
        socket.to(room.socket_room).emit("userTyping", {
          roomId: roomId,
          userId: userId,
          isTyping: isTyping
        });
      }
    } catch (error) {
      console.error('Error handling typing:', error.message);
    }
  });

  socket.on("stopTyping", async (data) => {
    const { roomId, userId } = data;
    
    try {
      const room = await ChatRoom.findOne({ room_id: roomId });
      if (room) {
        socket.to(room.socket_room).emit("userTyping", {
          roomId: roomId,
          userId: userId,
          isTyping: false
        });
      }
    } catch (error) {
      console.error('Error handling stop typing:', error.message);
    }
  });

  // ========================================
  // LEGACY CHAT EVENTS (For backward compatibility)
  // ========================================

  // Tham gia phiên chat (Phân biệt giữa Admin và Bot)
  socket.on("joinChatSession", (data) => {
    const { sessionId, chatType = 'bot' } = data;
    const prefix = chatType === 'admin' ? 'admin_' : 'bot_';
    const roomName = `${prefix}${sessionId.split('_').pop()}`;
    
    socket.join(roomName);
    console.log(`💬 Socket ${socket.id} joined ${chatType} session room: ${roomName}`);
  });

  socket.on("leaveChatSession", (data) => {
    const { sessionId, chatType = 'bot' } = data;
    const prefix = chatType === 'admin' ? 'admin_' : 'bot_';
    const roomName = `${prefix}${sessionId.split('_').pop()}`;
    
    socket.leave(roomName);
    console.log(`💬 Socket ${socket.id} left room: ${roomName}`);
  });

  // --- LOGIC CHO ADMIN CHAT ---
  socket.on("joinAdminChat", (data) => {
    const roomName = `admin_${data.sessionId.split('_').pop()}`;
    socket.join(roomName);
    console.log(`👨‍💼 Admin joined room: ${roomName}`);
  });

  socket.on("newUserMessage", (data) => {
    const roomName = `admin_${data.sessionId.split('_').pop()}`;
    // Gửi cho Admin
    socket.to(roomName).emit("newUserMessage", data);
    // Gửi xác nhận cho User
    socket.to(`user_${data.userId}`).emit("messageSent", {
      sessionId: data.sessionId,
      messageId: data.messageId || Date.now().toString()
    });
  });

  socket.on("adminResponse", (data) => {
    const roomName = `admin_${data.sessionId.split('_').pop()}`;
    const payload = {
      sessionId: data.sessionId,
      message: {
        message_id: data.messageId,
        text: data.text,
        is_user: false,
        timestamp: data.timestamp,
        admin_id: data.adminId
      }
    };
    // Gửi cho User và cập nhật giao diện Admin
    socket.to(`user_${data.userId}`).emit("newAdminMessage", payload);
    socket.to(roomName).emit("newAdminMessage", payload);
  });

  // --- LOGIC CHO BOT CHAT ---
  socket.on("newBotMessage", (data) => {
    const botRoomName = `bot_${data.sessionId.split('_').pop()}`;
    const payload = {
      sessionId: data.sessionId,
      message: {
        message_id: data.messageId,
        text: data.text,
        is_user: false,
        timestamp: data.timestamp,
        response_type: data.responseType,
        sub_answers: data.subAnswers || [],
        follow_up_questions: data.followUpQuestions || []
      }
    };
    socket.to(botRoomName).emit("newMessage", payload);
    socket.to(`user_${data.userId}`).emit("newMessage", payload); // Fallback
  });

  // ========================================
  // DISCONNECT HANDLING
  // ========================================

  socket.on("disconnect", async () => {
    const userId = socket.data?.userId;
    const userType = socket.data?.userType || 'user';
    const isGuestUser = socket.data?.isGuest || !isValidObjectId(userId);
    
    console.log("🔴 Socket disconnected:", socket.id);
    
    if (userId) {
      // Update connectedUsers map
      if (connectedUsers.has(userId)) {
        const sockets = connectedUsers.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
      
      try {
        // Only update UserStatus for registered users (not guests)
        if (!isGuestUser) {
          const userStatus = await UserStatus.findOne({ user_id: userId });
          if (userStatus) {
            await userStatus.removeSocketId(socket.id);
            
            // If no more sockets, user is potentially offline
            // The offline checker will handle this after 2 minutes
            if (userStatus.socket_ids.length === 0) {
              console.log(`⏳ User ${userId} has no active sockets, will be marked offline in 2 minutes if inactive`);
            }
          }
        }
        
        // Notify about potential offline
        socket.broadcast.emit('userDisconnected', {
          userId: userId,
          userType: userType,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error handling disconnect:', error.message);
      }
    }
  });
});

// ========================================
// OFFLINE CHECKER INTERVAL
// ========================================

// Start the offline checker that runs every 30 seconds
// This will mark users offline after 2 minutes of inactivity
// and close their chat room sockets
const offlineCheckerInterval = startOfflineChecker(io, 30000);

// Custom offline handler that also closes chat rooms
const handleOfflineUsersWithRoomClosure = async () => {
  try {
    const usersToMarkOffline = await UserStatus.getUsersToMarkOffline();
    
    for (const userStatus of usersToMarkOffline) {
      const userId = userStatus.user_id?._id || userStatus.user_id;
      
      // Handle user going offline (closes chat rooms)
      await ChatSupportService.handleUserOffline(userId, io);
      
      console.log(`📴 User ${userId} marked offline, chat rooms closed`);
    }
    
    // Mark users offline in database
    await UserStatus.checkAndSetOfflineUsers();
  } catch (error) {
    console.error('Error in offline handler:', error.message);
  }
};

// Run the custom handler every 30 seconds
setInterval(handleOfflineUsersWithRoomClosure, 30000);

// Clean up inactive rooms periodically (every 5 minutes)
setInterval(async () => {
  try {
    const result = await ChatRoom.closeInactiveRooms(30); // Close rooms inactive for 30+ minutes
    if (result.modifiedCount > 0) {
      console.log(`🧹 Closed ${result.modifiedCount} inactive chat rooms`);
    }
  } catch (error) {
    console.error('Error closing inactive rooms:', error.message);
  }
}, 5 * 60 * 1000);

// ========================================
// SERVER STARTUP
// ========================================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔌 Socket.io đã sẵn sàng.`);
  console.log(`⏱️ Offline checker active (2 minute timeout)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  clearInterval(offlineCheckerInterval);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
