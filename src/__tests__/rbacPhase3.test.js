const mongoose = require("mongoose");

jest.mock("../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({
    execute: jest.fn((work) => work({ id: "phase-3-session" })),
  })),
);
jest.mock("../modules/administration/AdministrationAuditLogger", () => ({
  createContext: jest.fn((values = {}) => ({ correlationId: "phase-3", ...values })),
  branchCreated: jest.fn().mockResolvedValue(undefined),
  branchUpdated: jest.fn().mockResolvedValue(undefined),
  branchAdminAssigned: jest.fn().mockResolvedValue(undefined),
  branchAdminReplaced: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../repositories/BranchRepository", () => ({
  findById: jest.fn(),
  findByAdminUser: jest.fn(),
  createBranch: jest.fn(),
  updateBranch: jest.fn(),
  save: jest.fn((doc) => Promise.resolve(doc)),
}));
jest.mock("../repositories/UserRepository", () => ({
  findById: jest.fn(),
  findByUsername: jest.fn(),
  findBranchAdmin: jest.fn(),
  createUserDocument: jest.fn(),
  clearRefreshToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../repositories/StaffRepository", () => ({
  save: jest.fn((doc) => Promise.resolve(doc)),
}));
jest.mock("../repositories/SettingsRepository", () => ({
  createSettings: jest.fn().mockResolvedValue({}),
}));
jest.mock("../repositories/KitchenRepository", () => ({}));

const Branch = require("../models/Branch");
const User = require("../models/users");
const branchRepository = require("../repositories/BranchRepository");
const userRepository = require("../repositories/UserRepository");
const staffRepository = require("../repositories/StaffRepository");
const audit = require("../modules/administration/AdministrationAuditLogger");
const branchService = require("../services/branchService");
const settingsRepository = require("../repositories/SettingsRepository");
const userService = require("../services/userService");
const {
  BRANCH_ADMIN_POINTER_INDEX_OPTIONS,
  BRANCH_ADMIN_USER_INDEX_OPTIONS,
  ensureIndexes,
  ensureRequiredBranchAdminIndexes,
} = require("../models/indexes");

const objectId = () => new mongoose.Types.ObjectId();
const doc = (values) => ({
  save: jest.fn().mockResolvedValue(undefined),
  ...values,
});

describe("RBAC Phase 3 required indexes", () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "aggregate").mockResolvedValue([]);
    jest.spyOn(Branch, "aggregate").mockResolvedValue([]);
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.restoreAllMocks();
  });

  it("creates unique partial indexes for one admin per branch and one branch per adminUser", async () => {
    const userCollection = {
      indexes: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ key: { branchId: 1, role: 1 }, unique: true,
          partialFilterExpression: BRANCH_ADMIN_USER_INDEX_OPTIONS.partialFilterExpression }]),
      createIndex: jest.fn().mockResolvedValue("user-index"),
    };
    const branchCollection = {
      indexes: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ key: { adminUser: 1 }, unique: true,
          partialFilterExpression: BRANCH_ADMIN_POINTER_INDEX_OPTIONS.partialFilterExpression }]),
      createIndex: jest.fn().mockResolvedValue("branch-index"),
    };

    await expect(ensureRequiredBranchAdminIndexes({
      userCollection,
      branchCollection,
    })).resolves.toBeUndefined();

    expect(userCollection.createIndex).toHaveBeenCalledWith(
      { branchId: 1, role: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { role: "admin", branchId: { $type: "objectId" } },
      }),
    );
    expect(branchCollection.createIndex).toHaveBeenCalledWith(
      { adminUser: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { adminUser: { $type: "objectId" } },
      }),
    );
  });

  it("fails before index creation when existing data has duplicate branch admins", async () => {
    User.aggregate.mockResolvedValueOnce([
      { _id: objectId(), count: 2, users: [objectId(), objectId()] },
    ]);

    await expect(ensureRequiredBranchAdminIndexes({
      userCollection: { indexes: jest.fn(), createIndex: jest.fn() },
      branchCollection: { indexes: jest.fn(), createIndex: jest.fn() },
    })).rejects.toThrow("Duplicate branch admins exist");
  });

  it("fails before index creation when one adminUser points to multiple branches", async () => {
    Branch.aggregate.mockResolvedValueOnce([
      { _id: objectId(), count: 2, branches: [objectId(), objectId()] },
    ]);

    await expect(ensureRequiredBranchAdminIndexes({
      userCollection: { indexes: jest.fn(), createIndex: jest.fn() },
      branchCollection: { indexes: jest.fn(), createIndex: jest.fn() },
    })).rejects.toThrow("assigned to multiple branches");
  });

  it("treats required Branch Admin index initialization failures as fatal", async () => {
    await expect(ensureIndexes({
      tableCollection: {
        indexes: jest.fn().mockResolvedValue([
          { key: { branchId: 1, tableNumber: 1 }, unique: true },
        ]),
        createIndex: jest.fn(),
        dropIndex: jest.fn(),
      },
      requiredBranchAdminInitializer: jest
        .fn()
        .mockRejectedValue(new Error("branch admin duplicates")),
      optionalInitializer: jest.fn(),
    })).rejects.toMatchObject({
      message: "branch admin duplicates",
      code: "REQUIRED_BRANCH_ADMIN_INDEX_INITIALIZATION_FAILED",
    });
  });
});

describe("RBAC Phase 3 Branch Admin lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("assigns the first eligible Branch Admin atomically", async () => {
    const branchId = objectId();
    const userId = objectId();
    const branch = doc({ _id: branchId, name: "Main", adminUser: null, isActive: true });
    const candidate = doc({ _id: userId, username: "admin", role: "manager",
      status: "active", branchId: null });
    branchRepository.findById.mockResolvedValue(branch);
    userRepository.findBranchAdmin.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(candidate);

    const result = await branchService.assignBranchAdmin({ branchId, userId });

    expect(result.replaced).toBe(false);
    expect(candidate.role).toBe("admin");
    expect(String(candidate.branchId)).toBe(String(branchId));
    expect(String(branch.adminUser)).toBe(String(userId));
    expect(staffRepository.save).toHaveBeenCalledWith(candidate,
      expect.objectContaining({ session: { id: "phase-3-session" } }));
    expect(audit.branchAdminAssigned).toHaveBeenCalled();
  });

  it("replaces Branch Admin and demotes the previous admin to manager in the same branch", async () => {
    const branchId = objectId();
    const oldId = objectId();
    const newId = objectId();
    const branch = doc({ _id: branchId, name: "Main", adminUser: oldId });
    const oldAdmin = doc({ _id: oldId, username: "old", role: "admin",
      status: "active", branchId });
    const candidate = doc({ _id: newId, username: "new", role: "cashier",
      status: "active", branchId });
    branchRepository.findById.mockResolvedValue(branch);
    userRepository.findById
      .mockResolvedValueOnce(oldAdmin)
      .mockResolvedValueOnce(candidate);
    userRepository.findBranchAdmin.mockResolvedValue(oldAdmin);

    const result = await branchService.assignBranchAdmin({ branchId, userId: newId });

    expect(result.replaced).toBe(true);
    expect(oldAdmin.role).toBe("manager");
    expect(candidate.role).toBe("admin");
    expect(String(branch.adminUser)).toBe(String(newId));
    expect(userRepository.clearRefreshToken).toHaveBeenCalledWith(oldId,
      expect.objectContaining({ session: { id: "phase-3-session" } }));
    expect(audit.branchAdminReplaced).toHaveBeenCalled();
  });

  it("rejects ineligible Branch Admin candidates", async () => {
    const branchId = objectId();
    branchRepository.findById.mockResolvedValue(doc({ _id: branchId, adminUser: null }));
    userRepository.findBranchAdmin.mockResolvedValue(null);
    userRepository.findById.mockResolvedValue(doc({ _id: objectId(), role: "superadmin",
      status: "active", branchId: null }));

    await expect(branchService.assignBranchAdmin({
      branchId,
      userId: objectId(),
    })).rejects.toThrow("Superadmin cannot be assigned as Branch Admin");
    expect(staffRepository.save).not.toHaveBeenCalled();
  });

  it("creates a new Branch Admin with server-controlled role and branch", async () => {
    const branchId = objectId();
    const branch = doc({ _id: branchId, name: "Main", adminUser: null });
    const created = doc({ _id: objectId(), username: "new-admin", role: "admin",
      status: "active", branchId });
    branchRepository.findById.mockResolvedValue(branch);
    userRepository.findBranchAdmin.mockResolvedValue(null);
    userRepository.findByUsername.mockResolvedValue(null);
    userRepository.createUserDocument.mockResolvedValue(created);

    const result = await branchService.createBranchAdmin({
      branchId,
      username: "new-admin",
      password: "StrongPassword@123",
      status: "active",
    });

    expect(result.user).toBe(created);
    expect(userRepository.createUserDocument).toHaveBeenCalledWith(
      expect.objectContaining({ role: "admin", branchId }),
      expect.objectContaining({ session: { id: "phase-3-session" } }),
    );
    expect(String(branch.adminUser)).toBe(String(created._id));
  });

  it("creates branches inactive until a Branch Admin is assigned", async () => {
    const branch = doc({ _id: objectId(), name: "New", isActive: false, adminUser: null });
    branchRepository.createBranch.mockResolvedValue(branch);

    const result = await branchService.createBranch({ name: "New" });

    expect(result).toBe(branch);
    expect(branchRepository.createBranch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New", isActive: false }),
    );
    expect(settingsRepository.createSettings).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: branch._id, businessName: "New" }),
    );
  });

  it("refuses to activate a branch without a canonical Branch Admin", async () => {
    branchRepository.findById.mockResolvedValue(doc({
      _id: objectId(),
      name: "No Admin",
      isActive: false,
      adminUser: null,
    }));

    await expect(branchService.updateBranch(objectId(), {
      name: "No Admin",
      isActive: true,
    })).rejects.toThrow("Branch Admin must be assigned before activating branch");
    expect(branchRepository.updateBranch).not.toHaveBeenCalled();
  });

  it("reactivates a branch when the canonical Branch Admin invariant is valid", async () => {
    const branchId = objectId();
    const adminId = objectId();
    const branch = doc({
      _id: branchId,
      name: "Inactive",
      isActive: false,
      adminUser: adminId,
    });
    const admin = doc({
      _id: adminId,
      role: "admin",
      status: "active",
      branchId,
    });
    const updated = doc({ ...branch, isActive: true });
    branchRepository.findById.mockResolvedValue(branch);
    userRepository.findById.mockResolvedValue(admin);
    userRepository.findBranchAdmin.mockResolvedValue(admin);
    branchRepository.updateBranch.mockResolvedValue(updated);

    const result = await branchService.updateBranch(branchId, {
      name: "Inactive",
      isActive: true,
    });

    expect(result).toBe(updated);
    expect(branchRepository.updateBranch).toHaveBeenCalledWith(
      branchId,
      expect.objectContaining({ isActive: true }),
    );
  });

  it("refuses to reactivate when adminUser is not a branch admin for that branch", async () => {
    const branchId = objectId();
    const adminId = objectId();
    branchRepository.findById.mockResolvedValue(doc({
      _id: branchId,
      name: "Invalid",
      isActive: false,
      adminUser: adminId,
    }));
    userRepository.findById.mockResolvedValue(doc({
      _id: adminId,
      role: "manager",
      status: "active",
      branchId,
    }));

    await expect(branchService.updateBranch(branchId, {
      name: "Invalid",
      isActive: true,
    })).rejects.toThrow("Branch Admin relationship is invalid");
    expect(branchRepository.updateBranch).not.toHaveBeenCalled();
  });
});

describe("RBAC Phase 3 generic staff protections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generic staff creation cannot create admin", async () => {
    await expect(userService.createUser({
      username: "branch-admin",
      password: "StrongPassword@123",
      role: "admin",
    }, objectId())).rejects.toThrow("Admin cannot be created through the staff API");
  });

  it("generic staff role changes cannot promote to admin", async () => {
    await expect(userService.updateUserRole({
      userId: objectId(),
      role: "admin",
      actorRole: "admin",
      scopeToBranch: (filter) => filter,
    })).rejects.toThrow("Admin cannot be assigned through the staff API");
  });
});
