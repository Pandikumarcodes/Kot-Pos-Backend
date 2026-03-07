const express = require("express");
const { userAuth, allowRoles } = require("../../middlewares/auth");
const Settings = require("../../models/settings.js");
const adminSettingsRouter = express.Router();

adminSettingsRouter.use(userAuth, allowRoles(["admin", "manager"]));
// ── GET SETTINGS ──────────────────────────────────────────────
// GET /admin/settings
adminSettingsRouter.get("/settings", async (req, res) => {
  try {
    let settings = await Settings.findOne();
    // ✅ If no settings exist yet, create default
    if (!settings) {
      settings = await Settings.create({});
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
  userAuth,
  allowRoles(["admin"]), // ✅ only admin can save
  async (req, res) => {
    try {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = await Settings.create(req.body);
      } else {
        settings = await Settings.findByIdAndUpdate(
          settings._id,
          { $set: req.body },
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
