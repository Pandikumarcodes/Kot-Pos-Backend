const { createQueues } = require("./queueFactory");
const { jobOptions } = require("./retryPolicy");
const { QUEUE_NAMES, JOB_NAMES } = require("./queueNames");
const { serializeScope } = require("./jobScope");

function createQueueService({ queues = createQueues() } = {}) {
  const add = (queueName, jobName, data, options) => {
    const queue = queues[queueName];
    if (!queue) return Promise.resolve(null);
    return queue.add(jobName, data, jobOptions(options));
  };
  return {
    enqueuePasswordResetEmail: (data, options) =>
      add(QUEUE_NAMES.EMAIL, JOB_NAMES.PASSWORD_RESET_EMAIL, data, options),
    enqueueStaffInvitationEmail: (data, options) =>
      add(QUEUE_NAMES.EMAIL, JOB_NAMES.STAFF_INVITATION_EMAIL, data, options),
    enqueueLowInventoryAlert: (data, options) =>
      add(
        QUEUE_NAMES.INVENTORY_ALERTS,
        JOB_NAMES.LOW_INVENTORY_ALERT,
        { ...data, scope: serializeScope(data?.scope) },
        options,
      ),
    enqueueDailySalesReport: (data, options) =>
      add(QUEUE_NAMES.REPORTS, JOB_NAMES.DAILY_SALES_REPORT, { ...data, scope: serializeScope(data?.scope) }, options),
    enqueueCleanup: (data = {}, options) =>
      add(QUEUE_NAMES.CLEANUP, JOB_NAMES.CLEANUP, data, options),
  };
}

module.exports = { createQueueService };
