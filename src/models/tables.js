const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      immutable: true,
      index: true,
    },
    currentCustomer: {
      name: String,
      phone: String,
    },
    tableNumber: {
      type: Number,
      required: false,
    },
    capacity: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "occupied", "billing", "reserved"],
      default: "available",
    },
    assignedWaiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

tableSchema.index({ branchId: 1, status: 1 });
tableSchema.index({ branchId: 1, createdAt: -1 });
tableSchema.index({ branchId: 1, tableNumber: 1 }, { unique: true });

const Table = mongoose.model("Table", tableSchema);

module.exports = Table; // ✅ export as default
