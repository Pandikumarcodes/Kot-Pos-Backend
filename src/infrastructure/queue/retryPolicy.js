const DEFAULT_RETRY_POLICY = Object.freeze({
  attempts: Number(process.env.QUEUE_RETRY_ATTEMPTS) || 5,
  backoff: {
    type: "exponential",
    delay: Number(process.env.QUEUE_RETRY_DELAY_MS) || 1000,
  },
  removeOnComplete: {
    age: Number(process.env.QUEUE_COMPLETED_RETENTION_SECONDS) || 86400,
    count: 1000,
  },
  removeOnFail: false,
});

const jobOptions = (overrides = {}) => ({
  ...DEFAULT_RETRY_POLICY,
  ...overrides,
  backoff: { ...DEFAULT_RETRY_POLICY.backoff, ...(overrides.backoff || {}) },
});

module.exports = { DEFAULT_RETRY_POLICY, jobOptions };
