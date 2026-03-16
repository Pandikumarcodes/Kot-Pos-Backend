const mongoose = require("mongoose");

const stockLogSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },

    // What caused this stock change
    type: {
      type: String,
      enum: [
        "restock", // admin added stock manually
        "kot_deduct", // KOT created → stock deducted automatically
        "adjustment", // manual correction (waste, spillage, count)
        "return", // returned to supplier
      ],
      required: true,
    },

    // Positive = stock added, negative = stock removed
    quantity: {
      type: Number,
      required: true,
    },

    // Stock level before and after this change
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },

    note: { type: String, default: "" },
    kotId: { type: mongoose.Schema.Types.ObjectId, ref: "Kot", default: null },
    doneBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

stockLogSchema.index({ inventoryId: 1, createdAt: -1 });

module.exports = mongoose.model("StockLog", stockLogSchema);
