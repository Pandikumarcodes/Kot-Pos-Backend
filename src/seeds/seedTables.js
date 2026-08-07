const Table = require("../models/tables");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");
const DEFAULT_TABLES = [
  { tableNumber: 1, capacity: 2 },
  { tableNumber: 2, capacity: 4 },
  { tableNumber: 3, capacity: 4 },
  { tableNumber: 4, capacity: 6 },
];
async function seedTables({ force = false, clean = false } = {}) {
  const tables = jsonEnv("SEED_TABLES_JSON", DEFAULT_TABLES);
  if (clean)
    await removeSeedRecords(
      tables.map(({ tableNumber }) => ({
        Model: Table,
        filter: { tableNumber },
        label: `table ${tableNumber}`,
      })),
    );
  return Promise.all(
    tables.map((table) =>
      saveIfMissing(
        Table,
        { tableNumber: table.tableNumber },
        table,
        `table ${table.tableNumber}`,
        { force },
      ),
    ),
  );
}
if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("tables", seedTables, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedTables };
