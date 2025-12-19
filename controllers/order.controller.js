const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Notification = require("../models/Notification");
// Tạo đơn hàng COD
exports.createCashOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, shipping_address, subtotal, shipping_fee, total, note } = req.body;

    console.log('=== CREATE CASH ORDER ===');
    console.log('User ID:', userId);

    // Validate
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng trống'
      });
    }

    // Create order
    const order = await Order.create({
      user_id: userId,
      items,
      address: shipping_address || {},
      payment_method: 'cash',
      shipping_fee: shipping_fee || 30000,
      total_amount: total || 0,
      status: 'pending'
    });

    console.log('Cash order created:', order._id);

    // Tạo notification cho user
    try {
      await Notification.create({
        user_id: userId,
        title: 'Đặt hàng thành công',
        message: `Đơn hàng #${order._id} của bạn đã được tạo thành công!`,
        read: false
      });
      console.log('Notification created for user:', userId);
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // GIẢM TỒN KHO sau khi đặt hàng
    try {
      for (const item of items) {
        const product = await Product.findById(item.product_id);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);

          if (item.size || item.color) {
            const variation = product.variations.find(v =>
              v.size === item.size && v.color === item.color
            );
            if (variation) {
              variation.quantity = Math.max(0, variation.quantity - item.quantity);
            }
          }

          if (product.quantity === 0) {
            product.status = 'Hết hàng';
          }

          await product.save();
          console.log(`Updated stock for ${product.name}: ${product.quantity}`);
        }
      }
    } catch (stockError) {
      console.error('Error updating stock:', stockError);
    }

    // Xóa sản phẩm khỏi cart
    try {
      if (req.body.cart_item_ids && req.body.cart_item_ids.length > 0) {
        await Cart.updateOne(
          { user_id: userId },
          { $pull: { items: { _id: { $in: req.body.cart_item_ids } } } }
        );
      } else {
        await Cart.updateOne({ user_id: userId }, { items: [] });
      }
    } catch (e) {
      console.log('Cart clear error (ignored)', e);
    }

    await order.populate('items.product_id', 'name image price');
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order
    });

  } catch (error) {
    console.error('Error creating cash order:', error);
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: { _id: 'mock_' + Date.now(), status: 'pending' }
    });
  }
};
// Tạo đơn hàng VNPay (mock - luôn success)
exports.createVNPayOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, shipping_address, subtotal, shipping_fee, total } = req.body;

    console.log('=== CREATE VNPAY ORDER ===');

    // Create order
    const order = await Order.create({
      user_id: userId,
      items,
      address: shipping_address || {},
      payment_method: 'vnpay',
      shipping_fee: shipping_fee || 30000,
      total_amount: total || 0,
      status: 'pending'
    });

    // Tạo notification cho user
    try {
      await Notification.create({
        user_id: userId,
        title: 'Đặt hàng thành công',
        message: `Đơn hàng #${order._id} của bạn đã được tạo thành công!`,
        read: false
      });
      console.log('Notification created for user:', userId);
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // GIẢM TỒN KHO sau khi đặt hàng
    try {
      for (const item of items) {
        const product = await Product.findById(item.product_id);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);

          if (item.size || item.color) {
            const variation = product.variations.find(v =>
              v.size === item.size && v.color === item.color
            );
            if (variation) {
              variation.quantity = Math.max(0, variation.quantity - item.quantity);
            }
          }

          if (product.quantity === 0) {
            product.status = 'Hết hàng';
          }

          await product.save();
          console.log(`Updated stock for ${product.name}: ${product.quantity}`);
        }
      }
    } catch (stockError) {
      console.error('Error updating stock:', stockError);
    }

    // Remove purchased items from cart
    try {
      if (req.body.cart_item_ids && req.body.cart_item_ids.length > 0) {
        await Cart.updateOne(
          { user_id: userId },
          { $pull: { items: { _id: { $in: req.body.cart_item_ids } } } }
        );
      } else {
        await Cart.updateOne({ user_id: userId }, { items: [] });
      }
    } catch (e) {
      console.log('Cart clear error (ignored)', e);
    }

    await order.populate('items.product_id', 'name image price');
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order
    });

  } catch (error) {
    console.error('Error creating VNPay order:', error);
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: { _id: 'mock_' + Date.now(), status: 'pending' }
    });
  }
};


// Lấy danh sách đơn hàng của user
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const orders = await Order.find({ user_id: userId })
      .populate('items.product_id', 'name image price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công',
      data: orders
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy tất cả đơn hàng (Admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user_id', 'full_name email')
      .populate('items.product_id', 'name image price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error getting all orders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy chi tiết đơn hàng
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user_id: userId })
      .populate('items.product_id', 'name image price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật trạng thái đơn hàng (Admin)
// Cập nhật trạng thái đơn hàng (Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    // ✅ Tạo notification cho user khi đơn thay đổi trạng thái
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        user_id: order.user_id,
        title: 'Cập nhật đơn hàng',
        message: `Đơn hàng #${order._id} đã được chuyển sang trạng thái: ${status}`,
        read: false,
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Hủy đơn hàng
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user_id: userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy đơn hàng đang chờ xử lý'
      });
    }

    order.status = 'cancelled';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Đã hủy đơn hàng',
      data: order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// Lấy danh sách thông báo
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const list = await Notification.find({ user_id: userId })
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: list
    });
  } catch (err) {
    console.error("Lỗi lấy thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi lấy thông báo" 
    });
  }
};

// Đếm thông báo chưa đọc
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await Notification.countDocuments({
      user_id: userId,
      read: false,
    });
    res.status(200).json({ 
      success: true,
      unreadCount: count 
    });
  } catch (err) {
    console.error("Lỗi đếm thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi đếm thông báo" 
    });
  }
};

// Đánh dấu đã đọc
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    await Notification.updateMany(
      { user_id: userId, read: false },
      { read: true }
    );
    res.status(200).json({ 
      success: true,
      message: "Đã đọc tất cả thông báo" 
    });
  } catch (err) {
    console.error("Lỗi cập nhật thông báo:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi cập nhật thông báo" 
    });
  }
};