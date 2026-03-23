// backend/config/logger.js
// ─────────────────────────────────────────────────────────────
// Winston logger — structured JSON logs with daily rotation.
// Import anywhere:
//   const logger = require("../config/logger");
//   logger.info("Server started");
//   logger.error("Something failed", { err: error.message });
// ─────────────────────────────────────────────────────────────

const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// ── Log directory ─────────────────────────────────────────────
const LOG_DIR = path.join(process.cwd(), "logs");

// ── Custom log format ─────────────────────────────────────────
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }), // include stack traces
  winston.format.json(), // output as JSON
);

// ── Console format (coloured, readable in dev) ────────────────
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }),
);

// ── Transports ────────────────────────────────────────────────
const transports = [
  // Console — always on, coloured in dev
  new winston.transports.Console({
    format: consoleFormat,
    silent: process.env.NODE_ENV === "test",
  }),

  // Errors only — kept for 30 days
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    level: "error",
    maxFiles: "30d",
    zippedArchive: true,
    format: logFormat,
  }),

  // All levels — kept for 14 days
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: "combined-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    zippedArchive: true,
    format: logFormat,
  }),
];

// ── Create logger ─────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports,
  // Don't crash on unhandled promise rejections
  exitOnError: false,
});

module.exports = logger;
