const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require("../models/Notification");
const Cart = require('../models/Cart');
const vnpayService = require('../services/vnpay.service');
// Import hàm gửi socket đã viết ở notification.controller
const { createAndSendNotification } = require("./notification.controller");
const {
  ORDER_STATUSES,
  STATUS_LABELS,
  isValidOrderStatus,
  canTransition,
} = require("../config/orderStatuses");

// ==========================================
// 1. TẠO ĐƠN HÀNG THANH TOÁN TIỀN MẶT (COD)
// ==========================================
exports.createCashOrder = async (req, res) => {
    try {
        console.log('--- BẮT ĐẦU TẠO ĐƠN HÀNG COD ---');
        console.log('Dữ liệu Body:', JSON.stringify(req.body, null, 2));

        const {
            items,
            shippingAddress: address, 
            shipping_fee,
            paymentMethod: payment_method = 'cash', 
            total_amount
        } = req.body;

        const user_id = req.user?.userId;
        if (!user_id) {
            return res.status(401).json({ message: 'Người dùng chưa được xác thực.' });
        }

        // Validate danh sách sản phẩm
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Danh sách sản phẩm không hợp lệ.' });
        }

        // Kiểm tra từng sản phẩm và tồn kho
        for (const item of items) {
            const product_id = item.product_id?.["_id"] || item.product_id; 
            const { package: packageName, quantity, price } = item;
            
            if (!product_id || !packageName || !quantity || !price) {
                console.error('LỖI DỮ LIỆU SẢN PHẨM:', item);
                return res.status(400).json({
                    message: 'Mỗi sản phẩm phải có đủ: product_id, package, quantity, price.',
                    item_error: item
                });
            }

            const product = await Product.findById(product_id);
            if (!product) {
                return res.status(404).json({ message: `Không tìm thấy sản phẩm ID: ${product_id}` });
            }

            const variant = product.variations.find((v) => v.package === packageName);

            if (!variant || variant.quantity < quantity) {
                return res.status(400).json({
                    message: `Sản phẩm ${product.name} (${packageName}) không đủ hàng. Còn: ${variant?.quantity || 0}`
                });
            }
        }

        // Validate địa chỉ
        if (!address || !address.fullName || !address.phone || !address.province || 
            !address.district || !address.ward || !address.street) {
            return res.status(400).json({ message: 'Địa chỉ giao hàng không đầy đủ.' });
        }

        if (typeof shipping_fee !== 'number' || typeof total_amount !== 'number') {
            return res.status(400).json({ message: 'Phí ship và Tổng tiền phải là số.' });
        }

        const dbAddress = {
            full_name: address.fullName,
            phone_number: address.phone,
            province: address.province,
            district: address.district,
            ward: address.ward,
            street: address.street
        };
        
        const dbItems = items.map(item => ({
            ...item,
            product_id: item.product_id?.["_id"] || item.product_id,
        }));

        const order = new Order({
            user_id,
            items: dbItems, 
            address: dbAddress, 
            shipping_fee,
            payment_method,
            total_amount,
            status: 'pending',
            payment_info: {}
        });

        const savedOrder = await order.save();
        console.log('✅ Đã lưu đơn hàng thành công:', savedOrder._id);

        
// --- CHỈ SỬA ĐOẠN NÀY ĐỂ LẤY ẢNH TỪ DATABASE ---
const firstProduct = await Product.findById(items[0].product_id?.["_id"] || items[0].product_id);
const productImage = firstProduct ? firstProduct.image : "";

// ⭐ GỬI THÔNG BÁO REAL-TIME CHO USER
await createAndSendNotification(req.app, user_id, {
    type: "order",
    title: "Đặt hàng thành công",
    message: `Đơn hàng #${savedOrder._id.toString().slice(-6)} đang chờ xác nhận.`,
    order_id: savedOrder._id,
    image: productImage // <--- Thay items[0]?.imageUrl bằng productImage vừa lấy ở trên
});

        // LÀM RỖNG GIỎ HÀNG
        try {
            await Cart.findOneAndUpdate(
                { user_id: user_id },
                { $set: { items: [] } }
            );
            console.log(`✅ Giỏ hàng của user ${user_id} đã được dọn sạch.`);
        } catch (cartError) {
            console.error('LỖI khi xóa giỏ hàng:', cartError);
        }

        res.status(201).json(savedOrder);
    } catch (error) {
        console.error('Lỗi createCashOrder:', error);
        res.status(500).json({ message: 'Tạo đơn hàng thất bại.' });
    }
};

// ==========================================
// 2. LẤY DANH SÁCH ĐƠN HÀNG CỦA USER (CÓ LỌC)
// ==========================================
exports.getMyOrders = async (req, res) => {
    try {
        const userId = req.user.userId;
        const statusFilter = req.query.status;
        const filter = { user_id: userId };
        
        if (statusFilter && ORDER_STATUSES.includes(statusFilter)) {
            filter.status = statusFilter;
            console.log(`🔍 Lọc trạng thái: ${statusFilter}`);
        }

        const orders = await Order.find(filter)
            .populate('items.product_id', 'name image price')
            .sort({ createdAt: -1 })
            .lean();

        const formattedOrders = orders.map(order => {
            const processedItems = order.items.map(item => {
                const populatedProduct = item.product_id;
                return {
                    ...item,
                    productName: populatedProduct ? populatedProduct.name : 'Sản phẩm đã xóa', 
                    imageUrl: populatedProduct?.image || '',
                    unitPrice: item.price || populatedProduct?.price || 0,
                };
            });
            return { ...order, items: processedItems };
        });

        res.status(200).json(formattedOrders);
    } catch (error) {
        console.error("Lỗi getMyOrders:", error);
        res.status(500).json({ message: "Lỗi Server." });
    }
};

// ==========================================
// 3. CHI TIẾT ĐƠN HÀNG
// ==========================================
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user_id', 'full_name phone_number')
            .populate('items.product_id', 'name image price')
            .lean();

        if (!order) return res.status(404).json({ message: 'Không tìm thấy.' });

        // Phân quyền xem
        if (req.user.role !== 'admin' && order.user_id._id.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Không có quyền.' });
        }

        const processedItems = order.items.map(item => {
            const prod = item.product_id;
            return {
                ...item,
                productName: prod ? prod.name : 'N/A',
                imageUrl: prod?.image || '',
                unitPrice: item.price || prod?.price || 0,
            };
        });

        res.status(200).json({ ...order, items: processedItems });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi lấy chi tiết.' });
    }
};

// ==========================================
// 4. CẬP NHẬT TRẠNG THÁI (ADMIN)
// ==========================================
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status: newStatus } = req.body;

        const order = await Order.findById(id).populate('items.product_id');
        if (!order) return res.status(404).json({ message: "Không thấy đơn." });

        const currentStatus = order.status;

        if (!isValidOrderStatus(newStatus)) {
            return res.status(400).json({ message: "Trạng thái không hợp lệ." });
        }
        if (!canTransition(currentStatus, newStatus)) {
            return res.status(400).json({
                message: `Không thể chuyển từ "${STATUS_LABELS[currentStatus] || currentStatus}" sang "${STATUS_LABELS[newStatus]}".`,
            });
        }

        // Trừ kho khi Admin chuyển Chờ xác nhận -> Đã xác nhận
        if (currentStatus === 'pending' && newStatus === 'confirmed') {
            for (const item of order.items) {
                const product = await Product.findById(item.product_id);
                if (product) {
                    // Tìm đúng màu và size trong variations
                    const v = product.variations.find((v) => v.package === item.package);
                    
                    if (v) {
                        if (v.quantity < item.quantity) {
                            return res.status(400).json({ 
                                message: `Sản phẩm ${product.name} không đủ tồn kho để xác nhận!` 
                            });
                        }
                        v.quantity -= item.quantity; // TRỪ KHO TẠI ĐÂY
                        
                        // Cập nhật trạng thái tổng (Hết hàng/Còn hàng) dựa trên số lượng mới
                        if (typeof product.updateStatusBasedOnStock === 'function') {
                            product.updateStatusBasedOnStock();
                        }
                        await product.save();
                    }
                }
            }
        }

        order.status = newStatus;
        await order.save();

        const productImage = order.items[0]?.product_id?.image || null;

        // ⭐ THÔNG BÁO CHO KHÁCH HÀNG QUA SOCKET
        await createAndSendNotification(req.app, order.user_id.toString(), {
            type: "order",
            title: "Cập nhật đơn hàng",
            message: `Đơn hàng #${order._id.toString().slice(-6)} đã chuyển sang: ${STATUS_LABELS[newStatus] || newStatus}`,
            order_id: order._id,
            image: productImage
        });

        res.status(200).json({ message: "Thành công", order });
    } catch (error) {
        console.error("Lỗi updateOrderStatus:", error);
        res.status(500).json({ message: "Lỗi." });
    }
};

// ==========================================
// 5. HỦY ĐƠN HÀNG
// ==========================================
exports.cancelOrder = async (req, res) => {
    return res.status(400).json({ message: "Không hỗ trợ hủy đơn hàng." });
};

// ==========================================
// 6. CÁC HÀM CÒN LẠI (ADMIN & VNPAY)
// ==========================================
exports.getAllOrders = async (req, res) => {
    try {
        const { status, sort } = req.query;
        const filter = status ? { status } : {};
        const orders = await Order.find(filter)
            .populate('user_id', 'full_name phone_number')
            .populate('items.product_id', 'name')
            .sort({ createdAt: sort === 'asc' ? 1 : -1 })
            .lean();
        res.status(200).json(orders);
    } catch (err) { res.status(500).json({ message: 'Lỗi.' }); }
};

// File: controllers/order.controller.js

exports.createVNPayOrder = async (req, res) => {
    try {
        const { items, shippingAddress, shipping_fee, total_amount } = req.body;
        const user_id = req.user?.userId;

        // 1. Log để kiểm tra dữ liệu đầu vào
        console.log("Dữ liệu nhận được để tạo link VNPay:", { items, shippingAddress });

        const tempTransactionId = new mongoose.Types.ObjectId();
        const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // 2. PHẢI ĐÓNG GÓI ĐỦ DỮ LIỆU Ở ĐÂY
        const paymentData = {
            order_id: tempTransactionId.toString(), 
            total: total_amount,
            ipAddr: ipAddr,
            user_id: user_id,
            // Đây là phần bị thiếu của bạn:
            order_details: { 
                items, 
                shippingAddress, 
                shipping_fee, 
                total_amount 
            } 
        };

        const vnpayResponse = await vnpayService.createPaymentUrl(paymentData);

        if (vnpayResponse.success) {
            res.status(201).json({
                success: true,
                paymentUrl: vnpayResponse.paymentUrl
            });
        } else {
            res.status(400).json({ success: false, message: "Lỗi tạo link thanh toán" });
        }
    } catch (err) {
        console.error('Lỗi createVNPayOrder:', err);
        res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};

exports.createOrder = exports.createCashOrder;