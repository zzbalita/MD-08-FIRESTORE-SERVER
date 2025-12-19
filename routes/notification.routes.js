const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware"); // Xác thực user
const notificationController = require("../controllers/notification.controller");

// -----------------------------
// Lấy danh sách thông báo của user
// GET /notifications
// -----------------------------
router.get("/", auth, notificationController.getMyNotifications);

// -----------------------------
// Lấy số lượng thông báo chưa đọc
// GET /notifications/unread-count
// -----------------------------
router.get("/unread-count", auth, notificationController.getUnreadCount);

// -----------------------------
// Đánh dấu tất cả thông báo đã đọc
// PUT /notifications/mark-read
// -----------------------------
router.put("/mark-read", auth, notificationController.markAllRead);

module.exports = router;
