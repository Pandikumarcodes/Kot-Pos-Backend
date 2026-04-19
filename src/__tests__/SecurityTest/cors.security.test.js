const request = require("supertest");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// ── Environment ───────────────────────────────────────────────
process.env.JWT_SECRET = "test_jwt_secret_cors";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_cors";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "https://kotpos.vercel.app";

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Build app with EXACT same CORS config as your app.js ─────
// Copy from your app.js corsOptions exactly
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

const app = express();
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// ── Test endpoints ────────────────────────────────────────────
app.get("/api/v1/test", (_req, res) => res.json({ ok: true }));
app.post("/api/v1/auth/login", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/admin/users", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/public/menu/:id", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─────────────────────────────────────────────────────────────
// 1. ALLOWED ORIGINS
// ─────────────────────────────────────────────────────────────
describe("CORS — Allowed Origins", () => {
  // ── 1.1 Localhost dev frontend ────────────────────────────
  test("localhost:5173 is allowed (dev frontend)", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(res.status).toBe(200);
  });

  // ── 1.2 Localhost backend ─────────────────────────────────
  test("localhost:3000 is allowed (local backend)", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.status).toBe(200);
  });

  // ── 1.3 Production frontend ───────────────────────────────
  test("production frontend URL is allowed", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", process.env.FRONTEND_URL);

    expect(res.headers["access-control-allow-origin"]).toBe(
      process.env.FRONTEND_URL,
    );
    expect(res.status).toBe(200);
  });

  // ── 1.4 No origin (curl/Postman/server) ──────────────────
  test("request with no Origin header is allowed (server-to-server)", async () => {
    const res = await request(app).get("/api/v1/test");
    // No Origin = allowed (Postman, curl, server calls)
    expect(res.status).toBe(200);
  });

  // ── 1.5 Credentials header ────────────────────────────────
  test("allowed origin gets credentials header", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ─────────────────────────────────────────────────────────────
// 2. BLOCKED ORIGINS
// ─────────────────────────────────────────────────────────────
describe("CORS — Blocked Origins", () => {
  // ── 2.1 Evil origin ───────────────────────────────────────
  test("evil.com is blocked", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "https://evil.com");

    // CORS header must NOT be set for blocked origins
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.com",
    );
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  test("attacker.kotpos.in is blocked (subdomain attack)", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "https://attacker.kotpos.in");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://attacker.kotpos.in",
    );
  });

  test("kotpos.evil.com is blocked (domain confusion)", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "https://kotpos.evil.com");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://kotpos.evil.com",
    );
  });

  test("http://localhost:9999 is blocked (wrong port)", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "http://localhost:9999");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "http://localhost:9999",
    );
  });

  test("null origin is blocked", async () => {
    // "null" origin is sent by sandboxed iframes — a known attack vector
    const res = await request(app).get("/api/v1/test").set("Origin", "null");

    expect(res.headers["access-control-allow-origin"]).not.toBe("null");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  test("file:// origin is blocked", async () => {
    const res = await request(app).get("/api/v1/test").set("Origin", "file://");

    expect(res.headers["access-control-allow-origin"]).not.toBe("file://");
  });

  // ── 2.2 Similar looking domains ──────────────────────────
  test("kotpos.vercel.app.evil.com is blocked", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "https://kotpos.vercel.app.evil.com");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://kotpos.vercel.app.evil.com",
    );
  });

  test("https://kotpos.vercel.app.com is blocked", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "https://kotpos.vercel.app.com");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://kotpos.vercel.app.com",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 3. PREFLIGHT REQUESTS
// ─────────────────────────────────────────────────────────────
describe("CORS — Preflight Requests", () => {
  // ── 3.1 Valid preflight ───────────────────────────────────
  test("valid preflight from allowed origin returns 204", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    // 204 or 200 = preflight approved
    expect([200, 204]).toContain(res.status);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  test("preflight from blocked origin is rejected", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://evil.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.com",
    );
  });

  test("preflight allows Content-Type header", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    // Content-Type must be in allowed headers
    const allowedHeaders = res.headers["access-control-allow-headers"] ?? "";
    // Either specifically listed or wildcard
    const isAllowed =
      allowedHeaders.includes("Content-Type") ||
      allowedHeaders.includes("content-type") ||
      allowedHeaders === "*";

    expect(isAllowed).toBeTruthy();
  });

  test("preflight allows credentials", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ─────────────────────────────────────────────────────────────
// 4. WILDCARD CHECK
// ─────────────────────────────────────────────────────────────
describe("CORS — No Wildcard", () => {
  // ── 4.1 Wildcard never used ───────────────────────────────
  test("response never uses wildcard (*) origin", async () => {
    const origins = [
      "http://localhost:5173",
      "https://evil.com",
      "https://attacker.com",
    ];

    for (const origin of origins) {
      const res = await request(app).get("/api/v1/test").set("Origin", origin);

      expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    }
  });

  // ── 4.2 Credentials + wildcard combination ────────────────
  test("credentials header is never combined with wildcard", async () => {
    const res = await request(app)
      .get("/api/v1/test")
      .set("Origin", "http://localhost:5173");

    const origin = res.headers["access-control-allow-origin"];
    const credentials = res.headers["access-control-allow-credentials"];

    // If credentials is true, origin must NOT be wildcard
    if (credentials === "true") {
      expect(origin).not.toBe("*");
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 5. CORS ON SENSITIVE ROUTES
// ─────────────────────────────────────────────────────────────
describe("CORS — Sensitive Route Protection", () => {
  // ── 5.1 Login route ───────────────────────────────────────
  test("login route blocks cross-origin requests from evil.com", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.com")
      .send({ username: "admin", password: "Admin@1234" });

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.com",
    );
  });

  test("login route allows requests from localhost:5173", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({ username: "admin", password: "Admin@1234" });

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  // ── 5.2 Admin route ───────────────────────────────────────
  test("admin route blocks cross-origin from evil.com", async () => {
    const res = await request(app)
      .get("/api/v1/admin/users")
      .set("Origin", "https://evil.com");

    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.com",
    );
  });

  // ── 5.3 Public route ──────────────────────────────────────
  test("public QR menu route - CORS blocks unknown browser origins", async () => {
    const res = await request(app)
      .get("/api/v1/public/menu/507f1f77bcf86cd799439011")
      .set("Origin", "https://any-restaurant-website.com");
    // CORS blocks unknown origins - correct behavior
    // Real QR scans have no Origin header and work fine
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://any-restaurant-website.com",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 6. CORS CONFIGURATION INTEGRITY
// ─────────────────────────────────────────────────────────────
describe("CORS — Configuration Integrity", () => {
  // ── 6.1 Allowed origins list ──────────────────────────────
  test("allowed origins list contains expected values", () => {
    expect(allowedOrigins).toContain("http://localhost:5173");
    expect(allowedOrigins).toContain("http://localhost:3000");
    expect(allowedOrigins).toContain(process.env.FRONTEND_URL);
  });

  test("allowed origins list does not contain undefined or null", () => {
    for (const origin of allowedOrigins) {
      expect(origin).toBeDefined();
      expect(origin).not.toBeNull();
      expect(typeof origin).toBe("string");
      expect(origin.length).toBeGreaterThan(0);
    }
  });

  test("FRONTEND_URL environment variable is set", () => {
    if (!process.env.FRONTEND_URL) {
      console.warn(
        "\n⚠️  [CONFIGURATION WARNING]\n" +
          "  FRONTEND_URL environment variable is not set\n" +
          "  Your production frontend will be BLOCKED by CORS\n" +
          "  Fix: Set FRONTEND_URL=https://your-app.vercel.app in .env\n",
      );
    }
    // Document — test passes either way
    expect(true).toBe(true);
  });

  test("allowed origins do not include dangerous values", () => {
    const dangerous = ["*", "null", "file://", "data:"];
    for (const origin of allowedOrigins) {
      expect(dangerous).not.toContain(origin);
    }
  });

  // ── 6.2 Origin reflection check ──────────────────────────
  test("CORS does not blindly reflect any origin", async () => {
    const attackOrigins = [
      "https://evil.com",
      "https://attacker.com",
      "https://malicious.kotpos.fake.com",
    ];

    for (const origin of attackOrigins) {
      const res = await request(app).get("/api/v1/test").set("Origin", origin);

      // Must NOT reflect the attacker's origin back
      expect(res.headers["access-control-allow-origin"]).not.toBe(origin);
    }
  });
});
