const service = require("../services/aiService");
const { forwardError } = require("./controllerUtils");

const chat = async (req, res, next) => {
  try {
    res.json({ reply: await service.chat(req.body) });
  } catch (err) {
    forwardError(next, err);
  }
};
const getInventoryAlerts = async (req, res, next) => {
  try {
    res.json(await service.getInventoryAlerts(req.accessScope));
  } catch (err) {
    forwardError(next, err, "Failed to generate inventory alerts");
  }
};
const getDailySummary = async (req, res, next) => {
  try {
    res.json(
      await service.getDailySummary({
        scope: req.accessScope,
      }),
    );
  } catch (err) {
    forwardError(next, err, "Failed to generate daily summary");
  }
};
module.exports = { chat, getInventoryAlerts, getDailySummary };
