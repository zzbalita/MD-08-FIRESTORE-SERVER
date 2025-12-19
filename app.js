require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");

// Routes
const addressRoutes = require('./routes/address.routes');
const orderRoutes = require("./routes/order.routes");
const statisticsRoutes = require('./routes/statistics.routes');
const notificationRoutes = require("./routes/notification.routes");
const vnpayRoutes = require("./routes/vnpay.routes");

// Kết nối MongoDB
connectDB();

const app = express();

// Biến môi trường
const isProduction = process.env.NODE_ENV === "production";

// Log origin để kiểm tra request từ đâu
app.use((req, res, next) => {
  console.log("=> Origin:", req.headers.origin);
  next();
});

// CORS cấu hình chuẩn cho cả localhost và vercel
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      "http://192.168.1.9:5000",
      "http://192.168.1.2:5000",
      "http://localhost:5000",
      "http://10.158.14.189",
      "https://md-08-firestore-admin.vercel.app",
      "fivestore://app",
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Middleware cần thiết
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static folder cho ảnh upload (chỉ dùng ở local)
if (!isProduction) {
  const uploadsPath = path.join(__dirname, "tmp", "uploads");
  app.use("/uploads", express.static(uploadsPath));
  console.log("=> Đang dùng ảnh local từ", uploadsPath);
} else {
  console.log("=> Đang dùng Cloudinary - không cần /uploads");
}

// -------------------------
// Routes API
// -------------------------

// VNPay
app.use("/api/vnpay", vnpayRoutes);

// Index
app.use("/", require("./routes/index"));

// Admin routes
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin", require("./routes/adminUser.routes"));
app.use("/api/admin/statistics", statisticsRoutes);

// Product / category / brand
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/sizes", require("./routes/size.routes"));
app.use("/api/description-fields", require("./routes/descriptionField.routes"));

// Upload
app.use("/api/upload", require("./routes/upload.routes"));

// Auth & user
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));

// Wishlist, Cart, Comments
app.use("/api/wishlists", require("./routes/wishlist.routes"));
app.use("/api/cart", require("./routes/cart.routes"));
app.use("/api/comments", require("./routes/comment.routes"));

// Address
app.use("/api/addresses", addressRoutes);

// Orders
app.use("/api/orders", orderRoutes);

// Payment
app.use("/api/payments", require("./routes/payment.routes"));

// Notification
app.use("/api/notifications", notificationRoutes);

// Chat
app.use("/api/chat", require("./routes/chat.routes"));
app.use("/api/chat-new", require("./routes/chatNew.routes"));

// -------------------------
// Export app
// -------------------------
module.exports = app;
