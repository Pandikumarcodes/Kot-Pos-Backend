const mongoose = require("mongoose");
const {
  DEFAULT_MAX_RETRIES,
  DEFAULT_TRANSACTION_OPTIONS,
} = require("./transactionOptions");
const { isTransientTransactionError } = require("./transactionErrors");

class TransactionManager {
  constructor({
    connection = mongoose.connection,
    maxRetries = DEFAULT_MAX_RETRIES,
    transactionOptions = DEFAULT_TRANSACTION_OPTIONS,
  } = {}) {
    if (!connection || typeof connection.startSession !== "function") {
      throw new TypeError(
        "A MongoDB connection with startSession() is required",
      );
    }

    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new TypeError("maxRetries must be a non-negative integer");
    }

    this.connection = connection;
    this.maxRetries = maxRetries;
    this.transactionOptions = transactionOptions;
  }

  async execute(work, options = {}) {
    if (typeof work !== "function") {
      throw new TypeError("Transaction work must be a function");
    }

    const session = await this.connection.startSession();
    try {
      for (let retryCount = 0; ; retryCount += 1) {
        try {
          let result;

          await session.withTransaction(
            async () => {
              result = await work(session);
              return result;
            },
            { ...this.transactionOptions, ...options },
          );

          return result;
        } catch (error) {
          await this.#abortSafely(session);

          if (
            retryCount >= this.maxRetries ||
            !isTransientTransactionError(error)
          ) {
            throw error;
          }
        }
      }
    } finally {
      await this.#endSessionSafely(session);
    }
  }

  async #abortSafely(session) {
    try {
      if (
        typeof session.inTransaction === "function" &&
        session.inTransaction() &&
        typeof session.abortTransaction === "function"
      ) {
        await session.abortTransaction();
      }
    } catch (_cleanupError) {
      // Abort failures must not replace the transaction's original error.
    }
  }

  async #endSessionSafely(session) {
    try {
      await session.endSession();
    } catch (_cleanupError) {
      // Session cleanup must not alter an already-determined transaction outcome.
    }
  }
}

module.exports = TransactionManager;
