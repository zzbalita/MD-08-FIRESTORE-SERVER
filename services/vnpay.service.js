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
        // Tạo vnpTxnRef duy nhất (tối đa 15 ký tự theo yêu cầu VNPay)
        // Format: YYYYMMDDHHmmss (14 ký tự) + 1 số random (1 ký tự) = 15 ký tự
        const timestamp = moment(date).format('YYYYMMDDHHmmss');
        const randomSuffix = Math.floor(Math.random() * 10).toString();
        const vnpTxnRef = timestamp + randomSuffix; // Tổng cộng 15 ký tự 
        
        let vnp_Params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': this.vnp_TmnCode,
            'vnp_Locale': 'vn',
            'vnp_CurrCode': 'VND',
            'vnp_TxnRef': vnpTxnRef,
            'vnp_OrderInfo': 'Thanh toan don hang ' + vnpTxnRef, // Có dấu cách - VNPay chấp nhận
            'vnp_OrderType': 'billpayment',
            'vnp_Amount': total * 100,
            'vnp_ReturnUrl': this.vnp_ReturnUrl,
            'vnp_IpAddr': ipAddr || '127.0.0.1',
            'vnp_CreateDate': createDate
        };

        // 1. Sắp xếp key theo alphabet (theo chuẩn VNPay)
        const sortedKeys = Object.keys(vnp_Params).sort();
        
        // 2. Tạo chuỗi signData (Để băm) - Theo chuẩn VNPay 2.1.0
        // VNPay yêu cầu: KHÔNG encode key, CHỈ encode value và thay %20 bằng + (QUAN TRỌNG!)
        let signData = "";
        for (let i = 0; i < sortedKeys.length; i++) {
            let key = sortedKeys[i];
            let value = vnp_Params[key];
            if (i > 0) signData += "&";
            
            // KHÔNG encode key - chỉ dùng key gốc
            // ENCODE value bằng encodeURIComponent và thay %20 bằng + (theo yêu cầu VNPay)
            const encodedValue = encodeURIComponent(String(value)).replace(/%20/g, "+");
            
            signData += key + "=" + encodedValue;
        }

        // 3. Băm HMAC-SHA512 với secret key
        // QUAN TRỌNG: Dùng Buffer để đảm bảo encoding đúng
        const hmac = crypto.createHmac("sha512", Buffer.from(this.vnp_HashSecret, 'utf-8'));
        const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        // 4. Tạo query string cho URL - Encode đầy đủ theo chuẩn URL (cả key và value)
        // KHÁC với Sign Data: URL cần encode đầy đủ để tránh lỗi khi parse
        const queryString = sortedKeys.map(key => {
            return encodeURIComponent(key) + "=" + encodeURIComponent(String(vnp_Params[key]));
        }).join("&");
        
        // 5. Tạo URL cuối cùng
        const paymentUrl = `${this.vnp_Url}?${queryString}&vnp_SecureHash=${secureHash}`;

        await Payment.findByIdAndUpdate(payment._id, { transactionRef: vnpTxnRef });
        
        // Log chi tiết để debug
        console.log("📋 [VNPay Params]:", JSON.stringify(vnp_Params, null, 2));
        console.log("📋 [VNPay Sorted Keys]:", sortedKeys);
        console.log("📋 [VNPay Sign Data (KHÔNG encode key, ENCODE value, thay %20 thành +)]:", signData);
        console.log("📋 [VNPay Hash Secret Length]:", this.vnp_HashSecret.length);
        console.log("📋 [VNPay Secure Hash]:", secureHash);
        console.log("📋 [VNPay Query String (có encode)]:", queryString.substring(0, 150) + "...");
        console.log("📋 [VNPay Full URL]:", paymentUrl.substring(0, 200) + "...");
        
        return { success: true, paymentUrl };
    } catch (error) {
        console.error('❌ VNPay Service Error:', error);
        return { success: false, message: error.message };
    }
  }
}

module.exports = new VNPayService();