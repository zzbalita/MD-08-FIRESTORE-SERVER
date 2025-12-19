const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

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

  // Đăng ký User khi vừa kết nối
  socket.on("register", (userId) => {
    if (!userId) return;
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    socket.data.userId = userId;
    socket.join(userId);
    console.log(`👤 Registered user ${userId} with socket ${socket.id}`);
  });

  // Tham gia phòng cá nhân để nhận thông báo chat
  socket.on("joinUser", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined room user_${userId}`);
  });

  // Xử lý Typing (Đang nhập tin nhắn)
  socket.on("typing", (data) => {
    socket.to(`user_${data.userId}`).emit("userTyping", {
      sessionId: data.sessionId,
      isTyping: true
    });
  });

  socket.on("stopTyping", (data) => {
    socket.to(`user_${data.userId}`).emit("userTyping", {
      sessionId: data.sessionId,
      isTyping: false
    });
  });

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

  socket.on("adminConnect", (data) => {
    console.log(`👨‍💼 Admin ${data.adminId} connected`);
    socket.join('admin_room');
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

  // Xử lý khi ngắt kết nối
  socket.on("disconnect", () => {
    const userId = socket.data?.userId;
    if (userId && connectedUsers.has(userId)) {
      const sockets = connectedUsers.get(userId);
      sockets.delete(socket.id);
      if (sockets.size === 0) connectedUsers.delete(userId);
    }
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// 4. Khởi chạy Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔌 Socket.io đã sẵn sàng.`);
});