const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: false, default: "" },
    billNumber: { type: String, required: true, unique: true },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // New Bills require ownership; hydrated historical branchless Bills
      // remain readable through the explicit archival compatibility path.
      required: function requiredForNewBills() {
        return this.isNew;
      },
      immutable: true,
      index: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      default: null,
    },
    tableNumber: { type: Number, default: null },
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
        total: { type: Number, default: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
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
    paidAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

billSchema.index({ branchId: 1, createdAt: -1 });
billSchema.index({ branchId: 1, paymentStatus: 1, createdAt: -1 });
// A table may have many historical paid bills, but only one unpaid bill at a
// time. This protects concurrent waiter double-clicks at the database level.
billSchema.index(
  { branchId: 1, tableId: 1, paymentStatus: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tableId: { $type: "objectId" },
      paymentStatus: "unpaid",
    },
  },
);

module.exports = mongoose.model("Billing", billSchema);
