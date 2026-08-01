const {
  QueryValidationError,
  validatePublicFieldName,
} = require("./validation");

const ALLOWED_TYPES = Object.freeze([
  "string",
  "boolean",
  "number",
  "integer",
  "enum",
  "objectId",
  "date",
]);
const ALLOWED_OPERATORS = Object.freeze(["eq", "gt", "gte", "lt", "lte"]);
const OPERATOR_MAP = Object.freeze({
  gt: "$gt",
  gte: "$gte",
  lt: "$lt",
  lte: "$lte",
});

const rejectStructuredValue = (value, name) => {
  if (value !== null && typeof value === "object") {
    throw new QueryValidationError(`${name} must be a scalar value`, name);
  }
};

const convertFilterValue = (value, definition, name) => {
  rejectStructuredValue(value, name);
  const type = definition.type || "string";
  if (!ALLOWED_TYPES.includes(type)) {
    throw new QueryValidationError(
      `filter policy for ${name} has an invalid type`,
      name,
    );
  }
  if (type === "string") {
    if (typeof value !== "string")
      throw new QueryValidationError(`${name} must be a string`, name);
    return value.trim();
  }
  if (type === "boolean") {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    throw new QueryValidationError(`${name} must be true or false`, name);
  }
  if (type === "number" || type === "integer") {
    if (typeof value === "string" && value.trim() === "") {
      throw new QueryValidationError(`${name} must be a number`, name);
    }
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      (type === "integer" && !Number.isInteger(number))
    ) {
      throw new QueryValidationError(
        `${name} must be ${type === "integer" ? "an integer" : "a number"}`,
        name,
      );
    }
    return number;
  }
  if (type === "enum") {
    if (
      !Array.isArray(definition.values) ||
      !definition.values.includes(value)
    ) {
      throw new QueryValidationError(`${name} has an invalid value`, name);
    }
    return value;
  }
  if (type === "objectId") {
    if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
      throw new QueryValidationError(`${name} must be a valid ObjectId`, name);
    }
    return value;
  }
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new QueryValidationError(`${name} must be a valid date`, name);
  }
  return new Date(Date.parse(value)).toISOString();
};

const buildFilters = (values = {}, definitions = {}) => {
  const filter = {};
  for (const [name, value] of Object.entries(values)) {
    validatePublicFieldName(name, name);
    if (!Object.prototype.hasOwnProperty.call(definitions, name)) {
      throw new QueryValidationError(`filter ${name} is not allowed`, name);
    }
    if (value === undefined || value === null || value === "") continue;
    const definition = definitions[name];
    const operator = definition.operator || "eq";
    if (!definition.field || !ALLOWED_OPERATORS.includes(operator)) {
      throw new QueryValidationError(
        `filter policy for ${name} is invalid`,
        name,
      );
    }
    const converted = convertFilterValue(value, definition, name);
    if (operator === "eq") {
      filter[definition.field] = converted;
    } else {
      const mongoOperator = OPERATOR_MAP[operator];
      filter[definition.field] = {
        ...(filter[definition.field] || {}),
        [mongoOperator]: converted,
      };
    }
  }
  return filter;
};

const buildDateRangeFilter = (createdFrom, createdTo, policy) => {
  if (!createdFrom && !createdTo) return null;
  if (!policy?.field) {
    throw new QueryValidationError(
      "date range filtering is not supported",
      "createdFrom",
    );
  }
  const range = {};
  if (createdFrom) range.$gte = createdFrom;
  if (createdTo) range.$lt = createdTo;
  return { [policy.field]: range };
};

module.exports = {
  ALLOWED_OPERATORS,
  ALLOWED_TYPES,
  buildDateRangeFilter,
  buildFilters,
  convertFilterValue,
};
