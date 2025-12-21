module.exports = {
  // Gán cứng giá trị để loại bỏ hoàn toàn việc đọc sai từ file .env
  VNP_TMN_CODE: 'A9RIOAAB',
  VNP_HASH_SECRET: '01G10T2J0SPRK3SNEZUMOARQ07FWQ3VR',
  VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  
  // Return URL quan trọng để VNPay gửi kết quả về App
  VNP_RETURN_URL: 'http://172.20.10.3:5001/api/payments/vnpay-return',

  VNP_IPN_URL: 'http://172.20.10.3:5001/api/payments/vnpay-ipn',
  VNP_CALLBACK_URL: 'http://172.20.10.3:5001/api/payments/handle-callback',
  
  IS_SANDBOX: true,
  PAYMENT_TIMEOUT: 5 * 60 * 1000,
  MAX_RETRY_COUNT: 30,
  CHECK_INTERVAL: 10 * 1000
};