module.exports = {
  VNP_TMN_CODE: 'FZOEKU8X',
  VNP_HASH_SECRET: '6VMKOYY9616I0V9NOMKK6IA03TDRJRR6',
  VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  
  // Dùng link ngrok cho tất cả (đã xóa khoảng trắng thừa)
  VNP_RETURN_URL: 'https://tinisha-nonwashable-castiel.ngrok-free.dev/api/payments/vnpay-return',
  VNP_IPN_URL: 'https://tinisha-nonwashable-castiel.ngrok-free.dev/api/payments/vnpay-ipn',
  
  IS_SANDBOX: true,
  PAYMENT_TIMEOUT: 5 * 60 * 1000,
  MAX_RETRY_COUNT: 30,
  CHECK_INTERVAL: 10 * 1000
};