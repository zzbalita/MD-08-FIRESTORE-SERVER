const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Không có token hoặc sai định dạng" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Set consistent user object structure
    req.user = {
      id: decoded.userId,        // Use 'id' for consistency with chat controller
      userId: decoded.userId,    // Keep 'userId' for backward compatibility
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
};
