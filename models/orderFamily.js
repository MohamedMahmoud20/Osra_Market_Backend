const mongoose = require("mongoose");

const orderFamilySchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    orderNumber: {
      type: String,
      default: "",
    },
       phone: {
      type: String,
      default:"" ,
    },
     address: {
      type: String,
      default:"" ,
    },
     location: {
      type: String,
      default:"" ,
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

   products: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      priceAfterDiscount: {
        type: Number,
        required: true,
        min: 0,
      },
      
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      itemTotal: {
        type: Number,
        required: true,
        min: 0,
      },
    }],
        orderStatus: {
      type: String,
      enum: ['pending', 'delivered', 'cancelled'],
      default: 'pending',
    },
    orderNotes: {
      type: String,
      default: '',
    },
    familyNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OrdersFamily", orderFamilySchema);
