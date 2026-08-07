const Customer = require("../models/customer");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");
const DEFAULT_CUSTOMERS = [];
async function seedCustomers({ force = false, clean = false } = {}) {
  const customers = jsonEnv("SEED_CUSTOMERS_JSON", DEFAULT_CUSTOMERS);
  if (clean)
    await removeSeedRecords(
      customers.map(({ phone }) => ({
        Model: Customer,
        filter: { phone },
        label: `customer ${phone}`,
      })),
    );
  return Promise.all(
    customers.map((customer) =>
      saveIfMissing(
        Customer,
        { phone: customer.phone },
        customer,
        `customer ${customer.phone}`,
        { force },
      ),
    ),
  );
}
if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("customers", seedCustomers, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedCustomers };
