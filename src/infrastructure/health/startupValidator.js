const { EnvironmentValidationError } = require("./errors");

const required = ["MONGO_URI", "JWT_SECRET", "REFRESH_TOKEN_SECRET", "PORT", "NODE_ENV"];
const conditionalUrl = /^(https?):\/\/[^\s/$.?#].[^\s]*$/i;
const environments = new Set(["development", "test", "production", "staging"]);
const redisUrl = /^(redis|rediss):\/\/[^\s]+$/i;

function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
function validatePort(value) { const port = Number(value); return Number.isInteger(port) && port >= 1 && port <= 65535; }
function validateMongoUri(value) { return /^mongodb(?:\+srv)?:\/\/[^\s]+$/i.test(value); }
function validateSecret(value) { return nonEmpty(value) && value.length >= 16; }
function validateOptionalInteger(source, field, errors, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!nonEmpty(source[field])) return;
  const value = Number(source[field]);
  if (!Number.isInteger(value) || value < min || value > max) errors.push({ field, reason: `must be an integer between ${min} and ${max}` });
}

function validateEnvironment(source = process.env, options = {}) {
  const errors = [];
  for (const field of required) {
    if (!nonEmpty(source[field])) errors.push({ field, reason: "is required" });
  }
  if (nonEmpty(source.MONGO_URI) && !validateMongoUri(source.MONGO_URI)) errors.push({ field: "MONGO_URI", reason: "must be a valid MongoDB URI" });
  if (nonEmpty(source.JWT_SECRET) && !validateSecret(source.JWT_SECRET)) errors.push({ field: "JWT_SECRET", reason: "must be at least 16 characters" });
  if (nonEmpty(source.REFRESH_TOKEN_SECRET) && !validateSecret(source.REFRESH_TOKEN_SECRET)) errors.push({ field: "REFRESH_TOKEN_SECRET", reason: "must be at least 16 characters" });
  if (nonEmpty(source.PORT) && !validatePort(source.PORT)) errors.push({ field: "PORT", reason: "must be an integer between 1 and 65535" });
  if (nonEmpty(source.NODE_ENV) && !environments.has(source.NODE_ENV)) errors.push({ field: "NODE_ENV", reason: "must be development, test, staging, or production" });
  if (nonEmpty(source.REDIS_URL) && !redisUrl.test(source.REDIS_URL.trim())) errors.push({ field: "REDIS_URL", reason: "must be a valid redis:// or rediss:// URL" });

  validateOptionalInteger(source, "CACHE_TTL", errors, { max: 2592000 });
  validateOptionalInteger(source, "QUEUE_CONCURRENCY", errors, { max: 100 });
  validateOptionalInteger(source, "QUEUE_RETRY_ATTEMPTS", errors, { max: 20 });
  validateOptionalInteger(source, "RATE_LIMIT_WINDOW", errors, { max: 86400000 });
  validateOptionalInteger(source, "RATE_LIMIT_WINDOW_MS", errors, { max: 86400000 });
  validateOptionalInteger(source, "RATE_LIMIT_MAX", errors, { max: 1000000 });
  validateOptionalInteger(source, "SLOW_REQUEST_MS", errors, { max: 600000 });
  validateOptionalInteger(source, "REDIS_TIMEOUT", errors, { max: 120000 });
  validateOptionalInteger(source, "REDIS_OPERATION_TIMEOUT_MS", errors, { max: 120000 });
  validateOptionalInteger(source, "MONGO_TIMEOUT", errors, { max: 120000 });
  validateOptionalInteger(source, "MONGO_TIMEOUT_MS", errors, { max: 120000 });

  for (const field of ["FRONTEND_URL", "BACKEND_URL"]) {
    const values = nonEmpty(source[field]) ? source[field].split(",").map((value) => value.trim()) : [];
    if (options.requireUrls && values.length === 0) errors.push({ field, reason: "is required in this environment" });
    if (values.some((value) => !conditionalUrl.test(value))) errors.push({ field, reason: "must contain valid http(s) URL(s)" });
  }
  if (nonEmpty(source.GEMINI_API_KEY) && source.GEMINI_API_KEY.trim().length < 10) errors.push({ field: "GEMINI_API_KEY", reason: "must be at least 10 characters when provided" });
  if (options.requireGemini && !nonEmpty(source.GEMINI_API_KEY)) errors.push({ field: "GEMINI_API_KEY", reason: "is required when Gemini integration is enabled" });
  if (errors.length) throw new EnvironmentValidationError(errors);

  return Object.freeze({
    mongoUri: source.MONGO_URI.trim(), jwtSecret: source.JWT_SECRET, refreshTokenSecret: source.REFRESH_TOKEN_SECRET,
    port: Number(source.PORT), nodeEnv: source.NODE_ENV.trim(),
    frontendUrls: nonEmpty(source.FRONTEND_URL) ? source.FRONTEND_URL.split(",").map((v) => v.trim()) : [],
    backendUrl: nonEmpty(source.BACKEND_URL) ? source.BACKEND_URL.trim() : undefined,
    geminiApiKey: nonEmpty(source.GEMINI_API_KEY) ? source.GEMINI_API_KEY : undefined,
    redisUrl: nonEmpty(source.REDIS_URL) ? source.REDIS_URL.trim() : undefined,
    cacheTtl: nonEmpty(source.CACHE_TTL) ? Number(source.CACHE_TTL) : 300,
    queueConcurrency: nonEmpty(source.QUEUE_CONCURRENCY) ? Number(source.QUEUE_CONCURRENCY) : 1,
  });
}

module.exports = { validateEnvironment, required };
