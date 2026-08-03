const {
  createQueues,
  getQueueRedisConnection,
  closeQueueRedis,
  QUEUE_NAMES,
  JOB_NAMES,
  jobOptions,
} = require("./index");
const { createWorkerManager } = require("../../workers/workerManager");
const { createEmailProvider } = require("./emailProvider");
const { scheduleDailySalesReport } = require("../../queues/scheduledQueues");
const reportService = require("../../services/reportService");
const logger = require("../../config/logger");

async function startBackgroundJobs({
  emailProvider = createEmailProvider(),
  reports = reportService,
} = {}) {
  const connection = getQueueRedisConnection();
  if (!connection) return null;
  const queues = createQueues({ connection, defaultJobOptions: jobOptions() });
  const manager = createWorkerManager({
    queues,
    connection,
    emailProvider,
    reportService: reports,
  });
  await scheduleDailySalesReport({
    queues,
    data: {
      recipients: (process.env.DAILY_REPORT_RECIPIENTS || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    },
  });
  const cleanup = queues[QUEUE_NAMES.CLEANUP];
  if (cleanup?.upsertJobScheduler) {
    await cleanup.upsertJobScheduler(
      "cleanup",
      { every: 86400000 },
      { name: JOB_NAMES.CLEANUP, data: {}, opts: jobOptions() },
    );
  }
  logger.info("Background jobs started", {
    queues: Object.values(QUEUE_NAMES),
  });
  return {
    queues,
    workers: manager,
    async close() {
      await manager.close();
      await Promise.all(
        Object.values(queues)
          .filter(Boolean)
          .map((queue) => queue.close()),
      );
      await closeQueueRedis();
    },
  };
}

module.exports = { startBackgroundJobs };
