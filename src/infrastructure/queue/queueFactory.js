const { Queue } = require("bullmq");
const { QUEUE_NAMES } = require("./queueNames");
const { getQueueRedisConnection } = require("./sharedRedisConnection");

function createQueue(
  name,
  { connection = getQueueRedisConnection(), defaultJobOptions } = {},
) {
  if (!connection) return null;
  return new Queue(name, { connection, defaultJobOptions });
}

function createQueues(options = {}) {
  return Object.fromEntries(
    Object.values(QUEUE_NAMES).map((name) => [
      name,
      createQueue(name, options),
    ]),
  );
}

module.exports = { createQueue, createQueues };
