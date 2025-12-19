const Notification = require("../models/Notification");

// Lấy danh sách thông báo
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const list = await Notification.find({ user_id: userId })
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: list
    });
  } catch (err) {
    console.error("Lỗi lấy thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi lấy thông báo" 
    });
  }
};

// Đếm thông báo chưa đọc
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await Notification.countDocuments({
      user_id: userId,
      read: false,
    });
    res.status(200).json({ 
      success: true,
      unreadCount: count 
    });
  } catch (err) {
    console.error("Lỗi đếm thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi đếm thông báo" 
    });
  }
};

// Đánh dấu đã đọc
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    await Notification.updateMany(
      { user_id: userId, read: false },
      { read: true }
    );
    res.status(200).json({ 
      success: true,
      message: "Đã đọc tất cả thông báo" 
    });
  } catch (err) {
    console.error("Lỗi cập nhật thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi cập nhật thông báo" 
    });
  }
};
