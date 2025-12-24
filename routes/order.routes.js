const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const orderController = require('../controllers/order.controller');
// BỔ SUNG DÒNG NÀY:
const paymentController = require('../controllers/payment.controller'); 
const authAdminOrStaff = require("../middlewares/authAdminOrStaff");

// Đặt hàng VNPay (Tạo link)
router.post("/vnpay-order", auth, orderController.createVNPayOrder);

// Xử lý kết quả trả về từ VNPay (SỬA Ở ĐÂY)
// Sử dụng paymentController thay vì orderController
router.get('/vnpay-return', paymentController.processPaymentReturn);

// Các route khác giữ nguyên
router.post("/", auth, orderController.createOrder); 
router.post('/cash-order', auth, orderController.createCashOrder);
router.get('/my-orders', auth, orderController.getMyOrders);
router.get('/admin/orders', authAdminOrStaff, orderController.getAllOrders);
router.get('/:id', auth, orderController.getOrderById);
router.put('/:id/status', authAdminOrStaff, orderController.updateOrderStatus);
router.put('/:id/cancel', auth, orderController.cancelOrder);

module.exports = router;