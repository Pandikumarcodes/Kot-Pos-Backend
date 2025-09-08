const express = require("express");
const { connectDB } = require("./config/Database");
const cookieParser = require("cookie-parser");
const app = express();
const PORT = 3000;
app.use(express.json());
app.use(cookieParser());

const { authRouter } = require("./router/auth");
app.use("/", authRouter);

connectDB()
  .then(() => {
    console.log("✅ Database connection established");
    app.listen(PORT, () => {
      console.log(`server is sucussfully listining running ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });
