const {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  QueryBuilder,
  QueryValidationError,
  buildFilters,
  buildPagination,
  buildPaginationMetadata,
  buildProjection,
  buildSearchFilter,
  buildSort,
  escapeRegex,
  validateDateRange,
  validateFields,
  validateLimit,
  validateOrder,
  validatePage,
  validateQuery,
  validateSearch,
} = require("../../utils/query");

describe("query validation", () => {
  test("normalizes defaults and integer query strings", () => {
    expect(validatePage()).toBe(DEFAULT_PAGE);
    expect(validateLimit()).toBe(DEFAULT_LIMIT);
    expect(validatePage("3")).toBe(3);
    expect(validateLimit("40")).toBe(40);
  });

  test.each([0, -1, "1.5", "abc", [], {}])(
    "rejects invalid page value %p",
    (value) => expect(() => validatePage(value)).toThrow(QueryValidationError),
  );

  test("rejects limits outside the configured range", () => {
    expect(() => validateLimit(0)).toThrow("limit must be between");
    expect(() => validateLimit(MAX_LIMIT + 1)).toThrow("limit must be between");
    expect(validateLimit("5", { maxLimit: 5 })).toBe(5);
  });

  test("accepts only asc and desc sort orders", () => {
    expect(validateOrder("asc")).toBe("asc");
    expect(validateOrder("desc")).toBe("desc");
    expect(() => validateOrder("ascending")).toThrow("order must be asc or desc");
    expect(() => validateOrder("ASC")).toThrow("order must be asc or desc");
  });

  test("normalizes valid dates and rejects malformed or impossible dates", () => {
    expect(
      validateDateRange(
        "2026-08-01T00:00:00+05:30",
        "2026-08-02T00:00:00+05:30",
      ),
    ).toEqual({
      createdFrom: "2026-07-31T18:30:00.000Z",
      createdTo: "2026-08-01T18:30:00.000Z",
    });
    expect(() => validateDateRange("not-a-date")).toThrow("valid ISO date-time");
    expect(() => validateDateRange("2026-02-30T00:00:00Z")).toThrow(
      "valid ISO date-time",
    );
    expect(() =>
      validateDateRange("2026-08-03T00:00:00Z", "2026-08-02T00:00:00Z"),
    ).toThrow("createdFrom must not be after createdTo");
  });

  test("normalizes search and fields", () => {
    expect(validateSearch("  coffee  ")).toBe("coffee");
    expect(validateSearch("   ")).toBeUndefined();
    expect(validateFields("name, price,name")).toEqual(["name", "price"]);
    expect(() => validateSearch("x".repeat(101))).toThrow("100 characters");
    expect(() => validateFields("name,$password")).toThrow("invalid field name");
  });

  test("rejects unknown query parameters", () => {
    expect(() =>
      validateQuery(
        { page: "1", unexpected: "value" },
        {
          sorting: {
            fields: { createdAt: "createdAt" },
            defaultField: "createdAt",
          },
        },
      ),
    ).toThrow("query parameter unexpected is not allowed");
  });
});

describe("pagination", () => {
  test("calculates page, limit and skip", () => {
    expect(buildPagination({ page: 3, limit: 25 })).toEqual({
      page: 3,
      limit: 25,
      skip: 50,
    });
  });

  test("uses configurable defaults without database access", () => {
    expect(
      buildPagination({}, { defaultPage: 2, defaultLimit: 10, maxLimit: 50 }),
    ).toEqual({ page: 2, limit: 10, skip: 10 });
  });

  test("builds standard pagination metadata", () => {
    expect(buildPaginationMetadata({ page: 2, limit: 20, total: 45 })).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      pages: 3,
      hasNext: true,
      hasPrev: true,
    });
    expect(buildPaginationMetadata({ page: 1, limit: 20, total: 0 })).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      pages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
});

describe("search", () => {
  test("escapes regex metacharacters instead of accepting raw regex", () => {
    expect(escapeRegex("coffee.*(hot)?")).toBe("coffee\\.\\*\\(hot\\)\\?");
    expect(buildSearchFilter("coffee.*", ["name"])).toEqual({
      $or: [{ name: { $regex: "coffee\\.\\*", $options: "i" } }],
    });
  });

  test("supports module-defined partial, prefix and exact fields", () => {
    expect(
      buildSearchFilter(" Bill-1 ", [
        { field: "customerName", mode: "partial" },
        { field: "billNumber", mode: "prefix" },
        { field: "reference", mode: "exact" },
      ]),
    ).toEqual({
      $or: [
        { customerName: { $regex: "Bill-1", $options: "i" } },
        { billNumber: { $regex: "^Bill-1", $options: "i" } },
        { reference: { $regex: "^Bill-1$", $options: "i" } },
      ],
    });
  });

  test("returns no filter for empty search and rejects overlong search", () => {
    expect(buildSearchFilter("  ", ["name"])).toBeNull();
    expect(() => buildSearchFilter("x".repeat(101), ["name"])).toThrow(
      "100 characters",
    );
  });
});

describe("filtering", () => {
  const definitions = {
    status: { field: "state", type: "enum", values: ["active", "inactive"] },
    lowStock: { field: "lowStock", type: "boolean" },
    minimum: { field: "quantity", type: "number", operator: "gte" },
  };

  test("builds typed allowlisted filters", () => {
    expect(
      buildFilters({ status: "active", lowStock: "false", minimum: "5" }, definitions),
    ).toEqual({
      state: "active",
      lowStock: false,
      quantity: { $gte: 5 },
    });
  });

  test("rejects unknown filters and invalid typed values", () => {
    expect(() => buildFilters({ role: "admin" }, definitions)).toThrow(
      "filter role is not allowed",
    );
    expect(() => buildFilters({ lowStock: "yes" }, definitions)).toThrow(
      "must be true or false",
    );
    expect(() => buildFilters({ status: { $ne: "active" } }, definitions)).toThrow(
      "scalar value",
    );
  });

  test("rejects operator names and dotted public filter paths", () => {
    expect(() => buildFilters({ $where: "true" }, definitions)).toThrow(
      "invalid field name",
    );
    expect(() => buildFilters({ "user.role": "admin" }, definitions)).toThrow(
      "invalid field name",
    );
  });
});

describe("sorting", () => {
  const policy = {
    fields: { name: "displayName", createdAt: "createdAt" },
    defaultField: "createdAt",
    defaultOrder: "desc",
  };

  test("maps aliases and adds a deterministic _id tie-breaker", () => {
    expect(buildSort("name", "asc", policy)).toEqual({ displayName: 1, _id: 1 });
    expect(buildSort(undefined, undefined, policy)).toEqual({ createdAt: -1, _id: -1 });
  });

  test("rejects a sort field outside the whitelist", () => {
    expect(() => buildSort("password", "asc", policy)).toThrow(
      "sort field password is not allowed",
    );
  });
});

describe("field selection", () => {
  const policy = {
    fields: { name: "displayName", price: "price" },
    defaultFields: ["name"],
    mandatoryFields: ["_id"],
  };

  test("maps allowed fields and preserves mandatory fields", () => {
    expect(buildProjection(["price"], policy)).toEqual({ price: 1, _id: 1 });
    expect(buildProjection(undefined, policy)).toEqual({ displayName: 1, _id: 1 });
  });

  test("rejects denied fields", () => {
    expect(() => buildProjection(["password"], policy)).toThrow(
      "field password is not selectable",
    );
  });
});

describe("QueryBuilder", () => {
  const policy = {
    pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
    searchableFields: [{ field: "displayName", mode: "partial" }],
    filters: {
      status: { field: "status", type: "enum", values: ["active", "inactive"] },
    },
    dateRange: { field: "createdAt" },
    sorting: {
      fields: { createdAt: "createdAt", name: "displayName" },
      defaultField: "createdAt",
      defaultOrder: "desc",
    },
    fieldSelection: {
      fields: { name: "displayName", status: "status" },
      defaultFields: ["name", "status"],
      mandatoryFields: ["_id"],
    },
    mandatoryFilter: { isActive: true },
  };

  test("produces the complete repository query plan", () => {
    const plan = QueryBuilder.build({
      query: {
        page: "2",
        limit: "10",
        search: " Coffee ",
        status: "active",
        sort: "name",
        order: "asc",
        fields: "name",
        createdFrom: "2026-08-01T00:00:00Z",
      },
      policy,
      trustedConstraints: { branchId: "branch-1" },
      options: { lean: true },
    });

    expect(plan).toEqual({
      filter: {
        $and: [
          { branchId: "branch-1" },
          { isActive: true },
          { status: "active" },
          { $or: [{ displayName: { $regex: "Coffee", $options: "i" } }] },
          { createdAt: { $gte: "2026-08-01T00:00:00.000Z" } },
        ],
      },
      projection: { displayName: 1, _id: 1 },
      sort: { displayName: 1, _id: 1 },
      pagination: { page: 2, limit: 10, skip: 10 },
      options: { lean: true },
      metadata: {
        search: "Coffee",
        filters: ["status"],
        sort: { field: "name", order: "asc" },
        fields: ["name"],
      },
    });
  });

  test("preserves trusted constraints when client fields target the same property", () => {
    const plan = QueryBuilder.build({
      query: { status: "active" },
      policy,
      trustedConstraints: { status: "trusted-status" },
    });

    expect(plan.filter.$and).toContainEqual({ status: "trusted-status" });
    expect(plan.filter.$and).toContainEqual({ status: "active" });
  });

  test("returns a deeply immutable plan without freezing caller input", () => {
    const trusted = { branchId: "branch-1" };
    const options = { lean: true };
    const plan = QueryBuilder.build({ policy, trustedConstraints: trusted, options });

    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.filter)).toBe(true);
    expect(Object.isFrozen(plan.projection)).toBe(true);
    expect(Object.isFrozen(plan.pagination)).toBe(true);
    expect(Object.isFrozen(plan.options)).toBe(true);
    expect(Object.isFrozen(trusted)).toBe(false);
    expect(Object.isFrozen(options)).toBe(false);
  });
});
