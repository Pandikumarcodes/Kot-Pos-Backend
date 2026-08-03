const { createWorker } = require("../infrastructure/queue");
const { QUEUE_NAMES } = require("../infrastructure/queue");
const { emailJobHandlers } = require("../jobs/emailJobs");
const { inventoryJobHandlers } = require("../jobs/inventoryJobs");
const { reportJobHandlers } = require("../jobs/reportJobs");
const { cleanupJobHandlers } = require("../jobs/cleanupJobs");
const logger = require("../config/logger");

const configuredConcurrency = (fallback) => Number(process.env.QUEUE_CONCURRENCY) || fallback;

const processorFor = (handlers) => async (job) => {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`Unsupported background job: ${job.name}`);
  return handler(job.data);
};

function createWorkerManager({ queues, emailProvider, reportService, reportRenderer = async () => null, connection } = {}) {
  const workers = [
    createWorker(QUEUE_NAMES.EMAIL, processorFor(emailJobHandlers({ emailProvider })), { connection, concurrency: configuredConcurrency(5) }),
    createWorker(QUEUE_NAMES.INVENTORY_ALERTS, processorFor(inventoryJobHandlers({ emailProvider })), { connection, concurrency: configuredConcurrency(2) }),
    createWorker(QUEUE_NAMES.REPORTS, processorFor(reportJobHandlers({ reportService, reportRenderer, emailProvider })), { connection, concurrency: configuredConcurrency(1) }),
    createWorker(QUEUE_NAMES.CLEANUP, processorFor(cleanupJobHandlers({ queues })), { connection, concurrency: configuredConcurrency(1) }),
  ].filter(Boolean);
  workers.forEach((worker) => {
    worker.on("failed", (job, error) => logger.error("Background job failed", { queue: worker.name, jobId: job?.id, jobName: job?.name, error: error.message }));
  });
  return {
    workers,
    async close() { await Promise.all(workers.map((worker) => worker.close())); },
  };
}

module.exports = { createWorkerManager, processorFor };
