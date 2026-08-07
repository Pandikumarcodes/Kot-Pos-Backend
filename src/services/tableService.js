const tableRepository = require("../repositories/TableRepository");
const AppError = require("../utils/AppError");
const { assertBranchScope } = require("../utils/accessScope");

const createTable = async ({ tableNumber, capacity }, scope) => {
  assertBranchScope(scope);
  if (await tableRepository.findByNumberInScope(scope, tableNumber))
    throw new AppError("Table number already exists", 400);
  const table = await tableRepository.createTableDocument({
    tableNumber,
    capacity,
    branchId: scope.branchId,
  });
  return table;
};

const listTables = (scope) => tableRepository.listScoped(scope);

const getTable = async (id, scope) => {
  const table = await tableRepository.findByIdInScope(scope, id);
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const updateTable = async (id, { capacity, status, branchId: _ignored }, scope) => {
  const table = await tableRepository.updateTableInScope(scope, id, { capacity, status }, { new: true, runValidators: true });
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const deleteTable = async (id, scope) => {
  const table = await tableRepository.deleteTableInScope(scope, id);
  if (!table) throw new AppError("Table not found", 404);
};

module.exports = {
  createTable,
  listTables,
  getTable,
  updateTable,
  deleteTable,
};
