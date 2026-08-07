const path = require("path");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});

const mongoose = require("mongoose");
const logger = require("../config/logger");
const { connectDB } = require("../config/Database");

const EXIT_CODES = Object.freeze({ SUCCESS: 0, FAILURE: 1, USAGE: 2 });

const log = {
  info(message, meta = {}) {
    logger.info(`[seed] ${message}`, meta);
  },
  warn(message, meta = {}) {
    logger.warn(`[seed] ${message}`, meta);
  },
  error(message, meta = {}) {
    logger.error(`[seed] ${message}`, meta);
  },
};

function parseArgs(argv = process.argv.slice(2)) {
  const allowed = new Set(["--clean", "--force", "--admin-only"]);
  const options = { clean: false, force: false, adminOnly: false };
  for (const arg of argv) {
    if (!allowed.has(arg)) throw new Error(`Unknown option: ${arg}`);
    if (arg === "--clean") options.clean = true;
    if (arg === "--force") options.force = true;
    if (arg === "--admin-only") options.adminOnly = true;
  }
  if (options.clean && !options.force) {
    throw new Error("--clean is destructive; re-run with --clean --force");
  }
  return options;
}

function requiredEnv(...names) {
  for (const name of names)
    if (process.env[name]?.trim()) return process.env[name].trim();
  throw new Error(
    `Missing required environment variable: ${names.join(" or ")}`,
  );
}

function jsonEnv(name, fallback) {
  if (!process.env[name]?.trim()) return fallback;
  try {
    const value = JSON.parse(process.env[name]);
    if (!Array.isArray(value)) throw new Error("must be a JSON array");
    return value;
  } catch (error) {
    throw new Error(`${name} ${error.message}`);
  }
}

async function saveIfMissing(
  Model,
  filter,
  data,
  label,
  { force = false } = {},
) {
  let document = await Model.findOne(filter);
  if (document) {
    if (force) {
      Object.assign(document, data);
      await document.save();
      log.info(`updated ${label}`);
      return { document, action: "updated" };
    }
    log.info(`kept ${label}`);
    return { document, action: "kept" };
  }
  document = new Model(data);
  await document.save();
  log.info(`created ${label}`);
  return { document, action: "created" };
}

async function removeSeedRecords(records) {
  for (const { Model, filter, label } of records) {
    const result = await Model.deleteMany(filter);
    if (result.deletedCount)
      log.warn(`removed ${result.deletedCount} ${label}`);
  }
}

async function runSeed(name, seed, options = {}) {
  log.info(`starting ${name}`);
  const result = await seed(options);
  log.info(`completed ${name}`);
  return result;
}

async function closeDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

async function executeSeed(main, argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
    console.log("MONGO_URI:", process.env.MONGO_URI);
    await connectDB();
    await main(options);
    await closeDatabase();
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    log.error(error.message, {
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    });
    try {
      await closeDatabase();
    } catch (closeError) {
      log.error("database shutdown failed", { message: closeError.message });
    }
    return error.message.startsWith("Unknown option") ||
      error.message.startsWith("--clean")
      ? EXIT_CODES.USAGE
      : EXIT_CODES.FAILURE;
  }
}

module.exports = {
  EXIT_CODES,
  log,
  parseArgs,
  requiredEnv,
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
  executeSeed,
  closeDatabase,
};
