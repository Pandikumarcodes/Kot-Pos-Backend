const { createQueueService } = require("../infrastructure/queue");

function createBackgroundJobService({ enqueue = createQueueService() } = {}) {
  return {
    sendPasswordResetEmail: (data, options) => enqueue.enqueuePasswordResetEmail(data, options),
    sendStaffInvitationEmail: (data, options) => enqueue.enqueueStaffInvitationEmail(data, options),
    sendLowInventoryAlert: (data, options) => enqueue.enqueueLowInventoryAlert(data, options),
    sendDailySalesReport: (data, options) => enqueue.enqueueDailySalesReport(data, options),
    runCleanup: (data, options) => enqueue.enqueueCleanup(data, options),
  };
}

module.exports = { createBackgroundJobService };
