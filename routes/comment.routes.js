const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comment.controller');
const auth = require('../middlewares/authMiddleware'); // <-- dùng file của bạn
const authAdminOrStaff = require('../middlewares/authAdminOrStaff');

// Lấy bình luận + tổng quan theo sản phẩm
router.get('/product/:productId', ctrl.listByProduct);

// Tạo bình luận (cần đăng nhập)
router.post('/', auth, ctrl.create);

// Cập nhật bình luận (cần là chủ comment)
router.put('/:commentId', auth, ctrl.update);

// Xoá bình luận (cần là chủ comment)
router.delete('/:commentId', auth, ctrl.remove);

// === Admin routes ===
// Lấy tất cả đánh giá (admin/staff)
router.get('/admin/all', authAdminOrStaff, ctrl.adminListAll);

// Xóa đánh giá (admin/staff)
router.delete('/admin/:commentId', authAdminOrStaff, ctrl.adminRemove);

module.exports = router;
