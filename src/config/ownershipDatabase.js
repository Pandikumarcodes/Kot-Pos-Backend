const path = require("node:path");
const dns = require("node:dns");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

let initialized = false;

const initializeOwnershipRuntime = () => {
  if (initialized) return;

  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  initialized = true;
};

const getMongoConnectionOptions = () => {
  const configuredTimeout = Number(
    process.env.MONGO_TIMEOUT_MS || process.env.MONGO_TIMEOUT,
  );
  const timeout = Number.isInteger(configuredTimeout) && configuredTimeout > 0
    ? Math.min(configuredTimeout, 30000)
    : 5000;

  return {
    serverSelectionTimeoutMS: timeout,
    connectTimeoutMS: timeout,
    socketTimeoutMS: timeout,
  };
};

const connectOwnershipDatabase = async () => {
  initializeOwnershipRuntime();
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, getMongoConnectionOptions());
};

const disconnectOwnershipDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

const logOwnershipScriptError = (error, { phase = "unknown" } = {}) => {
  const message = String(error?.message || "unknown error")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted database URI]")
    .replace(/(password|passwd|pwd)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/(MONGO_URI\s*[=:]\s*)[^\s,}]+/gi, "$1[redacted]");
  const lowerMessage = message.toLowerCase();
  const timeoutCategory = error?.code === "OWNERSHIP_BOUND_TIMEOUT"
    ? "connection-bound-timeout"
    : /timed out|timeout|server selection/i.test(lowerMessage)
      ? (/server selection/i.test(lowerMessage)
      ? "server-selection-timeout"
      : /connect/i.test(lowerMessage) ? "connect-timeout" : "bounded-operation-timeout")
      : "none";
  const dnsSrvCategory = /querysrv|srv|enotfound|eai_again|dns|name resolution/i.test(lowerMessage)
    ? (/(enotfound|eai_again|querysrv|name resolution)/i.test(lowerMessage)
      ? "dns-srv-resolution-failure"
      : "dns-srv-related-failure")
    : "none";

  console.error(JSON.stringify({
    phase,
    timeoutCategory,
    dnsSrvCategory,
    name: error?.name,
    code: error?.code,
    message,
  }));
};

initializeOwnershipRuntime();

module.exports = {
  initializeOwnershipRuntime,
  connectOwnershipDatabase,
  disconnectOwnershipDatabase,
  logOwnershipScriptError,
};
