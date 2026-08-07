const mongoose = require("mongoose");
const takeAwaySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      immutable: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: ["pending", "sent_to_kitchen", "received", "cancelled"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // cashier user id
      required: true,
    },
  },
  { timestamps: true }
);

takeAwaySchema.index({ branchId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("TakeAway", takeAwaySchema);
