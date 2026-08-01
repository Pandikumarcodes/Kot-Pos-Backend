const TRANSIENT_TRANSACTION_ERROR = "TransientTransactionError";

const hasErrorLabel = (error, label) => {
  if (!error) return false;

  if (typeof error.hasErrorLabel === "function") {
    return error.hasErrorLabel(label);
  }

  return Array.isArray(error.errorLabels) && error.errorLabels.includes(label);
};

const isTransientTransactionError = (error) =>
  hasErrorLabel(error, TRANSIENT_TRANSACTION_ERROR);

module.exports = {
  TRANSIENT_TRANSACTION_ERROR,
  hasErrorLabel,
  isTransientTransactionError,
};
