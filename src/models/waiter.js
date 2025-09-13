const mongoose = require("mongoose");

const tableOrderSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: true,
    },
    customerName: {
      type: String,
      required: false,
      trim: true,
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
      enum: ["pending", "sent_to_kitchen", "served", "cancelled"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // waiter user id
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TableOrder", tableOrderSchema);
