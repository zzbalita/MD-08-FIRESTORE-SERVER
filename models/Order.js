const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      name: String,
      image: String,
      size: String,
      color: String,
      quantity: Number,
      price: Number,
    }
  ],

  address: {
    full_name: String,
    phone_number: String,
    province: String,
    district: String,
    ward: String,
    street: String
  },

  shipping_fee: { type: Number, required: true },
  payment_method: { type: String, enum: ['cash', 'momo', 'vnpay'], required: true },
  total_amount: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      'pending',           // Chờ xác nhận
      'payment_verified',  // Đã xác nhận thanh toán
      'confirmed',         // Đã xác nhận đơn hàng
      'processing',        // Đang xử lý
      'packing',           // Đang đóng gói
      'ready_to_ship',     // Sẵn sàng giao hàng
      'picked_up',         // Đã lấy hàng
      'in_transit',        // Đang vận chuyển
      'out_for_delivery',  // Đang giao hàng
      'delivered',         // Đã giao hàng
      'completed',         // Hoàn thành
      'return_requested',  // Yêu cầu trả hàng
      'returning',         // Đang trả hàng
      'returned',          // Đã trả hàng
      'refund_pending',    // Chờ hoàn tiền
      'refunded',          // Đã hoàn tiền
      'cancelled'          // Đã hủy
    ],
    default: 'pending'
  }
  ,

  payment_info: {
    transaction_id: String,
    pay_type: String,
    momo_response: Object
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);
