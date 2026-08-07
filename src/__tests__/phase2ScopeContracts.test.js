const { assertBranchScope, assertScope } = require("../utils/accessScope");
const { cacheKeys } = require("../infrastructure/cache");
const { serializeScope, requireJobScope } = require("../infrastructure/queue/jobScope");

describe("Phase 2 explicit scope contracts", () => {
  const branchScope = { type: "branch", isGlobal: false, branchId: "branch-a" };

  test("rejects missing, empty, and global operational scope", () => {
    expect(() => assertBranchScope()).toThrow();
    expect(() => assertBranchScope({})).toThrow();
    expect(() => assertBranchScope({ type: "global", isGlobal: true, branchId: null })).toThrow();
  });

  test("accepts only explicit global shape", () => {
    expect(assertScope({ type: "global", isGlobal: true, branchId: null })).toEqual({
      type: "global", isGlobal: true, branchId: null,
    });
    expect(() => assertScope({ type: "global", branchId: null })).toThrow();
  });

  test("AI keys separate global and branch scopes", () => {
    const globalKey = cacheKeys.aiDailySummary({
      scope: { type: "global", isGlobal: true, branchId: null }, date: "today",
    });
    const branchKey = cacheKeys.aiDailySummary({ scope: branchScope, date: "today" });
    expect(globalKey).not.toBe(branchKey);
    expect(cacheKeys.aiDailySummary({ date: "today" })).toContain("invalid-scope");
  });

  test("job scopes are serializable and malformed payloads fail", () => {
    expect(serializeScope({ type: "branch", isGlobal: false, branchId: { toString: () => "branch-a" } })).toEqual(branchScope);
    expect(requireJobScope({ scope: { type: "global", isGlobal: true, branchId: null } })).toEqual({
      type: "global", isGlobal: true, branchId: null,
    });
    expect(() => requireJobScope({})).toThrow();
    expect(() => requireJobScope({ scope: { type: "global", isGlobal: true, branchId: null } }, { allowGlobal: false })).toThrow();
  });
});
