// utils/customerHelper.js
// ✅ Call this whenever a new order is placed (waiter or cashier)
// It will auto-create customer if not exists, or update stats if exists

const Customer = require("../models/customer");

/**
 * Upsert customer — create if new, update stats if existing
 * @param {string} name - customer name
 * @param {string} phone - customer phone (unique key)
 * @param {number} orderAmount - total amount of this order
 */
const upsertCustomer = async (name, phone, orderAmount = 0) => {
  try {
    if (!phone) return; // skip if no phone

    const existing = await Customer.findOne({ phone });

    if (existing) {
      // ✅ Update existing customer stats
      await Customer.findOneAndUpdate(
        { phone },
        {
          $inc: {
            totalOrders: 1,
            totalSpent: orderAmount,
          },
          $set: {
            lastVisit: new Date(),
            // update name if changed
            name: name || existing.name,
          },
        },
        { new: true },
      );
    } else {
      // ✅ Create new customer
      await Customer.create({
        name: name || "Walk-in",
        phone,
        totalOrders: 1,
        totalSpent: orderAmount,
        lastVisit: new Date(),
      });
    }
  } catch (err) {
    // Don't block order flow if customer upsert fails
    console.error("Customer upsert failed:", err.message);
  }
};

module.exports = { upsertCustomer };
