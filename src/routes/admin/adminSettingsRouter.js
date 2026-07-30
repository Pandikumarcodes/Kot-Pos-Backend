const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const branchScope = require("../../middlewares/branchScope");
const Settings = require("../../models/settings.js");
const adminSettingsRouter = express.Router();

adminSettingsRouter.use(
  userAuth,
  allowRoles(["admin", "manager"]),
  branchScope,
);
// ── GET SETTINGS ──────────────────────────────────────────────
// GET /admin/settings
adminSettingsRouter.get("/settings", async (req, res) => {
  try {
    let settings = await Settings.findOne(req.branchFilter);
    // ✅ If no settings exist yet, create default
    if (!settings) {
      settings = await Settings.create({ branchId: req.branchId });
    }
    res.status(200).json({ settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE SETTINGS ───────────────────────────────────────────
// PUT /admin/settings
adminSettingsRouter.put(
  "/settings",
  allowRoles(["admin"]), // ✅ only admin can save
  async (req, res) => {
    try {
      const settingsInput = { ...req.body };
      delete settingsInput.branchId;
      let settings = await Settings.findOne(req.branchFilter);
      if (!settings) {
        settings = await Settings.create({
          ...settingsInput,
          branchId: req.branchId,
        });
      } else {
        settings = await Settings.findOneAndUpdate(
          req.scopeToBranch({ _id: settings._id }),
          { $set: settingsInput },
          { new: true, runValidators: true },
        );
      }
      res
        .status(200)
        .json({ message: "Settings saved successfully", settings });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = { adminSettingsRouter };
