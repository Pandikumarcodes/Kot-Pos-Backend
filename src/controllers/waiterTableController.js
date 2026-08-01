const service = require("../services/waiterTableService");
const { forwardError } = require("./controllerUtils");

const allocateTable = async (req, res, next) => { try { const table = await service.allocateTable(req.params.tableId, req.body, { io: req.app.get("io"), branchId: req.user.branchId }); res.status(200).json({ message: "Table allocated successfully", table }); } catch (err) { forwardError(next, err); } };
const freeTable = async (req, res, next) => { try { const table = await service.freeTable(req.params.tableId, { io: req.app.get("io"), branchId: req.user.branchId }); res.status(200).json({ message: "Table is now available", table }); } catch (err) { forwardError(next, err); } };
module.exports = { allocateTable, freeTable };
