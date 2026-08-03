const logger = require("../../config/logger");

function createEmailProvider({
  fetchImpl = global.fetch,
  webhookUrl = process.env.EMAIL_WEBHOOK_URL,
} = {}) {
  return {
    async send(message) {
      if (!webhookUrl || typeof fetchImpl !== "function") {
        throw new Error("Email provider is not configured");
      }
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!response.ok)
        throw new Error(`Email provider returned HTTP ${response.status}`);
      logger.info("Background email sent", { template: message.template });
    },
  };
}

module.exports = { createEmailProvider };
