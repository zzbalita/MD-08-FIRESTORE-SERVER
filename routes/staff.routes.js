const express = require("express");
const router = express.Router();
const authAdmin = require("../middlewares/authAdmin");
const staffController = require("../controllers/staffManagement.controller");

// All routes require admin authentication
router.get("/", authAdmin, staffController.listStaff);
router.get("/:id", authAdmin, staffController.getStaffById);
router.put("/:id/status", authAdmin, staffController.updateStaffStatus);
router.delete("/:id", authAdmin, staffController.deleteStaff);

module.exports = router;

