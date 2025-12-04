const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const authAdmin = require("../middlewares/authAdmin");
const orderController = require('../controllers/order.controller');
const orderAdminController = require('../controllers/order.admin.controller');

// Đặt hàng VNPay
router.post("/vnpay-order", auth, orderController.createVNPayOrder);

// Đặt hàng COD
router.post('/cash-order', auth, orderController.createCashOrder);

// Lấy đơn hàng của user
router.get('/my-orders', auth, orderController.getMyOrders);

// Lấy danh sách tất cả đơn hàng cho admin
router.get('/admin/orders', authAdmin, orderController.getAllOrders);

// Admin lấy chi tiết đơn hàng (bất kỳ đơn nào)
router.get('/admin/orders/:id', authAdmin, orderAdminController.getOrderByIdAdmin);

// Lấy chi tiết đơn hàng (user chỉ xem đơn của mình)
router.get('/:id', auth, orderController.getOrderById);

// Admin cập nhật trạng thái đơn hàng
router.put('/:id/status', authAdmin, orderController.updateOrderStatus);

// Hủy đơn hàng (User chỉ hủy được đơn của mình khi pending, Admin hủy được nhiều trạng thái hơn)
router.put('/:id/cancel', auth, orderController.cancelOrder);



module.exports = router;
