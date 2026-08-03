const { JOB_NAMES } = require("../infrastructure/queue");

const inventoryJobHandlers = ({ emailProvider }) => ({
  [JOB_NAMES.LOW_INVENTORY_ALERT]: (data) =>
    emailProvider.send({ ...data, template: "low-inventory-alert" }),
});

module.exports = { inventoryJobHandlers };
