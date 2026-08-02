const leanQuery = (query) =>
  query && typeof query.lean === "function" ? query.lean() : query;

module.exports = { leanQuery };
