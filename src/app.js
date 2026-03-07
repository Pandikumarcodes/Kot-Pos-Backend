const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const { connectDB } = require("./config/Database.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// ── Import Routers ────────────────────────────────────────────
const { authRouter } = require("./routes/auth.js");
const { router } = require("./routes/testRouter.js");

// Admin
const { adminUserRouter } = require("./routes/admin/adminUser.js");
const { adminMenuRouter } = require("./routes/admin/adminMenu.js");
const { adminTableRouter } = require("./routes/admin/adminTable.js");
const { adminReportRouter } = require("./routes/admin/adminReportRouter");
const {
  adminCustomerRouter,
} = require("./routes/admin/adminCustomerRouter.js");
const {
  adminSettingsRouter,
} = require("./routes/admin/adminSettingsRouter.js");

// Cashier
const { cashierbillingRouter } = require("./routes/cashier/cashierBilling.js");
const { cashierKotRouter } = require("./routes/cashier/cashierKotOrder.js");
const { cashierReportsRouter } = require("./routes/cashier/cashierReports.js");

// Waiter
const { waiterOrderRouter } = require("./routes/waiter/waiterOrderRouter.js");
const { waiterTableRouter } = require("./routes/waiter/waiterTableRouter.js");

// Chef
const { chefRouter } = require("./routes/chef/chefRouter.js");

// ── Mount Routes ──────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/test", router);

// ✅ Admin
app.use("/admin", adminMenuRouter);
app.use("/admin", adminTableRouter);
app.use("/admin", adminUserRouter);
app.use("/admin", adminReportRouter);
app.use("/admin", adminCustomerRouter);
app.use("/admin", adminSettingsRouter);

// ✅ Cashier
app.use("/cashier", cashierbillingRouter);
app.use("/cashier", cashierKotRouter);
app.use("/cashier", cashierReportsRouter);

// ✅ Waiter
app.use("/waiter", waiterOrderRouter);
app.use("/waiter", waiterTableRouter);

// ✅ Chef
app.use("/chef", chefRouter);

// ── Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "KOT POS API is running!" });
});

// ── Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ─ Server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV}`);
      console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });
