const express = require("express");
const { connectDB } = require("./config/Database.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
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

// ✅ Admin — each router mounted ONCE
app.use("/admin", adminMenuRouter);
app.use("/admin", adminTableRouter);
app.use("/admin", adminUserRouter);
app.use("/admin", adminReportRouter);
app.use("/admin", adminCustomerRouter);
app.use("/admin", adminSettingsRouter);

// ✅ Cashier — each router mounted ONCE
app.use("/cashier", cashierbillingRouter);
app.use("/cashier", cashierKotRouter);
app.use("/cashier", cashierReportsRouter);

// ✅ Waiter — each router mounted ONCE
app.use("/waiter", waiterOrderRouter);
app.use("/waiter", waiterTableRouter);

// ✅ Chef
app.use("/chef", chefRouter);

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// ── Start Server ──────────────────────────────────────────────
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });
