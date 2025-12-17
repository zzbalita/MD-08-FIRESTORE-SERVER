const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require("../models/Notification");
const Cart = require('../models/Cart'); // ⭐ ĐÃ THÊM: Import Cart Model


exports.createCashOrder = async (req, res) => {
  try {
    // Log dữ liệu để chẩn đoán
    console.log('Dữ liệu Body nhận được (createCashOrder):', JSON.stringify(req.body, null, 2));

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

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Danh sách sản phẩm không hợp lệ.' });
    }

    for (const item of items) {
      const product_id = item.product_id?.["_id"] || item.product_id; 

      const { color, size, quantity, price } = item;
      
      if (!product_id || !color || !size || !quantity || !price) {
        console.error('LỖI DỮ LIỆU SẢN PHẨM (400): Sản phẩm thiếu trường.', item);
        return res.status(400).json({
          message: 'Mỗi sản phẩm phải có đủ: product_id (string), color, size, quantity, price.',
          item_error: item
        });
      }

      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ message: `Không tìm thấy sản phẩm.` });
      }

      const variant = product.variations.find(
        (v) => v.color === color && v.size === size
      );

      if (!variant || variant.quantity < quantity) {
        return res.status(400).json({
          message: `Sản phẩm ${product.name} (${color} - ${size}) không đủ hàng trong kho. Còn lại: ${variant?.quantity || 0}`
        });
      }
    }

    if (
      !address ||
      !address.fullName ||
      !address.phone ||
      !address.province ||
      !address.district ||
      !address.ward ||
      !address.street
    ) {
      return res.status(400).json({ message: 'Địa chỉ giao hàng không đầy đủ (cần: fullName, phone, province, district, ward, street).' });
    }

    if (typeof shipping_fee !== 'number' || typeof total_amount !== 'number' || total_amount < 0) {
      console.error('LỖI DỮ LIỆU (400): shipping_fee hoặc total_amount không phải là số hợp lệ.', { shipping_fee, total_amount });
      return res.status(400).json({ message: 'shipping_fee và total_amount phải là số (number) hợp lệ.' });
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

    // ⭐ BƯỚC MỚI VÀ QUAN TRỌNG: XÓA/LÀM RỖNG GIỎ HÀNG SAU KHI TẠO ĐƠN THÀNH CÔNG
    try {
        // Tìm giỏ hàng theo user_id và đặt mảng items về rỗng
        await Cart.findOneAndUpdate(
            { user_id: user_id },
            { $set: { items: [] } }, 
            { new: true } 
        );
        console.log(`✅ Giỏ hàng của người dùng ${user_id} đã được làm rỗng.`);
    } catch (cartError) {
        // Log lỗi nhưng không chặn việc trả về đơn hàng đã tạo
        console.error('LỖI: Không thể làm rỗng giỏ hàng sau khi tạo đơn.', cartError);
    }
    // ⭐ KẾT THÚC BƯỚC MỚI

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Lỗi khi tạo đơn hàng thanh toán tiền mặt:', error);
    res.status(500).json({ message: 'Tạo đơn hàng thất bại.' });
  }
};


// Lấy danh sách đơn hàng của chính người dùng
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy tên và ảnh từ Product Model
    const orders = await Order.find({ user_id: userId })
      .populate('items.product_id', 'name image') 
      .sort({ createdAt: -1 })
      .lean(); 

    // SỬA LỖI ẢNH VÀ GIÁ: Xử lý dữ liệu đã populate để Client Android dễ đọc
    const formattedOrders = orders.map(order => {
        const processedItems = order.items.map(item => {
            const populatedProduct = item.product_id; 
            
            const imagePath = populatedProduct?.image || ''; 

            // Cập nhật item để Android Adapter có thể đọc được productName và imageUrl
            return {
                ...item,
                productName: populatedProduct ? populatedProduct.name : 'Sản phẩm không tồn tại',
                imageUrl: imagePath, 
                unitPrice: item.price || 0,
            };
        });
        return {
            ...order,
            items: processedItems, // Thay thế items thô bằng items đã được xử lý
        };
    });

    res.status(200).json(formattedOrders); // Trả về dữ liệu đã được xử lý
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đơn hàng:", error);
    res.status(500).json({ message: "Không thể lấy danh sách đơn hàng." });
  }
};
//chi tiết đơn hàng
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
.populate('user_id', 'full_name email')
      .populate('items.product_id', 'name image price');


    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // Chỉ admin hoặc chính chủ mới xem được
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && order.user_id._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này.' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết đơn hàng:', error);
    res.status(500).json({ message: 'Không thể lấy chi tiết đơn hàng.' });
  }
};

// Cập nhật trạng thái
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    // THÊM POPULATE: Cần populate để lấy image path cho Notification/WebSocket
    const order = await Order.findById(id).populate('items.product_id', 'image'); 
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const currentStatus = order.status;

    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipping', 'cancelled'],
      shipping: ['delivered'],
    };

    if (['delivered', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({ message: "Đơn hàng đã hoàn tất hoặc đã bị hủy, không thể cập nhật." });
    }

    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      return res.status(400).json({
        message: `Không thể chuyển trạng thái từ "${currentStatus}" sang "${newStatus}". Trạng thái hợp lệ tiếp theo: ${allowedNextStatuses.join(', ')}.`
      });
    }

    // Trừ kho khi chuyển sang "confirmed"
    if (currentStatus === 'pending' && newStatus === 'confirmed') {
      const Product = require('../models/Product');

      for (const item of order.items) {
        const product = await Product.findById(item.product_id);
        if (!product) continue;

        const variant = product.variations.find(
          (v) => v.color === item.color && v.size === item.size
        );

        if (!variant || variant.quantity < item.quantity) {
          return res.status(400).json({ message: `Sản phẩm ${item.name} không đủ hàng.` });
        }

        variant.quantity -= item.quantity;
        product.quantity -= item.quantity;
        await product.save();
      }
    }

    order.status = newStatus;
    await order.save();

    // Lấy image path đã được populate
    const productImagePath = order.items[0]?.product_id?.image || null;

    // Gửi WebSocket cập nhật
    const io = req.app.get("io");
    if (io) {
console.log("📢 Emit orderStatusUpdated cho user:", order.user_id.toString());
      io.to(order.user_id.toString()).emit("orderStatusUpdated", {
        orderId: order._id,
        newStatus: order.status,
        updatedAt: order.updatedAt,
        // ĐÃ SỬA: Lấy ảnh từ product_id.image
        image: productImagePath, 
        productName: order.items[0]?.name || "",
      });
    }
    await Notification.create({
      user_id: order.user_id,
      type: "order",
      title: "Cập nhật đơn hàng",
      message: `Đơn hàng #${order._id.toString().slice(-6)} đã chuyển sang trạng thái: ${order.status}`,
      order_id: order._id,
      // ĐÃ SỬA: Lấy ảnh từ product_id.image
      image: productImagePath, 
      productName: order.items[0]?.name || "",
      read: false,
    });

    res.status(200).json({
      message: "Cập nhật trạng thái đơn hàng thành công.",
      order
    });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
    res.status(500).json({ message: "Cập nhật thất bại." });
  }
};


// Lấy danh sách tất cả đơn hàng (dành cho admin)
exports.getAllOrders = async (req, res) => {
  try {
    const { status, sort } = req.query;

    const filter = {};

    // Lọc theo status nếu có
    if (status && ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    // Xác định hướng sắp xếp
    const sortOption = sort === 'asc' ? 1 : -1;

    console.log(' Đang lấy danh sách đơn hàng với filter:', filter);

    const orders = await Order.find(filter)
      .populate('user_id', 'full_name email') // Lấy tên/email khách hàng
      .populate('items.product_id', 'name')   // lấy tên sản phẩm
      .sort({ createdAt: sortOption })
      .lean();

    console.log(` Đã tìm được ${orders.length} đơn hàng.`);
    res.status(200).json(orders);
  } catch (error) {
    console.error(' Lỗi khi lấy danh sách đơn hàng admin:', error);
    res.status(500).json({ message: 'Không thể tải danh sách đơn hàng.' });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // THÊM POPULATE: Cần populate để lấy image path cho Notification/WebSocket
    const order = await Order.findById(id).populate('items.product_id', 'image');
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    // Không cho hủy nếu đã giao hoặc đã hủy
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: "Đơn hàng không thể hủy." });
    }

    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';

    // Kiểm tra quyền hủy
    if (!isAdmin && order.user_id.toString() !== userId) {
return res.status(403).json({ message: "Bạn không có quyền hủy đơn hàng này." });
    }

    // Người dùng thường chỉ được hủy khi pending
    if (!isAdmin && order.status !== 'pending') {
      return res.status(403).json({ message: "Bạn chỉ có thể hủy đơn hàng khi đang chờ xác nhận." });
    }

    // ===== Cộng lại kho (logic giữ nguyên) =====
    if (isAdmin) {
      if (Array.isArray(order.items)) {
        for (const item of order.items) {
          // Lấy product_id từ item
          const productId = item.product_id?._id || item.product_id; 

          const product = await Product.findById(productId);
          if (product && Array.isArray(product.variations)) {
            const variation = product.variations.find(
              v => v.color === item.color && v.size === item.size
            );

            if (variation) {
              variation.quantity += item.quantity;
            } else {
              console.warn(`Không tìm thấy biến thể: ${item.color}, ${item.size} cho sản phẩm ${productId}`);
            }

            // Chỉ cần save product nếu đã thay đổi variations
            if (variation) await product.save();
          } else {
            console.warn(`Không tìm thấy sản phẩm hoặc variations không hợp lệ: ${productId}`);
          }
        }
      }
    }

    // ===== Cập nhật trạng thái đơn hàng =====
    order.status = 'cancelled';
    await order.save();

    // Lấy image path đã được populate
    const productImagePath = order.items[0]?.product_id?.image || null;

    // ===== Gửi event realtime nếu có =====
    const io = req.app.get("io");
    if (io) {
       console.log("📢 Emit orderStatusUpdated cho user:", order.user_id.toString());
      io.to(order.user_id.toString()).emit("orderStatusUpdated", {
        orderId: order._id,
        newStatus: order.status,
        updatedAt: order.updatedAt,
        // ĐÃ SỬA: Lấy ảnh từ product_id.image
        image: productImagePath,
        productName: order.items[0]?.name || "",
      });
    }
    await Notification.create({
      user_id: order.user_id,
      type: "order",
      title: "Cập nhật đơn hàng",
      message: `Đơn hàng #${order._id.toString().slice(-6)} đã bị hủy.`,
      order_id: order._id,
      // ĐÃ SỬA: Lấy ảnh từ product_id.image
      image: productImagePath, // lấy ảnh sản phẩm đầu tiên
      productName: order.items[0]?.name || "",
      read: false,
    });


    res.status(200).json({
      message: 'Đơn hàng đã được hủy.',
      order
    });
  } catch (error) {
    console.error('Lỗi khi huỷ đơn hàng:', error);
    res.status(500).json({ message: 'Không thể hủy đơn hàng.' });
  }
};



// Thêm function tạo đơn hàng VNPay
exports.createVNPayOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress: address,
shipping_fee,
      paymentMethod: payment_method = 'vnpay', 
      total_amount
    } = req.body;

    const user_id = req.user?.userId;
    if (!user_id) {
      return res.status(401).json({ message: 'Người dùng chưa được xác thực.' });
    }

    // Kiểm tra thông tin đầu vào
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Danh sách sản phẩm không hợp lệ.' });
    }
    
    for (const item of items) {
      const product_id = item.product_id?.["_id"] || item.product_id; 
      const { color, size, quantity, price } = item;
      if (!product_id || !color || !size || !quantity || !price) {
        return res.status(400).json({
          message: 'Mỗi sản phẩm phải có đủ: product_id, color, size, quantity, price.'
        });
      }
    }


    if (
      !address ||
      !address.fullName ||
      !address.phone ||
      !address.province ||
      !address.district ||
      !address.ward ||
      !address.street
    ) {
      return res.status(400).json({ message: 'Địa chỉ giao hàng không đầy đủ (cần: fullName, phone, province, district, ward, street).' });
    }

    if (typeof shipping_fee !== 'number' || typeof total_amount !== 'number' || total_amount < 0) {
      return res.status(400).json({ message: 'shipping_fee và total_amount phải là số (number) hợp lệ.' });
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


    // Tạo đơn hàng với payment_method = 'vnpay'
    const order = new Order({
      user_id,
      items: dbItems,
      address: dbAddress,
      shipping_fee,
      payment_method: 'vnpay', // Luôn là vnpay cho hàm này
      total_amount,
      status: 'pending',
      payment_info: {}
    });

    const savedOrder = await order.save();

    // ⭐ BỔ SUNG: Xóa giỏ hàng sau khi tạo đơn VNPay
    // Tuy nhiên, nếu bạn xử lý thanh toán VNPay sau, có thể giữ giỏ hàng cho đến khi giao dịch thành công.
    // Nếu bạn quyết định xóa luôn, hãy thêm logic này:
     /*
     try {
        await Cart.findOneAndUpdate(
            { user_id: user_id },
            { $set: { items: [] } }, 
            { new: true } 
        );
        console.log(`✅ Giỏ hàng của người dùng ${user_id} đã được làm rỗng sau khi tạo đơn VNPay.`);
     } catch (cartError) {
         console.error('LỖI: Không thể làm rỗng giỏ hàng sau khi tạo đơn VNPay.', cartError);
     }
     */


    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Lỗi khi tạo đơn hàng VNPay:', error);
res.status(500).json({ message: 'Tạo đơn hàng thất bại.' });
  }
};
// Đảm bảo createOrder gọi đúng hàm tạo đơn COD
exports.createOrder = exports.createCashOrder;