const { Worker } = require("bullmq");
const { getQueueRedisConnection } = require("./sharedRedisConnection");

function createWorker(
  name,
  processor,
  { connection = getQueueRedisConnection(), concurrency = 1 } = {},
) {
  if (!connection) return null;
  return new Worker(name, processor, { connection, concurrency });
}

module.exports = { createWorker };
