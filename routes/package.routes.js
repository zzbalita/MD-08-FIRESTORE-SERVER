const express = require("express");
const router = express.Router();
const packageController = require("../controllers/package.controller");

router.get("/", packageController.getAllPackages);
router.post("/", packageController.createPackage);
router.put("/:id", packageController.updatePackage);
router.delete("/:id", packageController.deletePackage);

module.exports = router;
