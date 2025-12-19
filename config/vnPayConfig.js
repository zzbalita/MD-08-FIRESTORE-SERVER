module.exports = {
  VNP_TMN_CODE: process.env.VNP_TMN_CODE || "WVHCBEIS",
  VNP_HASH_SECRET: process.env.VNP_HASH_SECRET || "G835F4FT2LR70GPLQLDMVYRIJHN2YUPT",
  VNP_URL: process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",

  // ✅ DEEP LINK trả về APP
  VNP_RETURN_URL: "fivestore://app",

  IS_SANDBOX: true
};
