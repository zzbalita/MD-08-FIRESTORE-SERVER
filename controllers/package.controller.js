const Package = require("../models/Package");

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().sort({ createdAt: -1 });
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    if (!name) return res.status(400).json({ message: "Tên khối lượng không hợp lệ" });

    const exists = await Package.findOne({ name: new RegExp(`^${name}$`, "i") });
    if (exists) return res.status(409).json({ message: "Khối lượng đã tồn tại" });

    const pkg = await Package.create({ name });
    res.status(201).json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Không thể tạo khối lượng" });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const { name, status } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (status !== undefined) update.status = status;

    const updated = await Package.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "Khối lượng không tồn tại" });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Không thể cập nhật khối lượng" });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const deleted = await Package.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Khối lượng không tồn tại" });
    res.json({ message: "Đã xoá khối lượng" });
  } catch (err) {
    res.status(400).json({ message: "Không thể xoá khối lượng" });
  }
};
