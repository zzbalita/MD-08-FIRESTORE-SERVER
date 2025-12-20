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

// Kết nối MongoDB
connectDB();

const app = express();

// Biến môi trường
const isProduction = process.env.NODE_ENV === "production";

// Log origin để kiểm tra request từ đâu (Hữu ích khi debug)
app.use((req, res, next) => {
  console.log("=> Origin:", req.headers.origin);
  next();
});

// --- Cấu hình CORS (Gộp tất cả các IP từ cả 2 file) ---
const corsOptions = {
  origin: [
    "http://192.168.0.103:5001",
    "http://192.168.0.103:5002",
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
// ⭐ Đã tích hợp fix: Đảm bảo express.json() nằm trước các routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static folder cho ảnh upload (chỉ dùng ở local)
const useCloudinary = process.env.USE_CLOUDINARY === "true";

// Debug: show Cloudinary config status
console.log("=> USE_CLOUDINARY:", process.env.USE_CLOUDINARY);
console.log("=> NODE_ENV:", process.env.NODE_ENV);
console.log("=> CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);

if (isProduction || useCloudinary) {
  console.log("=> ✅ Đang dùng Cloudinary để upload ảnh");
// Static folder cho ảnh upload
if (!isProduction) {
// Tìm đoạn cấu hình static folder và sửa lại y hệt thế này:
const uploadsPath = path.join(__dirname, "tmp", "uploads");
app.use("/uploads", express.static(uploadsPath));

// Log này để ông kiểm tra khi start server xem nó trỏ đúng chưa
console.log("=> Ảnh đang được lấy tại: ", uploadsPath);
} else {
  const uploadsPath = path.join(__dirname, "tmp", "uploads");
  app.use("/uploads", express.static(uploadsPath));
  console.log("=> ⚠️ Đang dùng ảnh local từ", uploadsPath);
}

// --- Các Routes (Đã gộp đầy đủ) ---
app.use("/", require("./routes/index"));
app.use("/api/auth", require("./routes/auth.routes"));

// Nhóm route Admin & Staff
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin/staff", require("./routes/staff.routes")); // Từ file 1
app.use("/api/admin", require("./routes/adminUser.routes"));
app.use('/api/admin/statistics', statisticsRoutes);

// Nhóm route Sản phẩm & Danh mục
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/sizes", require("./routes/size.routes"));
app.use("/api/description-fields", require("./routes/descriptionField.routes"));

// Nhóm route Người dùng & Chức năng
app.use("/api/user", require("./routes/user.routes")); 
app.use("/api/cart", cartRoutes);
app.use("/api/wishlists", require("./routes/wishlist.routes"));
app.use("/api/comments", require("./routes/comment.routes"));
app.use('/api/addresses', addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/notifications", notificationRoutes);

// Chat routes
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/chat-new", require("./routes/chatNew.routes"));

// Upload
app.use("/api/upload", require("./routes/upload.routes"));

module.exports = app;}