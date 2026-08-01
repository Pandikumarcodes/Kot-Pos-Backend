const { QueryValidationError, validateOrder, validateSort } = require("./validation");

const buildSort = (sort, order, policy = {}) => {
  const alias = validateSort(sort, policy.fields, policy.defaultField);
  if (!alias) {
    throw new QueryValidationError("a default or requested sort field is required", "sort");
  }
  const normalizedOrder = validateOrder(order, policy.defaultOrder);
  const direction = normalizedOrder === "asc" ? 1 : -1;
  const databaseField = policy.fields[alias];
  const tieBreaker = policy.tieBreaker || "_id";
  const result = { [databaseField]: direction };
  if (databaseField !== tieBreaker) result[tieBreaker] = direction;
  return result;
};

module.exports = { buildSort };
