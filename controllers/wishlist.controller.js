const wishlistService = require('../services/wishlist.service');

exports.getMyWishlist = async (req, res) => {
  try {
    const userId = req.user.userId;
    const wishlist = await wishlistService.getWishlist(userId);

    // Convert to WishlistItem array format
    const wishlistItems = (wishlist.products || []).map(product => ({
      _id: `${userId}_${product._id}`, // Unique ID for wishlist item
      user_id: userId,
      product_id: product._id,
      product: product,
      created_at: new Date().toISOString()
    }));
    console.log(wishlistItems);
    res.status(200).json({
      success: true,
      message: 'Lấy danh sách yêu thích thành công',
      data: wishlistItems
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Không thể lấy danh sách yêu thích'
    });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Thiếu productId' });

    const wishlist = await wishlistService.addProduct(userId, productId);
    res.status(200).json({
      success: true,
      message: 'Đã thêm vào yêu thích',
      data: wishlist
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Không thể thêm vào yêu thích'
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ success: false, message: 'Thiếu productId' });

    const wishlist = await wishlistService.removeProduct(userId, productId);
    res.status(200).json({
      success: true,
      message: 'Đã xoá khỏi yêu thích',
      data: wishlist
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Không thể xoá khỏi yêu thích'
    });
  }
};

exports.check = async (req, res) => {
  try {
    const userId = req.user.userId;
    const productId = req.params.productId || req.query.productId;
    if (!productId) return res.status(400).json({ success: false, message: 'Thiếu productId' });

    const inWishlist = await wishlistService.isInWishlist(userId, productId);
    return res.status(200).json({
      success: true,
      message: 'Kiểm tra thành công',
      data: { inWishlist }
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Không thể kiểm tra wishlist'
    });
  }
};
