const express = require('express');
const router = express.Router();
const { getProductStatistics } = require('../controllers/statistics.controller');
const { getOrderStatistics } = require('../controllers/statistics.controller');
const { getInventoryStatistics, getInventoryProductList } = require('../controllers/statistics.controller');

const verifyAdmin = require('../middlewares/authAdmin');

router.get('/products', verifyAdmin, getProductStatistics);
router.get('/orders', verifyAdmin, getOrderStatistics);
router.get("/inventory",verifyAdmin, getInventoryStatistics );
router.get("/inventory/products", verifyAdmin, getInventoryProductList);

module.exports = router;
