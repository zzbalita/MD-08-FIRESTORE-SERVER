const jwt = require('jsonwebtoken');

/**
 * Middleware xác thực tùy chọn (Optional Authentication).
 * Mục đích:
 * 1. Nếu có token hợp lệ, giải mã và gán req.user = thông tin user.
 * 2. Nếu KHÔNG có token hoặc token KHÔNG hợp lệ/hết hạn, gán req.user = null 
 * và cho phép request đi tiếp (coi là Khách Vãng Lai/Guest User).
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware function
 */
const optionalAuth = (req, res, next) => {
    // 1. Lấy token từ header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // ⭐ Case 1: Không có token (Guest User)
        req.user = null; 
        console.log("=> Guest User: No token provided.");
        return next(); // Cho phép đi tiếp
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Xác thực token
        // Đảm bảo bạn sử dụng JWT_SECRET đúng với biến môi trường của bạn
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        
        // Case 2: Token hợp lệ (Logged-in User)
        req.user = decoded; 
        console.log(`=> Logged-in User: ID ${decoded.userId}`);
        next(); // Cho phép đi tiếp
        
    } catch (err) {
        // ⭐ Case 3: Token không hợp lệ/hết hạn (Vẫn coi là Guest User)
        req.user = null;
        console.log("=> Guest User: Invalid or expired token.");
        next(); // Cho phép đi tiếp
    }
};

module.exports = optionalAuth;