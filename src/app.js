const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { connectDB } = require("./config/Database.js");
const { ensureIndexes } = require("./models/indexes.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const {
  authLimiter,
  apiLimiter,
  orderLimiter,
  reportLimiter,
} = require("./middlewares/ratelimiter.js");

const { initSocket } = require("./socket/index.js");

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.FRONTEND_URL,
      ];
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
});

initSocket(io);
app.set("io", io);

// ── Trust proxy ───────────────────────────────────────────────
app.set("trust proxy", 1);

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.FRONTEND_URL,
      ];
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// ── Rate Limiters ─────────────────────────────────────────────
app.use("/auth", authLimiter);

app.use("/admin/reports", reportLimiter);
app.use("/admin", apiLimiter);

app.use("/waiter/orders", orderLimiter);
app.use("/waiter", apiLimiter);

app.use("/cashier/billing", orderLimiter);
app.use("/cashier", apiLimiter);

app.use("/chef", apiLimiter);

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

// NOTE: branchScope is NOT mounted globally here anymore.
// Each router applies it internally AFTER userAuth so req.user
// is guaranteed to be populated when branchScope runs.

const { cashierbillingRouter } = require("./routes/cashier/cashierBilling.js");
const { cashierKotRouter } = require("./routes/cashier/cashierKotOrder.js");
const { cashierReportsRouter } = require("./routes/cashier/cashierReports.js");

const { waiterOrderRouter } = require("./routes/waiter/waiterOrderRouter.js");
const { waiterTableRouter } = require("./routes/waiter/waiterTableRouter.js");

const { chefRouter } = require("./routes/chef/chefRouter.js");
const inventoryRouter = require("./routes/admin/InventoryRouter.js");

// ── Mount Routes ──────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/test", router);

app.use("/public", qrMenuRouter);
app.use("/admin", adminMenuRouter);
app.use("/admin", adminTableRouter);
app.use("/admin", adminUserRouter);
app.use("/admin", adminReportRouter);
app.use("/admin", adminCustomerRouter);
app.use("/admin", adminSettingsRouter);
app.use("/admin", adminBranchRouter);
app.use("/admin/inventory", inventoryRouter);

app.use("/cashier", cashierbillingRouter);
app.use("/cashier", cashierKotRouter);
app.use("/cashier", cashierReportsRouter);

app.use("/waiter", waiterOrderRouter);
app.use("/waiter", waiterTableRouter);

app.use("/chef", chefRouter);

// ── Health Check ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "KOT POS API is running!",
    sockets: io.engine.clientsCount,
  });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

connectDB()
  .then(async () => {
    await ensureIndexes();
    server.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`✅ Socket.io ready`);
      console.log(`✅ Environment: ${process.env.NODE_ENV}`);
      console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });
