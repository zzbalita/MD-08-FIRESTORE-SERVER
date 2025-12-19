const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["order", "promotion", "system"],
      default: "system",
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    image: String,
    productName: String,

    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
