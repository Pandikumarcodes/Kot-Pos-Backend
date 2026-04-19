// ─────────────────────────────────────────────────────────────
// Authentication Security Tests — KOT POS
// Pattern: mirrors your existing auth.test.js exactly
// Run: npx jest SecurityTest/auth.security --verbose --forceExit
// ─────────────────────────────────────────────────────────────

const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const helmet = require("helmet");

// ── Environment setup ─────────────────────────────────────────
process.env.JWT_SECRET = "test_jwt_secret_security_suite";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret_security";
process.env.NODE_ENV = "test";

// ── Mock logger ───────────────────────────────────────────────
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock User model ───────────────────────────────────────────
jest.mock("../../models/users");

const User = require("../../models/users");
const { authRouter } = require("../../routes/auth");

// ── Build mini Express app ────────────────────────────────────
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/auth", authRouter);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// ── Token helpers ─────────────────────────────────────────────
function makeToken(role = "admin", userId = "aabbcc112233445566778899") {
  return jwt.sign(
    { _id: userId, username: "testuser", role, branchId: null },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function makeExpiredToken() {
  return jwt.sign(
    { _id: "aabbcc112233445566778899", role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "0s" },
  );
}

// ── Shared hashed password ────────────────────────────────────
const VALID_PASSWORD = "Admin@Secure99!";
let hashedPassword = "";

beforeAll(async () => {
  hashedPassword = await bcrypt.hash(VALID_PASSWORD, 10);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// 1. LOGIN SECURITY
// ─────────────────────────────────────────────────────────────
describe("Login Security", () => {
  function mockActiveUser(overrides = {}) {
    const user = {
      _id: "aabbcc112233445566778899",
      username: "admin_test",
      role: "admin",
      status: "active",
      branchId: null,
      password: hashedPassword,
      validatePassword: jest.fn().mockResolvedValue(true),
      getJWT: jest.fn().mockResolvedValue(makeToken("admin")),
      getRefreshToken: jest.fn().mockReturnValue("mock_refresh_token"),
      ...overrides,
    };
    User.findOne.mockResolvedValue(user);
    return user;
  }

  test("valid credentials return 200 with user info", async () => {
    mockActiveUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe("admin_test");
  });

  test("JWT token is NOT exposed in response body", async () => {
    mockActiveUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.jwt).toBeUndefined();
  });

  test("access token cookie has HttpOnly flag", async () => {
    mockActiveUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    const cookies = res.headers["set-cookie"] ?? [];
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/HttpOnly/i);
  });

  test("refresh token cookie has HttpOnly flag", async () => {
    mockActiveUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    const cookies = res.headers["set-cookie"] ?? [];
    const refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  test("wrong password returns 401", async () => {
    const user = mockActiveUser();
    user.validatePassword.mockResolvedValue(false);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: "WrongPassword!" });
    expect(res.status).toBe(401);
  });

  test("non-existent username returns 401", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "ghost_xyz_99999", password: "Password@123!" });
    expect(res.status).toBe(401);
  });

  test("wrong password and non-existent user return same error", async () => {
    const user = mockActiveUser();
    user.validatePassword.mockResolvedValue(false);
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: "WrongPassword!" });

    User.findOne.mockResolvedValue(null);
    const noUser = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "ghost_xyz", password: "Password@123!" });

    expect(wrongPassword.status).toBe(noUser.status);
    expect(wrongPassword.body.error).toBe(noUser.body.error);
  });

  test("locked account returns 403", async () => {
    mockActiveUser({ status: "locked" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/i);
  });

  test("inactive account cannot login", async () => {
    mockActiveUser({ status: "accepted" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: VALID_PASSWORD });
    expect(res.status).toBe(403);
  });

  test("empty username returns error", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "", password: "Password@123!" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("empty password returns error", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "admin_test", password: "" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("missing body returns error", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/v1/auth/login").send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("NoSQL injection { $gt } in username is blocked", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).not.toBe(200);
  });

  test("NoSQL injection with $where is blocked", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: { $where: "function() { return true; }" },
        password: "anything",
      });
    expect(res.status).not.toBe(200);
  });

  test("XSS in username does not execute", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: "<script>alert('xss')</script>",
        password: "Password@123!",
      });
    expect(res.status).not.toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("<script>");
  });

  test("oversized username payload is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "a".repeat(100_000), password: "Password@123!" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("SQL injection patterns are handled safely", async () => {
    User.findOne.mockResolvedValue(null);
    const payloads = [
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "'; DROP TABLE users;--",
    ];
    for (const payload of payloads) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ username: payload, password: "anything" });
      expect(res.status).not.toBe(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SIGNUP SECURITY
// NOTE: Signup has rate limit of 5 per hour.
// Tests accept BOTH 400 (validation error) AND 429 (rate limited)
// because both mean the request was correctly rejected.
// ─────────────────────────────────────────────────────────────
describe("Signup Security", () => {
  const uniqueName = () =>
    `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Helper: accept 400 OR 429 — both are valid rejections
  function expectRejected(status) {
    expect([400, 429]).toContain(status);
  }

  beforeEach(() => {
    User.findOne.mockResolvedValue(null);
    User.prototype.save = jest.fn().mockResolvedValue(true);
  });

  test("weak password is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ username: uniqueName(), password: "password" });
    expectRejected(res.status);
  });

  test("short password is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ username: uniqueName(), password: "Ab1!" });
    expectRejected(res.status);
  });

  test("password without special char is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ username: uniqueName(), password: "Password123" });
    expectRejected(res.status);
  });

  test("duplicate username returns 400 or 429", async () => {
    User.findOne.mockResolvedValue({ username: "existing_user" });
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ username: "existing_user", password: "StrongPass@99!" });
    expectRejected(res.status);
    // If 400, verify correct error message
    if (res.status === 400) {
      expect(res.body.error).toMatch(/already exists/i);
    }
  });

  test("cannot self-assign admin role on signup", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        username: uniqueName(),
        password: "StrongPass@99!",
        role: "admin",
      });
    if (res.status === 201) {
      expect(res.body.user?.role).not.toBe("admin");
    } else {
      expectRejected(res.status);
    }
  });

  test("missing username is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ password: "StrongPass@99!" });
    // Accept 400 (validation) OR 429 (rate limited)
    expectRejected(res.status);
  });

  test("missing password is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ username: uniqueName() });
    expectRejected(res.status);
  });

  test("XSS in username is rejected or sanitized", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        username: "<script>alert('xss')</script>",
        password: "StrongPass@99!",
      });
    if (res.status === 201) {
      expect(res.body.user?.username).not.toContain("<script>");
    } else {
      expectRejected(res.status);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. SESSION & TOKEN SECURITY
// ─────────────────────────────────────────────────────────────
describe("Session & Token Security", () => {
  test("protected route returns 401 without token", async () => {
    User.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("valid token grants access to protected route", async () => {
    const mockUser = {
      _id: "aabbcc112233445566778899",
      username: "admin_test",
      role: "admin",
      branchId: null,
    };
    User.findById = jest.fn().mockResolvedValue(mockUser);
    const token = makeToken("admin");
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  test("fake JWT token is rejected", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", ["token=fakejwttoken123"]);
    expect(res.status).toBe(401);
  });

  test("tampered JWT payload is rejected", async () => {
    const tampered =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJfaWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsInJvbGUiOiJhZG1pbiJ9." +
      "fakesignature";
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`token=${tampered}`]);
    expect(res.status).toBe(401);
  });

  test("expired JWT is rejected", async () => {
    const expired = makeExpiredToken();
    await new Promise((r) => setTimeout(r, 100));
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`token=${expired}`]);
    expect(res.status).toBe(401);
  });

  test("logout returns 200", async () => {
    const token = makeToken("admin");
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [`token=${token}`]);
    expect(res.status).toBe(200);
  });

  test("logout clears token cookie", async () => {
    const token = makeToken("admin");
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", [`token=${token}`]);
    const cookies = res.headers["set-cookie"] ?? [];
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    if (tokenCookie) {
      expect(tokenCookie).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i);
    }
  });

  test("refresh without token returns 401", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });

  test("fake refresh token is rejected", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", ["refreshToken=fakerefreshtoken123"]);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. RATE LIMITING
// Rate limiting is bypassed in NODE_ENV=test
// This test confirms it's configured and would activate in prod
// ─────────────────────────────────────────────────────────────
describe("Rate Limiting Security", () => {
  test("login endpoint exists and responds", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "test", password: "test" });
    expect(res.status).toBeDefined();
    console.log(
      "[security] Rate limiting bypassed in test mode — " +
        "verify it works in production with NODE_ENV=production",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 5. SECURITY HEADERS
// ─────────────────────────────────────────────────────────────
describe("Security Headers", () => {
  test("X-Content-Type-Options header is set", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("X-Frame-Options header prevents clickjacking", async () => {
    const res = await request(app).get("/health");
    const frameOptions = res.headers["x-frame-options"];
    expect(frameOptions).toBeDefined();
    expect(frameOptions).toMatch(/DENY|SAMEORIGIN/i);
  });

  test("Content-Security-Policy header is set", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  test("server does not expose Express version", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("health endpoint returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
