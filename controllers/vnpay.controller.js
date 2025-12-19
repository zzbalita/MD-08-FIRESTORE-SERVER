const crypto = require("crypto");
const qs = require("qs");

exports.createPayment = (req, res) => {
  const date = new Date();

  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  const vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURN_URL;

  // Ép kiểu amount thành số nguyên
  const rawAmount = req.body.amount;
  const amount = parseInt(rawAmount, 10);

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount không hợp lệ",
      rawAmount
    });
  }

  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: date.getTime().toString(), // mã giao dịch duy nhất
    vnp_OrderInfo: "Thanh toan don hang",
    vnp_OrderType: "other",
    vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
    vnp_CreateDate: formatDate(date),
  };

  // 🔥 SORT A → Z
  const sortedParams = sortObject(vnpParams);

  // 🔥 KÝ KHÔNG ENCODE
  const signData = qs.stringify(sortedParams, { encode: false });

  const hmac = crypto.createHmac("sha512", secretKey);
  const secureHash = hmac.update(signData).digest("hex");

  sortedParams.vnp_SecureHash = secureHash;

  const paymentUrl =
    vnpUrl + "?" + qs.stringify(sortedParams, { encode: false });

  return res.json({
    success: true,
    data: paymentUrl,
  });
};

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

function formatDate(date) {
  return date
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}
