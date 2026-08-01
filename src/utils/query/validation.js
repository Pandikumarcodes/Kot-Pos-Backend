const {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_SEARCH_LENGTH,
  SORT_ORDERS,
  STANDARD_QUERY_PARAMETERS,
} = require("./constants");

class QueryValidationError extends Error {
  constructor(message, field, code = "INVALID_QUERY") {
    super(message);
    this.name = "QueryValidationError";
    this.field = field;
    this.code = code;
    Error.captureStackTrace?.(this, QueryValidationError);
  }
}

const isMissing = (value) =>
  value === undefined || value === null || value === "";

const validateInteger = (value, field) => {
  const validString = typeof value === "string" && /^\d+$/.test(value);
  const validNumber = typeof value === "number" && Number.isInteger(value);
  if (!validString && !validNumber) {
    throw new QueryValidationError(`${field} must be an integer`, field);
  }
  return Number(value);
};

const validatePage = (value, defaultPage = DEFAULT_PAGE) => {
  if (isMissing(value)) return defaultPage;
  const page = validateInteger(value, "page");
  if (page < 1) {
    throw new QueryValidationError("page must be at least 1", "page");
  }
  return page;
};

const validateLimit = (
  value,
  { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {},
) => {
  if (isMissing(value)) return defaultLimit;
  const limit = validateInteger(value, "limit");
  if (limit < 1 || limit > maxLimit) {
    throw new QueryValidationError(
      `limit must be between 1 and ${maxLimit}`,
      "limit",
    );
  }
  return limit;
};

const validateOrder = (value, defaultOrder = "desc") => {
  const order = isMissing(value) ? defaultOrder : value;
  if (typeof order !== "string" || !SORT_ORDERS.includes(order)) {
    throw new QueryValidationError("order must be asc or desc", "order");
  }
  return order;
};

const validateSearch = (value, maxLength = MAX_SEARCH_LENGTH) => {
  if (isMissing(value)) return undefined;
  if (typeof value !== "string") {
    throw new QueryValidationError("search must be a string", "search");
  }
  const search = value.trim();
  if (!search) return undefined;
  if (search.length > maxLength) {
    throw new QueryValidationError(
      `search must not exceed ${maxLength} characters`,
      "search",
    );
  }
  return search;
};

const validatePublicFieldName = (value, field) => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ||
    value.includes(".") ||
    value.startsWith("$")
  ) {
    throw new QueryValidationError(
      `${field} contains an invalid field name`,
      field,
    );
  }
  return value;
};

const validateSort = (value, allowedFields, defaultField) => {
  const sort = isMissing(value) ? defaultField : value;
  if (isMissing(sort)) return undefined;
  validatePublicFieldName(sort, "sort");
  if (!Object.prototype.hasOwnProperty.call(allowedFields || {}, sort)) {
    throw new QueryValidationError(`sort field ${sort} is not allowed`, "sort");
  }
  return sort;
};

const validateFields = (value) => {
  if (isMissing(value)) return undefined;
  if (typeof value !== "string") {
    throw new QueryValidationError(
      "fields must be a comma-separated string",
      "fields",
    );
  }
  const parts = value.split(",").map((field) => field.trim());
  if (parts.some((field) => !field)) {
    throw new QueryValidationError(
      "fields contains an empty field name",
      "fields",
    );
  }
  parts.forEach((field) => validatePublicFieldName(field, "fields"));
  return [...new Set(parts)];
};

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

const validateDate = (value, field) => {
  if (isMissing(value)) return undefined;
  if (typeof value !== "string") {
    throw new QueryValidationError(`${field} must be an ISO date-time`, field);
  }
  const match = ISO_DATE_TIME.exec(value);
  if (!match) {
    throw new QueryValidationError(
      `${field} must be a valid ISO date-time`,
      field,
    );
  }
  const [, year, month, day, hour, minute, second] = match;
  const daysInMonth = new Date(
    Date.UTC(Number(year), Number(month), 0),
  ).getUTCDate();
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    Number(day) < 1 ||
    Number(day) > daysInMonth ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    throw new QueryValidationError(
      `${field} must be a valid ISO date-time`,
      field,
    );
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new QueryValidationError(
      `${field} must be a valid ISO date-time`,
      field,
    );
  }
  return new Date(timestamp).toISOString();
};

const validateDateRange = (createdFrom, createdTo) => {
  const from = validateDate(createdFrom, "createdFrom");
  const to = validateDate(createdTo, "createdTo");
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new QueryValidationError(
      "createdFrom must not be after createdTo",
      "createdFrom",
    );
  }
  return Object.freeze({ createdFrom: from, createdTo: to });
};

const validateQuery = (query = {}, policy = {}) => {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new QueryValidationError("query must be an object", "query");
  }
  const filterDefinitions = policy.filters || {};
  const allowedParameters = new Set([
    ...STANDARD_QUERY_PARAMETERS,
    ...Object.keys(filterDefinitions),
  ]);
  for (const key of Object.keys(query)) {
    validatePublicFieldName(key, key);
    if (!allowedParameters.has(key)) {
      throw new QueryValidationError(
        `query parameter ${key} is not allowed`,
        key,
      );
    }
  }

  const paginationPolicy = policy.pagination || {};
  const sortingPolicy = policy.sorting || {};
  const dateRange = validateDateRange(query.createdFrom, query.createdTo);
  const normalized = {
    page: validatePage(query.page, paginationPolicy.defaultPage),
    limit: validateLimit(query.limit, paginationPolicy),
    search: validateSearch(query.search, policy.maxSearchLength),
    sort: validateSort(
      query.sort,
      sortingPolicy.fields,
      sortingPolicy.defaultField,
    ),
    order: validateOrder(query.order, sortingPolicy.defaultOrder),
    fields: validateFields(query.fields),
    ...dateRange,
  };
  for (const key of Object.keys(filterDefinitions)) {
    if (query[key] !== undefined) normalized[key] = query[key];
  }
  return Object.freeze(normalized);
};

module.exports = {
  QueryValidationError,
  validateDate,
  validateDateRange,
  validateFields,
  validateLimit,
  validateOrder,
  validatePage,
  validatePublicFieldName,
  validateQuery,
  validateSearch,
  validateSort,
};
