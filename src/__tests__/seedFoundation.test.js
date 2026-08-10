const {
  DEMO_BRANCHES,
  buildDemoUsers,
  buildDemoTables,
  branchDocument,
} = require("../seed");

describe("Phase 2 demo seed foundation", () => {
  const branchIds = DEMO_BRANCHES.map((_, index) => `branch-${index + 1}`);
  const branches = DEMO_BRANCHES.map((definition, index) => ({
    _id: branchIds[index],
    definition,
  }));

  test("defines the three deterministic active branch targets", () => {
    expect(DEMO_BRANCHES.map((branch) => branch.name)).toEqual([
      "Indiranagar Flagship",
      "Whitefield Tech Park",
      "Jayanagar Family Dining",
    ]);
    expect(DEMO_BRANCHES.every((branch) => branch.tableCount > 0)).toBe(true);
  });

  test("creates exactly one branchless superadmin and no branchless admin", () => {
    const users = buildDemoUsers(branches);
    expect(users.filter((user) => user.role === "superadmin")).toHaveLength(1);
    expect(users.find((user) => user.role === "superadmin").branchId).toBeNull();
    expect(users.filter((user) => user.role === "admin" && user.branchId == null)).toHaveLength(0);
    expect(users.filter((user) => user.role === "admin")).toHaveLength(3);
  });

  test("matches the explicit branch staff topology and unique usernames", () => {
    const users = buildDemoUsers(branches);
    expect(users).toHaveLength(25);
    expect(new Set(users.map((user) => user.username)).size).toBe(users.length);
    expect(users.filter((user) => ["manager", "waiter", "chef", "cashier"].includes(user.role)).every((user) => branchIds.includes(user.branchId))).toBe(true);
    expect(users.filter((user) => user.branchId === branchIds[0] && user.role === "waiter")).toHaveLength(3);
    expect(users.filter((user) => user.branchId === branchIds[1] && user.role === "cashier")).toHaveLength(1);
    expect(users.filter((user) => user.branchId === branchIds[2] && user.role === "waiter")).toHaveLength(2);
  });

  test("matches every deterministic role count", () => {
    const users = buildDemoUsers(branches);
    expect(users).toHaveLength(25);
    expect(users.filter((user) => user.role === "superadmin")).toHaveLength(1);
    expect(users.filter((user) => user.role === "admin")).toHaveLength(3);
    expect(users.filter((user) => user.role === "manager")).toHaveLength(3);
    expect(users.filter((user) => user.role === "waiter")).toHaveLength(8);
    expect(users.filter((user) => user.role === "chef")).toHaveLength(6);
    expect(users.filter((user) => user.role === "cashier")).toHaveLength(4);
  });

  test("uses schema-supported branch metadata and canonical admin usernames", () => {
    const allowed = new Set(["name", "address", "phone", "email", "gstin", "isActive", "adminUser"]);
    for (const definition of DEMO_BRANCHES) {
      expect(Object.keys(branchDocument(definition)).every((key) => allowed.has(key))).toBe(true);
      expect(branchDocument(definition)).toMatchObject({ isActive: false, adminUser: null });
    }
    expect(DEMO_BRANCHES.map((branch) => branch.username)).toEqual([
      "admin.indiranagar", "admin.whitefield", "admin.jayanagar",
    ]);
  });

  test("creates 36 branch-owned tables with per-branch unique numbers", () => {
    const tables = buildDemoTables(branches);
    expect(tables).toHaveLength(36);
    const keys = tables.map((table) => `${table.branchId}:${table.tableNumber}`);
    expect(new Set(keys).size).toBe(36);
    expect(tables.every((table) => table.branchId && ["available", "reserved"].includes(table.status))).toBe(true);
  });
});
