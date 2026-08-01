const { STANDARD_QUERY_PARAMETERS } = require("./constants");
const { buildProjection } = require("./fieldSelection");
const { buildDateRangeFilter, buildFilters } = require("./filtering");
const { buildPagination } = require("./pagination");
const { buildSearchFilter } = require("./search");
const { buildSort } = require("./sorting");
const { QueryValidationError, validateQuery } = require("./validation");

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, clone(item)]),
  );
};

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const hasKeys = (value) =>
  isPlainObject(value) && Object.keys(value).length > 0;

const composeFilter = (parts) => {
  const active = parts.filter(hasKeys).map(clone);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0];
  return { $and: active };
};

class QueryBuilder {
  constructor({
    query = {},
    policy = {},
    trustedConstraints = [],
    options = {},
  } = {}) {
    this.query = query;
    this.policy = policy;
    this.trustedConstraints = Array.isArray(trustedConstraints)
      ? trustedConstraints
      : [trustedConstraints];
    this.options = options;
  }

  build() {
    if (!this.trustedConstraints.every(isPlainObject)) {
      throw new QueryValidationError(
        "trusted constraints must be objects",
        "constraints",
      );
    }
    if (!isPlainObject(this.options)) {
      throw new QueryValidationError(
        "query options must be an object",
        "options",
      );
    }

    const normalized = validateQuery(this.query, this.policy);
    const filterNames = Object.keys(this.policy.filters || {});
    const filterValues = Object.fromEntries(
      filterNames
        .filter((name) => normalized[name] !== undefined)
        .map((name) => [name, normalized[name]]),
    );
    const clientFilter = buildFilters(filterValues, this.policy.filters);
    const searchFilter = buildSearchFilter(
      normalized.search,
      this.policy.searchableFields,
      this.policy.maxSearchLength,
    );
    const dateFilter = buildDateRangeFilter(
      normalized.createdFrom,
      normalized.createdTo,
      this.policy.dateRange,
    );
    const pagination = buildPagination(normalized, this.policy.pagination);
    const projection = buildProjection(
      normalized.fields,
      this.policy.fieldSelection,
    );
    const sort = buildSort(
      normalized.sort,
      normalized.order,
      this.policy.sorting,
    );
    const filter = composeFilter([
      ...this.trustedConstraints,
      this.policy.mandatoryFilter,
      clientFilter,
      searchFilter,
      dateFilter,
    ]);
    const metadata = {
      search: normalized.search,
      filters: filterNames.filter((name) => normalized[name] !== undefined),
      sort: { field: normalized.sort, order: normalized.order },
      fields: normalized.fields,
    };

    return deepFreeze({
      filter,
      projection,
      sort,
      pagination,
      options: clone(this.options),
      metadata,
    });
  }

  static build(input) {
    return new QueryBuilder(input).build();
  }
}

module.exports = QueryBuilder;
module.exports.composeFilter = composeFilter;
module.exports.deepFreeze = deepFreeze;
