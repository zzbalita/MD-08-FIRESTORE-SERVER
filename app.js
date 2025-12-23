require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");

// Import các routes (Dùng biến để quản lý cho gọn)
const addressRoutes = require('./routes/address.routes');
const orderRoutes = require("./routes/order.routes");
const statisticsRoutes = require('./routes/statistics.routes');
const notificationRoutes = require("./routes/notification.routes");
const cartRoutes = require('./routes/cart.routes');
const chatSupportRoutes = require('./routes/chatSupport.routes');

// Import middleware for user activity tracking
const { userActivityMiddleware } = require('./middlewares/userActivity');

// Kết nối MongoDB
connectDB();

const app = express();

app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true'); // Ép ngrok bỏ qua trang cảnh báo
  res.setHeader('bypass-tunnel-reminder', 'true'); 
  next();
});

// ⭐ FIX QUAN TRỌNG: Chấp nhận cả /api/comments và /api/comments/
app.set('strict routing', false);

// Biến môi trường
const isProduction = process.env.NODE_ENV === "production";

// Log origin để kiểm tra request từ đâu
app.use((req, res, next) => {
  console.log("=> Origin:", req.headers.origin);
  next();
});

// --- Cấu hình CORS (Giữ nguyên toàn bộ IP của bạn) ---
const corsOptions = {
  origin: [
    "http://172.20.10.3:5001",
    "http://192.168.100.215",
    "http://192.168.100.127",
    "http://localhost:3000",
    "http://localhost:5002",
    "http://localhost:5003",
    "http://192.168.1.9:5002",
    "http://192.168.1.2:5002",
    "http://192.168.1.4:5001",
    "http://192.168.1.4:5002",
    "http://10.158.14.189",
    "http://10.0.2.2:5001", // Cho Emulator Android
    "https://md-08-firestore-admin.vercel.app"
  ],
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// --- Middleware ---
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// User activity tracking middleware (updates last_activity for online/offline status)
// This middleware tracks user activity on each authenticated API request
app.use(userActivityMiddleware);

// --- Cấu hình Ảnh (Giữ nguyên logic của bạn) ---
const useCloudinary = process.env.USE_CLOUDINARY === "true";
console.log("=> USE_CLOUDINARY:", process.env.USE_CLOUDINARY);
console.log("=> NODE_ENV:", process.env.NODE_ENV);
console.log("=> CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);

if (isProduction || useCloudinary) {
    console.log("=> ✅ Đang dùng Cloudinary để upload ảnh");
}

const uploadsPath = path.join(__dirname, "tmp", "uploads");
app.use("/uploads", express.static(uploadsPath));
console.log("=> Ảnh đang được lấy tại: ", uploadsPath);

// --- CÁC ROUTES (Sắp xếp lại thứ tự ưu tiên API) ---

// 1. Nhóm API AUTH & COMMENT (Phải nằm trên)
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/comments", require("./routes/comment.routes"));

// 2. Nhóm route Admin & Staff
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin/staff", require("./routes/staff.routes"));
app.use("/api/admin", require("./routes/adminUser.routes"));
app.use('/api/admin/statistics', statisticsRoutes);

// 3. Nhóm route Sản phẩm & Danh mục
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/sizes", require("./routes/size.routes"));
app.use("/api/description-fields", require("./routes/descriptionField.routes"));

// 4. Nhóm route Người dùng & Chức năng
app.use("/api/user", require("./routes/user.routes")); 
app.use("/api/cart", cartRoutes);
app.use("/api/wishlists", require("./routes/wishlist.routes"));
app.use('/api/addresses', addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/notifications", notificationRoutes);

// 5. Chat & Upload
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/chat-new", require("./routes/chatNew.routes"));
app.use("/api/chat-support", chatSupportRoutes); // New Chat Support System (bot/admin with rooms)
app.use("/api/upload", require("./routes/upload.routes"));

// 6. ⭐ QUAN TRỌNG: Chuyển Route "/" xuống cuối cùng để không chặn API
app.use("/", require("./routes/index"));

// 7. Middleware xử lý 404 cuối cùng
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Đường dẫn ${req.url} không hợp lệ trên server.`
    });
});

module.exports = app;