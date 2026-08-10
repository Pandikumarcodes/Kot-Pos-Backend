const { MENU_ITEMS, MENU_DISTRIBUTION, CUSTOMER_FIXTURE, DEMO_BRANCHES, buildDemoUsers, buildDemoTables } = require("../seed");

describe("Phase 3 deterministic demo fixtures", () => {
  test("has the requested menu count, categories, and seasonal subset", () => {
    expect(MENU_ITEMS).toHaveLength(80);
    for (const [category, count] of Object.entries(MENU_DISTRIBUTION)) expect(MENU_ITEMS.filter((item) => item.category === category)).toHaveLength(count);
    expect(MENU_ITEMS.filter((item) => item.available === false).length).toBe(4);
    expect(new Set(MENU_ITEMS.map((item) => item.ItemName)).size).toBe(80);
  });

  test("has deterministic global customer identities", () => {
    expect(CUSTOMER_FIXTURE).toHaveLength(120);
    expect(new Set(CUSTOMER_FIXTURE.map((customer) => customer.phone)).size).toBe(120);
    expect(CUSTOMER_FIXTURE.every((customer) => /^\d{10}$/.test(customer.phone))).toBe(true);
    expect(CUSTOMER_FIXTURE.some((customer) => customer.name === "Walk-in Guest")).toBe(false);
  });

  test("preserves foundation role topology and table isolation", () => {
    const branches = DEMO_BRANCHES.map((definition, index) => ({ _id: `branch-${index + 1}`, definition }));
    const users = buildDemoUsers(branches); const tables = buildDemoTables(branches);
    expect(users).toHaveLength(25); expect(users.filter((user) => user.role === "superadmin")).toHaveLength(1); expect(users.filter((user) => user.role === "admin")).toHaveLength(3);
    expect(users.filter((user) => user.role === "admin").every((user) => user.branchId)).toBe(true);
    expect(tables).toHaveLength(36); expect(new Set(tables.map((table) => `${table.branchId}:${table.tableNumber}`)).size).toBe(36);
  });
});
