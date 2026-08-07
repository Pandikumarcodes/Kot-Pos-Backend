const mongoose = require("mongoose");
const {
  accessScope,
  requireBranchScope,
} = require("../middlewares/accessScope");

const branchA = new mongoose.Types.ObjectId().toString().toUpperCase();
const branchB = new mongoose.Types.ObjectId().toString();

const run = async ({ role, branchId, queryBranchId }) => {
  const req = {
    user: { role, branchId },
    query: queryBranchId === undefined ? {} : { branchId: queryBranchId },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  await accessScope({ allowSelectedBranch: true })(req, res, next);
  return { req, res, next };
};

describe("access scope resolver", () => {
  test("admin without branchId becomes global", async () => {
    const { req, next } = await run({ role: "admin", branchId: null });
    expect(next).toHaveBeenCalled();
    expect(req.accessScope).toEqual({ type: "global", isGlobal: true, branchId: null });
  });

  test("admin with branchId becomes branch scoped and is normalized", async () => {
    const { req } = await run({ role: "admin", branchId: branchA });
    expect(req.accessScope).toEqual({
      type: "branch",
      isGlobal: false,
      branchId: branchA.toLowerCase(),
    });
  });

  test.each(["manager", "cashier", "waiter", "chef"])(
    "%s without branchId is rejected",
    async (role) => {
      const { res, next } = await run({ role, branchId: null });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    },
  );

  test("malformed assigned branchId returns 400", async () => {
    const { res, next } = await run({ role: "manager", branchId: "bad" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test("branch users cannot override assigned branch", async () => {
    const { res, next } = await run({
      role: "cashier",
      branchId: branchA,
      queryBranchId: branchB,
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("global admin may select a branch when the route opts in", async () => {
    const { req, next } = await run({
      role: "admin",
      branchId: null,
      queryBranchId: branchA,
    });
    expect(next).toHaveBeenCalled();
    expect(req.accessScope).toEqual({
      type: "branch",
      isGlobal: false,
      branchId: branchA.toLowerCase(),
    });
  });

  test("global scope cannot pass the branch guard", () => {
    const req = { accessScope: { type: "global", isGlobal: true, branchId: null } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireBranchScope(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
