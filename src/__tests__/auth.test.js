const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

// ── Set env vars BEFORE requiring any app code ────────────────
process.env.JWT_SECRET = "test_jwt_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";
process.env.NODE_ENV = "test";

// ── Mock the User model ───────────────────────────────────────
// We never touch a real DB — all User calls are intercepted here
jest.mock("../models/users");
const User = require("../models/users");

// ── Mock logger to silence Winston output during tests ────────
jest.mock("../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Mock cookie config (return plain objects, no secure flags) ─
jest.mock("../config/cookieConfig", () => ({
  accessCookieOptions: { httpOnly: true },
  refreshCookieOptions: { httpOnly: true },
  clearCookieOptions: () => ({ httpOnly: true }),
}));

// ── Mock validation utils ─────────────────────────────────────
jest.mock("../utils/validation", () => ({
  validateSignupData: jest.fn(), // no-op by default, throws on bad data
  validateStatus: jest.fn(({ status }) => status || "active"),
  validateRole: jest.fn(({ role }) => role || "waiter"),
}));

// ── Build a minimal Express app (no DB, no socket, no socket.io)
const { authRouter } = require("../routes/auth");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/auth", authRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Build a real signed access token for a mock user */
function makeAccessToken(payload = {}) {
  return jwt.sign(
    {
      _id: "user_id_123",
      username: "testuser",
      role: "admin",
      branchId: null,
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

/** Build a real signed refresh token */
function makeRefreshToken(userId = "user_id_123") {
  return jwt.sign({ _id: userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
}

/** A mock User document returned by User.findOne / User.findById */
function mockUserDoc(overrides = {}) {
  return {
    _id: "user_id_123",
    username: "testuser",
    role: "admin",
    status: "active",
    branchId: null,
    validatePassword: jest.fn().mockResolvedValue(true),
    getJWT: jest.fn().mockResolvedValue(makeAccessToken()),
    getRefreshToken: jest.fn().mockReturnValue(makeRefreshToken()),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/signup
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/signup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — creates a new user successfully", async () => {
    User.findOne.mockResolvedValue(null); // username not taken
    const savedUser = mockUserDoc();
    User.mockImplementation(() => savedUser);

    const res = await request(app).post("/api/v1/auth/signup").send({
      username: "testuser",
      password: "Test@1234!",
      role: "waiter",
      status: "active",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("User registered successfully");
    expect(res.body.user).toMatchObject({
      username: "testuser",
      role: "admin", // comes from mockUserDoc
    });
  });

  it("400 — rejects duplicate username", async () => {
    User.findOne.mockResolvedValue(mockUserDoc()); // username already exists

    const res = await request(app).post("/api/v1/auth/signup").send({
      username: "testuser",
      password: "Test@1234!",
      role: "waiter",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Username already exists");
  });

  it("400 — rejects when validateSignupData throws", async () => {
    const { validateSignupData } = require("../utils/validation");
    validateSignupData.mockImplementationOnce(() => {
      throw new Error("Username is required");
    });

    const res = await request(app).post("/api/v1/auth/signup").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Username is required");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — logs in with valid credentials", async () => {
    User.findOne.mockResolvedValue(mockUserDoc());

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Login successful");
    expect(res.body.user).toMatchObject({
      username: "testuser",
      role: "admin",
    });
  });

  it("200 — sets HttpOnly cookies on successful login", async () => {
    User.findOne.mockResolvedValue(mockUserDoc());

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    // Both token and refreshToken cookies should be set
    const cookieNames = cookies.map((c) => c.split("=")[0]);
    expect(cookieNames).toContain("token");
    expect(cookieNames).toContain("refreshToken");
  });

  it("200 — does NOT expose tokens in the response body", async () => {
    User.findOne.mockResolvedValue(mockUserDoc());

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("401 — rejects wrong password", async () => {
    const user = mockUserDoc({
      validatePassword: jest.fn().mockResolvedValue(false),
    });
    User.findOne.mockResolvedValue(user);

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "WrongPassword!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("401 — rejects non-existent username without leaking info", async () => {
    User.findOne.mockResolvedValue(null); // user not found

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "ghost_user",
      password: "SomePassword!",
    });

    expect(res.status).toBe(401);
    // Must be the same message as wrong password — prevents enumeration
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("403 — rejects locked account", async () => {
    User.findOne.mockResolvedValue(mockUserDoc({ status: "locked" }));

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Account locked");
  });

  it("403 — rejects inactive account", async () => {
    User.findOne.mockResolvedValue(
      mockUserDoc({ status: "accepted" }), // not "active"
    );

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("inactive");
  });

  it("200 — includes branchId in user response", async () => {
    User.findOne.mockResolvedValue(mockUserDoc({ branchId: "branch_001" }));

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.branchId).toBe("branch_001");
  });

  it("200 — branchId is null for super-admin", async () => {
    User.findOne.mockResolvedValue(mockUserDoc({ branchId: null }));

    const res = await request(app).post("/api/v1/auth/login").send({
      username: "testuser",
      password: "Test@1234!",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.branchId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/auth/me", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns user data with valid token cookie", async () => {
    User.findById.mockResolvedValue(mockUserDoc());

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `token=${makeAccessToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      role: "admin",
      branchId: null,
    });
  });

  it("200 — also accepts token via Authorization header", async () => {
    User.findById.mockResolvedValue(mockUserDoc());

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${makeAccessToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it("401 — rejects request with no token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
  });

  it("401 — rejects an expired / tampered token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", "token=invalid.token.here");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("401 — returns 401 when user no longer exists in DB", async () => {
    User.findById.mockResolvedValue(null); // deleted user

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", `token=${makeAccessToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("User not found");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/refresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — issues new tokens with valid refresh token", async () => {
    User.findById.mockResolvedValue(mockUserDoc());

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${makeRefreshToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Token refreshed");
  });

  it("200 — rotates both cookies on refresh", async () => {
    User.findById.mockResolvedValue(mockUserDoc());

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${makeRefreshToken()}`);

    const cookies = res.headers["set-cookie"];
    const cookieNames = cookies.map((c) => c.split("=")[0]);
    expect(cookieNames).toContain("token");
    expect(cookieNames).toContain("refreshToken");
  });

  it("401 — rejects when no refresh token cookie present", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No refresh token");
  });

  it("401 — rejects tampered refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", "refreshToken=tampered.token.here");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired refresh token");
  });

  it("401 — rejects when user no longer exists", async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${makeRefreshToken()}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("User not found");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/auth/logout", () => {
  it("200 — clears cookies and returns success message", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logout successful");
  });

  it("200 — clears the token cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    const cookies = res.headers["set-cookie"] || [];
    const tokenCookie = cookies.find((c) => c.startsWith("token="));
    // Cookie should be cleared (empty value or Max-Age=0)
    if (tokenCookie) {
      const isCleared =
        tokenCookie.includes("Max-Age=0") ||
        tokenCookie.includes("token=;") ||
        tokenCookie.match(/token=\s*;/);
      expect(isCleared).toBeTruthy();
    }
  });

  it("200 — logout works even without a token (already logged out)", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
  });
});
