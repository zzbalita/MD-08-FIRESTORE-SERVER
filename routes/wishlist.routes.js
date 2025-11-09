const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const wishlistController = require('../controllers/wishlist.controller');

// Lấy danh sách yêu thích của tôi
router.get('/me', auth, wishlistController.getMyWishlist);

// Thêm sản phẩm vào yêu thích
router.post('/', auth, wishlistController.addToWishlist);

// Xoá sản phẩm khỏi yêu thích
router.delete('/:productId', auth, wishlistController.removeFromWishlist);

// Kiểm tra 1 sản phẩm có trong wishlist không ( /check/:productId hoặc ?productId= )
router.get('/check/:productId?', auth, wishlistController.check);

module.exports = router;
