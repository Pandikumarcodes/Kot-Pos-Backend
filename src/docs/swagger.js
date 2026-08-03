const swaggerUi = require("swagger-ui-express");
const openapi = require("./openapi");

const unauthorized = (res) => {
  res.set("WWW-Authenticate", 'Basic realm="KOT POS API documentation"');
  return res.status(401).send("Authentication required");
};

const docsAuth = (req, res, next) => {
  const enabled = process.env.NODE_ENV === "production" &&
    process.env.DOCS_USERNAME && process.env.DOCS_PASSWORD;
  if (!enabled) return next();

  const header = req.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return unauthorized(res);
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  const username = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";
  if (username !== process.env.DOCS_USERNAME || password !== process.env.DOCS_PASSWORD) {
    return unauthorized(res);
  }
  return next();
};

const mountSwagger = (app) => {
  app.get("/api/docs.json", docsAuth, (req, res) => res.json(openapi));
  app.use(
    "/api/docs",
    docsAuth,
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      explorer: true,
      customSiteTitle: "KOT POS API Documentation",
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    }),
  );
};

module.exports = { mountSwagger, docsAuth, openapi };
