const Billing = require("../models/billings");
const { getPagination, paginate } = require("../middleware/paginate");

// GET /cashier/bills
async function getBills(req, res) {
  try {
    const { skip, limit, page } = getPagination(req);

    // ── Build filter ──────────────────────────────────────────
    const filter = { ...req.branchFilter };

    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // ── Query ─────────────────────────────────────────────────
    const [bills, total] = await Promise.all([
      Billing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Billing.countDocuments(filter),
    ]);

    res.json({
      myBills: bills, // ← existing frontend reads this
      ...paginate(bills, total, page, limit), // ← new pagination envelope
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
}

module.exports = { getBills };
