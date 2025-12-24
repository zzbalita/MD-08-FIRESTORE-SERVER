const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comment.controller');
const auth = require('../middlewares/authMiddleware'); // Middleware của bạn

// Log để chắc chắn file này đang chạy
console.log("==> [FILE CHECK] Đang chạy trong routes/comment.routes.js");

// --- TEST ROUTES ---
router.get('/test', (req, res) => {
    res.json({ message: "Route comment đã thông suốt!" });
});

// --- USER ROUTES ---

// Lấy danh sách bình luận theo sản phẩm (Không cần đăng nhập)
router.get('/product/:productId', ctrl.listByProduct);

// Tạo bình luận mới (Có Log từng bước)
router.post('/', (req, res, next) => {
    console.log("=> 🎯 ĐANG VÀO ROUTE COMMENT: [POST] /api/comments");
    console.log("==> [STEP 1] Đã vượt qua tầng route, chuẩn bị vào Auth middleware");
    next();
}, auth, (req, res, next) => {
    console.log("==> [STEP 2] Đã vượt qua Auth middleware, chuẩn bị vào Controller");
    next();
}, ctrl.create);

// Cập nhật bình luận
router.put('/:commentId', auth, ctrl.update);

// Xóa bình luận
router.delete('/:commentId', auth, ctrl.remove);


// --- ADMIN ROUTES ---
// Route mà Admin Web của bạn đang gọi bị 404 là ở đây
// Đường dẫn sẽ là: GET /api/comments/admin/all
router.get('/admin/all', auth, ctrl.adminListAll);

// Admin xóa comment bất kỳ
router.delete('/admin/:commentId', auth, ctrl.adminRemove);

module.exports = router;