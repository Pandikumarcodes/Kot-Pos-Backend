const express = require("express");
const { connectDB } = require("./utils/Database");
const app = express();
const PORT = 3000;

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
