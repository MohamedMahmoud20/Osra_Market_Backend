const mongoose = require("mongoose");

const cartSchema = mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// // Compound index to prevent duplicate cart items
// cartSchema.index({ familyId: 1, productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Cart", cartSchema);
