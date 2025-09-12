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
const { chefRouter } = require("./protected/chefRouter");
const { waiterRouter } = require("./protected/waiterRouter");
const { cashierRouter } = require("./protected/cashierRouter.js");

// Import Roueter Middleware
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/chef", chefRouter);
app.use("/waiter", waiterRouter);
app.use("/cashier", cashierRouter);

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
