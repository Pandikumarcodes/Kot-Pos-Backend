const { QueryValidationError, validateFields } = require("./validation");

const buildProjection = (requestedFields, policy = {}) => {
  const allowedFields = policy.fields || {};
  const requested = Array.isArray(requestedFields)
    ? requestedFields
    : validateFields(requestedFields);
  const selected = requested || policy.defaultFields || Object.keys(allowedFields);
  const projection = {};
  for (const alias of selected) {
    if (!Object.prototype.hasOwnProperty.call(allowedFields, alias)) {
      throw new QueryValidationError(`field ${alias} is not selectable`, "fields");
    }
    projection[allowedFields[alias]] = 1;
  }
  for (const field of policy.mandatoryFields || []) projection[field] = 1;
  return projection;
};

module.exports = { buildProjection };
