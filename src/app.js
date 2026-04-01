const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { connectDB } = require("./config/Database.js");
const { ensureIndexes } = require("./models/indexes.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
// const mongoSanitize = require("./config/sanitize");
// const xssClean = require("xss-clean");
// const { doubleCsrfProtection } = require("./config/csrfConfig.js");

const {
  authLimiter,
  apiLimiter,
  orderLimiter,
  reportLimiter,
} = require("./middlewares/ratelimiter.js");

const { initSocket } = require("./socket/index.js");

// ── Winston ───────────────────────────────────────────────────
const logger = require("./config/logger");
const requestLogger = require("./middlewares/requestLogger.js");
const errorLogger = require("./middlewares/ErrorLogger.js");

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// ── Shared CORS config ────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// ── Socket.io ─────────────────────────────────────────────────
const io = new Server(server, { cors: corsOptions });
initSocket(io);
app.set("io", io);

// ── Trust proxy ───────────────────────────────────────────────
app.set("trust proxy", 1);

// ── Middlewares (Order matters!) ──────────────────────────────

// 1. 🔒 Security headers — must be first
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
          "ws://localhost:3000",
          "wss://localhost:3000",
          ...(process.env.BACKEND_URL
            ? [`wss://${process.env.BACKEND_URL}`]
            : []),
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// 2. 🌐 CORS
app.use(cors(corsOptions));

// 3. 📦 Body parsing with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use(requestLogger);

// ── Rate Limiters ─────────────────────────────────────────────
app.use(["/auth", "/api/v1/auth"], authLimiter);
app.use(["/admin/reports", "/api/v1/admin/reports"], reportLimiter);
app.use(["/admin", "/api/v1/admin"], apiLimiter);
app.use(["/waiter/orders", "/api/v1/waiter/orders"], orderLimiter);
app.use(["/waiter", "/api/v1/waiter"], apiLimiter);
app.use(["/cashier/billing", "/api/v1/cashier/billing"], orderLimiter);
app.use(["/cashier", "/api/v1/cashier"], apiLimiter);
app.use(["/chef", "/api/v1/chef"], apiLimiter);

// ── Import Routers ────────────────────────────────────────────
const { authRouter } = require("./routes/auth.js");
const { router } = require("./routes/testRouter.js");
const qrMenuRouter = require("./routes/public/QrMenuRouter.js");
const { adminUserRouter } = require("./routes/admin/adminUser.js");
const { adminMenuRouter } = require("./routes/admin/adminMenu.js");
const { adminTableRouter } = require("./routes/admin/adminTable.js");
const { adminReportRouter } = require("./routes/admin/adminReportRouter");
const {
  adminCustomerRouter,
} = require("./routes/admin/adminCustomerRouter.js");
const {
  adminSettingsRouter,
} = require("./routes/admin/adminSettingsRouter.js");
const { adminBranchRouter } = require("./routes/admin/adminBranchRouter");
const inventoryRouter = require("./routes/admin/InventoryRouter.js");
const { cashierbillingRouter } = require("./routes/cashier/cashierBilling.js");
const { cashierKotRouter } = require("./routes/cashier/cashierKotOrder.js");
const { cashierReportsRouter } = require("./routes/cashier/cashierReports.js");
const { waiterOrderRouter } = require("./routes/waiter/waiterOrderRouter.js");
const { waiterTableRouter } = require("./routes/waiter/waiterTableRouter.js");
const { chefRouter } = require("./routes/chef/chefRouter.js");

// ── Version info endpoint ─────────────────────────────────────
app.get("/api/version", (req, res) => {
  res.json({
    current: "v1",
    supported: ["v1"],
    deprecated: [],
    note: "All routes available under /api/v1/* prefix",
  });
});

// app.use("/api/v1/auth", authRouter);
// app.use("/api/v1/test", router);
// app.use("/api/v1/public", qrMenuRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminMenuRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminTableRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminUserRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminReportRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminCustomerRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminSettingsRouter);
// app.use("/api/v1/admin", doubleCsrfProtection, adminBranchRouter);
// app.use("/api/v1/admin/inventory", doubleCsrfProtection, inventoryRouter);

// // All cashier routes
// app.use("/api/v1/cashier", doubleCsrfProtection, cashierbillingRouter);
// app.use("/api/v1/cashier", doubleCsrfProtection, cashierKotRouter);
// app.use("/api/v1/cashier", doubleCsrfProtection, cashierReportsRouter);

// // All waiter routes
// app.use("/api/v1/waiter", doubleCsrfProtection, waiterOrderRouter);
// app.use("/api/v1/waiter", doubleCsrfProtection, waiterTableRouter);

// // All chef routes
// app.use("/api/v1/chef", doubleCsrfProtection, chefRouter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/test", router);
app.use("/api/v1/public", qrMenuRouter);

app.use("/api/v1/public", qrMenuRouter);

app.use("/api/v1/admin", adminMenuRouter);

app.use("/api/v1/admin", adminTableRouter);

app.use("/api/v1/admin", adminUserRouter);

app.use("/api/v1/admin", adminReportRouter);

app.use("/api/v1/admin", adminCustomerRouter);

app.use("/api/v1/admin", adminSettingsRouter);

app.use("/api/v1/admin", adminBranchRouter);

app.use("/api/v1/admin/inventory", inventoryRouter);

app.use("/api/v1/cashier", cashierbillingRouter);

app.use("/api/v1/cashier", cashierKotRouter);

app.use("/api/v1/cashier", cashierReportsRouter);

app.use("/api/v1/waiter", waiterOrderRouter);

app.use("/api/v1/waiter", waiterTableRouter);

app.use("/api/v1/chef", chefRouter);

// ── Health Check ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "KOT POS API is running!",
    version: "v1",
    sockets: io.engine.clientsCount,
  });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Error logger ──────────────────────────────────────────────
app.use(errorLogger);

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  const message =
    process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again later."
      : err.message;

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ── Process-level crash handlers ──────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// ── Start server ──────────────────────────────────────────────
connectDB()
  .then(async () => {
    await ensureIndexes();
    server.listen(PORT, () => {
      logger.info("Server started", {
        port: PORT,
        env: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL,
      });
      logger.info("Socket.io ready");
    });
  })
  .catch((err) => {
    logger.error("Database connection failed", { message: err.message });
    process.exit(1);
  });
