const { createClient } = require("redis");
const logger = require("../../config/logger");

let client;
let enabled = false;
let connected = false;

const isConfigured = (source = process.env) =>
  Boolean(source.REDIS_URL?.trim());

function getRedisClient() {
  if (!client && isConfigured()) {
    client = createClient({
      url: process.env.REDIS_URL.trim(),
      socket: {
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 1000,
        reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
      },
    });
    client.on("ready", () => {
      connected = true;
      logger.info("Redis cache connected");
    });
    client.on("end", () => {
      connected = false;
    });
    client.on("error", (error) => {
      connected = false;
      logger.warn("Redis cache unavailable; requests will bypass cache", {
        error: error.message,
      });
    });
  }
  return client;
}

async function connectRedis() {
  const redis = getRedisClient();
  if (!redis) return false;
  if (redis.isReady) {
    connected = true;
    return true;
  }
  try {
    await redis.connect();
    connected = true;
    return true;
  } catch (error) {
    connected = false;
    logger.warn("Redis startup connection failed; continuing without cache", {
      error: error.message,
    });
    return false;
  }
}

async function disconnectRedis() {
  if (!client) return;
  try {
    if (client.isOpen) await client.quit();
  } finally {
    connected = false;
    client = undefined;
  }
}

const redisStatus = () => ({
  configured: isConfigured(),
  connected: Boolean(connected && client?.isReady),
});

module.exports = { getRedisClient, connectRedis, disconnectRedis, redisStatus };
