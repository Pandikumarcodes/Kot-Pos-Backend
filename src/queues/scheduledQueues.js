const { QUEUE_NAMES, JOB_NAMES, jobOptions } = require("../infrastructure/queue");

async function scheduleDailySalesReport({ queues, data, pattern = "0 21 * * *" } = {}) {
  const queue = queues?.[QUEUE_NAMES.REPORTS];
  if (!queue) return null;
  if (typeof queue.upsertJobScheduler === "function") {
    return queue.upsertJobScheduler("daily-sales-report", { pattern }, { name: JOB_NAMES.DAILY_SALES_REPORT, data, opts: jobOptions({}) });
  }
  return queue.add(JOB_NAMES.DAILY_SALES_REPORT, data, jobOptions({ repeat: { pattern }, jobId: "daily-sales-report" }));
}

module.exports = { scheduleDailySalesReport };
