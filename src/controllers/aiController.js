const service = require("../services/aiService");
const { forwardError } = require("./controllerUtils");

const chat = async (req, res, next) => { try { res.json({ reply: await service.chat(req.body) }); } catch (err) { forwardError(next, err); } };
const getInventoryAlerts = async (req, res, next) => { try { res.json(await service.getInventoryAlerts(req.branchFilter)); } catch (err) { forwardError(next, err, "Failed to generate inventory alerts"); } };
const getDailySummary = async (req, res, next) => { try { res.json(await service.getDailySummary({ branchFilter: req.branchFilter, branchMemberFilter: req.branchMemberFilter, branchId: req.branchId })); } catch (err) { forwardError(next, err, "Failed to generate daily summary"); } };
module.exports = { chat, getInventoryAlerts, getDailySummary };
