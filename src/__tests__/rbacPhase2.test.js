const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
jest.mock("../models/Branch", () => ({ findById: jest.fn() }));
const User = require("../models/users");
const Branch = require("../models/Branch");
const branchScope = require("../middlewares/branchScope");
const { requireSuperAdmin, isSuperAdminUser } = branchScope;
const { allowRoles } = require("../middlewares/auth");

const branchId = new mongoose.Types.ObjectId();
process.env.JWT_SECRET = process.env.JWT_SECRET || "rbac_phase_2_secret";

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const mockBranchActive = (isActive = true) => {
  Branch.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: branchId, isActive }),
    }),
  });
};

describe("RBAC Phase 2 role model", () => {
  it.each(["superadmin", "admin", "manager", "waiter", "chef", "cashier"])(
    "accepts the %s role in the User schema",
    async (role) => {
      const user = new User({
        username: `${role}-user`, password: "StrongPassword@123", role,
        branchId: role === "superadmin" ? null : branchId,
      });
      await expect(user.validate()).resolves.toBeUndefined();
    },
  );

  it("accepts a branchless superadmin", async () => {
    const user = new User({
      username: "valid-global", password: "StrongPassword@123",
      role: "superadmin", branchId: null,
    });
    await expect(user.validate()).resolves.toBeUndefined();
  });

  it("rejects a branch-assigned superadmin", async () => {
    const user = new User({
      username: "invalid-global", password: "StrongPassword@123",
      role: "superadmin", branchId,
    });
    await expect(user.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("issues the unchanged access-token structure with role=superadmin", async () => {
    const user = new User({
      username: "token-global", password: "StrongPassword@123",
      role: "superadmin", branchId: null,
    });
    const payload = jwt.verify(await user.getJWT(), process.env.JWT_SECRET);
    expect(payload).toMatchObject({
      _id: user._id.toString(), username: "token-global",
      role: "superadmin", branchId: null, tokenType: "access",
    });
  });
});

describe("explicit superadmin branch scope", () => {
  beforeEach(() => jest.clearAllMocks());

  it("recognizes only a branchless explicit superadmin", () => {
    expect(isSuperAdminUser({ role: "superadmin", branchId: null })).toBe(true);
    expect(isSuperAdminUser({ role: "admin", branchId: null })).toBe(false);
    expect(isSuperAdminUser({ role: "superadmin", branchId })).toBe(false);
  });

  it("lets superadmin select a branch context explicitly", async () => {
    const req = { user: { role: "superadmin", branchId: null }, query: { branchId: branchId.toString() } };
    const res = response();
    const next = jest.fn();
    await branchScope(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.isSuperAdmin).toBe(true);
    expect(req.branchId).toBe(branchId.toString());
    expect(Branch.findById).not.toHaveBeenCalled();
  });

  it("rejects a branch-assigned superadmin", async () => {
    const req = { user: { role: "superadmin", branchId }, query: {} };
    const res = response();
    await branchScope(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Super-admin cannot be assigned to a branch" });
  });

  it("does not recognize branchless admin as superadmin", async () => {
    const req = { user: { role: "admin", branchId: null }, query: { branchId: branchId.toString() } };
    const res = response();
    await branchScope(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it.each(["admin", "manager", "waiter", "chef", "cashier"])(
    "keeps persisted branch authority for %s and ignores query override",
    async (role) => {
      mockBranchActive(true);
      const otherBranch = new mongoose.Types.ObjectId().toString();
      const req = { user: { role, branchId }, query: { branchId: otherBranch } };
      const next = jest.fn();
      await branchScope(req, response(), next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.branchId).toBe(branchId.toString());
      expect(req.isSuperAdmin).toBe(false);
      expect(Branch.findById).toHaveBeenCalledWith(branchId);
    },
  );

  it.each(["admin", "manager", "waiter", "chef", "cashier"])(
    "rejects inactive branch %s users",
    async (role) => {
      mockBranchActive(false);
      const res = response();
      const next = jest.fn();

      await branchScope({ user: { role, branchId }, query: {} }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Branch is inactive" });
    },
  );
});

describe("authorization separation", () => {
  it("requireSuperAdmin allows superadmin and rejects legacy branchless admin", () => {
    const next = jest.fn();
    requireSuperAdmin({ user: { role: "superadmin", branchId: null } }, response(), next);
    expect(next).toHaveBeenCalledTimes(1);

    const res = response();
    requireSuperAdmin({ user: { role: "admin", branchId: null } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each(["waiter", "chef", "cashier", "admin"])(
    "does not admit superadmin through the %s operational allow-list",
    (operationalRole) => {
      const res = response();
      allowRoles([operationalRole])(
        { user: { role: "superadmin", branchId: null } }, res, jest.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );
});
