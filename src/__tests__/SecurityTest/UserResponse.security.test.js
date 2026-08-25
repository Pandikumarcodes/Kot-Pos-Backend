const request = require("supertest");
const express = require("express");

jest.mock("../../services/userService", () => ({
  listUsers: jest.fn(),
}));
jest.mock("../../services/branchService", () => ({
  assignStaff: jest.fn(),
  assignBranchAdmin: jest.fn(),
  createBranchAdmin: jest.fn(),
  removeStaff: jest.fn(),
  listBranchStaff: jest.fn(),
  listUnassignedStaff: jest.fn(),
}));
jest.mock("../../middlewares/auth", () => ({
  userAuth: (req, _res, next) => {
    req.user = { _id: "actor-id", role: "superadmin" };
    next();
  },
  allowRoles: () => (_req, _res, next) => next(),
}));
jest.mock("../../middlewares/branchScope", () => {
  const pass = (_req, _res, next) => next();
  const branchScope = (req, _res, next) => {
    req.branchFilter = {};
    next();
  };
  branchScope.requireBranch = pass;
  branchScope.requireSuperAdmin = pass;
  return branchScope;
});
jest.mock("../../validators/users", () => ({
  validateCreateUser: (_req, _res, next) => next(),
  validateRoleUpdate: (_req, _res, next) => next(),
  validateUserId: (_req, _res, next) => next(),
}));
jest.mock("../../validators/branches", () => ({
  validateBranchCreate: (_req, _res, next) => next(),
  validateBranchAdminAssignment: (_req, _res, next) => next(),
  validateBranchAdminCreate: (_req, _res, next) => next(),
  validateBranchId: (_req, _res, next) => next(),
  validateBranchStaff: (_req, _res, next) => next(),
  validateBranchUpdate: (_req, _res, next) => next(),
}));

const userService = require("../../services/userService");
const branchService = require("../../services/branchService");
const { adminUserRouter } = require("../../routes/admin/adminUser");
const { adminBranchRouter } = require("../../routes/admin/adminBranchRouter");
const {
  USER_RESPONSE_FIELDS,
  toUserResponse,
} = require("../../utils/userResponse");

const app = express();
app.use(express.json());
app.use("/api/v1/admin", adminUserRouter);
app.use("/api/v1/admin", adminBranchRouter);

const branchId = "507f1f77bcf86cd799439011";
const userId = "507f1f77bcf86cd799439012";
const internalFields = [
  "password",
  "refreshTokenHash",
  "__v",
  "createdAt",
  "updatedAt",
  "internalSecret",
  "accessToken",
  "refreshToken",
];

const rawUser = (overrides = {}) => ({
  _id: userId,
  username: "staff@example.com",
  role: "waiter",
  status: "active",
  branchId,
  password: "$2b$12$must-not-leak",
  refreshTokenHash: "must-not-leak",
  __v: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  internalSecret: "must-not-leak",
  accessToken: "must-not-leak",
  refreshToken: "must-not-leak",
  ...overrides,
});

const expectSafeUser = (user, expected = {}) => {
  expect(user).toMatchObject({
    id: userId,
    username: "staff@example.com",
    role: "waiter",
    status: "active",
    branchId,
    ...expected,
  });
  expect(Object.keys(user).sort()).toEqual([...USER_RESPONSE_FIELDS].sort());
  internalFields.forEach((field) => expect(user[field]).toBeUndefined());
};

beforeEach(() => {
  jest.clearAllMocks();
  userService.listUsers.mockResolvedValue({ items: [rawUser()] });
  branchService.assignStaff.mockResolvedValue({
    branch: { _id: branchId, name: "Main Branch" },
    user: rawUser(),
  });
  branchService.assignBranchAdmin.mockResolvedValue({
    branch: { _id: branchId, name: "Main Branch" },
    user: rawUser({ role: "admin" }),
    previousAdmin: rawUser({ _id: "507f1f77bcf86cd799439013", role: "manager" }),
    replaced: true,
  });
  branchService.createBranchAdmin.mockResolvedValue({
    branch: { _id: branchId, name: "Main Branch" },
    user: rawUser({ role: "admin" }),
    previousAdmin: null,
    replaced: false,
  });
  branchService.removeStaff.mockResolvedValue(rawUser({ branchId: null }));
  branchService.listBranchStaff.mockResolvedValue([rawUser()]);
  branchService.listUnassignedStaff.mockResolvedValue([
    rawUser({ branchId: null }),
  ]);
});

describe("central User response DTO", () => {
  it("allowlists fields for lean objects without mutating the input", () => {
    const source = rawUser();
    const before = { ...source };
    expectSafeUser(toUserResponse(source));
    expect(source).toEqual(before);
  });

  it("supports document-like values and drops future fields", () => {
    const source = rawUser();
    const document = { get: (field) => source[field] };
    expectSafeUser(toUserResponse(document));
  });
});

describe("privileged User response endpoints", () => {
  it.each(["", "?fields=id,username,role,status,branchId"])(
    "GET /api/v1/admin/users%s returns only approved fields",
    async (query) => {
      const res = await request(app).get(`/api/v1/admin/users${query}`);
      expect(res.status).toBe(200);
      expectSafeUser(res.body.users[0]);
    },
  );

  it("assign-staff serializes user", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/branches/${branchId}/assign-staff`)
      .send({ userId });
    expect(res.status).toBe(200);
    expectSafeUser(res.body.user);
  });

  it("assign-admin serializes user and previousAdmin", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/branches/${branchId}/assign-admin`)
      .send({ userId });
    expect(res.status).toBe(200);
    expectSafeUser(res.body.user, { role: "admin" });
    expectSafeUser(res.body.previousAdmin, {
      id: "507f1f77bcf86cd799439013",
      role: "manager",
    });
  });

  it("create branch admin never serializes its in-memory password hash", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/branches/${branchId}/admin`)
      .send({ username: "new.admin@example.com", password: "Strong@123" });
    expect(res.status).toBe(201);
    expectSafeUser(res.body.user, { role: "admin" });
    expect(res.body.previousAdmin).toBeNull();
  });

  it("remove-staff serializes user", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/branches/${branchId}/remove-staff`)
      .send({ userId });
    expect(res.status).toBe(200);
    expectSafeUser(res.body.user, { branchId: null });
  });

  it("branch staff list serializes every user", async () => {
    const res = await request(app).get(
      `/api/v1/admin/branches/${branchId}/staff`,
    );
    expect(res.status).toBe(200);
    res.body.users.forEach((user) => expectSafeUser(user));
  });

  it("unassigned staff list serializes every user", async () => {
    const res = await request(app).get(
      "/api/v1/admin/branches/unassigned-staff",
    );
    expect(res.status).toBe(200);
    res.body.users.forEach((user) => expectSafeUser(user, { branchId: null }));
  });
});
