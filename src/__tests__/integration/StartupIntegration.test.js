const { EnvironmentValidationError } = require("../../infrastructure/health/errors");

describe("startup integration", () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    process.env.MONGO_URI ||= "mongodb://localhost:27017/kot-pos-test";
    process.env.JWT_SECRET ||= "a".repeat(32);
    process.env.REFRESH_TOKEN_SECRET ||= "b".repeat(32);
    process.env.PORT ||= "3000";
    process.env.NODE_ENV ||= "test";
    appModule = require("../../app");
  });

  test("valid configuration preserves the existing startup order and reaches ready", async () => {
    const validate = jest.fn();
    const order = [];
    const connect = jest.fn(async () => order.push("connect"));
    const indexes = jest.fn(async () => order.push("indexes"));
    const listen = jest.fn((onReady) => { order.push("listen"); onReady(); });

    validate.mockImplementation(() => order.push("validate"));
    await appModule.startServer({ validate, connect, indexes, listen });

    expect(order).toEqual(["validate", "connect", "indexes", "listen"]);
    expect(appModule.lifecycle.getState()).toBe("ready");
    expect(appModule.lifecycle.isStartupCompleted()).toBe(true);
  });

  test("invalid configuration fails fast, logs only field metadata, and never connects", async () => {
    const validationError = new EnvironmentValidationError([
      { field: "JWT_SECRET", reason: "must be at least 16 characters" },
    ]);
    const connect = jest.fn();
    const exit = jest.spyOn(process, "exit").mockImplementation(() => undefined);
    const logger = require("../../config/logger");
    const errorLog = jest.spyOn(logger, "error").mockImplementation(() => logger);

    await appModule.startServer({
      validate: () => {
        throw validationError;
      },
      connect,
    });

    expect(connect).not.toHaveBeenCalled();
    expect(appModule.lifecycle.getState()).toBe("failed");
    expect(errorLog).toHaveBeenCalledWith("Startup validation failed", expect.objectContaining({
      code: "ENVIRONMENT_VALIDATION_ERROR",
      fields: expect.any(Array),
    }));
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("JWT_SECRET=");

    errorLog.mockRestore();
    exit.mockRestore();
  });
});
