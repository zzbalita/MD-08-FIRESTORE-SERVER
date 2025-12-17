const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const authAdmin = require("../middlewares/authAdmin");
const authAdminOrStaff = require("../middlewares/authAdminOrStaff");
const orderController = require('../controllers/order.controller');

// Đặt hàng VNPay
router.post("/vnpay-order", auth, orderController.createVNPayOrder);

// Đặt hàng COD
router.post('/cash-order', auth, orderController.createCashOrder);

// Lấy đơn hàng của user
router.get('/my-orders', auth, orderController.getMyOrders);

// Lấy danh sách tất cả đơn hàng cho admin/staff
router.get('/admin/orders', authAdminOrStaff, orderController.getAllOrders);

// Lấy chi tiết đơn hàng
router.get('/:id', auth, orderController.getOrderById);

// Admin/Staff cập nhật trạng thái đơn hàng
router.put('/:id/status', authAdminOrStaff, orderController.updateOrderStatus);

// Hủy đơn hàng (User chỉ hủy được đơn của mình khi pending, Admin/Staff hủy được nhiều trạng thái hơn)
router.put('/:id/cancel', auth, orderController.cancelOrder);



module.exports = router;
