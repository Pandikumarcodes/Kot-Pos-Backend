const reportService = require("../services/reportService");
const { forwardError } = require("./controllerUtils");

const context = (req) => ({
  ...req.query,
  scope: req.accessScope,
});
const getSummary = async (req, res, next) => {
  try {
    res.json(await reportService.getSummary(context(req)));
  } catch (err) {
    forwardError(next, err);
  }
};
const getTopItems = async (req, res, next) => {
  try {
    res.json({ topItems: await reportService.getTopItems(context(req)) });
  } catch (err) {
    forwardError(next, err);
  }
};
const getPayments = async (req, res, next) => {
  try {
    res.json({ payments: await reportService.getPayments(context(req)) });
  } catch (err) {
    forwardError(next, err);
  }
};
const getHourlySales = async (req, res, next) => {
  try {
    res.json({ hourly: await reportService.getHourlySales(context(req)) });
  } catch (err) {
    forwardError(next, err);
  }
};
const getCashierIncome = async (req, res, next) => {
  try {
    res
      .status(200)
      .json({
        totalIncome: await reportService.getCashierIncome(req.user._id, req.accessScope),
      });
  } catch (err) {
    forwardError(next, err, "Failed to fetch your income");
  }
};
module.exports = {
  getSummary,
  getTopItems,
  getPayments,
  getHourlySales,
  getCashierIncome,
};
