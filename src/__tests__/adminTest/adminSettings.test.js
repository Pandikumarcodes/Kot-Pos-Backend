const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/settings");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Settings = require("../../models/settings");
const {
  adminSettingsRouter,
} = require("../../routes/admin/adminSettingsRouter");

const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminSettingsRouter);

function makeToken(role = "admin") {
  return jwt.sign(
    {
      _id: "user_id_123",
      username: "testuser",
      role,
      branchId: VALID_BRANCH_ID,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin") {
  return { _id: "user_id_123", username: "testuser", role };
}

function mockSettingsDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    businessName: "KOT POS",
    address: "123 MG Road",
    phone: "9876543210",
    gstin: "29ABCDE1234F1Z5",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/settings
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — admin can fetch settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.settings.businessName).toBe("KOT POS");
  });

  it("200 — manager can fetch settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(200);
  });

  it("200 — creates default settings when none exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Settings.findOne.mockResolvedValue(null);
    Settings.create.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("admin")}`);

    expect(res.status).toBe(200);
    expect(Settings.create).toHaveBeenCalledWith({});
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/settings");
    expect(res.status).toBe(401);
  });

  it("403 — waiter cannot fetch settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("waiter")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — cashier cannot fetch settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/settings
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/settings", () => {
  beforeEach(() => jest.clearAllMocks());

  const validPayload = {
    businessName: "New KOT POS",
    address: "456 Brigade Road",
    phone: "9123456789",
  };

  it("200 — admin can update settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());
    Settings.findByIdAndUpdate.mockResolvedValue(
      mockSettingsDoc({ businessName: "New KOT POS" }),
    );

    const res = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Settings saved successfully");
  });

  it("200 — creates settings when none exist", async () => {
    User.findById.mockResolvedValue(mockUserDoc("admin"));
    Settings.findOne.mockResolvedValue(null);
    Settings.create.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("admin")}`)
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(Settings.create).toHaveBeenCalledWith(validPayload);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put("/api/v1/admin/settings")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("403 — manager cannot update settings (admin only)", async () => {
    User.findById.mockResolvedValue(mockUserDoc("manager"));

    const res = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("manager")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden - insufficient role");
  });

  it("403 — cashier cannot update settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });

  it("403 — waiter cannot update settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("waiter"));

    const res = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("waiter")}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });
});
