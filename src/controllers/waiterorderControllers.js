const Kot = require("../models/kot");
const { getPagination, paginate } = require("../middleware/paginate");

// GET /waiter/orders
async function getOrders(req, res) {
  try {
    const { skip, limit, page } = getPagination(req);

    // ── Build filter ──────────────────────────────────────────
    const filter = { ...req.branchFilter }; // from branchScope middleware

    if (req.query.status && req.query.status !== "all") {
      filter.status = req.query.status;
    }

    if (req.query.orderType) {
      filter.orderType = req.query.orderType;
    }

    if (req.query.tableNumber) {
      filter.tableNumber = parseInt(req.query.tableNumber);
    }

    // Date range
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999); // include full end day
        filter.createdAt.$lte = to;
      }
    }

    // Text search — uses the text index on customerName + customerPhone
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // ── Query with pagination ─────────────────────────────────
    const [orders, total] = await Promise.all([
      Kot.find(filter)
        .sort({ createdAt: -1 }) // newest first — uses { branchId, createdAt } index
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "username") // only fetch username, not password
        .lean(), // plain JS objects — faster than Mongoose docs
      Kot.countDocuments(filter),
    ]);

    res.json(paginate(orders, total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

module.exports = { getOrders };
