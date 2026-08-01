const mongoose = require("mongoose");
const AuditEvent = require("../../models/AuditEvent");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AuditManager,
} = require("../../infrastructure/audit");
const {
  InventoryAuditLogger,
  adjustmentType,
  errorCode,
  sanitizedReason,
  transactionId,
} = require("../../modules/inventory/InventoryAuditLogger");

const branchId = new mongoose.Types.ObjectId().toString();
const inventoryId = new mongoose.Types.ObjectId().toString();
const menuItemId = new mongoose.Types.ObjectId().toString();
const stockLogId = new mongoose.Types.ObjectId().toString();
const session = { id: { id: Buffer.from("fade", "hex") } };

const setup = () => {
  const repository = { insert: jest.fn().mockResolvedValue(undefined) };
  const logger = new InventoryAuditLogger(new AuditManager({ repository }));
  const context = logger.createContext({
    actorId: "user-1",
    actorRole: "manager",
    branchId,
    correlationId: "inventory-correlation-1",
  });
  return { context, logger, repository };
};

const eventFrom = (repository) => repository.insert.mock.calls[0][0];
const expectSchemaAndScope = (event, action) => {
  expect(new AuditEvent(event).validateSync()).toBeUndefined();
  expect(event).toMatchObject({
    schemaVersion: 1,
    action,
    outcome: AUDIT_OUTCOMES.SUCCESS,
    actor: "user-1",
    actorRole: "manager",
    actorType: ACTOR_TYPES.USER,
    branchId,
    entityId: inventoryId,
    correlationId: "inventory-correlation-1",
    transactionId: "fade",
    metadata: { source: "APPLICATION", service: "inventory" },
  });
  expect(event.timestamp).toBeInstanceOf(Date);
};

describe("inventory audit event contracts", () => {
  test("builds schema-valid INVENTORY.CREATE with initial quantity and linked entities", async () => {
    const { context, logger, repository } = setup();

    await logger.created(
      {
        context,
        item: {
          _id: inventoryId,
          name: "Tomatoes",
          unit: "kg",
          currentStock: 6,
          costPerUnit: 20,
          menuItemId,
          password: "must-not-appear",
          authorization: "Bearer must-not-appear",
        },
        initialQuantity: 6,
        stockLogId,
      },
      { session },
    );

    const event = eventFrom(repository);
    expectSchemaAndScope(event, AUDIT_ACTIONS.INVENTORY_CREATE);
    expect(event.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "currentStock",
          operation: "CREATE",
          before: null,
          after: 6,
        }),
        expect.objectContaining({ path: "menuItemId", after: menuItemId }),
      ]),
    );
    expect(event.metadata).toMatchObject({
      parentEntityType: "MENU",
      parentEntityId: menuItemId,
      affectedEntityIds: [stockLogId],
      affectedCount: 2,
      businessReference:
        "inventory:create;stock-log:create;menu-availability:create",
    });
    expect(JSON.stringify(event)).not.toMatch(
      /must-not-appear|password|authorization|cookies?|api[-_ ]?keys?|jwt|tokens?|secrets?/i,
    );
    expect(repository.insert).toHaveBeenCalledWith(event, { session });
  });

  test("builds INVENTORY.RESTOCK with the before, added, and new quantities", async () => {
    const { context, logger, repository } = setup();

    await logger.restocked(
      {
        context,
        item: { _id: inventoryId, currentStock: 8, menuItemId },
        previousQuantity: 3,
        addedQuantity: 5,
        stockLogId,
        availabilityChanged: false,
      },
      { session },
    );

    const event = eventFrom(repository);
    expectSchemaAndScope(event, AUDIT_ACTIONS.INVENTORY_RESTOCK);
    expect(event.changes).toEqual([
      expect.objectContaining({
        path: "currentStock",
        operation: "INCREMENT",
        before: 3,
        after: 8,
        delta: 5,
      }),
    ]);
    expect(event.metadata.businessReference).toContain("added:5");
    expect(event.metadata.businessReference).toContain(
      "menu-availability:unchanged",
    );
  });

  test("builds INVENTORY.ADJUST with quantity and availability transitions", async () => {
    const { context, logger, repository } = setup();

    await logger.adjusted(
      {
        context,
        item: { _id: inventoryId, currentStock: 0, menuItemId },
        previousQuantity: 4,
        reason: "Damaged stock",
        stockLogId,
        availabilityChanged: true,
      },
      { session },
    );

    const event = eventFrom(repository);
    expectSchemaAndScope(event, AUDIT_ACTIONS.INVENTORY_ADJUST);
    expect(event.changes).toEqual([
      expect.objectContaining({
        path: "currentStock",
        operation: "DECREMENT",
        before: 4,
        after: 0,
        delta: -4,
      }),
    ]);
    expect(event.metadata).toMatchObject({
      reasonCode: "Damaged stock",
      businessReference:
        "adjustment:DECREASE;stock-log:create;menu-availability:status-transition",
    });
  });

  test("writes a minimal sanitized failure event outside the transaction", async () => {
    const { context, logger, repository } = setup();
    const databaseError = Object.assign(
      new Error("MongoDB password=secret; request payload contains a JWT"),
      {
        code: 112,
        stack: "sensitive stack",
        authorization: "Bearer token",
        request: { cookies: "secret" },
      },
    );

    await logger.failure({
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      context,
      entityId: inventoryId,
      error: databaseError,
    });

    const event = eventFrom(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.INVENTORY_ADJUST,
      outcome: AUDIT_OUTCOMES.FAILURE,
      actor: "user-1",
      actorRole: "manager",
      branchId,
      entityId: inventoryId,
      correlationId: "inventory-correlation-1",
      transactionId: null,
      changes: [],
      metadata: {
        source: "APPLICATION",
        service: "inventory",
        errorCode: "INVENTORY_TRANSACTION_FAILED",
      },
    });
    expect(JSON.stringify(event)).not.toMatch(
      /mongodb|password|secret|stack|payload|authorization|bearer|token|cookie|jwt/i,
    );
    expect(repository.insert).toHaveBeenCalledWith(event, {});
  });

  test("normalizes helper values without exposing unsafe diagnostics", () => {
    expect(transactionId(session)).toBe("fade");
    expect(errorCode({ statusCode: 409, message: "MongoDB secret" })).toBe(
      "INVENTORY_HTTP_409",
    );
    expect(errorCode({ code: 112, message: "MongoDB secret" })).toBe(
      "INVENTORY_TRANSACTION_FAILED",
    );
    expect(adjustmentType(2, 4)).toBe("INCREASE");
    expect(adjustmentType(4, 2)).toBe("DECREASE");
    expect(adjustmentType(2, 2)).toBe("NO_CHANGE");
    expect(sanitizedReason("password=do-not-store")).toBe("[REDACTED]");
  });
});
