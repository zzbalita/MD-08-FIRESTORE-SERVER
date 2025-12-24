// 🔴 QUAN TRỌNG: Phải có dòng này để gọi Service
const svc = require('../services/comment.service');

// Lấy danh sách bình luận theo sản phẩm
exports.listByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const data = await svc.listByProduct(productId, { page, limit });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Không thể lấy bình luận' });
  }
};

// Tạo bình luận mới
exports.create = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    
    // ⭐ LOG DEBUG
    console.log("=> [AUTH CHECK] UserId từ Middleware:", userId);

    const { product_id, rating, content } = req.body;
    
    // ⭐ LOG DEBUG
    console.log("=> [BODY CHECK] Dữ liệu Android gửi:", { product_id, rating, content });

    if (!product_id) {
        console.error("❌ LỖI: Android không gửi product_id");
        return res.status(400).json({ message: "Thiếu ID sản phẩm" });
    }

    // Gọi đến Service để xử lý logic
    const doc = await svc.create(userId, { productId: product_id, content, rating });
    
    console.log("✅ [SUCCESS] Đã tạo đánh giá thành công!");
    res.status(201).json(doc);

  } catch (err) {
    // ⭐ LOG DEBUG KHI CÓ LỖI
    console.error("❌ LỖI TẠI SERVICE:");
    console.error("- Status:", err.status);
    console.error("- Message:", err.message);

    if (err?.code === 11000) return res.status(409).json({ message: 'Bạn đã đánh giá sản phẩm này' });
    res.status(err.status || 500).json({ message: err.message || 'Không thể tạo bình luận' });
  }
};

// Cập nhật bình luận
exports.update = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { commentId } = req.params;
    const { rating, content } = req.body;
    const doc = await svc.update(userId, commentId, { content, rating });
    res.status(200).json(doc);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Không thể cập nhật bình luận' });
  }
};

// Xóa bình luận (Người dùng tự xóa)
exports.remove = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { commentId } = req.params;
    const out = await svc.remove(userId, commentId);
    res.status(200).json(out);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Không thể xoá bình luận' });
  }
};

// --- ADMIN ROUTES ---

// Admin: Lấy tất cả đánh giá
exports.adminListAll = async (req, res) => {
  try {
    const { page, limit, rating, productId } = req.query;
    const data = await svc.listAll({ page, limit, rating, productId });
    res.status(200).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Không thể lấy danh sách đánh giá' });
  }
};

// Admin: Xóa đánh giá của bất kỳ ai
exports.adminRemove = async (req, res) => {
  try {
    const { commentId } = req.params;
    const out = await svc.adminRemove(commentId);
    res.status(200).json(out);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Không thể xoá đánh giá' });
  }
};