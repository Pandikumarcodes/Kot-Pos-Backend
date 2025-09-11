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
app.use("/", authRouter);

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
