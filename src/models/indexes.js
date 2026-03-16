const Kot = require("./kot");
const Billing = require("./billings");
const User = require("./users");
const Table = require("./tables");
const MenuItem = require("./menuItems");
const Branch = require("./Branch");

async function ensureIndexes() {
  try {
    // ── Kot ──────────────────────────────────────────────────
    // Most queried collection — kitchen dashboard + reports + orders page
    await Kot.collection.createIndex({ branchId: 1, status: 1 }); // kitchen filter
    await Kot.collection.createIndex({ branchId: 1, createdAt: -1 }); // reports + orders list
    await Kot.collection.createIndex({
      branchId: 1,
      orderType: 1,
      createdAt: -1,
    }); // dine-in vs takeaway stats
    await Kot.collection.createIndex({ createdBy: 1, createdAt: -1 }); // waiter's own orders
    await Kot.collection.createIndex({ tableId: 1, status: 1 }); // orders for a specific table
    await Kot.collection.createIndex({
      // text search
      customerName: "text",
      customerPhone: "text",
    });

    // ── Billing ───────────────────────────────────────────────
    // Cashier bills list + reports revenue aggregations
    await Billing.collection.createIndex({ branchId: 1, createdAt: -1 }); // bills list
    await Billing.collection.createIndex({
      branchId: 1,
      paymentStatus: 1,
      createdAt: -1,
    }); // paid/unpaid filter
    await Billing.collection.createIndex({ branchId: 1, paymentMethod: 1 }); // payment breakdown chart
    await Billing.collection.createIndex({ createdBy: 1, createdAt: -1 }); // cashier's own bills
    await Billing.collection.createIndex({ billNumber: 1 }, { unique: true }); // unique bill lookup
    await Billing.collection.createIndex({
      // text search
      customerName: "text",
      customerPhone: "text",
      billNumber: "text",
    });

    // ── User ──────────────────────────────────────────────────
    await User.collection.createIndex({ branchId: 1, role: 1 }); // staff list per branch
    await User.collection.createIndex({ username: 1 }, { unique: true }); // login lookup (likely exists)
    await User.collection.createIndex({ role: 1, status: 1 }); // active staff by role

    // ── Table ─────────────────────────────────────────────────
    await Table.collection.createIndex({ branchId: 1, status: 1 }); // floor view filter
    await Table.collection.createIndex(
      { branchId: 1, tableNumber: 1 },
      { unique: true },
    ); // table lookup

    // ── MenuItem ──────────────────────────────────────────────
    await MenuItem.collection.createIndex({ category: 1, available: 1 }); // menu by category
    await MenuItem.collection.createIndex({ ItemName: "text" }); // menu search
    await MenuItem.collection.createIndex({ available: 1 }); // filter available only

    // ── Branch ────────────────────────────────────────────────
    await Branch.collection.createIndex({ isActive: 1 }); // active branches list

    console.log("✅ All DB indexes ensured");
  } catch (err) {
    // Non-fatal — app still works without indexes, just slower
    console.error("⚠️  Index creation warning:", err.message);
  }
}

module.exports = { ensureIndexes };
