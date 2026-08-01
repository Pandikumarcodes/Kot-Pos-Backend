const tableRepository = require("../repositories/TableRepository");
const AppError = require("../utils/AppError");

const createTable = async ({ tableNumber, capacity }) => {
  if (await tableRepository.findByNumber(tableNumber))
    throw new AppError("Table number already exists", 400);
  const table = await tableRepository.createTableDocument({
    tableNumber,
    capacity,
  });
  return table;
};

const listTables = () => tableRepository.listAll();

const getTable = async (id) => {
  const table = await tableRepository.findById(id);
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const updateTable = async (id, { capacity, status }) => {
  const table = await tableRepository.updateTable(id, { capacity, status });
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const deleteTable = async (id) => {
  const table = await tableRepository.deleteTable(id);
  if (!table) throw new AppError("Table not found", 404);
};

module.exports = {
  createTable,
  listTables,
  getTable,
  updateTable,
  deleteTable,
};
