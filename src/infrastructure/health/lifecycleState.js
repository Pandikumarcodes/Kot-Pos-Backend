const { LifecycleTransitionError } = require("./errors");

const STATES = Object.freeze({ STARTING: "starting", READY: "ready", DRAINING: "draining", STOPPED: "stopped", FAILED: "failed" });
const transitions = Object.freeze({
  starting: new Set(["ready", "failed", "draining"]),
  ready: new Set(["draining", "failed"]),
  draining: new Set(["stopped", "failed"]),
  stopped: new Set([]),
  failed: new Set(["draining", "stopped"]),
});

class LifecycleState {
  constructor(initialState = STATES.STARTING) {
    if (!Object.values(STATES).includes(initialState)) throw new TypeError(`Unknown lifecycle state: ${initialState}`);
    this._state = initialState;
    this._startupCompleted = initialState === STATES.READY;
  }

  getState() { return this._state; }
  isStartupCompleted() { return this._startupCompleted; }
  markStartupCompleted() { this._startupCompleted = true; }

  transition(nextState) {
    if (!Object.values(STATES).includes(nextState)) throw new TypeError(`Unknown lifecycle state: ${nextState}`);
    if (nextState === this._state) return this._state;
    if (!transitions[this._state].has(nextState)) throw new LifecycleTransitionError(this._state, nextState);
    this._state = nextState;
    if (nextState === STATES.READY) this._startupCompleted = true;
    return this._state;
  }
}

const lifecycleState = new LifecycleState();
module.exports = { STATES, LifecycleState, lifecycleState };
