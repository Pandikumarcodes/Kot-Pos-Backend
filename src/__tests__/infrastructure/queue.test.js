const { createQueueService } = require("../../infrastructure/queue/queueService");
const { jobOptions } = require("../../infrastructure/queue/retryPolicy");
const { emailJobHandlers } = require("../../jobs/emailJobs");
const { cleanupJobHandlers } = require("../../jobs/cleanupJobs");
const { JOB_NAMES, QUEUE_NAMES } = require("../../infrastructure/queue");
const { createBackgroundJobService } = require("../../services/backgroundJobService");

describe("background job infrastructure", () => {
  test("service facade enqueues named jobs without exposing BullMQ", async () => {
    const add = jest.fn().mockResolvedValue({ id: "1" });
    const service = createQueueService({ queues: { [QUEUE_NAMES.EMAIL]: { add } } });
    await service.enqueuePasswordResetEmail({ recipient: "user@example.com", token: "opaque" });
    expect(add).toHaveBeenCalledWith(JOB_NAMES.PASSWORD_RESET_EMAIL, expect.any(Object), expect.objectContaining({ attempts: 5, removeOnFail: false }));
  });

  test("application service facade delegates to the queue port", async () => {
    const enqueue = { enqueueLowInventoryAlert: jest.fn().mockResolvedValue({ id: "2" }) };
    const service = createBackgroundJobService({ enqueue });
    await service.sendLowInventoryAlert({ inventoryId: "i1" });
    expect(enqueue.enqueueLowInventoryAlert).toHaveBeenCalledWith({ inventoryId: "i1" }, undefined);
  });

  test("retry policy uses exponential backoff and retains completed jobs", () => {
    expect(jobOptions()).toEqual(expect.objectContaining({
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: expect.objectContaining({ age: 86400 }),
    }));
  });

  test("email handlers delegate delivery and preserve job payload", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await emailJobHandlers({ emailProvider: { send } })[JOB_NAMES.PASSWORD_RESET_EMAIL]({ to: "a@b.test" });
    expect(send).toHaveBeenCalledWith({ to: "a@b.test", template: "password-reset" });
  });

  test("cleanup handler cleans completed and failed jobs", async () => {
    const clean = jest.fn().mockResolvedValue([]);
    await cleanupJobHandlers({ queues: { a: { name: "a", clean } } })[JOB_NAMES.CLEANUP]({ graceMs: 10 });
    expect(clean).toHaveBeenCalledTimes(2);
    expect(clean).toHaveBeenNthCalledWith(1, 10, 1000, "completed");
    expect(clean).toHaveBeenNthCalledWith(2, 10, 1000, "failed");
  });
});
