const Table = require("../models/tables");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const allocateTable = async (tableId, customer, { io, branchId }) => {
  const table = await Table.findById(tableId);
  if (!table) throw new AppError("Table not found", 404);
  if (table.status === "occupied") throw new AppError("Table is already occupied", 400);
  table.status = "occupied";
  table.currentCustomer = { name: customer.name, phone: customer.phone };
  await table.save();
  notify.tableUpdated(io, table, branchId);
  return table;
};

const freeTable = async (tableId, { io, branchId }) => {
  const table = await Table.findById(tableId);
  if (!table) throw new AppError("Table not found", 404);
  table.status = "available";
  table.currentCustomer = null;
  await table.save();
  notify.tableUpdated(io, table, branchId);
  return table;
};

module.exports = { allocateTable, freeTable };
