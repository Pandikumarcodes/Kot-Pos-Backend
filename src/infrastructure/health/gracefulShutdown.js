const { STATES } = require("./lifecycleState");

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error);
      else resolve();
    });
  });
}

function closeSocket(socket) {
  if (!socket || typeof socket.close !== "function") return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    try {
      const result = socket.close(finish);
      if (result && typeof result.then === "function") result.then(() => finish(), finish);
      else if (socket.close.length === 0) finish();
    } catch (error) { finish(error); }
  });
}

function disconnectMongo(mongo) {
  if (!mongo || typeof mongo.disconnect !== "function") return Promise.resolve();
  return Promise.resolve().then(() => mongo.disconnect());
}

function createGracefulShutdown({
  server,
  io,
  mongo,
  lifecycle,
  shutdownManager,
  logger,
  timeoutMs = 10000,
  exit = (code) => process.exit(code),
} = {}) {
  if (!lifecycle || !shutdownManager) throw new TypeError("Lifecycle and ShutdownManager are required");

  let execution;
  const shutdown = (reason = "unknown") => {
    if (execution) return execution;

    execution = (async () => {
      const startedAt = Date.now();
      const context = { reason: String(reason), timeoutMs, lifecycleState: lifecycle.getState() };
      try {
        if (lifecycle.getState() === STATES.READY || lifecycle.getState() === STATES.STARTING || lifecycle.getState() === STATES.FAILED) {
          lifecycle.transition(STATES.DRAINING);
        }
        logger?.info("Graceful shutdown started", { ...context, lifecycleState: lifecycle.getState() });

        let firstFailure;
        const cleanup = async (operation) => {
          try { await operation(); }
          catch (error) {
            firstFailure ||= error;
            logger?.error("Shutdown cleanup failed", { ...context, errorCode: error.code || "SHUTDOWN_FAILED", errorMessage: error.message });
          }
        };
        let timeout;
        try {
          const cleanupPromise = (async () => {
            await cleanup(() => closeServer(server));
            await cleanup(() => shutdownManager.execute());
            await cleanup(() => closeSocket(io));
            await cleanup(() => disconnectMongo(mongo));
            if (firstFailure) throw firstFailure;
          })();
          cleanupPromise.catch(() => {});
          await Promise.race([
            cleanupPromise,
            new Promise((_, reject) => { timeout = setTimeout(() => {
              const error = new Error("Graceful shutdown timed out");
              error.code = "SHUTDOWN_TIMEOUT";
              reject(error);
            }, timeoutMs); }),
          ]);
        } finally { clearTimeout(timeout); }

        if (lifecycle.getState() === STATES.DRAINING) lifecycle.transition(STATES.STOPPED);
        logger?.info("Graceful shutdown completed", { ...context, lifecycleState: lifecycle.getState(), durationMs: Date.now() - startedAt });
        exit(0);
        return { state: STATES.STOPPED };
      } catch (error) {
        if (lifecycle.getState() === STATES.DRAINING) lifecycle.transition(STATES.FAILED);
        const event = error.code === "SHUTDOWN_TIMEOUT" ? "Graceful shutdown timed out" : "Graceful shutdown failed";
        logger?.error(event, {
          ...context,
          lifecycleState: lifecycle.getState(),
          errorCode: error.code || "SHUTDOWN_FAILED",
          errorMessage: error.message,
          durationMs: Date.now() - startedAt,
        });
        exit(1);
        return { state: STATES.FAILED, error };
      }
    })();
    return execution;
  };

  const installSignalHandlers = (processObject = process) => {
    const handleSignal = (signal) => {
      if (!execution) shutdown(signal);
    };
    processObject.on("SIGTERM", handleSignal);
    processObject.on("SIGINT", handleSignal);
    return () => {
      processObject.removeListener("SIGTERM", handleSignal);
      processObject.removeListener("SIGINT", handleSignal);
    };
  };

  return { shutdown, installSignalHandlers };
}

module.exports = { createGracefulShutdown };
