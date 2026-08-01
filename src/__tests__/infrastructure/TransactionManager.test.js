const TransactionManager = require("../../infrastructure/transaction/TransactionManager");
const {
  DEFAULT_TRANSACTION_OPTIONS,
} = require("../../infrastructure/transaction/transactionOptions");

const createSession = (overrides = {}) => ({
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn().mockResolvedValue(undefined),
  inTransaction: jest.fn().mockReturnValue(false),
  withTransaction: jest.fn(async (callback) => callback()),
  ...overrides,
});

const createManager = (session, options = {}) =>
  new TransactionManager({
    connection: { startSession: jest.fn().mockResolvedValue(session) },
    ...options,
  });

describe("TransactionManager", () => {
  test("commits through withTransaction and returns the work result", async () => {
    const session = createSession();
    const manager = createManager(session);
    const work = jest.fn().mockResolvedValue({ id: "result" });

    await expect(manager.execute(work)).resolves.toEqual({ id: "result" });

    expect(work).toHaveBeenCalledWith(session);
    expect(session.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      DEFAULT_TRANSACTION_OPTIONS,
    );
    expect(session.abortTransaction).not.toHaveBeenCalled();
  });

  test("aborts an active transaction and preserves the application error", async () => {
    const applicationError = new Error("validation failed");
    const session = createSession({
      inTransaction: jest.fn().mockReturnValue(true),
    });
    const manager = createManager(session);

    await expect(
      manager.execute(async () => {
        throw applicationError;
      }),
    ).rejects.toBe(applicationError);

    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
  });

  test("retries transient transaction errors up to the configured limit", async () => {
    const transientError = new Error("write conflict");
    transientError.errorLabels = ["TransientTransactionError"];
    const session = createSession();
    const manager = createManager(session, { maxRetries: 2 });
    const work = jest
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce("committed");

    await expect(manager.execute(work)).resolves.toBe("committed");

    expect(session.withTransaction).toHaveBeenCalledTimes(2);
    expect(work).toHaveBeenCalledTimes(2);
  });

  test("does not retry ordinary application errors", async () => {
    const applicationError = new Error("not retryable");
    const session = createSession();
    const manager = createManager(session, { maxRetries: 3 });
    const work = jest.fn().mockRejectedValue(applicationError);

    await expect(manager.execute(work)).rejects.toBe(applicationError);

    expect(work).toHaveBeenCalledTimes(1);
  });

  test("ends the session after both commit and rollback", async () => {
    const committedSession = createSession();
    const rolledBackSession = createSession();

    await createManager(committedSession).execute(async () => "ok");
    await expect(
      createManager(rolledBackSession).execute(async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");

    expect(committedSession.endSession).toHaveBeenCalledTimes(1);
    expect(rolledBackSession.endSession).toHaveBeenCalledTimes(1);
  });

  test("cleanup failures never replace the original application error", async () => {
    const applicationError = new Error("original");
    const session = createSession({
      endSession: jest.fn().mockRejectedValue(new Error("cleanup failed")),
    });

    await expect(
      createManager(session).execute(async () => {
        throw applicationError;
      }),
    ).rejects.toBe(applicationError);
  });

  test("cleanup failures do not misreport a committed transaction", async () => {
    const session = createSession({
      endSession: jest.fn().mockRejectedValue(new Error("cleanup failed")),
    });

    await expect(
      createManager(session).execute(async () => "committed"),
    ).resolves.toBe("committed");
  });
});
