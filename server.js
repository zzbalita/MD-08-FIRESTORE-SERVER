const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const server = http.createServer(app);

// Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5002",
      // Add your frontend URLs
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Store connected users
const connectedUsers = new Map();
app.set("io", io);
app.set("connectedUsers", connectedUsers);

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

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

  socket.on("disconnect", () => {
    const userId = socket.data?.userId;
    if (userId && connectedUsers.has(userId)) {
      const sockets = connectedUsers.get(userId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🔌 Socket.io running at http://localhost:${PORT}`);
});