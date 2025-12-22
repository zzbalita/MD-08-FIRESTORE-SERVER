const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const orderController = require('../controllers/order.controller');
const auth = require('../middlewares/authMiddleware');

// Sửa lại cho khớp với App Android đang gọi: /api/payments/vnpay-order
// (Hoặc nếu bạn đặt route này trong file payment.routes.js và khai báo app.use('/api/payments', ...))
router.post('/vnpay-order', auth, orderController.createVNPayOrder);

// Xử lý kết quả trả về (VNPay gọi link này)
router.get('/vnpay-return', paymentController.processPaymentReturn);

// Xử lý IPN (Cập nhật đơn hàng ngầm - Rất quan trọng)
router.get('/vnpay-ipn', paymentController.processIpn);

module.exports = router;