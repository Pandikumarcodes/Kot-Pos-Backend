const mongoose = require("mongoose");
const { HealthCheckError } = require("../errors");

async function checkMongo(options = {}) {
  const connection = options.connection || mongoose.connection;
  const timeoutMs = options.timeoutMs ?? 1000;
  if (connection.readyState !== 1) return { status: "unhealthy", reason: `connection state is ${connection.readyState}` };
  if (!options.ping) return { status: "healthy" };
  const admin = connection.db?.admin?.();
  const ping = admin?.ping?.bind(admin);
  if (typeof ping !== "function") return { status: "unhealthy", reason: "MongoDB ping is unavailable" };
  try {
    await Promise.race([Promise.resolve().then(() => ping()), new Promise((_, reject) => setTimeout(() => reject(new HealthCheckError("MongoDB ping timed out", { timeoutMs })), timeoutMs))]);
    return { status: "healthy" };
  } catch (error) {
    return { status: "unhealthy", reason: error instanceof HealthCheckError ? error.message : "MongoDB ping failed" };
  }
}

module.exports = { checkMongo };
