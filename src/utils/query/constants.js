const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const SORT_ORDERS = Object.freeze(["asc", "desc"]);
const STANDARD_QUERY_PARAMETERS = Object.freeze([
  "page",
  "limit",
  "search",
  "sort",
  "order",
  "fields",
  "createdFrom",
  "createdTo",
]);

module.exports = Object.freeze({
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_SEARCH_LENGTH,
  SORT_ORDERS,
  STANDARD_QUERY_PARAMETERS,
});
