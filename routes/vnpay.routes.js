const express = require("express");
const crypto = require("crypto");
const qs = require("qs");
const moment = require("moment");

const router = express.Router();

// Hàm sắp xếp object A → Z
function sortObject(obj) {
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
}

// API tạo URL thanh toán
router.post("/create-payment", (req, res) => {
    try {
        const rawAmount = req.body.amount;
        const amount = parseInt(rawAmount, 10);

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Số tiền không hợp lệ",
                rawAmount
            });
        }

        const tmnCode = process.env.VNP_TMN_CODE;
        const secretKey = process.env.VNP_HASH_SECRET;
        const vnpUrl = process.env.VNP_URL;
        const returnUrl = process.env.VNP_RETURN_URL;

        const date = moment().format("YYYYMMDDHHmmss");
        const orderId = moment().format("HHmmss");

        let vnp_Params = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode: tmnCode,
            vnp_Locale: "vn",
            vnp_CurrCode: "VND",
            vnp_TxnRef: orderId, // mã giao dịch duy nhất
            vnp_OrderInfo: "ThanhToanDonHangFiveStore",
            vnp_OrderType: "other",
            vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
            vnp_CreateDate: date
        };

        // Sắp xếp tham số
        vnp_Params = sortObject(vnp_Params);

        // Tạo chữ ký
        const signData = qs.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const secureHash = hmac.update(signData, "utf-8").digest("hex");

        vnp_Params.vnp_SecureHash = secureHash;

        // Tạo URL thanh toán
        const paymentUrl = vnpUrl + "?" + qs.stringify(vnp_Params, { encode: false });

        return res.json({
            success: true,
            data: paymentUrl
        });

    } catch (err) {
        console.error("VNPAY ERROR:", err);
        res.status(500).json({ success: false });
    }
});

// API xử lý callback từ VNPay
router.get("/return", (req, res) => {
    const vnp_Params = req.query;
    const secureHash = vnp_Params.vnp_SecureHash;

    // Xóa hash trước khi ký lại
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = qs.stringify(sortObject(vnp_Params), { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const checkHash = hmac.update(signData, "utf-8").digest("hex");

    if (secureHash === checkHash) {
        // ✅ Chữ ký hợp lệ
        if (vnp_Params.vnp_ResponseCode === "00") {
            // Thanh toán thành công
            res.json({
                success: true,
                message: "Thanh toán thành công",
                data: vnp_Params
            });
        } else {
            // Thanh toán thất bại
            res.json({
                success: false,
                message: "Thanh toán thất bại",
                data: vnp_Params
            });
        }
    } else {
        // ❌ Sai chữ ký
        res.status(400).json({
            success: false,
            message: "Sai chữ ký, dữ liệu không hợp lệ"
        });
    }
});

module.exports = router;
