const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const authAdmin = require("../middlewares/authAdmin");
const orderController = require('../controllers/order.controller');
const orderAdminController = require('../controllers/order.admin.controller');

// -----------------------------
// Đặt hàng
// -----------------------------

// ✅ [GIỮ NGUYÊN] Đặt hàng VNPay (luồng cũ)
router.post("/vnpay-order", auth, orderController.createVNPayOrder);

// ✅ [THÊM MỚI] Tạo URL thanh toán VNPay (luồng mới - deep link)
router.post("/create-vnpay-payment",auth,orderController.createVnPayPayment);

// Đặt hàng COD
router.post('/cash-order', auth, orderController.createCashOrder);

// -----------------------------
// Lấy đơn hàng
// -----------------------------

// Lấy đơn hàng của user
router.get('/my-orders', auth, orderController.getMyOrders);

// Lấy tất cả đơn hàng (Admin)
router.get('/admin/orders', authAdmin, orderController.getAllOrders);

// Lấy chi tiết đơn hàng (Admin)
router.get('/admin/orders/:id', authAdmin, orderAdminController.getOrderByIdAdmin);

// Lấy chi tiết đơn hàng (User)
router.get('/:id', auth, orderController.getOrderById);

// -----------------------------
// Cập nhật trạng thái / hủy đơn
// -----------------------------

// Admin cập nhật trạng thái đơn hàng → sẽ tạo Notification
router.put('/:id/status', authAdmin, orderController.updateOrderStatus);

// Hủy đơn hàng (User hủy đơn pending, Admin hủy nhiều trạng thái)
router.put('/:id/cancel', auth, orderController.cancelOrder);

module.exports = router;
