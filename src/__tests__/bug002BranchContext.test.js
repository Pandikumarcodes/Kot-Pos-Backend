const { allowGlobalOrSelectedBranch, requireBranchScope } = require("../middlewares/accessScope");

const runScope = (queryBranchId) => {
  const req = { user: { role: "admin", branchId: null }, query: { branchId: queryBranchId } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  allowGlobalOrSelectedBranch(req, res, next);
  return { req, res, next };
};

describe("BUG-002 selected global-admin branch context", () => {
  test("resolves a valid selected branch before the branch guard", () => {
    const { req, next, res } = runScope("507f1f77bcf86cd799439011");
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.accessScope).toEqual({
      type: "branch",
      isGlobal: false,
      branchId: "507f1f77bcf86cd799439011",
    });
    const guardNext = jest.fn();
    requireBranchScope(req, res, guardNext);
    expect(guardNext).toHaveBeenCalled();
  });

  test.each([undefined, "", "not-an-object-id"])("rejects missing or malformed branchId: %p", (branchId) => {
    const { req, res, next } = runScope(branchId);
    if (branchId === undefined) {
      expect(next).toHaveBeenCalled();
      requireBranchScope(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    } else {
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(branchId === "" ? 400 : 400);
    }
  });

  test("assigned users cannot switch branches", () => {
    const req = {
      user: { role: "manager", branchId: "507f1f77bcf86cd799439011" },
      query: { branchId: "507f1f77bcf86cd799439012" },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    allowGlobalOrSelectedBranch(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("selected global-admin scope is accepted by shared branch resolver", () => {
    const req = {
      user: { role: "admin", branchId: null },
      query: { branchId: "507f1f77bcf86cd799439011" },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    allowGlobalOrSelectedBranch(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.query.branchId).toBe("507f1f77bcf86cd799439011");
    expect(req.accessScope.branchId).toBe("507f1f77bcf86cd799439011");
  });
});
