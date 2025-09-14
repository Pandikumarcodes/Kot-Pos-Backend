// const mongoose = require("mongoose");
// const express = require("express");
// const { userAuth, allowRoles } = require("../middlewares/auth");
// const User = require("../models/users");
// const MenuItem = require("../models/menuItems");
// const {
//   validateSignupData,
//   validateStatus,
//   validateRole,
//   validateMenuData,
// } = require("../utils/validation");

// const adminReportRouter = express.Router();

// // Middleware: only admins can access these routes
// adminReportRouter.use(userAuth, allowRoles(["admin"]));

// adminReportRouter.get("/reports", async (req, res) => {
//   try {
//     const { from, to } = req.query;

//     // Default: today
//     const startDate = from
//       ? new Date(from)
//       : new Date(new Date().setHours(0, 0, 0, 0));
//     const endDate = to ? new Date(to) : new Date();

//     // Aggregate total income per cashier
//     const incomeReport = await Billing.aggregate([
//       {
//         $match: {
//           paymentStatus: "paid",
//           createdAt: { $gte: startDate, $lte: endDate },
//         },
//       },
//       {
//         $group: {
//           _id: "$createdBy",
//           totalIncome: { $sum: "$totalAmount" },
//           totalOrders: { $sum: 1 },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "cashier",
//         },
//       },
//       { $unwind: "$cashier" },
//       {
//         $project: {
//           cashierName: "$cashier.name",
//           totalIncome: 1,
//           totalOrders: 1,
//         },
//       },
//     ]);

//     res.status(200).json({ incomeReport });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch reports" });
//   }
// });

// module.exports = { adminReportRouter };
