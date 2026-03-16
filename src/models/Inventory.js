const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    // Link to MenuItem so menu availability auto-updates on low stock
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Paneer", "Chicken", "Butter Naan Dough"
    },

    // ── Stock ─────────────────────────────────────────────────
    unit: {
      type: String,
      enum: ["kg", "g", "l", "ml", "pcs", "dozen", "box", "packet"],
      default: "pcs",
    },

    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    lowStockThreshold: {
      // Alert when currentStock falls below this
      type: Number,
      required: true,
      default: 10,
    },

    // ── Metadata ──────────────────────────────────────────────
    category: {
      type: String,
      enum: [
        "raw_material",
        "beverage",
        "packaging",
        "dairy",
        "produce",
        "other",
      ],
      default: "other",
    },

    costPerUnit: {
      type: Number,
      default: 0,
    },

    supplier: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────
inventorySchema.index({ branchId: 1, isActive: 1 });
inventorySchema.index({ branchId: 1, currentStock: 1 }); // low stock queries
inventorySchema.index({ menuItemId: 1 });

// ── Virtual: isLowStock ───────────────────────────────────────
inventorySchema.virtual("isLowStock").get(function () {
  return this.currentStock <= this.lowStockThreshold;
});

inventorySchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Inventory", inventorySchema);
