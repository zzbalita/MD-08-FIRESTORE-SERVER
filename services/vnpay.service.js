const crypto = require('crypto');
const moment = require('moment');
const Payment = require('../models/Payment');
const vnpayConfig = require('../config/vnPayConfig');
const mongoose = require('mongoose');

class VNPayService {
  constructor() {
    this._initialized = false;
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
        const { total, ipAddr, order_details, user_id } = paymentData;

        const payment = await Payment.create({
            order_id: new mongoose.Types.ObjectId(), 
            user_id: user_id,
            amount: total,
            paymentType: 'VNPay',
            status: 'pending',
            responseData: { order_details: order_details }
        });

        const date = new Date();
        const createDate = moment(date).format('YYYYMMDDHHmmss');
        const vnpTxnRef = moment(date).format('DDHHmmss'); 
        
        let vnp_Params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': this.vnp_TmnCode,
            'vnp_Locale': 'vn',
            'vnp_CurrCode': 'VND',
            'vnp_TxnRef': vnpTxnRef,
            'vnp_OrderInfo': 'Thanh toan don hang ' + vnpTxnRef, // Có dấu cách
            'vnp_OrderType': 'billpayment',
            'vnp_Amount': total * 100,
            'vnp_ReturnUrl': this.vnp_ReturnUrl,
            'vnp_IpAddr': ipAddr || '127.0.0.1',
            'vnp_CreateDate': createDate
        };

        // 1. Sắp xếp key
        const sortedKeys = Object.keys(vnp_Params).sort();
        
        // 2. Tạo chuỗi signData (Để băm)
        let signData = "";
        for (let i = 0; i < sortedKeys.length; i++) {
            let key = sortedKeys[i];
            let value = vnp_Params[key];
            if (i > 0) signData += "&";
            
            // DÙNG encodeURIComponent VÀ thay %20 bằng dấu + (Chuẩn VNPay 2.1.0)
            signData += encodeURIComponent(key) + "=" + encodeURIComponent(value).replace(/%20/g, "+");
        }

        // 3. Băm HMAC-SHA512
        const hmac = crypto.createHmac("sha512", this.vnp_HashSecret);
        const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        // 4. URL cuối cùng (Dùng chính cái signData đã tạo làm query)
        const paymentUrl = `${this.vnp_Url}?${signData}&vnp_SecureHash=${secureHash}`;

        await Payment.findByIdAndUpdate(payment._id, { transactionRef: vnpTxnRef });
        
        console.log("✅ [CHUẨN SIGN DATA]:", signData); 
        return { success: true, paymentUrl };
    } catch (error) {
        console.error('❌ VNPay Service Error:', error);
        return { success: false, message: error.message };
    }
  }
}

module.exports = new VNPayService();