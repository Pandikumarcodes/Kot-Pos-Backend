const tableRepository = require("../repositories/TableRepository");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const createTable = async ({ tableNumber, capacity }, { io, branchId } = {}) => {
  if (!branchId) throw new AppError("An operational branch is required", 400);
  if (await tableRepository.findByNumberAndBranch(tableNumber, branchId))
    throw new AppError("Table number already exists", 400);
  const table = await tableRepository.createTableDocument({
    branchId,
    tableNumber,
    capacity,
  });
  notify.tableUpdated(io, table);
  return table;
};

const listTables = (branchId) => tableRepository.findAllByBranch(branchId);

const getTable = async (id, branchId) => {
  const table = await tableRepository.findByIdAndBranch(id, branchId);
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const updateTable = async (id, { capacity, status }, { io, branchId } = {}) => {
  const table = await tableRepository.updateByIdAndBranch(
    id,
    branchId,
    { capacity, status },
  );
  if (!table) throw new AppError("Table not found", 404);
  notify.tableUpdated(io, table);
  return table;
};

const deleteTable = async (id, { io, branchId } = {}) => {
  const table = await tableRepository.deleteByIdAndBranch(id, branchId);
  if (!table) throw new AppError("Table not found", 404);
  notify.tableUpdated(io, table);
};

module.exports = {
  createTable,
  listTables,
  getTable,
  updateTable,
  deleteTable,
};
