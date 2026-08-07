const express = require("express");

// Test/development helper only. app.js never mounts this router in production.
const mountTestRoutes = (app, environment = process.env.NODE_ENV) => {
  if (environment !== "development" && environment !== "test") return;
  const router = express.Router();
  router.get("/test/ping", (_req, res) => {
    res.json({ ok: true, environment });
  });
  app.use("/api/v1", router);
};

module.exports = { mountTestRoutes };
