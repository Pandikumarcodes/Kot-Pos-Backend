const { EventEmitter } = require("events");
const { ShutdownManager } = require("../../infrastructure/health/shutdownManager");
const { LifecycleState, STATES } = require("../../infrastructure/health/lifecycleState");
const { createGracefulShutdown } = require("../../infrastructure/health/gracefulShutdown");

function setup(overrides = {}) {
  const lifecycle = overrides.lifecycle || new LifecycleState(STATES.READY);
  const manager = overrides.shutdownManager || new ShutdownManager({ defaultTimeoutMs: 25 });
  const logger = { info: jest.fn(), error: jest.fn() };
  const exit = jest.fn();
  const server = { listening: true, close: jest.fn((callback) => { server.listening = false; callback(); }) };
  const io = { close: jest.fn((callback) => callback()) };
  const mongo = { disconnect: jest.fn(async () => {}) };
  const controller = createGracefulShutdown({ server, io, mongo, lifecycle, shutdownManager: manager, logger, timeoutMs: 50, exit, ...overrides });
  return { controller, lifecycle, manager, logger, exit, server, io, mongo };
}

describe("graceful shutdown", () => {
  test("transitions ready to draining, returns readiness 503, and stops in order", async () => {
    const { controller, lifecycle, manager, server, io, mongo, exit } = setup();
    const order = [];
    server.close.mockImplementation((callback) => { order.push("http"); callback(); });
    manager.register(() => order.push("callback"), { name: "application" });
    io.close.mockImplementation((callback) => { order.push("socket"); callback(); });
    mongo.disconnect.mockImplementation(async () => order.push("mongo"));

    await controller.shutdown("SIGTERM");

    expect(lifecycle.getState()).toBe(STATES.STOPPED);
    expect(order).toEqual(["http", "callback", "socket", "mongo"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  test("is idempotent and ignores duplicate signals", async () => {
    const processObject = new EventEmitter();
    const state = setup();
    const remove = state.controller.installSignalHandlers(processObject);
    processObject.emit("SIGTERM");
    processObject.emit("SIGINT");
    await state.controller.shutdown("direct-call");

    expect(state.server.close).toHaveBeenCalledTimes(1);
    expect(state.io.close).toHaveBeenCalledTimes(1);
    expect(state.mongo.disconnect).toHaveBeenCalledTimes(1);
    expect(state.exit).toHaveBeenCalledTimes(1);
    remove();
  });

  test("continues cleanup after a callback failure and preserves failure state", async () => {
    const state = setup();
    const order = [];
    state.manager.register(() => { order.push("callback"); throw new Error("callback failed"); }, { name: "bad-callback" });
    state.io.close.mockImplementation((callback) => { order.push("socket"); callback(); });
    state.mongo.disconnect.mockImplementation(async () => order.push("mongo"));

    const result = await state.controller.shutdown("SIGINT");

    expect(result.state).toBe(STATES.FAILED);
    expect(state.lifecycle.getState()).toBe(STATES.FAILED);
    expect(order).toEqual(["callback", "socket", "mongo"]);
    expect(state.logger.error).toHaveBeenCalledWith("Graceful shutdown failed", expect.objectContaining({ reason: "SIGINT" }));
    expect(state.exit).toHaveBeenCalledWith(1);
  });

  test("fails safely when the configured shutdown timeout is exceeded", async () => {
    const state = setup({ timeoutMs: 10 });
    state.manager.register(() => new Promise(() => {}), { name: "hanging-callback", timeoutMs: 1000 });

    const result = await state.controller.shutdown("SIGTERM");

    expect(result.state).toBe(STATES.FAILED);
    expect(state.lifecycle.getState()).toBe(STATES.FAILED);
    expect(state.logger.error).toHaveBeenCalledWith("Graceful shutdown timed out", expect.objectContaining({ reason: "SIGTERM", errorCode: "SHUTDOWN_TIMEOUT" }));
    expect(state.exit).toHaveBeenCalledWith(1);
  });
});
