const { lifecycleState } = require("./lifecycleState");
const { checkMongo } = require("./checks/mongoCheck");
const { checkSocket } = require("./checks/socketCheck");
const { checkStartup } = require("./checks/startupCheck");

class HealthService {
  constructor({
    lifecycle = lifecycleState,
    mongoCheck = checkMongo,
    socketCheck = checkSocket,
    startupCheck = checkStartup,
    mongoOptions = {},
    socket,
    version = "unknown",
    uptime = () => process.uptime(),
    clock = () => new Date().toISOString(),
  } = {}) {
    this.lifecycle = lifecycle;
    this.mongoCheck = mongoCheck;
    this.socketCheck = socketCheck;
    this.startupCheck = startupCheck;
    this.mongoOptions = mongoOptions;
    this.socket = socket;
    this.version = version;
    this.uptime = uptime;
    this.clock = clock;
  }

  async getLiveness() {
    const state = this.lifecycle.getState();
    const healthy = !["stopped", "failed"].includes(state);
    return {
      status: healthy ? "healthy" : "unhealthy",
      uptime: this.uptime(),
      timestamp: this.clock(),
      version: this.version,
      state,
      lifecycleState: state,
    };
  }

  async getReadiness() {
    const checks = {};
    const runCheck = async (name, check) => {
      try {
        checks[name] = await check();
      } catch {
        checks[name] = { status: "unhealthy", reason: `${name} check failed` };
      }
    };
    await Promise.all([
      runCheck("mongo", () => this.mongoCheck(this.mongoOptions)),
      runCheck("socket", () =>
        this.socketCheck({ socket: this.socket, lifecycle: this.lifecycle }),
      ),
      runCheck("startup", () =>
        this.startupCheck({ lifecycle: this.lifecycle }),
      ),
    ]);
    const lifecycle = {
      status: ["ready"].includes(this.lifecycle.getState())
        ? "healthy"
        : "unhealthy",
      state: this.lifecycle.getState(),
      reason:
        this.lifecycle.getState() === "ready"
          ? undefined
          : "lifecycle is not ready",
    };
    checks.lifecycle = lifecycle;
    const healthy = Object.values(checks).every(
      (check) => check.status === "healthy",
    );
    return {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      timestamp: this.clock(),
      version: this.version,
    };
  }
}

module.exports = { HealthService };
