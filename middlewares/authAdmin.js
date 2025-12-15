const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('🔍 [authAdmin] Authorization header:', authHeader ? 'Có' : 'Không có');

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log('❌ [authAdmin] Không có token hoặc sai định dạng');
    return res.status(401).json({ message: "Không có token hoặc sai định dạng" });
  }

  const token = authHeader.split(" ")[1];
  console.log('🔑 [authAdmin] Token:', token.substring(0, 20) + '...');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ [authAdmin] Token hợp lệ. Role:', decoded.role, 'UserID:', decoded.userId);

    if (decoded.role !== "admin") {
      console.log('❌ [authAdmin] Role không phải admin:', decoded.role);
      return res.status(403).json({ message: "Không có quyền truy cập (admin)" });
    }

    req.user = { userId: decoded.userId, role: decoded.role };
    console.log('✅ [authAdmin] Cho phép truy cập');
    next();
  } catch (err) {
    console.log('❌ [authAdmin] Token không hợp lệ:', err.message);
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
};
