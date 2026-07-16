const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    status: { type: String, default: "Hiển thị" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
