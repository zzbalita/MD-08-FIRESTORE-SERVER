const Admin = require("../models/Admin");
const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const OtpCode = require("../models/otp.model");
const sendMail = require("../utils/sendMail");

// ĐĂNG KÝ - Tất cả đăng ký mới đều vào Staff collection
exports.register = async (req, res) => {
  const { username, password, name, email, phone } = req.body;
  const normalizedPhone = (phone || "").trim();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedName = (name || "").trim();
  const normalizedUsername = (username || normalizedPhone || "").trim();

  if (!normalizedPhone || !password || !normalizedEmail || !normalizedName) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }

  try {
    // Check duplicates in both Admin and Staff collections
    const existingAdminPhone = await Admin.findOne({ phone: normalizedPhone });
    const existingStaffPhone = await Staff.findOne({ phone: normalizedPhone });
    if (existingAdminPhone || existingStaffPhone) {
      return res.status(400).json({ message: "Số điện thoại đã được sử dụng" });
    }

    const existingAdminEmail = await Admin.findOne({ email: normalizedEmail });
    const existingStaffEmail = await Staff.findOne({ email: normalizedEmail });
    if (existingAdminEmail || existingStaffEmail) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    if (normalizedUsername) {
      const existingAdminUsername = await Admin.findOne({ username: normalizedUsername });
      const existingStaffUsername = await Staff.findOne({ username: normalizedUsername });
      if (existingAdminUsername || existingStaffUsername) {
        return res.status(400).json({ message: "Username đã tồn tại" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new staff in Staff collection (NOT Admin)
    const newStaff = new Staff({
      username: normalizedUsername,
      password: hashedPassword,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: "staff",
      status: "pending",
    });

    console.log("=== REGISTER DEBUG ===");
    console.log("Saving to collection:", Staff.collection.name);
    
    await newStaff.save();
    
    console.log("Saved staff _id:", newStaff._id);
    console.log("=== END DEBUG ===");

    res.status(201).json({ 
      message: "Đăng ký thành công! Vui lòng chờ admin phê duyệt trước khi đăng nhập." 
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ĐĂNG NHẬP - Check both Admin and Staff collections
exports.login = async (req, res) => {
  const { password } = req.body;
  const phone = (req.body.phone || "").trim();

  try {
    // First check Admin collection
    let account = await Admin.findOne({ phone });
    let isAdminAccount = true;
    
    // If not found in Admin, check Staff collection
    if (!account) {
      account = await Staff.findOne({ phone });
      isAdminAccount = false;
    }
    
    if (!account) {
      return res.status(400).json({ message: "Tài khoản không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // Check status for staff accounts
    if (!isAdminAccount) {
      const status = account.status || "pending";
      if (status === "pending") {
        return res.status(403).json({ message: "Tài khoản đang chờ admin phê duyệt" });
      }
      if (status === "disabled") {
        return res.status(403).json({ message: "Tài khoản đã bị vô hiệu hóa" });
      }
    }

    const token = jwt.sign(
      { userId: account._id, role: account.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      admin: {
        username: account.username,
        name: account.name,
        phone: account.phone,
        email: account.email,
        role: account.role,
        status: account.status || "active",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ĐỔI MẬT KHẨU
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.userId;
  const userRole = req.user.role;

  try {
    let account;
    if (userRole === "admin") {
      account = await Admin.findById(userId);
    } else {
      account = await Staff.findById(userId);
    }
    
    if (!account) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    const isMatch = await bcrypt.compare(oldPassword, account.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu cũ không đúng" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    account.password = hashedPassword;
    await account.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendAdminOtp = async (req, res) => {
  const normEmail = String(req.body.email || '').trim().toLowerCase();
  if (!normEmail) return res.status(400).json({ message: "Email là bắt buộc" });

  // Check Admin, Staff, and User
  let account = await Admin.findOne({ email: normEmail });
  if (!account) {
    account = await Staff.findOne({ email: normEmail });
  }
  if (!account && User) {
    account = await User.findOne({ email: normEmail });
  }
  if (!account) {
    return res.status(404).json({ message: "Email không tồn tại trong hệ thống" });
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await OtpCode.findOneAndUpdate(
      { email: normEmail },
      {
        $set: { code, expiresAt },
        $setOnInsert: { email: normEmail },
      },
      { upsert: true, new: true }
    );

    const html = `
      <h2>Mã xác thực đặt lại mật khẩu:</h2>
      <h3>${code}</h3>
      <p>Mã có hiệu lực trong 5 phút. Không chia sẻ với bất kỳ ai.</p>
    `;

    await sendMail(normEmail, "Mã OTP xác minh đặt lại mật khẩu", html);
    return res.json({ message: "✅ Mã OTP đã được gửi qua email" });
  } catch (error) {
    console.error("sendAdminOtp error:", error);
    return res.status(500).json({ message: "Lỗi khi gửi OTP" });
  }
};

// === XÁC NHẬN OTP & ĐẶT LẠI MẬT KHẨU ===
exports.resetAdminPassword = async (req, res) => {
  const normEmail = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const newPassword = req.body.newPassword;

  if (!normEmail || !code || !newPassword) {
    return res.status(400).json({ message: "Thiếu thông tin cần thiết" });
  }

  try {
    const otpRecord = await OtpCode.findOne({ email: normEmail });
    if (!otpRecord || otpRecord.code !== code) {
      return res.status(400).json({ message: "OTP không hợp lệ" });
    }
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP đã hết hạn" });
    }

    // Check Admin, Staff, User
    let target = await Admin.findOne({ email: normEmail });
    if (!target) {
      target = await Staff.findOne({ email: normEmail });
    }
    if (!target && User) {
      target = await User.findOne({ email: normEmail });
    }
    if (!target) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    target.password = hashed;
    await target.save();

    await OtpCode.deleteOne({ email: normEmail });

    return res.json({ message: "✅ Đặt lại mật khẩu thành công" });
  } catch (error) {
    console.error("resetAdminPassword error:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
