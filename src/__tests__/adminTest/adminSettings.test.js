const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../modules/administration/AdministrationAuditLogger", () => ({
  createContext: jest.fn((values = {}) => ({ correlationId: "test-correlation", ...values })),
  settingsChanged: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));
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
const { settingsRouter } = require("../../routes/settingsRouter");

const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/admin", adminSettingsRouter);
app.use("/api/v1", settingsRouter);

function makeToken(role = "admin", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    {
      _id: "user_id_123",
      username: "testuser",
      role,
      branchId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockUserDoc(role = "admin", branchId = VALID_BRANCH_ID) {
  return { _id: "user_id_123", username: "testuser", role, branchId };
}

function mockSettingsDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    businessName: "KOT POS",
    address: "123 MG Road",
    phone: "9876543210",
    gstin: "29ABCDE1234F1Z5",
    email: "admin@kotpos.example",
    fssai: "FSSAI-SECRET-FOR-ADMIN",
    paymentMethods: { cash: true, card: true, upi: true },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/settings
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — global admin resolves a selected branch", async () => {
    const selectedBranchId = new mongoose.Types.ObjectId().toString();
    User.findById.mockResolvedValue(mockUserDoc("admin", null));
    Settings.findOne.mockResolvedValue(mockSettingsDoc({ branchId: selectedBranchId }));

    const res = await request(app)
      .get(`/api/v1/admin/settings?branchId=${selectedBranchId}`)
      .set("Cookie", `token=${makeToken("admin", null)}`);

    expect(res.status).toBe(200);
    expect(Settings.findOne).toHaveBeenCalledWith({ branchId: selectedBranchId });
  });

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

  it("200 — normalizes role casing and whitespace for operational reads", async () => {
    User.findById.mockResolvedValue(mockUserDoc(" Cashier "));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get("/api/v1/settings")
      .set("Cookie", `token=${makeToken(" Cashier ")}`);

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
    expect(Settings.create).toHaveBeenCalledWith({ branchId: VALID_BRANCH_ID });
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

  it("403 — cashier cannot fetch admin settings", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/settings operational cashier settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows a cashier to read only its assigned branch", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    Settings.findOne.mockResolvedValue(mockSettingsDoc());

    const res = await request(app)
      .get(`/api/v1/settings?branchId=${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      businessName: "KOT POS",
      paymentMethods: { cash: true, card: true, upi: true },
    });
    expect(res.body.settings).not.toHaveProperty("email");
    expect(res.body.settings).not.toHaveProperty("gstin");
    expect(res.body.settings).not.toHaveProperty("fssai");
  });

  it("rejects a cashier requesting another branch", async () => {
    const otherBranchId = new mongoose.Types.ObjectId().toString();
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .get(`/api/v1/settings?branchId=${otherBranchId}`)
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(403);
    expect(Settings.findOne).not.toHaveBeenCalled();
  });

  it("does not expose settings mutation on the operational route", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));
    const res = await request(app)
      .put("/api/v1/settings")
      .set("Cookie", `token=${makeToken("cashier")}`)
      .send({ businessName: "Nope" });

    expect(res.status).toBe(404);
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
    expect(Settings.create).toHaveBeenCalledWith({
      ...validPayload,
      branchId: VALID_BRANCH_ID,
    });
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

describe("settings reset contract", () => {
  it("has no reset operation available to cashier", async () => {
    User.findById.mockResolvedValue(mockUserDoc("cashier"));

    const res = await request(app)
      .post("/api/v1/admin/settings/reset")
      .set("Cookie", `token=${makeToken("cashier")}`);

    expect(res.status).toBe(404);
  });
});
