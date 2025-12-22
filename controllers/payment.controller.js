const mongoose = require('mongoose'); // THÊM DÒNG NÀY
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { createAndSendNotification } = require("./notification.controller");

const createRealOrder = async (app, payment) => { 
    try {
        // Kiểm tra lại một lần nữa để chắc chắn không tạo trùng
        const existingOrder = await Order.findOne({ "payment_info.payment_id": payment._id });
        if (existingOrder) return existingOrder;

        console.log("-----------------------------------------");
        console.log(">>> [BƯỚC 1] Bắt đầu tạo đơn hàng thật từ Payment ID:", payment._id);

        const { items, shippingAddress, shipping_fee, total_amount } = payment.responseData.order_details;

        const processedItems = [];
        for (const item of items) {
            const pId = item.product_id?._id || item.product_id;
            const product = await Product.findById(pId);
            
            if (product) {
                const variant = product.variations.find(v => v.color === item.color && v.size === item.size);
                if (variant) {
                    variant.quantity -= item.quantity;
                    product.quantity -= item.quantity;
                    await product.save();
                }
            }

            processedItems.push({
              product_id: new mongoose.Types.ObjectId(pId),
              color: item.color,
              size: item.size,
              quantity: item.quantity,
              price: item.price,
              image: item.image // <--- PHẢI THÊM DÒNG NÀY ĐỂ LƯU ẢNH VÀO ORDER
          });
        }

        const newOrder = new Order({
            user_id: new mongoose.Types.ObjectId(payment.user_id),
            items: processedItems,
            address: {
                full_name: shippingAddress.fullName || shippingAddress.full_name,
                phone_number: shippingAddress.phone || shippingAddress.phone_number,
                province: shippingAddress.province,
                district: shippingAddress.district,
                ward: shippingAddress.ward,
                street: shippingAddress.street
            },
            shipping_fee: Number(shipping_fee),
            total_amount: Number(total_amount),
            payment_method: 'vnpay',
            status: 'processing',
            payment_info: {
                transaction_ref: payment.transactionRef,
                payment_id: payment._id
            }
        });

        const savedOrder = await newOrder.save();
        console.log("✅ [BƯỚC 3] Đã lưu Order thành công ID:", savedOrder._id);

        // Cập nhật Payment & Giỏ hàng
        await Payment.findByIdAndUpdate(payment._id, { 
            status: 'completed', 
            order_id: savedOrder._id 
        });
        
        await Cart.findOneAndUpdate({ user_id: payment.user_id }, { $set: { items: [] } });

        const io = app.get('io');
        if (io) {
            io.emit('admin:new_order', savedOrder);
            io.to(payment.user_id.toString()).emit('payment:success', { order_id: savedOrder._id });
        }

      
        try {
          // Lấy ảnh từ chính dữ liệu ông đã giải nén ở đầu hàm [BƯỚC 1]
          // payment.responseData.order_details.items là nơi chứa ảnh chuẩn nhất
          let finalImage = "";
          
          if (payment.responseData && payment.responseData.order_details && payment.responseData.order_details.items.length > 0) {
              finalImage = payment.responseData.order_details.items[0].image; 
          }
      
          console.log("=> Link ảnh sản phẩm gửi thông báo:", finalImage);
      
          await createAndSendNotification(app, payment.user_id.toString(), {
              type: "order",
              title: "Thanh toán thành công",
              message: `Đơn hàng #${savedOrder._id.toString().slice(-6)} đã được thanh toán.`,
              order_id: savedOrder._id,
              image: finalImage // Gửi link ảnh này đi
          });
      } catch (e) {
          console.error("Lỗi gửi thông báo:", e.message);
      }
        // === HẾT ĐOẠN SỬA ===

        return savedOrder;
    } catch (error) {
        console.error("❌ LỖI TRONG createRealOrder:", error);
        throw error; // Xóa chữ 'n' thừa ở đây nếu có
    }
};
const paymentController = {
    processPaymentReturn: async (req, res) => {
        try {
            const { vnp_ResponseCode, vnp_TxnRef } = req.query;
            const payment = await Payment.findOne({ transactionRef: vnp_TxnRef });

            if (!payment) return res.send("Không tìm thấy giao dịch.");

            let orderId = payment.order_id;

            if (vnp_ResponseCode === '00') {
              if (payment.status !== 'completed') {
                  const savedOrder = await createRealOrder(req.app, payment);
                  orderId = savedOrder._id;
              }
              
              // TRẢ VỀ HTML CHUẨN (KHÔNG DÙNG myapp:// ĐỂ TRÁNH LỖI WEBVIEW)
              return res.send(`
                  <html>
                      <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1">
                          <style>
                              body { font-family: sans-serif; text-align: center; padding-top: 50px; }
                          </style>
                      </head>
                      <body>
                          <div style="font-size: 50px;">✅</div>
                          <h2>Thanh toán thành công</h2>
                          <p>Đang quay lại FiveStore...</p>
                          <script>
                              // Chỉ cần in log, Android sẽ bắt URL có chứa order_id tự động
                              console.log("Success: ${orderId}");
                          </script>
                      </body>
                  </html>
              `);
          } else {
                return res.send(`
                    <html>
                        <body onload="location.href='myapp://payment_fail'">
                            <div style="text-align:center; padding-top:50px;">
                                <h2>Thanh toán thất bại</h2>
                                <p>Đang quay lại ứng dụng...</p>
                            </div>
                        </body>
                    </html>
                `);
            }
        } catch (error) {
            console.error("Lỗi Return:", error);
            res.status(500).send("Lỗi xử lý đơn hàng.");
        }
    },

    processIpn: async (req, res) => {
      try {
        // TRUY XUẤT ĐÚNG CẤU TRÚC: responseData -> order_details -> items
        const details = payment.responseData.order_details;
        let finalImage = "";
    
        if (details && details.items && details.items.length > 0) {
            finalImage = details.items[0].image; // Lấy ảnh sản phẩm đầu tiên
        }
    
        console.log("=> THỰC TẾ ẢNH SẼ GỬI:", finalImage);
    
        await createAndSendNotification(app, payment.user_id.toString(), {
            type: "order",
            title: "Thanh toán thành công",
            message: `Đơn hàng #${savedOrder._id.toString().slice(-6)} đã được thanh toán.`,
            order_id: savedOrder._id,
            image: finalImage // Nếu cái này có link, nó sẽ không hiện "anh tây" nữa
        });
    } catch (e) {
        console.error("Lỗi gửi thông báo:", e.message);
    }
    }
};

module.exports = paymentController;