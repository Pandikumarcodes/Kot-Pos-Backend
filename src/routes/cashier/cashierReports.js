const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const cashierReportsRouter = express.Router();
cashierReportsRouter.use(userAuth, allowRoles(["cashier"]));
const Billing = require("../../models/billings");

cashierReportsRouter.get("/income", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const myIncome = await Billing.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart },
          createdBy: req.user._id,
          paymentStatus: "paid",
        },
      },
      { $group: { _id: null, totalIncome: { $sum: "$totalAmount" } } },
    ]);

    res.status(200).json({ totalIncome: myIncome[0]?.totalIncome || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch your income" });
  }
});

module.exports = { cashierReportsRouter };
