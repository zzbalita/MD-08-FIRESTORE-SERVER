const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const notificationController = require("../controllers/notification.controller");

// Lấy danh sách
router.get("/my-notifications", authMiddleware, notificationController.getMyNotifications);

// Đánh dấu tất cả đã đọc
router.put("/mark-all-read", authMiddleware, notificationController.markAllRead);

// Đánh dấu 1 cái đã đọc
router.put("/:id/read", authMiddleware, notificationController.markAsRead);

module.exports = router;