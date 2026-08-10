jest.mock("../../models/Branch", () => ({ findById: jest.fn() }));

const Branch = require("../../models/Branch");

const mockActiveBranch = (branchId, isActive = true) => {
  Branch.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: branchId,
        isActive,
      }),
    }),
  });
};

module.exports = { Branch, mockActiveBranch };
