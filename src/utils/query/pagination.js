const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require("./constants");
const { validateLimit, validatePage } = require("./validation");

const buildPagination = (
  { page, limit } = {},
  {
    defaultPage = DEFAULT_PAGE,
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
  } = {},
) => {
  const normalizedPage = validatePage(page, defaultPage);
  const normalizedLimit = validateLimit(limit, { defaultLimit, maxLimit });
  const skip = (normalizedPage - 1) * normalizedLimit;
  if (!Number.isSafeInteger(skip)) {
    const error = new RangeError(
      "pagination offset exceeds the safe integer range",
    );
    error.field = "page";
    throw error;
  }
  return Object.freeze({
    page: normalizedPage,
    limit: normalizedLimit,
    skip,
  });
};

module.exports = { buildPagination };
