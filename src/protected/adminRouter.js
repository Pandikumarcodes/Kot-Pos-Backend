const mongoose = require("mongoose");
const express = require("express");
const { userAuth, allowRoles } = require("../middlewares/auth");
const User = require("../models/users");
const MenuItem = require("../models/menuItems");
const {
  validateSignupData,
  validateStatus,
  validateRole,
  validateMenuData,
} = require("../utils/validation");

const adminRouter = express.Router();

// Middleware: only admins can access these routes
adminRouter.use(userAuth, allowRoles(["admin"]));

/**
 * PUT /admin/tables - post tables List
 */

adminRouter.post("/tables", (req, res) => {
  res.json({ message: "New table created" });
});

/**
 * PUT /admin/reports - get company reports
 */

adminRouter.get("/reports", (req, res) => {
  res.json({ message: "Sales and income reports" });
});

module.exports = { adminRouter };
