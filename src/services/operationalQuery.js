const AppError = require("../utils/AppError");
const {
  QueryBuilder,
  QueryValidationError,
  buildPaginationMetadata,
} = require("../utils/query");

const STANDARD_PARAMETERS = Object.freeze([
  "page",
  "limit",
  "search",
  "sort",
  "order",
]);

const hasQueryControls = (query = {}) =>
  Object.values(query).some((value) => value !== undefined);

const usesPagination = (query = {}) =>
  query.page !== undefined || query.limit !== undefined;

const buildOperationalPlan = ({ query = {}, policy, trustedConstraints = [] }) => {
  try {
    const allowed = new Set([
      ...STANDARD_PARAMETERS,
      ...Object.keys(policy.filters || {}),
    ]);
    const unsupported = Object.keys(query).find((key) => !allowed.has(key));
    if (unsupported) {
      throw new QueryValidationError(
        `query parameter ${unsupported} is not allowed`,
        unsupported,
      );
    }
    return QueryBuilder.build({ query, policy, trustedConstraints });
  } catch (error) {
    if (error instanceof QueryValidationError || error instanceof RangeError) {
      throw new AppError(error.message, 400);
    }
    throw error;
  }
};

const repositoryOptions = (plan, paginated) => ({
  projection: plan.projection,
  sort: plan.sort,
  ...(paginated
    ? { skip: plan.pagination.skip, limit: plan.pagination.limit }
    : {}),
  lean: true,
});

const paginationFor = (plan, total) =>
  buildPaginationMetadata({
    page: plan.pagination.page,
    limit: plan.pagination.limit,
    total,
  });

module.exports = {
  buildOperationalPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
};
