const express = require("express");
const { connectDB } = require("./config/Database.js");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = 3000;

// ✅ Middlewares — must come before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Routes
const { authRouter } = require("./routes/auth.js");

// admin Routes
const { adminUserRouter } = require("./routes/admin/adminUser.js");
const { adminMenuRouter } = require("./routes/admin/adminMenu.js");
const { adminTableRouter } = require("./routes/admin/adminTable.js");
// const { adminReportRouter } = require("./routes/admin/adminReportRouter.js");

// cashier Router
const { cashierbillingRouter } = require("./routes/cashier/cashierBilling.js");
const { cashierKotRouter } = require("./routes/cashier/cashierKotOrder.js");
const { cashierReportsRouter } = require("./routes/cashier/cashierReports.js");
// const { cashierOnlineRouter } = require("./routes/cashier/cashierOnline.js");

// waiter Router
const { waiterOrderRouter } = require("./routes/waiter/waiterOrderRouter.js");
const { waiterTableRouter } = require("./routes/waiter/waiterTableRouter.js");

// chef Router
const { chefRouter } = require("./routes/chef/chefRouter.js");

// Auth Router  Middleware
app.use("/auth", authRouter);

//Admin Router
app.use("/admin", adminUserRouter);
app.use("/admin", adminMenuRouter);
app.use("/admin", adminTableRouter);
// app.use("/admin", adminReportRouter);

//cashier Router
app.use("/cashier", cashierbillingRouter);
app.use("/cashier", cashierKotRouter);
app.use("/cashier", cashierReportsRouter);
// app.use("/cashier", cashierOnlineRouter);

// waiter Router
app.use("/waiter", waiterOrderRouter);
app.use("/waiter", waiterTableRouter);

// chef Router
app.use("/chef", chefRouter);

//global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// const cors = require("cors");
// app.use(cors({ origin: "http://localhost:5173", credentials: true }))

// ✅ DB + Server Start
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is successfully listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });
