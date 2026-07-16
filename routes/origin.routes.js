const express = require("express");
const router = express.Router();
const originController = require("../controllers/origin.controller");

router.get("/", originController.getAllOrigins);
router.post("/", originController.createOrigin);
router.put("/:id", originController.updateOrigin);
router.delete("/:id", originController.deleteOrigin);

module.exports = router;
