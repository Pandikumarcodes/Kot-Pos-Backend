const mongoose = require("mongoose");

const kotSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    orderType: {
      type: String,
      enum: ["dine-in", "takeaway"],
      required: true,
    },
    tableNumber: {
      type: Number,
      required: function () {
        return this.orderType === "dine-in";
      },
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: function () {
        return this.orderType === "dine-in";
      },
    },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
     required: false,
      default: null,
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
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// Compound index for fast per-branch KOT queries
kotSchema.index({ branchId: 1, status: 1 });
kotSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model("Kot", kotSchema);
