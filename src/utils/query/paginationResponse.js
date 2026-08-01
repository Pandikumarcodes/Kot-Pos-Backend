const { QueryValidationError } = require("./validation");

const buildPaginationMetadata = ({ page, limit, total }) => {
  if (!Number.isInteger(page) || page < 1) {
    throw new QueryValidationError("page must be a positive integer", "page");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new QueryValidationError("limit must be a positive integer", "limit");
  }
  if (!Number.isInteger(total) || total < 0) {
    throw new QueryValidationError(
      "total must be a non-negative integer",
      "total",
    );
  }
  const pages = total === 0 ? 0 : Math.ceil(total / limit);
  return Object.freeze({
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: total > 0 && page > 1,
  });
};

module.exports = { buildPaginationMetadata };
