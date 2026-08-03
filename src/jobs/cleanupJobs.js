const { JOB_NAMES } = require("../infrastructure/queue");

const cleanupJobHandlers = ({ queues }) => ({
  [JOB_NAMES.CLEANUP]: async ({ graceMs = 86400000 } = {}) => {
    const results = [];
    for (const queue of Object.values(queues)) {
      if (!queue) continue;
      const [completed, failed] = await Promise.all([
        queue.clean(graceMs, 1000, "completed"),
        queue.clean(graceMs, 1000, "failed"),
      ]);
      results.push({
        name: queue.name,
        completed: completed.length,
        failed: failed.length,
      });
    }
    return results;
  },
});

module.exports = { cleanupJobHandlers };
