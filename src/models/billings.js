const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      match: [/^\d{10}$/, "Enter a valid 10-digit phone number"],
    },
    billNumber: { type: String, required: true, unique: true },
    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "none"],
      default: "none",
    },
    // shopName: { type: String, required: true },
    // shopAddress: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // cashier user id
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Billing", billSchema);
