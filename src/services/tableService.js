const Table = require("../models/tables");
const AppError = require("../utils/AppError");

const createTable = async ({ tableNumber, capacity }) => {
  if (await Table.findOne({ tableNumber })) throw new AppError("Table number already exists", 400);
  const table = new Table({ tableNumber, capacity });
  await table.save();
  return table;
};

const listTables = () => Table.find();

const getTable = async (id) => {
  const table = await Table.findById(id);
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const updateTable = async (id, { capacity, status }) => {
  const table = await Table.findByIdAndUpdate(
    id,
    { capacity, status },
    { new: true, runValidators: true },
  );
  if (!table) throw new AppError("Table not found", 404);
  return table;
};

const deleteTable = async (id) => {
  const table = await Table.findByIdAndDelete(id);
  if (!table) throw new AppError("Table not found", 404);
};

module.exports = { createTable, listTables, getTable, updateTable, deleteTable };
