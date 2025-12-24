const express = require('express');
const router = express.Router();
const { 
  getProductStatistics,
  getOrderStatistics,
  getInventoryStatistics,
  getInventoryProductList,
  getLowStockProducts,
  getOutOfStockProducts
} = require('../controllers/statistics.controller');

const verifyAdmin = require('../middlewares/authAdmin');

router.get('/products', verifyAdmin, getProductStatistics);
router.get('/orders', verifyAdmin, getOrderStatistics);
router.get("/inventory", verifyAdmin, getInventoryStatistics);
router.get("/inventory/products", verifyAdmin, getInventoryProductList);
router.get("/products/low-stock", verifyAdmin, getLowStockProducts);
router.get("/products/out-of-stock", verifyAdmin, getOutOfStockProducts);

module.exports = router;
