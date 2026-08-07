const tableService = require("../services/tableService");
const { forwardError } = require("./controllerUtils");

const createTable = async (req, res, next) => {
  try {
    const table = await tableService.createTable(req.body, req.accessScope);
    res.status(201).json({ message: "Table created", table });
  } catch (err) {
    forwardError(next, err);
  }
};
const listTables = async (req, res, next) => {
  try {
    res.status(200).json({ tables: await tableService.listTables(req.accessScope) });
  } catch (err) {
    forwardError(next, err);
  }
};
const getTable = async (req, res, next) => {
  try {
    res.status(200).json({ table: await tableService.getTable(req.params.id, req.accessScope) });
  } catch (err) {
    forwardError(next, err);
  }
};
const updateTable = async (req, res, next) => {
  try {
    const table = await tableService.updateTable(req.params.id, req.body, req.accessScope);
    res.status(200).json({ message: "Table updated", table });
  } catch (err) {
    forwardError(next, err);
  }
};
const deleteTable = async (req, res, next) => {
  try {
    await tableService.deleteTable(req.params.id, req.accessScope);
    res.status(200).json({ message: "Table deleted" });
  } catch (err) {
    forwardError(next, err);
  }
};
module.exports = {
  createTable,
  listTables,
  getTable,
  updateTable,
  deleteTable,
};
