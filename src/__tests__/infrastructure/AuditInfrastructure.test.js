const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_ACTION_VALUES,
  AUDIT_OUTCOMES,
  CHANGE_OPERATIONS,
  RETENTION_CLASSES,
  AuditContext,
  AuditEventFactory,
  AuditManager,
  AuditPolicyRegistry,
  AuditValidationError,
  AuditWriteError,
  ChangeSetBuilder,
  Redactor,
} = require("../../infrastructure/audit");

const FIXED_EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const FIXED_NOW = new Date("2026-08-01T12:00:00.000Z");

const context = (overrides = {}) =>
  new AuditContext({
    actor: "user-1",
    actorRole: "admin",
    actorType: ACTOR_TYPES.USER,
    branchId: "507f1f77bcf86cd799439011",
    correlationId: "correlation-1",
    requestId: "request-1",
    source: "HTTP",
    route: "/api/inventory/1",
    method: "patch",
    ...overrides,
  });

const manager = (repository) =>
  new AuditManager({
    repository,
    eventFactory: new AuditEventFactory({
      clock: () => FIXED_NOW,
      idFactory: () => FIXED_EVENT_ID,
    }),
  });

const inventoryIntent = (overrides = {}) => ({
  action: AUDIT_ACTIONS.INVENTORY_ADJUST,
  outcome: AUDIT_OUTCOMES.SUCCESS,
  entityId: "inventory-1",
  context: context(),
  change: {
    operation: CHANGE_OPERATIONS.DECREMENT,
    before: { currentStock: 10, supplier: { token: "do-not-record" } },
    after: { currentStock: 7, supplier: { token: "still-secret" } },
  },
  metadata: { reasonCode: "DAMAGED", ignored: "not allowlisted" },
  ...overrides,
});

describe("audit policy and context", () => {
  test("registers exactly one policy for every declared action", () => {
    const registry = AuditPolicyRegistry.defaultRegistry;

    expect(registry.listActions()).toHaveLength(AUDIT_ACTION_VALUES.length);
    for (const action of AUDIT_ACTION_VALUES) {
      expect(registry.hasPolicy(action)).toBe(true);
      expect(registry.getPolicy(action).action).toBe(action);
    }
  });

  test("requires an identified user actor and a correlation ID", () => {
    expect(
      () =>
        new AuditContext({
          actorType: ACTOR_TYPES.USER,
          correlationId: "correlation-1",
        }),
    ).toThrow("User audit actors require an actor ID");

    expect(
      () =>
        new AuditContext({
          actorType: ACTOR_TYPES.SYSTEM,
          correlationId: " ",
        }),
    ).toThrow("A correlationId is required");
  });

  test("normalizes transport context and freezes it", () => {
    const auditContext = context({ actor: 42, method: "post" });

    expect(auditContext.actor).toBe("42");
    expect(auditContext.method).toBe("POST");
    expect(Object.isFrozen(auditContext)).toBe(true);
  });
});

describe("audit payload safety", () => {
  test("captures only policy-allowed changed paths", () => {
    const changes = new ChangeSetBuilder().build({
      operation: CHANGE_OPERATIONS.UPDATE,
      before: { status: "OPEN", password: "old", nested: { value: 1 } },
      after: { status: "CLOSED", password: "new", nested: { value: 2 } },
      allowedPaths: ["status", "nested.*"],
    });

    expect(changes).toEqual([
      {
        path: "status",
        operation: CHANGE_OPERATIONS.UPDATE,
        before: "OPEN",
        after: "CLOSED",
      },
      {
        path: "nested.value",
        operation: CHANGE_OPERATIONS.UPDATE,
        before: 1,
        after: 2,
      },
    ]);
  });

  test("validates increment and decrement direction", () => {
    expect(() =>
      new ChangeSetBuilder().build({
        operation: CHANGE_OPERATIONS.DECREMENT,
        before: { quantity: 2 },
        after: { quantity: 3 },
        allowedPaths: ["quantity"],
      }),
    ).toThrow("DECREMENT change direction does not match its values");
  });

  test("redacts secrets, bearer credentials, JWTs, and oversized arrays", () => {
    const redactor = new Redactor({ maxArrayLength: 2 });
    const result = redactor.redact({
      password: "plain text",
      message: "Authorization: Bearer abc.def-123",
      nested: { api_key: "secret" },
      values: [1, 2, 3],
    });

    expect(result.password).toBe("[REDACTED]");
    expect(result.message).toContain("Bearer [REDACTED]");
    expect(result.nested.api_key).toBe("[REDACTED]");
    expect(result.values).toEqual([1, 2, "[TRUNCATED]"]);
  });
});

describe("AuditManager", () => {
  test("builds, redacts, freezes, and persists a policy-derived event", async () => {
    const repository = { insert: jest.fn().mockResolvedValue(undefined) };
    const auditManager = manager(repository);

    const event = await auditManager.record(inventoryIntent());

    expect(event).toMatchObject({
      eventId: FIXED_EVENT_ID,
      timestamp: FIXED_NOW,
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      entityId: "inventory-1",
      retentionClass: RETENTION_CLASSES.BUSINESS,
      correlationId: "correlation-1",
      changes: [
        expect.objectContaining({
          path: "currentStock",
          before: 10,
          after: 7,
          delta: -3,
        }),
      ],
      metadata: expect.objectContaining({
        requestId: "request-1",
        method: "PATCH",
        reasonCode: "DAMAGED",
      }),
    });
    expect(event.metadata.ignored).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain("do-not-record");
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.changes)).toBe(true);
    expect(repository.insert).toHaveBeenCalledWith(event, {});
  });

  test("passes the transaction session to the repository", async () => {
    const repository = { insert: jest.fn().mockResolvedValue(undefined) };
    const session = { id: "session-1" };

    await manager(repository).record(inventoryIntent(), { session });

    expect(repository.insert).toHaveBeenCalledWith(expect.any(Object), {
      session,
    });
  });

  test("rejects entity types that conflict with the action policy", async () => {
    const repository = { insert: jest.fn() };

    await expect(
      manager(repository).record(
        inventoryIntent({ entityType: "ORDER" }),
      ),
    ).rejects.toBeInstanceOf(AuditValidationError);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  test("wraps persistence failures while preserving their cause", async () => {
    const databaseError = new Error("database unavailable");
    const repository = { insert: jest.fn().mockRejectedValue(databaseError) };

    await expect(manager(repository).record(inventoryIntent())).rejects.toEqual(
      expect.objectContaining({
        name: "AuditWriteError",
        code: "AUDIT_WRITE_ERROR",
        cause: databaseError,
      }),
    );
  });

  test("prepares a batch before performing its single ordered write", async () => {
    const repository = { insertMany: jest.fn().mockResolvedValue(undefined) };
    const auditManager = new AuditManager({
      repository,
      eventFactory: new AuditEventFactory({
        clock: () => FIXED_NOW,
        idFactory: jest
          .fn()
          .mockReturnValueOnce("123e4567-e89b-42d3-a456-426614174000")
          .mockReturnValueOnce("123e4567-e89b-42d3-a456-426614174001"),
      }),
    });
    const session = { id: "session-1" };

    const events = await auditManager.recordMany(
      [inventoryIntent(), inventoryIntent({ entityId: "inventory-2" })],
      { session },
    );

    expect(events).toHaveLength(2);
    expect(Object.isFrozen(events)).toBe(true);
    expect(repository.insertMany).toHaveBeenCalledWith(events, { session });
  });

  test("keeps audit validation errors distinct from write errors", async () => {
    const validationError = new AuditValidationError("invalid event");
    const repository = { insert: jest.fn().mockRejectedValue(validationError) };

    await expect(manager(repository).record(inventoryIntent())).rejects.toBe(
      validationError,
    );
    expect(validationError).not.toBeInstanceOf(AuditWriteError);
  });
});
