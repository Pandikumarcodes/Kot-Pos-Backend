const mongoose = require("mongoose");

const kotSchema = new mongoose.Schema({
  kotNumber: String,
  tableNumber: String,
  orderType: { type: String, enum: ["dine-in", "take-away", "delivery"] },
  items: [
    {
      itemId: mongoose.Schema.Types.ObjectId,
      quantity: Number,
      notes: String,
    },
  ],
  status: {
    type: String,
    enum: ["pending", "in-progress", "ready", "served", "billed"],
    default: "pending",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});
const KOT = mongoose.model("KOT", kotSchema);

module.exports = KOT;
