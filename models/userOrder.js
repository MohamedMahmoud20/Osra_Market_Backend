const mongoose = require("mongoose");

const userOrderSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    orderNumber: {
      type: String,
      unique: false,
    },
     phone: {
      type: String,
      default:"" ,
    },
     address: {
      type: String,
      unique: true,
    },
     location: {
      type: String,
      unique: true,
    },
    ordersFamily: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrdersFamily",
      required: true,
    }],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'delivered', 'cancelled'],
      default: 'pending',
    },
    orderNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique order number before saving
userOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const orderCount = await mongoose.model('UserOrders').countDocuments();
    this.orderNumber = `ORD-${timestamp.toString().slice(8)}`;
  }
  next();
});

// Index for better query performance
userOrderSchema.index({ userId: 1, createdAt: -1 });
userOrderSchema.index({ orderNumber: 1 });
userOrderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model("UserOrders", userOrderSchema);
