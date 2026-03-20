const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    currentCustomer: {
      name: String,
      phone: String,
    },
    tableNumber: {
      type: Number,
      required: false,
      unique: true,
    },
    capacity: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved"],
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

const Table = mongoose.model("Table", tableSchema);

module.exports = Table; // ✅ export as default
