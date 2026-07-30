const { Joi, objectId, optionalText } = require("./common");
const { validateRequest } = require("./validateRequest");

const TABLE_STATUSES = ["available", "occupied", "reserved"];
const idParams = Joi.object({ id: objectId("table ID") });
const tableIdParams = Joi.object({ tableId: objectId("table ID") });
const createTableBody = Joi.object({
  tableNumber: Joi.number().integer().positive().required(),
  capacity: Joi.number().integer().positive().required(),
});
const updateTableBody = Joi.object({
  capacity: Joi.number().integer().positive().optional(),
  status: Joi.string().valid(...TABLE_STATUSES).optional(),
});
const allocateBody = Joi.object({
  name: optionalText(150),
  phone: optionalText(30),
});

module.exports = {
  validateTableAllocate: validateRequest({
    params: tableIdParams,
    body: allocateBody,
  }),
  validateTableCreate: validateRequest({ body: createTableBody }),
  validateTableId: validateRequest({ params: idParams }),
  validateTableUpdate: validateRequest({
    params: idParams,
    body: updateTableBody,
  }),
  validateWaiterTableId: validateRequest({ params: tableIdParams }),
};
