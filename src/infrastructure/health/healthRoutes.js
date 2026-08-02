const express = require("express");
const { HealthService } = require("./healthService");
const { createHealthController } = require("./healthController");

function createHealthRouter({
  service = new HealthService(),
  controller = createHealthController(service),
} = {}) {
  const router = express.Router();
  router.get("/health", controller.getHealth);
  router.get("/ready", controller.getReady);
  return router;
}

module.exports = { createHealthRouter };
