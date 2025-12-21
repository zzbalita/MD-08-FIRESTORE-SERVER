const vnpayService = require('../services/vnpay.service');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart'); // ⭐ QUAN TRỌNG: Import model Cart

const paymentController = {
  /**
   * Tạo URL thanh toán VNPay cho đơn hàng đã có sẵn
   */
  createPayment: async (req, res) => {
    console.log('🔍 DEBUG req.body:', req.body);
    
    try {
      const { order_id, total, user_id, orderInfo, ipAddr } = req.body;
      
      // Lấy IP của client
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;
      console.log('🌐 DEBUG clientIp:', clientIp);
      
      const paymentData = {
        order_id,
        total,
        orderInfo: orderInfo || `Thanh toan don hang ${order_id}`,
        user_id,
        ipAddr: ipAddr || clientIp || '',
        bankCode: '',
        orderType: 'billpayment',
        language: 'vn'
      };
      
      console.log('📊 DEBUG paymentData:', paymentData);
      
      const result = await vnpayService.createPaymentUrl(paymentData);
      
      console.log('✅ Payment URL Result:', result);
      
      if (result.success) {
        res.json({
          success: true,
          orderId: result.orderId,
          vnpTxnRef: result.vnpTxnRef,
          paymentUrl: result.paymentUrl
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error('❌ Error in createPaymentUrl:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  /**
   * Xử lý return URL từ VNPay (khi user quay về từ trang thanh toán)
   */
  processPaymentReturn: async (req, res) => {
    console.log('🔄 VNPay Return URL called');
    console.log('📋 Query params:', req.query);
    
    try {
      const returnData = req.query;
      if (!returnData || !returnData.vnp_ResponseCode) {
        return res.status(400).send('Dữ liệu không hợp lệ');
      }
      
      const orderId = returnData.orderId; // Hoặc lấy từ vnp_TxnRef tùy logic lưu
      
      console.log('📦 OrderId from URL:', orderId);
      
      // Tìm payment record
      const payment = await Payment.findOne({
        order_id: orderId,
        paymentType: 'VNPay'
      });
      
      if (payment) {
        // Cập nhật payment với return data
        await Payment.findByIdAndUpdate(payment._id, {
          responseData: {
            ...payment.responseData,
            return: returnData,
            returnTime: new Date().toISOString()
          }
        });
        
        // Xử lý return data (check sum)
        returnData.orderId = payment.order_id;
        const handleResult = await vnpayService.handleVNPayCallback(returnData);
        console.log('🔍 Handle result:', handleResult);
        
        if (returnData.vnp_ResponseCode === '00') {
            // ============================================================
            // ⭐ BẮT ĐẦU: CODE XÓA GIỎ HÀNG SAU KHI THANH TOÁN THÀNH CÔNG ⭐
            // ============================================================
            console.log('🚀 [PAYMENT SUCCESS] Bắt đầu quy trình xóa giỏ hàng...');
            
            try {
                // 1. Tìm Order để lấy chính xác User ID
                const orderInfo = await Order.findById(payment.order_id);
                
                if (orderInfo) {
                    // Lấy user_id (kiểm tra cả 2 trường hợp tên biến)
                    const userIdToDelete = orderInfo.user_id || orderInfo.userId;
                    
                    console.log(`👤 Tìm thấy User ID từ đơn hàng: ${userIdToDelete}`);

                    if (userIdToDelete) {
                        // 2. Thực hiện xóa (Thử xóa cả 2 kiểu tên field trong Cart để chắc ăn 100%)
                        const del1 = await Cart.findOneAndDelete({ user_id: userIdToDelete });
                        const del2 = await Cart.findOneAndDelete({ userId: userIdToDelete });
                        
                        if (del1 || del2) {
                             console.log(`🛒 [SUCCESS] ĐÃ XÓA GIỎ HÀNG CỦA USER: ${userIdToDelete}`);
                        } else {
                             console.log(`⚠️ Không tìm thấy giỏ hàng của User ${userIdToDelete} (Có thể đã xóa trước đó)`);
                        }
                    } else {
                        console.log('⚠️ Không tìm thấy user_id trong bảng Order');
                    }
                } else {
                    console.log('⚠️ Không tìm thấy Order tương ứng để xóa giỏ hàng');
                }
            } catch (cartError) {
                console.error('❌ Lỗi ngoại lệ khi xóa giỏ hàng:', cartError);
            }
            // ============================================================
            // ⭐ KẾT THÚC CODE XÓA GIỎ HÀNG ⭐
            // ============================================================

          return res.send(`
            <html>
              <head>
                <title>Thanh toán thành công</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                  .success { color: #27ae60; }
                  .message { margin: 20px 0; }
                </style>
              </head>
              <body>
                <h2 class="success">✓ Thanh toán thành công!</h2>
                <div class="message">
                  <p>Đơn hàng đã được thanh toán.</p>
                  <p>Vui lòng quay lại ứng dụng.</p>
                </div>
                <script>setTimeout(() => { window.close(); }, 3000);</script>
              </body>
            </html>
          `);
        } else {
          return res.send(`
            <html>
              <head><title>Thanh toán thất bại</title></head>
              <body><h2 style="color:red">✗ Thanh toán thất bại</h2></body>
            </html>
          `);
        }
      } else {
        return res.send('Không tìm thấy đơn hàng');
      }
    } catch (error) {
      console.error('❌ Error in processPaymentReturn:', error);
      return res.status(500).send('Lỗi máy chủ');
    }
  },

  verifyPayment: (req, res) => {
    try {
      const vnpParams = req.query;
      if (!vnpParams || Object.keys(vnpParams).length === 0) {
        return res.status(400).json({ success: false, message: 'No payment data' });
      }
      const result = vnpayService.verifyReturnUrl(vnpParams);
      return res.status(200).json({
        ...vnpParams,
        success: result.isValid && result.isSuccessful
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Error' });
    }
  },

  processIpn: (req, res) => {
    try {
      const ipnData = req.query;
      const result = vnpayService.processIpn(ipnData);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ RspCode: '99', Message: 'Unknown error' });
    }
  },

  handleCallback: async (req, res) => {
    console.log('🔄 VNPay Callback called');
    try {
        const callbackData = req.query;
        // ... (Giữ nguyên logic callback cũ của bạn nếu cần thiết) ...
        // Lưu ý: Callback thường dùng cho IPN (server gọi server), 
        // còn processPaymentReturn dùng cho Browser redirect.
        // Nếu bạn muốn xóa giỏ hàng cả ở đây thì copy đoạn code xóa giỏ hàng bên trên bỏ vào đây.
        
        return res.status(200).json({ success: true, message: 'Callback received' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false });
    }
  },

  checkPaymentStatus: async (req, res) => {
    try {
      const { orderId } = req.params;
      const payment = await Payment.findOne({ order_id: orderId, paymentType: 'VNPay' });
      if (!payment) return res.status(404).json({ success: false });
      return res.status(200).json({ success: true, payment });
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  }
};

module.exports = paymentController;