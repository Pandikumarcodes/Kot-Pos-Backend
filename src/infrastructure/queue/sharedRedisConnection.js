const IORedis = require("ioredis");
const logger = require("../../config/logger");

let connection;

function getQueueRedisConnection(source = process.env) {
  if (!source.REDIS_URL?.trim()) return null;
  if (!connection) {
    connection = new IORedis(source.REDIS_URL.trim(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 100, 5000),
    });
    connection.on("error", (error) =>
      logger.warn("Queue Redis unavailable", { error: error.message }),
    );
  }
  return connection;
}

async function closeQueueRedis() {
  if (!connection) return;
  const current = connection;
  connection = undefined;
  await current.quit();
}

module.exports = { getQueueRedisConnection, closeQueueRedis };
