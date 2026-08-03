const mongoose = require("mongoose");

const connectDB = async () => {
  const timeout = Number(process.env.MONGO_TIMEOUT_MS || process.env.MONGO_TIMEOUT);
  const options = Number.isInteger(timeout) && timeout > 0
    ? { serverSelectionTimeoutMS: timeout, connectTimeoutMS: timeout }
    : undefined;
  await mongoose.connect(process.env.MONGO_URI, options);
};

module.exports = { connectDB };
