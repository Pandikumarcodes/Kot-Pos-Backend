const mongoose = require("mongoose");

const kotChefSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "cooking", "ready", "done"],
      default: "pending",
    },
    assignedChefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

const KOT = mongoose.model("KOT", kotChefSchema);

module.exports = KOT;
