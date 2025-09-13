const express = require("express");
const { connectDB } = require("./config/Database");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = 3000;

// ✅ Middlewares — must come before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Routes
const { authRouter } = require("./router/auth");
const { adminRouter } = require("./protected/adminRouter");

// admin Routes
const { adminUserRouter } = require("./adminRouter/adminUser.js");
const { adminMenuRouter } = require("./adminRouter/adminMenu.js");

// cashier Router
const { cashierbillingRouter } = require("./cashierRouter/cashierBilling.js");
const { cashierOnlineRouter } = require("./cashierRouter/cashierOnline.js");
const { cashierKotRouter } = require("./cashierRouter/cashierKotOrder.js");
const { cashierReportsRouter } = require("./cashierRouter/cashierReports.js");

// waiter Router
const { waiterRouter } = require("./waiterRouter/waiterRouter.js");

// chef Router
const { chefRouter } = require("./chefRouter/chefRouter.js");

// Auth Router  Middleware
app.use("/auth", authRouter);
app.use("/admin", adminRouter);

//Admin Router
app.use("/admin", adminUserRouter);
app.use("/admin", adminMenuRouter);

//cashier Router
app.use("/cashier", cashierbillingRouter);
app.use("/cashier", cashierOnlineRouter);
app.use("/cashier", cashierKotRouter);
app.use("/cashier", cashierReportsRouter);

// waiter Router
app.use("/waiter", waiterRouter);

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
