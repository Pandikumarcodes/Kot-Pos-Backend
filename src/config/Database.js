const mongoose = require("mongoose");

const connectDB = async () => {
  const timeout = Number(
    process.env.MONGO_TIMEOUT_MS || process.env.MONGO_TIMEOUT,
  );
  const options =
    Number.isInteger(timeout) && timeout > 0
      ? { serverSelectionTimeoutMS: timeout, connectTimeoutMS: timeout }
      : {};
  if (process.env.NODE_ENV === "test") {
    options.bufferCommands = false;
    options.serverSelectionTimeoutMS = options.serverSelectionTimeoutMS || 1000;
    options.connectTimeoutMS = options.connectTimeoutMS || 1000;
  }
  await mongoose.connect(process.env.MONGO_URI, options);
};

module.exports = { connectDB };
