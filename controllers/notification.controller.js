const Notification = require("../models/Notification");

// 1. Lấy danh sách notification cho user
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await Notification.find({ user_id: userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Không thể lấy thông báo." });
  }
};

// 2. Đánh dấu 1 thông báo đã đọc
exports.markAsRead = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id, 
      { read: true }, 
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật trạng thái đọc." });
  }
};

// 3. Đánh dấu TẤT CẢ đã đọc (THÊM HÀM NÀY ĐỂ HẾT CRASH)
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    await Notification.updateMany({ user_id: userId, read: false }, { read: true });
    res.json({ message: "Đã đọc tất cả thông báo." });
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật tất cả." });
  }
};

// 4. Hàm tạo thông báo khi có đơn hàng (Đảm bảo có trường image)
exports.createAndSendNotification = async (app, userId, data) => {
  try {
    const newNotif = new Notification({
      user_id: userId,
      type: data.type || "order",
      title: data.title,
      message: data.message,
      order_id: data.order_id,
      image: data.image, // Lưu tên file ảnh sản phẩm vào đây
      read: false
    });
    await newNotif.save();

    const io = app.get("io");
    if (io) {
      io.to(userId.toString()).emit("new_notification", newNotif);
    }
  } catch (error) {
    console.error("Lỗi createAndSendNotification:", error);
  }
};