const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../models/users");
jest.mock("../models/settings");
jest.mock("../infrastructure/cache", () => ({
  cache: {
    getOrSet: jest.fn((_key, factory) => factory()),
    del: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(undefined),
  },
  cacheKeys: {
    settings: jest.fn(({ branchId }) => `settings:${branchId || "global"}`),
  },
}));
jest.mock("../modules/administration/AdministrationAuditLogger", () => ({
  createContext: jest.fn((values = {}) => values),
  settingsChanged: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../models/users");
const { mockActiveBranch } = require("./helpers/mockBranch");
const Settings = require("../models/settings");
const { RECEIPT_SETTINGS_FIELDS } = require("../services/settingsService");
const { settingsRouter } = require("../routes/settingsRouter");
const {
  adminSettingsRouter,
} = require("../routes/admin/adminSettingsRouter");

const BRANCH_A = new mongoose.Types.ObjectId().toString();
const BRANCH_B = new mongoose.Types.ObjectId().toString();

beforeEach(() => mockActiveBranch(BRANCH_A));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/settings", settingsRouter);
app.use("/api/v1/admin", adminSettingsRouter);

const token = (role) =>
  jwt.sign(
    { _id: "settings-reader", role, tokenType: "access" },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

const user = (role, branchId) => ({
  _id: "settings-reader",
  role,
  branchId,
  status: "active",
});

const settingsDocument = (businessName = "Branch A") => ({
  _id: new mongoose.Types.ObjectId().toString(),
  branchId: BRANCH_A,
  businessName,
  email: "billing@example.test",
  phone: "9876543210",
  address: "123 Test Road",
  gstin: "29ABCDE1234F1Z5",
  fssai: "12345678901234",
  hsn: "996331",
  currency: "INR",
  taxRate: 5,
  serviceCharge: 2,
  autoRoundOff: true,
  printReceipt: true,
  paymentMethods: { cash: true, card: true, upi: true },
  orderAlerts: true,
  createdAt: new Date().toISOString(),
});

describe("GET /api/v1/settings receipt contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveBranch(BRANCH_A);
  });

  it("lets a cashier read only the receipt projection for their branch", async () => {
    User.findById.mockResolvedValue(user("cashier", BRANCH_A));
    Settings.findOne.mockResolvedValue(settingsDocument());

    const response = await request(app)
      .get("/api/v1/settings")
      .set("Cookie", `token=${token("cashier")}`);

    expect(response.status).toBe(200);
    expect(Settings.findOne).toHaveBeenCalledWith({ branchId: BRANCH_A });
    expect(Object.keys(response.body.settings).sort()).toEqual(
      [...RECEIPT_SETTINGS_FIELDS].sort(),
    );
    expect(response.body.settings).not.toHaveProperty("_id");
    expect(response.body.settings).not.toHaveProperty("branchId");
    expect(response.body.settings).not.toHaveProperty("paymentMethods");
    expect(response.body.settings).not.toHaveProperty("orderAlerts");
  });

  it("ignores a cashier branchId override and keeps user.branchId authoritative", async () => {
    User.findById.mockResolvedValue(user("cashier", BRANCH_A));
    Settings.findOne.mockResolvedValue(settingsDocument());

    const response = await request(app)
      .get(`/api/v1/settings?branchId=${BRANCH_B}`)
      .set("Cookie", `token=${token("cashier")}`);

    expect(response.status).toBe(200);
    expect(Settings.findOne).toHaveBeenCalledWith({ branchId: BRANCH_A });
  });

  it("uses the manager's own branch", async () => {
    User.findById.mockResolvedValue(user("manager", BRANCH_A));
    Settings.findOne.mockResolvedValue(settingsDocument());

    const response = await request(app)
      .get(`/api/v1/settings?branchId=${BRANCH_B}`)
      .set("Cookie", `token=${token("manager")}`);

    expect(response.status).toBe(200);
    expect(Settings.findOne).toHaveBeenCalledWith({ branchId: BRANCH_A });
  });

  it("does not grant superadmin branch settings access implicitly", async () => {
    User.findById.mockResolvedValue(user("superadmin", null));
    Settings.findOne.mockResolvedValue(settingsDocument("Branch B"));

    const response = await request(app)
      .get(`/api/v1/settings?branchId=${BRANCH_B}`)
      .set("Cookie", `token=${token("superadmin")}`);

    expect(response.status).toBe(403);
    expect(Settings.findOne).not.toHaveBeenCalled();
  });
});

describe("Cashier remains excluded from settings management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(user("cashier", BRANCH_A));
  });

  it("cannot read the Admin Settings management contract", async () => {
    const response = await request(app)
      .get("/api/v1/admin/settings")
      .set("Cookie", `token=${token("cashier")}`);

    expect(response.status).toBe(403);
  });

  it("cannot update Admin Settings", async () => {
    const response = await request(app)
      .put("/api/v1/admin/settings")
      .set("Cookie", `token=${token("cashier")}`)
      .send({ taxRate: 0 });

    expect(response.status).toBe(403);
    expect(Settings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("cannot reach a settings reset operation", async () => {
    const response = await request(app)
      .delete("/api/v1/admin/settings/reset")
      .set("Cookie", `token=${token("cashier")}`);

    expect(response.status).toBe(403);
    expect(Settings.deleteOne).not.toHaveBeenCalled();
  });
});
