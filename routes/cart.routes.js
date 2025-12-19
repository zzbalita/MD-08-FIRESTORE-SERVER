const express = require('express');
const router = express.Router();
// const auth = require('../middlewares/authMiddleware'); // ❌ Bỏ dòng này
const optionalAuth = require('../middlewares/optionalAuth'); // ⭐ Thêm optionalAuth

const cartController = require('../controllers/cart.controller');

// Lấy giỏ hàng (Cho phép Guest)
router.get('/', optionalAuth, cartController.getCart);

// Thêm sản phẩm vào giỏ (Cho phép Guest)
router.post('/', optionalAuth, cartController.addToCart);

// Cập nhật số lượng sản phẩm (Cho phép Guest)
router.put('/:itemId', optionalAuth, cartController.updateCartItem);

// Xóa sản phẩm khỏi giỏ (Cho phép Guest)
router.delete('/:itemId', optionalAuth, cartController.removeFromCart);

// Xóa toàn bộ giỏ hàng (Cho phép Guest)
router.delete('/', optionalAuth, cartController.clearCart);

module.exports = router;    