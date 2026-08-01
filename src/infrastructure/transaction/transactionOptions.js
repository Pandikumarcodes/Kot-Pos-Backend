const DEFAULT_TRANSACTION_OPTIONS = Object.freeze({
  readPreference: "primary",
  readConcern: Object.freeze({ level: "snapshot" }),
  writeConcern: Object.freeze({ w: "majority" }),
});

const DEFAULT_MAX_RETRIES = 3;

module.exports = {
  DEFAULT_MAX_RETRIES,
  DEFAULT_TRANSACTION_OPTIONS,
};
