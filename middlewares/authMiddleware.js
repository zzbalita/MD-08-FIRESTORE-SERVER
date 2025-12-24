const jwt = require('jsonwebtoken');

/**
 * Middleware xác thực tùy chọn (Optional Authentication Middleware).
 *
 * - Nếu token hợp lệ: Đính kèm thông tin người dùng (req.user).
 * - Nếu không có token (Guest User): Bỏ qua, gọi next(), req.user = null.
 * - Nếu có token nhưng không hợp lệ/hết hạn: Trả về lỗi 403.
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // --- BƯỚC 1: Xử lý trường hợp KHÔNG CÓ TOKEN (KHÁCH VÃNG LAI) ---
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Không có token -> Đây là khách vãng lai (Guest User).
    // Chúng ta không chặn request, chỉ cần đảm bảo req.user KHÔNG được thiết lập.
    // console.log(`ℹ️ AUTH OPTIONAL: Guest User accessing route: ${req.originalUrl}`);
    req.user = null; 
    return next(); // Cho phép request đi tiếp
  }

  // --- BƯỚC 2: Xử lý trường hợp CÓ TOKEN ---
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token hợp lệ: Đính kèm thông tin người dùng
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      role: decoded.role,
    };
    
    // Log thành công (Tùy chọn)
    // if (req.originalUrl.includes('wishlists')) {
    //      console.log(`✅ AUTH SUCCESS: User ${req.user.userId} authenticated for route: ${req.originalUrl}`);
    // }

    next(); // Cho phép request đi tiếp
  } catch (err) {
    // --- BƯỚC 3: Xử lý trường hợp CÓ TOKEN nhưng KHÔNG HỢP LỆ/HẾT HẠN ---
    console.error(`❌ AUTH FAILED (403): Invalid token for route: ${req.originalUrl}. Error: ${err.message}`);
    // Khác với Guest User, request có token lỗi phải bị chặn.
    return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." });
  }
};