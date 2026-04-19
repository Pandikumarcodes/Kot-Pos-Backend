const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/Branch");
jest.mock("../../models/settings");
jest.mock("../../models/kot");
jest.mock("../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const User = require("../../models/users");
const Branch = require("../../models/Branch");
const Settings = require("../../models/settings");
const Kot = require("../../models/kot");
const { adminBranchRouter } = require("../../routes/admin/adminBranchRouter");

const mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("io", mockIo);
app.use("/api/v1/admin", adminBranchRouter);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const VALID_BRANCH_ID = new mongoose.Types.ObjectId().toString();
const VALID_USER_ID = new mongoose.Types.ObjectId().toString();

// Super-admin: role=admin, branchId=null
function makeSuperAdminToken() {
  return jwt.sign(
    { _id: "admin_id", username: "superadmin", role: "admin", branchId: null },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function makeToken(role = "manager", branchId = VALID_BRANCH_ID) {
  return jwt.sign(
    { _id: "user_id_123", username: "testuser", role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function mockSuperAdminDoc() {
  return {
    _id: "admin_id",
    username: "superadmin",
    role: "admin",
    branchId: null,
  };
}

function mockBranchDoc(overrides = {}) {
  return {
    _id: VALID_BRANCH_ID,
    name: "Main Branch",
    address: "123 MG Road",
    phone: "9876543210",
    isActive: true,
    ...overrides,
  };
}

function mockUserDoc(overrides = {}) {
  return {
    _id: VALID_USER_ID,
    username: "staffuser",
    role: "waiter",
    branchId: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/branches
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/branches", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — super-admin can list all branches", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockBranchDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/admin/branches")
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.branches).toHaveLength(1);
  });

  it("403 — branch-admin cannot list branches", async () => {
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "admin",
      branchId: VALID_BRANCH_ID,
    });

    const res = await request(app)
      .get("/api/v1/admin/branches")
      .set("Cookie", `token=${makeToken("admin", VALID_BRANCH_ID)}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Super-admin access only");
  });

  it("403 — manager cannot list branches", async () => {
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "manager",
      branchId: VALID_BRANCH_ID,
    });

    const res = await request(app)
      .get("/api/v1/admin/branches")
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/branches");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/branches
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/branches", () => {
  beforeEach(() => jest.clearAllMocks());

  it("201 — super-admin can create a branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.create.mockResolvedValue(mockBranchDoc());
    Settings.create.mockResolvedValue({});

    const res = await request(app)
      .post("/api/v1/admin/branches")
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({
        name: "Main Branch",
        address: "123 MG Road",
        phone: "9876543210",
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Branch created");
    expect(Settings.create).toHaveBeenCalled();
  });

  it("400 — rejects missing branch name", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());

    const res = await request(app)
      .post("/api/v1/admin/branches")
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ address: "123 MG Road" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Branch name is required");
  });

  it("403 — manager cannot create a branch", async () => {
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "manager",
      branchId: VALID_BRANCH_ID,
    });

    const res = await request(app)
      .post("/api/v1/admin/branches")
      .set("Cookie", `token=${makeToken("manager")}`)
      .send({ name: "New Branch" });

    expect(res.status).toBe(403);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/admin/branches")
      .send({ name: "New Branch" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/v1/admin/branches/:id
// ─────────────────────────────────────────────────────────────
describe("PUT /api/v1/admin/branches/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — super-admin can update a branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.findByIdAndUpdate.mockResolvedValue(
      mockBranchDoc({ name: "Updated Branch" }),
    );

    const res = await request(app)
      .put(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ name: "Updated Branch" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Branch updated");
  });

  it("404 — returns 404 when branch not found", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ name: "Updated Branch" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Branch not found");
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app)
      .put(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .send({ name: "Updated Branch" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/admin/branches/:id
// ─────────────────────────────────────────────────────────────
describe("DELETE /api/v1/admin/branches/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — super-admin can deactivate a branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.findByIdAndUpdate.mockResolvedValue(
      mockBranchDoc({ isActive: false }),
    );

    const res = await request(app)
      .delete(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Branch deactivated");
  });

  it("404 — returns 404 when branch not found", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Branch not found");
  });

  it("403 — manager cannot deactivate a branch", async () => {
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "manager",
      branchId: VALID_BRANCH_ID,
    });

    const res = await request(app)
      .delete(`/api/v1/admin/branches/${VALID_BRANCH_ID}`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/branches/:id/assign-staff
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/branches/:id/assign-staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — assigns a user to a branch", async () => {
    User.findById
      .mockResolvedValueOnce(mockSuperAdminDoc()) // userAuth
      .mockResolvedValueOnce(mockUserDoc()); // User.findById(userId)
    Branch.findById.mockResolvedValue(mockBranchDoc());

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/assign-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("assigned to");
  });

  it("400 — rejects missing userId", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/assign-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("userId is required");
  });

  it("400 — rejects assigning super-admin to a branch", async () => {
    User.findById
      .mockResolvedValueOnce(mockSuperAdminDoc())
      .mockResolvedValueOnce(mockUserDoc({ role: "admin", branchId: null }));
    Branch.findById.mockResolvedValue(mockBranchDoc());

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/assign-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Cannot assign a super-admin to a branch");
  });

  it("404 — returns 404 when branch not found", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Branch.findById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/assign-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Branch not found");
  });

  it("404 — returns 404 when user not found", async () => {
    User.findById
      .mockResolvedValueOnce(mockSuperAdminDoc())
      .mockResolvedValueOnce(null);
    Branch.findById.mockResolvedValue(mockBranchDoc());

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/assign-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/admin/branches/:id/remove-staff
// ─────────────────────────────────────────────────────────────
describe("POST /api/v1/admin/branches/:id/remove-staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — removes a user from a branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    User.findOne.mockResolvedValue(mockUserDoc({ branchId: VALID_BRANCH_ID }));

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/remove-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("removed from branch");
  });

  it("400 — rejects missing userId", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/remove-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("userId is required");
  });

  it("404 — returns 404 when user not in branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/admin/branches/${VALID_BRANCH_ID}/remove-staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`)
      .send({ userId: VALID_USER_ID });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found in this branch");
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/branches/:id/staff
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/branches/:id/staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns staff for a branch", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockUserDoc()]),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/admin/branches/${VALID_BRANCH_ID}/staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });

  it("200 — returns empty array when no staff assigned", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      }),
    });

    const res = await request(app)
      .get(`/api/v1/admin/branches/${VALID_BRANCH_ID}/staff`)
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
  });

  it("401 — rejects unauthenticated request", async () => {
    const res = await request(app).get(
      `/api/v1/admin/branches/${VALID_BRANCH_ID}/staff`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/branches/unassigned-staff
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/branches/unassigned-staff", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns users with no branch assigned", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([mockUserDoc()]),
      }),
    });

    const res = await request(app)
      .get("/api/v1/admin/branches/unassigned-staff")
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/admin/branches/:id/summary
// ─────────────────────────────────────────────────────────────
describe("GET /api/v1/admin/branches/:id/summary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("200 — returns branch summary stats", async () => {
    User.findById.mockResolvedValue(mockSuperAdminDoc());
    Kot.countDocuments
      .mockResolvedValueOnce(10) // totalOrders
      .mockResolvedValueOnce(3); // activeOrders
    User.countDocuments.mockResolvedValue(5); // staffCount

    const res = await request(app)
      .get(`/api/v1/admin/branches/${VALID_BRANCH_ID}/summary`)
      .set("Cookie", `token=${makeSuperAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBe(10);
    expect(res.body.activeOrders).toBe(3);
    expect(res.body.staffCount).toBe(5);
  });

  it("403 — manager cannot view branch summary", async () => {
    User.findById.mockResolvedValue({
      _id: "user_id",
      role: "manager",
      branchId: VALID_BRANCH_ID,
    });

    const res = await request(app)
      .get(`/api/v1/admin/branches/${VALID_BRANCH_ID}/summary`)
      .set("Cookie", `token=${makeToken("manager")}`);

    expect(res.status).toBe(403);
  });
});
