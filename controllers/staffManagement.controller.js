const Staff = require("../models/Staff");

// Lấy danh sách nhân viên từ Staff collection
exports.listStaff = async (req, res) => {
  console.log("=== listStaff called ===");
  try {
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    console.log("Query:", query);
    const staff = await Staff.find(query)
      .select("-password -__v")
      .sort({ createdAt: -1 });

    console.log("Found staff count:", staff.length);
    return res.json({ staff });
  } catch (error) {
    console.error("listStaff error:", error);
    return res.status(500).json({ message: "Lỗi khi lấy danh sách nhân viên" });
  }
};

// Lấy chi tiết nhân viên
exports.getStaffById = async (req, res) => {
  console.log("=== getStaffById called ===", req.params.id);
  try {
    const staff = await Staff.findById(req.params.id).select("-password -__v");

    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    return res.json({ staff });
  } catch (error) {
    console.error("getStaffById error:", error);
    return res.status(500).json({ message: "Lỗi khi lấy thông tin nhân viên" });
  }
};

// Cập nhật trạng thái (duyệt / vô hiệu)
exports.updateStaffStatus = async (req, res) => {
  console.log("=== updateStaffStatus called ===", req.params.id, req.body);
  try {
    const { status } = req.body;
    const allowedStatuses = ["pending", "active", "disabled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }

    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("-password -__v");

    if (!staff) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    return res.json({ message: "Cập nhật trạng thái thành công", staff });
  } catch (error) {
    console.error("updateStaffStatus error:", error);
    return res.status(500).json({ message: "Lỗi khi cập nhật trạng thái" });
  }
};

// Xóa tài khoản nhân viên
exports.deleteStaff = async (req, res) => {
  console.log("=== deleteStaff called ===", req.params.id);
  try {
    const deleted = await Staff.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }

    return res.json({ message: "Xóa tài khoản nhân viên thành công" });
  } catch (error) {
    console.error("deleteStaff error:", error);
    return res.status(500).json({ message: "Lỗi khi xóa tài khoản nhân viên" });
  }
};

