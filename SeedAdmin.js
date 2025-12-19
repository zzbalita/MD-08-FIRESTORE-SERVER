// seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
})

.then(() => console.log("✅ Connected to MongoDB"))
.catch((err) => {
  console.error("❌ Connection failed:", err.message);
  process.exit(1);
});

// Định nghĩa schema admin (hoặc import từ model nếu có)
const adminSchema = new mongoose.Schema({
  phone: String,
  password: String,
  name: String,
  role: { type: String, default: "admin" },
});

const Admin = mongoose.model("Admin", adminSchema);

// Tạo tài khoản admin mặc định
(async () => {
  const phone = "0987654321";
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await Admin.findOne({ phone });
  if (existing) {
    console.log("⚠️ Admin đã tồn tại");
    process.exit(0);
  }

  const newAdmin = new Admin({
    phone,
    password: hashedPassword,
    name: "Super Admin",
  });

  await newAdmin.save();
  console.log("✅ Admin mặc định đã được tạo");
  process.exit(0);
})();

//node seedAdmin.js
