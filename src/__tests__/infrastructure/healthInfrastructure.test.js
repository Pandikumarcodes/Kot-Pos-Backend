const { STATES, LifecycleState } = require("../../infrastructure/health/lifecycleState");
const { validateEnvironment } = require("../../infrastructure/health/startupValidator");
const { checkMongo } = require("../../infrastructure/health/checks/mongoCheck");
const { checkSocket } = require("../../infrastructure/health/checks/socketCheck");
const { HealthService } = require("../../infrastructure/health/healthService");
const { ShutdownManager } = require("../../infrastructure/health/shutdownManager");
const { EnvironmentValidationError, LifecycleTransitionError, ShutdownTimeoutError } = require("../../infrastructure/health/errors");

describe("LifecycleState", () => {
  test("allows valid transitions and exposes read-only state", () => {
    const lifecycle = new LifecycleState();
    expect(lifecycle.getState()).toBe(STATES.STARTING);
    lifecycle.transition(STATES.READY);
    expect(lifecycle.getState()).toBe(STATES.READY);
    expect(lifecycle.isStartupCompleted()).toBe(true);
    expect(() => { lifecycle.state = "failed"; }).not.toThrow();
    expect(lifecycle.getState()).toBe(STATES.READY);
  });

  test("rejects invalid transitions", () => {
    const lifecycle = new LifecycleState();
    expect(() => lifecycle.transition(STATES.STOPPED)).toThrow(LifecycleTransitionError);
  });
});

const validEnv = { MONGO_URI: "mongodb://localhost:27017/kot", JWT_SECRET: "a".repeat(20), REFRESH_TOKEN_SECRET: "b".repeat(20), PORT: "3000", NODE_ENV: "test" };
describe("startup validator", () => {
  test("returns normalized configuration", () => {
    const config = validateEnvironment({ ...validEnv, FRONTEND_URL: "http://localhost:5173", BACKEND_URL: "https://api.example.com" });
    expect(config.port).toBe(3000);
    expect(config.frontendUrls).toEqual(["http://localhost:5173"]);
    expect(config.mongoUri).toBe(validEnv.MONGO_URI);
  });
  test("reports missing and invalid values without secret values", () => {
    expect(() => validateEnvironment({ ...validEnv, JWT_SECRET: "short", PORT: "bad", MONGO_URI: "secret-value" })).toThrow(EnvironmentValidationError);
    try { validateEnvironment({ ...validEnv, JWT_SECRET: "top-secret-value", PORT: "bad" }); } catch (error) { expect(JSON.stringify(error)).not.toContain("top-secret-value"); }
  });
});

describe("checks", () => {
  test("reports connected MongoDB", async () => { await expect(checkMongo({ connection: { readyState: 1 } })).resolves.toEqual({ status: "healthy" }); });
  test("reports disconnected MongoDB", async () => { await expect(checkMongo({ connection: { readyState: 0 } })).resolves.toEqual({ status: "unhealthy", reason: "connection state is 0" }); });
  test("reports MongoDB timeout", async () => {
    const connection = { readyState: 1, db: { admin: () => ({ ping: () => new Promise(() => {}) }) } };
    await expect(checkMongo({ connection, ping: true, timeoutMs: 5 })).resolves.toMatchObject({ status: "unhealthy", reason: "MongoDB ping timed out" });
  });
  test("reports initialized and missing Socket.IO", () => {
    expect(checkSocket({ socket: { httpServer: {} }, lifecycle: { getState: () => "ready" } }).status).toBe("healthy");
    expect(checkSocket({ lifecycle: { getState: () => "ready" } }).status).toBe("unhealthy");
  });
});

describe("HealthService", () => {
  test("returns liveness", async () => {
    const lifecycle = new LifecycleState(STATES.READY);
    const result = await new HealthService({ lifecycle, socket: {} }).getLiveness();
    expect(result).toMatchObject({ status: "healthy", state: "ready" });
  });
  test("returns readiness success and failure", async () => {
    const lifecycle = new LifecycleState(STATES.READY);
    const healthy = new HealthService({ lifecycle, socket: { httpServer: {} }, mongoCheck: async () => ({ status: "healthy" }) });
    expect((await healthy.getReadiness()).status).toBe("healthy");
    const failed = new HealthService({ lifecycle, socket: { httpServer: {} }, mongoCheck: async () => ({ status: "unhealthy", reason: "offline" }) });
    expect((await failed.getReadiness()).status).toBe("unhealthy");
  });
});

describe("ShutdownManager", () => {
  test("runs callbacks in registration order and is idempotent", async () => {
    const order = [];
    const manager = new ShutdownManager();
    manager.register(async () => order.push("first"));
    manager.register(async () => order.push("second"));
    const first = manager.execute();
    expect(manager.execute()).toBe(first);
    await first;
    expect(order).toEqual(["first", "second"]);
  });
  test("raises structured timeout error", async () => {
    const manager = new ShutdownManager({ defaultTimeoutMs: 5 });
    manager.register(() => new Promise(() => {}), { name: "database" });
    await expect(manager.execute()).rejects.toBeInstanceOf(ShutdownTimeoutError);
  });
});
