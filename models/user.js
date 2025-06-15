const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
     bankAccountNumber: {
      type: String,
      default: "",
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["admin", "family", "client"],
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

exports.User = mongoose.model("Users", userSchema);
