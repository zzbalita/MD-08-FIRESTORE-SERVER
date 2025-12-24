const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  username: { type: String, trim: true, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: "staff" },
  status: { type: String, enum: ["pending", "active", "disabled"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

// Explicitly set collection name to 'staffs'
module.exports = mongoose.model('Staff', staffSchema, 'staffs');
