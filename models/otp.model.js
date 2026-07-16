const mongoose = require('mongoose');

const OtpCodeSchema = new mongoose.Schema({
  phone_number: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('OtpCode', OtpCodeSchema);
