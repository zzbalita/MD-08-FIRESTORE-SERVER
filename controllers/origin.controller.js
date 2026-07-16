const Origin = require("../models/Origin");
const slugify = require("slugify");

exports.getAllOrigins = async (req, res) => {
  try {
    const origins = await Origin.find().sort({ createdAt: -1 });
    res.json(origins);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createOrigin = async (req, res) => {
  try {
    const { name } = req.body;
    const slug = slugify(name, { lower: true, locale: "vi" });

    const origin = new Origin({ name, slug });
    await origin.save();
    res.status(201).json(origin);
  } catch (err) {
    res.status(400).json({ message: "Không thể tạo nguồn heo" });
  }
};

exports.updateOrigin = async (req, res) => {
  try {
    const { name, status } = req.body;
    const slug = slugify(name, { lower: true, locale: "vi" });

    const updated = await Origin.findByIdAndUpdate(
      req.params.id,
      { name, slug, status },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Không thể cập nhật nguồn gốc" });
  }
};

exports.deleteOrigin = async (req, res) => {
  try {
    await Origin.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xoá nguồn gốc" });
  } catch (err) {
    res.status(400).json({ message: "Không thể xoá nguồn gốc" });
  }
};
