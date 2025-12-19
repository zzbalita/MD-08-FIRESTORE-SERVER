const crypto = require('crypto');
const moment = require('moment');
const querystring = require('qs');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const vnpayConfig = require('../config/vnPayConfig');

class VNPayService {
  constructor() {
    this._initialized = false;
    this.vnp_TmnCode = null;
    this.vnp_HashSecret = null;
    this.vnp_Url = null;
    this.vnp_ReturnUrl = null;
  }

  _ensureInitialized() {
    if (this._initialized) return;
    this.vnp_TmnCode = vnpayConfig.VNP_TMN_CODE;
    this.vnp_HashSecret = vnpayConfig.VNP_HASH_SECRET;
    this.vnp_Url = vnpayConfig.VNP_URL;
    this.vnp_ReturnUrl = vnpayConfig.VNP_RETURN_URL;
    this._initialized = true;
  }

  createPaymentUrl = async (paymentData) => {
    this._ensureInitialized();
    try {
      const { 
        order_id, 
        total, 
        ipAddr, 
        orderInfo, 
        orderType = 'billpayment', 
        bankCode, 
        language = 'vn' 
      } = paymentData;

      // Tạo payment record
      const payment = await Payment.create({
        order_id,
        user_id: paymentData.user_id,
        amount: total,
        paymentType: 'VNPay',
        status: 'pending'
      });

      const date = new Date();
      const createDate = moment(date).format('YYYYMMDDHHmmss');
      const vnpTxnRef = `VNP${order_id}${moment(date).format("HHmmss")}`;
      
      let vnp_Params = {};
      vnp_Params['vnp_Version'] = '2.1.0';
      vnp_Params['vnp_Command'] = 'pay';
      vnp_Params['vnp_TmnCode'] = this.vnp_TmnCode;
      vnp_Params['vnp_Locale'] = language;
      vnp_Params['vnp_CurrCode'] = 'VND';
      vnp_Params['vnp_TxnRef'] = vnpTxnRef;
      vnp_Params['vnp_OrderInfo'] = orderInfo || "Thanh toan don hang " + order_id;
      vnp_Params['vnp_OrderType'] = orderType;
      vnp_Params['vnp_Amount'] = total * 100;
      vnp_Params['vnp_ReturnUrl'] = this.vnp_ReturnUrl;
      vnp_Params['vnp_IpAddr'] = ipAddr ? ipAddr.replace('::ffff:', '') : '127.0.0.1';
      vnp_Params['vnp_CreateDate'] = createDate;

      // Chỉ thêm vnp_BankCode nếu thực sự có giá trị (tránh bị undefined)
      if (bankCode && bankCode !== '' && bankCode !== 'undefined') {
          vnp_Params['vnp_BankCode'] = bankCode;
      }

// 1. Sắp xếp và encode chuẩn VNPay
const sortedParams = this.sortObject(vnp_Params);

// 2. Tạo chuỗi ký (Sign Data)
// Lưu ý: Vì sortedParams đã được encode ở hàm sortObject, nên ở đây dùng encode: false
const signData = querystring.stringify(sortedParams, { encode: false });

// 3. Tạo Secure Hash
const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 

// 4. Tạo URL cuối cùng
const paymentUrl = `${this.vnp_Url}?${signData}&vnp_SecureHash=${secureHash}`;

console.log('✅ VNPay URL Success:', paymentUrl);

      await Payment.findByIdAndUpdate(payment._id, { transactionRef: vnpTxnRef });
      
      return { success: true, paymentUrl };
    } catch (error) {
      console.error('❌ VNPay Error:', error);
      return { success: false, message: error.message };
    }
  }

  verifyReturnUrl = (vnpParams) => {
    this._ensureInitialized();
    try {
      const secureHash = vnpParams['vnp_SecureHash'];
      delete vnpParams['vnp_SecureHash'];
      delete vnpParams['vnp_SecureHashType'];

      const sorted = this.sortObject(vnpParams);
      const signData = querystring.stringify(sorted, { encode: false });
      const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

      return {
        isValid: secureHash === signed,
        isSuccessful: vnpParams['vnp_ResponseCode'] === '00'
      };
    } catch (error) {
      return { isValid: false, isSuccessful: false };
    }
  }

  async handleVNPayCallback(callbackData) {
    this._ensureInitialized();
    try {
      const { vnp_TxnRef, vnp_ResponseCode, orderId } = callbackData;
      let order_id = orderId;
      
      const payment = await Payment.findOne({ order_id: order_id, paymentType: "VNPay" });
      if (!payment) return { success: false, message: "Payment not found" };
      if (payment.status === "completed") return { success: true, message: "Already processed" };
        
      if (vnp_ResponseCode === "00") {
        await Payment.findByIdAndUpdate(payment._id, { status: "completed", paymentDate: new Date() });
        await Order.findByIdAndUpdate(order_id, { status: 'processing' });
        return { success: true };
      } else {
        await Payment.findByIdAndUpdate(payment._id, { status: "failed" });
        return { success: false };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // HÀM QUAN TRỌNG: Không tự ý encode bên trong này
  sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      // QUAN TRỌNG: VNPay yêu cầu encode và thay thế %20 thành dấu +
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  }
}

module.exports = new VNPayService();