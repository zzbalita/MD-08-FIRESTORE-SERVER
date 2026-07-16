const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const OtpCode = require("../models/otp.model");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const VALID_PHONE = /^0[35789]\d{8}$/;

function normalizePhone(value) {
  return (value || "").replace(/\s/g, "").trim();
}

function isValidPhone(phone) {
  return VALID_PHONE.test(phone);
}

function userPayload(user) {
  return {
    id: user._id,
    full_name: user.full_name,
    phone_number: user.phone_number,
    role: user.role,
  };
}

// 1. Đăng ký & tạo OTP (không gửi SMS)
exports.register = async (req, res) => {
  try {
    const { full_name, phone, password } = req.body;
    const phone_number = normalizePhone(phone);

    if (!isValidPhone(phone_number)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ." });
    }

    const existingUser = await User.findOne({ phone_number });
    if (existingUser) {
      return res.status(400).json({ message: "Số điện thoại đã được đăng ký" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await OtpCode.findOneAndUpdate(
      { phone_number },
      { code: otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      { upsert: true, new: true }
    );

    console.log(`OTP cho ${phone_number} là: ${otp}`);

    res.json({
      message: "Đã tạo OTP (không gửi SMS). Kiểm tra console để lấy mã",
      phone_number,
      otp,
    });
  } catch (err) {
    console.error("Lỗi register:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 2. Xác minh OTP & tạo tài khoản
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, full_name, password } = req.body;
    const phone_number = normalizePhone(phone);

    if (!isValidPhone(phone_number)) {
      return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ." });
    }

    const otpDoc = await OtpCode.findOne({ phone_number });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: "OTP không tồn tại" });
    }

    if (otpDoc.code.trim() !== otp.trim()) {
      return res.status(400).json({ success: false, message: "OTP không đúng" });
    }

    if (otpDoc.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP đã hết hạn" });
    }

    const existingUser = await User.findOne({ phone_number });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Tài khoản đã tồn tại, vui lòng đăng nhập" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      full_name,
      phone_number,
      password: hashedPassword,
    });

    await newUser.save();
    await OtpCode.deleteMany({ phone_number });

    const token = jwt.sign({ userId: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Đăng ký và xác minh thành công",
      token,
      user: userPayload(newUser),
    });
  } catch (err) {
    console.error("Lỗi verifyOtp:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// 3. Đăng nhập
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const phone_number = normalizePhone(phone);

    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(400).json({ success: false, message: "Số điện thoại hoặc mật khẩu không đúng" });
    }

    if (user.is_account_locked === true) {
      return res.status(403).json({ success: false, message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để được hỗ trợ." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Số điện thoại hoặc mật khẩu không đúng" });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      user: userPayload(user),
    });
  } catch (err) {
    console.error("Lỗi login:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// 3b. Đăng nhập khách bằng số điện thoại (không mật khẩu, không OTP)
exports.guestLogin = async (req, res) => {
  try {
    const phone_number = normalizePhone(req.body.phone);
    const name = (req.body.name || "").trim();

    if (!isValidPhone(phone_number)) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập số điện thoại hợp lệ." });
    }

    let user = await User.findOne({ phone_number });
    if (!user) {
      try {
        user = await User.create({
          full_name: name || "Khách",
          password: crypto.randomBytes(16).toString("hex"),
          phone_number,
          role: 1,
        });
      } catch (createErr) {
        user = await User.findOne({ phone_number });
        if (!user) throw createErr;
      }
    } else if (name && user.full_name !== name) {
      user.full_name = name;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      user: userPayload(user),
    });
  } catch (err) {
    console.error("Lỗi guestLogin:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.requestPasswordOtp = async (req, res) => {
  try {
    const phone_number = normalizePhone(req.body.phone);

    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Số điện thoại không tồn tại hoặc lỗi gửi OTP.",
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await OtpCode.findOneAndUpdate(
      { phone_number },
      {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    console.log(`[QUÊN MẬT KHẨU] OTP cho ${phone_number} là: ${otp}`);
    res.json({
      success: true,
      message: "Đã gửi mã OTP (Xem console server để lấy mã).",
    });
  } catch (error) {
    console.error("Lỗi yêu cầu OTP đặt lại mật khẩu:", error);
    res.status(500).json({ success: false, message: "Lỗi server: Không thể gửi mã OTP" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const phone_number = normalizePhone(req.body.phone);
    const { otp, newPassword } = req.body;

    const otpDoc = await OtpCode.findOne({ phone_number, code: otp });

    if (!otpDoc || otpDoc.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
      });
    }

    const user = await User.findOne({ phone_number });
    if (!user) {
      return res.status(404).json({ success: false, message: "Người dùng không tồn tại." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await OtpCode.deleteOne({ phone_number });

    res.json({ success: true, message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." });
  } catch (error) {
    console.error("Lỗi đặt lại mật khẩu:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi đặt lại mật khẩu." });
  }
};
