const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // ── General ───────────────────────────────────────────────
    businessName: { type: String, default: "My Restaurant" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    gstin: { type: String, default: "" },
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },

    // ── Restaurant ────────────────────────────────────────────
    openTime: { type: String, default: "09:00" },
    closeTime: { type: String, default: "23:00" },
    avgServiceTime: { type: Number, default: 45 },
    maxCapacity: { type: Number, default: 100 },
    takeawayEnabled: { type: Boolean, default: true },
    deliveryEnabled: { type: Boolean, default: false },

    // ── Billing ───────────────────────────────────────────────
    taxRate: { type: Number, default: 5 },
    serviceCharge: { type: Number, default: 0 },
    autoRoundOff: { type: Boolean, default: true },
    printReceipt: { type: Boolean, default: true },
    paymentMethods: {
      cash: { type: Boolean, default: true },
      card: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
    },

    // ── Notifications ─────────────────────────────────────────
    orderAlerts: { type: Boolean, default: true },
    lowStockAlerts: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
