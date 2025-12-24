// controllers/statistics.controller.js
const mongoose = require("mongoose");
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require("../models/Category");

exports.getProductStatistics = async (req, res) => {
  try {
    const {
      sortBy = 'sold',
      order = 'desc',
      status,
      from,
      to,
      limit = 10,
      lowStockThreshold = 10
    } = req.query;

    // ===== 1. Lấy số liệu tổng (chỉ sản phẩm chưa xóa) =====
    const activeFilter = { isDeleted: { $ne: true } };
    
    const totalProducts = await Product.countDocuments(activeFilter);

    // 2. Tổng tồn kho (cộng tất cả quantity trong variations - chỉ sản phẩm chưa xóa)
    const stockData = await Product.aggregate([
      { $match: activeFilter },
      { $unwind: "$variations" },
      { $group: { _id: null, totalStock: { $sum: "$variations.quantity" } } }
    ]);
    const totalStock = stockData.length > 0 ? stockData[0].totalStock : 0;

    // 3. Số sản phẩm sắp hết hàng (ít nhất một biến thể có số lượng < threshold - chỉ sản phẩm chưa xóa)
    const lowStockCount = await Product.countDocuments({
      ...activeFilter,
      "variations.quantity": { $lt: parseInt(lowStockThreshold) }
    });
    // 4. Số sản phẩm đã hết hàng (chỉ sản phẩm chưa xóa)
    const outOfStockCount = await Product.countDocuments({
      ...activeFilter,
      status: "Hết hàng"
    });
    // ===== 2. Thống kê sản phẩm bán chạy =====
    const validStatuses = ['delivered'];
    const matchOrder = { status: { $in: validStatuses } };

    if (from || to) {
      matchOrder.createdAt = {};
      if (from) matchOrder.createdAt.$gte = new Date(from);
      if (to) matchOrder.createdAt.$lte = new Date(to);
    }

    const pipeline = [
      { $match: matchOrder },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product_id',
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      // Lọc bỏ sản phẩm đã xóa
      { $match: { 'product.isDeleted': { $ne: true } } }
    ];

    if (status) {
      pipeline.push({
        $match: { 'product.status': status }
      });
    }

    pipeline.push({
      $addFields: {
        stock: '$product.quantity',
        name: '$product.name',
        image: '$product.image',
        category: '$product.category',
        status: '$product.status'
      }
    });

    let sortField = {};
    switch (sortBy) {
      case 'sold':
        sortField = { totalSold: order === 'asc' ? 1 : -1 };
        break;
      case 'revenue':
        sortField = { totalRevenue: order === 'asc' ? 1 : -1 };
        break;
      case 'stock':
        sortField = { stock: order === 'asc' ? 1 : -1 };
        break;
      case 'name':
        sortField = { name: order === 'asc' ? 1 : -1 };
        break;
      default:
        sortField = { totalSold: -1 };
    }
    pipeline.push({ $sort: sortField });
    pipeline.push({ $limit: parseInt(limit) });

    const topProducts = await Order.aggregate(pipeline);

    // ===== 3. Trả kết quả =====
    res.json({
      summary: {
        totalProducts,
        totalStock,
        lowStockCount,
        outOfStockCount,
      },
      topProducts
    });

  } catch (err) {
    console.error('Lỗi khi thống kê sản phẩm:', err);
    res.status(500).json({ message: 'Không thể thống kê sản phẩm.' });
  }
};

// ====================== Thống kê đơn hàng ======================
exports.getOrderStatistics = async (req, res) => {
  try {
    const { from, to, limit = 5, groupBy = "day" } = req.query;

    // Điều kiện lọc thời gian
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    // ===== 1. Summary =====
    const totalOrders = await Order.countDocuments(match);
    const pendingOrders = await Order.countDocuments({ ...match, status: "pending" });
    const processingOrders = await Order.countDocuments({ ...match, status: "processing" });
    const shippingOrders = await Order.countDocuments({ ...match, status: "shipping" });
    const deliveredOrders = await Order.countDocuments({ ...match, status: "delivered" });
    const cancelledOrders = await Order.countDocuments({ ...match, status: "cancelled" });

    // Tính doanh thu (chỉ đơn đã giao)
    const deliveredOrdersData = await Order.find({ ...match, status: "delivered" });

    let totalRevenue = 0;
    deliveredOrdersData.forEach(order => {
      totalRevenue += order.total_amount;
    });

    // Tính TỔNG GIÁ VỐN: dựa trên tồn kho hiện tại của TẤT CẢ sản phẩm (kể cả đã xóa)
    // Công thức: import_price * tổng số lượng (tất cả các biến thể) của mỗi sản phẩm
    const totalCostData = await Product.aggregate([
      { $match: {} }, // Tính tất cả sản phẩm, kể cả đã xóa
      { $unwind: "$variations" },
      {
        $group: {
          _id: null,
          totalValueImport: { 
            $sum: { 
              $multiply: ["$variations.quantity", { $ifNull: ["$import_price", 0] }] 
            } 
          }
        }
      }
    ]);
    const totalCost = totalCostData.length > 0 ? totalCostData[0].totalValueImport : 0;

    // Tính TỔNG LỢI NHUẬN: Tổng doanh thu - Tổng giá vốn
    const totalProfit = totalRevenue - totalCost;

    // Doanh thu hôm nay
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await Order.find({
      status: "delivered",
      createdAt: { $gte: todayStart }
    }).populate("items.product_id", "import_price");

    let todayRevenue = 0;
    let todayCostOfSold = 0;
    let todayOrderCount = 0;
    
    todayOrders.forEach(order => {
      todayRevenue += order.total_amount;
      todayOrderCount += 1; // Đếm số đơn hàng
      order.items.forEach(item => {
        todayCostOfSold += (item.product_id?.import_price || 0) * item.quantity;
      });
    });
    
    // Lợi nhuận hôm nay = Doanh thu - Giá vốn hàng đã bán - (30000 * số đơn hàng)
    // 30000 là tiền shipper mỗi đơn hàng
    const todayShipperFee = 30000 * todayOrderCount;
    const todayProfit = todayRevenue - todayCostOfSold - todayShipperFee;

    // ===== 2. Top khách hàng =====
    const topCustomers = await Order.aggregate([
      { $match: { ...match, status: "delivered" } },
      {
        $group: {
          _id: "$user_id",
          totalSpent: { $sum: "$total_amount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          totalSpent: 1,
          totalOrders: "$orderCount",
          name: "$user.full_name",
          email: "$user.email"
        }
      }
    ]);

    // ===== 3. Biểu đồ theo ngày / tháng =====
    const dateFormat =
      groupBy === "month"
        ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
        : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

    const ordersByDate = await Order.aggregate([
      { $match: { ...match, status: "delivered" } },
      {
        $group: {
          _id: dateFormat,
          orderCount: { $sum: 1 },
          revenue: { $sum: "$total_amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const trend = await Promise.all(
      ordersByDate.map(async (item) => {
        // Xác định khoảng thời gian bắt đầu và kết thúc
        let startDate = new Date(item._id);
        let endDate;

        if (groupBy === "month") {
          endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
        } else {
          endDate = new Date(startDate); // clone
          endDate.setDate(endDate.getDate() + 1);
        }

        // Lấy danh sách đơn đã giao trong khoảng thời gian
        const orders = await Order.find({
          status: "delivered",
          createdAt: { $gte: startDate, $lt: endDate },
        }).populate("items.product_id", "import_price");

        // Tính tổng giá vốn
        let cost = 0;
        orders.forEach((o) => {
          o.items.forEach((it) => {
            cost += (it.product_id?.import_price || 0) * it.quantity;
          });
        });

        return {
          date: item._id,
          orders: item.orderCount,
          revenue: item.revenue,
          profit: item.revenue - cost,
        };
      })
    );


    // ===== Trả kết quả =====
    res.json({
      summary: {
        totalOrders,
        pendingOrders,
        processingOrders,
        shippingOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenue,
        totalCost,
        totalProfit,
        todayRevenue,
        todayProfit
      },
      topCustomers,
      trend
    });

  } catch (err) {
    console.error("Lỗi thống kê đơn hàng:", err);
    res.status(500).json({ message: "Không thể thống kê đơn hàng." });
  }
};


// Thống kê tồn kho
exports.getInventoryStatistics = async (req, res) => {
  try {
    const { category, brand } = req.query;
    let { minStock, maxStock, minPrice, maxPrice } = req.query;

    // Convert sang số
    minStock = parseInt(minStock);
    maxStock = parseInt(maxStock);
    minPrice = parseInt(minPrice);
    maxPrice = parseInt(maxPrice);

    // ================= Tổng quan tồn kho =================
    // Tổng số lượng tồn kho = tổng quantity của sản phẩm CHƯA XÓA
    // Giá trị tồn = tính CHỈ sản phẩm CHƯA XÓA (đang có trên admin)
    
    // Match cho sản phẩm chưa xóa (đang có trên admin)
    const matchActive = { isDeleted: { $ne: true } }; // Chỉ tính sản phẩm chưa xóa
    if (category) matchActive.category = category;
    if (brand) matchActive.brand = brand;
    
    // Tính tổng số lượng tồn kho (chỉ sản phẩm chưa xóa)
    const stockData = await Product.aggregate([
      { $match: matchActive }, // Chỉ tính sản phẩm chưa xóa
      { $unwind: "$variations" },
      {
        $group: {
          _id: null,
          totalStock: { $sum: "$variations.quantity" }
        }
      }
    ]);
    const totalStock = stockData.length > 0 ? stockData[0].totalStock : 0;
    
    // Tính giá trị tồn (CHỈ sản phẩm CHƯA XÓA - đang có trên admin)
    // Công thức: (giá bán/mua của 1 sản phẩm * tổng số lượng sản phẩm đó)
    // Bước 1: Lấy tất cả sản phẩm CHƯA XÓA và tính tổng quantity cho mỗi sản phẩm
    const allProducts = await Product.find(matchActive).lean();
    
    let totalValueSell = 0;
    let totalValueImport = 0;
    
    // Debug: log một vài sản phẩm đầu tiên
    console.log('📊 Debug - Sample products:', allProducts.slice(0, 3).map(p => ({
      name: p.name,
      price: p.price,
      import_price: p.import_price,
      quantity: p.quantity,
      variations_count: p.variations?.length || 0,
      variations: p.variations?.map(v => ({ color: v.color, size: v.size, qty: v.quantity })) || []
    })));
    
    console.log(`📊 Bắt đầu tính giá trị tồn cho ${allProducts.length} sản phẩm...`);
    
    allProducts.forEach((product, index) => {
      // Tính tổng số lượng của sản phẩm
      // Công thức: (giá bán/mua của 1 sản phẩm * tổng số lượng sản phẩm đó)
      // Tổng số lượng = tổng tất cả variations.quantity
      let totalQty = 0;
      
      if (product.variations && Array.isArray(product.variations) && product.variations.length > 0) {
        // Có variations: tổng tất cả quantity trong variations
        totalQty = product.variations.reduce((sum, v) => {
          const qty = Number(v.quantity) || 0;
          return sum + qty;
        }, 0);
      } else {
        // Không có variations: dùng quantity field trực tiếp
        totalQty = Number(product.quantity) || 0;
      }
      
      const price = Number(product.price) || 0;
      const importPrice = Number(product.import_price) || 0;
      
      // Công thức: giá bán/mua của 1 sản phẩm * tổng số lượng sản phẩm đó
      const valueSell = price * totalQty;
      const valueImport = importPrice * totalQty;
      
      // Log chi tiết TẤT CẢ sản phẩm để debug - format ngắn gọn hơn
      const variationsSum = product.variations?.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0) || 0;
      console.log(`${index + 1}. ${product.name.substring(0, 30)} | Price: ${price} | Import: ${importPrice} | Qty: ${totalQty} (variations: ${variationsSum}, qty_field: ${product.quantity}) | Sell: ${valueSell} | Import: ${valueImport}`);
      
      totalValueSell += valueSell;
      totalValueImport += valueImport;
    });
    
    console.log(`📊 Tổng kết tính toán:`, {
      totalValueSell: totalValueSell,
      totalValueImport: totalValueImport
    });
    
    const overview = {
      totalStock: totalStock,
      totalValueSell: totalValueSell,
      totalValueImport: totalValueImport
    };
    
    console.log('📊 Giá trị tồn tính toán:', {
      totalValueSell: overview.totalValueSell,
      totalValueImport: overview.totalValueImport,
      totalStock: totalStock,
      productsCount: allProducts.length
    });
    
    // Gán tổng số lượng tồn kho (chỉ sản phẩm chưa xóa)
    overview.totalStock = totalStock;

    // ================= Danh sách sản phẩm theo category =================
    let products = [];
    if (category) {
      // matchActive đã có isDeleted filter và category/brand nếu có
      products = await Product.aggregate([
        { $match: matchActive }, // Chỉ tính sản phẩm chưa xóa, đã có category/brand filter
        { $unwind: "$variations" },
        {
          $group: {
            _id: "$_id",
            name: { $first: "$name" },
            price: { $first: "$price" },
            import_price: { $first: "$import_price" },
            brand: { $first: "$brand" },
            image: { $first: { $arrayElemAt: ["$images", 0] } },
            totalStock: { $sum: "$variations.quantity" }
          }
        },
        {
          $addFields: {
            inventoryValueSell: { $multiply: ["$totalStock", "$price"] },
            inventoryValueImport: { $multiply: ["$totalStock", "$import_price"] }
          }
        },
        {
          $match: {
            ...(isNaN(minStock) ? {} : { totalStock: { $gte: minStock } }),
            ...(isNaN(maxStock) ? {} : { totalStock: { $lte: maxStock } }),
            ...(isNaN(minPrice) ? {} : { price: { $gte: minPrice } }),
            ...(isNaN(maxPrice) ? {} : { price: { $lte: maxPrice } })
          }
        },
        { $sort: { inventoryValueSell: -1 } }
      ]);
    }

    // ================= Nếu không có category thì gom theo danh mục =================
    let stockByCategory = [];
    if (!category) {
      // Lấy danh sách category đang hiển thị (status = "Hiển thị")
      const { Category } = require('../models');
      const activeCategories = await Category.find({ status: "Hiển thị" }).lean();
      const activeCategoryNames = activeCategories.map(c => c.name);
      
      // Chỉ tính sản phẩm chưa xóa và có category đang hiển thị
      const matchCategoryActive = {
        ...matchActive,
        category: { $in: activeCategoryNames }
      };
      
      stockByCategory = await Product.aggregate([
        { $match: matchCategoryActive }, // Chỉ tính sản phẩm chưa xóa và category đang hiển thị
        { $unwind: "$variations" },
        {
          $group: {
            _id: "$category",
            totalStock: { $sum: "$variations.quantity" },
            totalValueSell: { $sum: { $multiply: ["$variations.quantity", "$price"] } },
            totalValueImport: { $sum: { $multiply: ["$variations.quantity", "$import_price"] } }
          }
        },
        {
          $project: {
            category: "$_id",
            totalStock: 1,
            totalValueSell: 1,
            totalValueImport: 1
          }
        },
        { $sort: { category: 1 } } // Sắp xếp theo tên danh mục
      ]);
    }

    // Log trước khi trả về để đảm bảo giá trị đúng
    console.log('📤 Response overview:', JSON.stringify(overview, null, 2));
    
    res.json({ overview, products, stockByCategory });
  } catch (err) {
    console.error("Lỗi khi thống kê tồn kho:", err);
    res.status(500).json({ message: "Lỗi server khi thống kê tồn kho" });
  }
};





