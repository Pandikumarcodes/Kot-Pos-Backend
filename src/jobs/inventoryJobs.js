const { JOB_NAMES } = require("../infrastructure/queue");
const { requireJobScope } = require("../infrastructure/queue/jobScope");

const inventoryJobHandlers = ({ emailProvider }) => ({
  [JOB_NAMES.LOW_INVENTORY_ALERT]: (data) => {
    const scope = requireJobScope(data, { allowGlobal: false });
    return emailProvider.send({ ...data, scope, template: "low-inventory-alert" });
  },
});

module.exports = { inventoryJobHandlers };
