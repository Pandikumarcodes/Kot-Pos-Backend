const tableRepository = require("../repositories/TableRepository");
const AppError = require("../utils/AppError");
const { assertBranchScope } = require("../utils/accessScope");
const { notify } = require("./notificationservices");

const allocateTable = async (tableId, customer, { io, scope }) => {
  const branchId = assertBranchScope(scope).branchId;
  const table = await tableRepository.findByIdInScope(scope, tableId);
  if (!table) throw new AppError("Table not found", 404);
  if (table.status === "occupied") throw new AppError("Table is already occupied", 400);
  table.status = "occupied";
  table.currentCustomer = { name: customer.name, phone: customer.phone };
  await tableRepository.updateStateInScope(scope, tableId, { status: "occupied", currentCustomer: table.currentCustomer });
  notify.tableUpdated(io, table, branchId);
  return table;
};

const freeTable = async (tableId, { io, scope }) => {
  const branchId = assertBranchScope(scope).branchId;
  const table = await tableRepository.findByIdInScope(scope, tableId);
  if (!table) throw new AppError("Table not found", 404);
  table.status = "available";
  table.currentCustomer = null;
  await tableRepository.updateStateInScope(scope, tableId, { status: "available", currentCustomer: null });
  notify.tableUpdated(io, table, branchId);
  return table;
};

module.exports = { allocateTable, freeTable };
