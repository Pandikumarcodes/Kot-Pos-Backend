function createHealthController(healthService) {
  if (!healthService?.getLiveness || !healthService?.getReadiness)
    throw new TypeError("A health service is required");
  return {
    getHealth: async (req, res, next) => {
      try {
        const result = await healthService.getLiveness();
        return res.status(result.status === "healthy" ? 200 : 503).json(result);
      } catch {
        return res
          .status(503)
          .json({ status: "unhealthy", reason: "health check failed" });
      }
    },
    getReady: async (req, res, next) => {
      try {
        const result = await healthService.getReadiness();
        return res.status(result.status === "healthy" ? 200 : 503).json(result);
      } catch {
        return res
          .status(503)
          .json({ status: "unhealthy", reason: "readiness check failed" });
      }
    },
  };
}

module.exports = { createHealthController };
