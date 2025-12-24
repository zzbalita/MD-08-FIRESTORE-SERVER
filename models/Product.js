const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: String },
    images: [{ type: String }],


    description: [
      {
        field: String,
        value: String,
      },
    ],
    import_price: { type: Number, required: true },//giá nhập
    price: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },

    category: { type: String },
    brand: { type: String },

    // sizes, sử dụng variations
    variations: [
      {
        color: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
      }
    ],

    status: { type: String, default: "Đang bán" },

    is_featured: { type: Boolean, default: false },
    
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ProductSchema.index({ price: 1 });
ProductSchema.index({ sold: -1 });

// Method to update status based on total quantity
ProductSchema.methods.updateStatusBasedOnStock = function() {
  const totalQuantity = this.variations.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
  this.quantity = totalQuantity;
  
  // Only update status if it's not manually set to "Ngừng bán"
  if (this.status !== "Ngừng bán") {
    if (totalQuantity <= 0) {
      this.status = "Hết hàng";
    } else {
      this.status = "Đang bán";
    }
  }
  
  return this;
};

// Static method to update status for a product by ID
ProductSchema.statics.updateProductStatus = async function(productId) {
  const product = await this.findById(productId);
  if (!product) return null;
  
  product.updateStatusBasedOnStock();
  await product.save();
  return product;
};

module.exports = mongoose.model("Product", ProductSchema);
