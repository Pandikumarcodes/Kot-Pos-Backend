const { ShutdownTimeoutError } = require("./errors");

class ShutdownManager {
  constructor({ defaultTimeoutMs = 10000 } = {}) {
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.callbacks = [];
    this._execution = null;
  }

  register(callback, { name = `cleanup-${this.callbacks.length + 1}`, timeoutMs = this.defaultTimeoutMs } = {}) {
    if (this._execution) throw new Error("Cannot register cleanup after shutdown has started");
    if (typeof callback !== "function") throw new TypeError("Cleanup callback must be a function");
    this.callbacks.push({ callback, name, timeoutMs });
    return () => { this.callbacks = this.callbacks.filter((entry) => entry.callback !== callback); };
  }

  execute() {
    if (!this._execution) this._execution = this._run();
    return this._execution;
  }

  async _run() {
    const results = [];
    for (const { callback, name, timeoutMs } of this.callbacks) {
      let timer;
      try {
        await Promise.race([Promise.resolve().then(callback), new Promise((_, reject) => { timer = setTimeout(() => reject(new ShutdownTimeoutError(name, timeoutMs)), timeoutMs); })]);
        results.push({ name, status: "completed" });
      } finally { clearTimeout(timer); }
    }
    return results;
  }
}

module.exports = { ShutdownManager };
