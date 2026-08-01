const mongoose = require("mongoose");
const AuditEvent = require("../../models/AuditEvent");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AuditManager,
} = require("../../infrastructure/audit");
const {
  OrderAuditLogger,
  errorCode,
} = require("../../modules/orders/OrderAuditLogger");

const branchId = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();
const kotId = new mongoose.Types.ObjectId().toString();
const tableId = new mongoose.Types.ObjectId().toString();
const session = { id: { id: Buffer.from("cafe", "hex") } };

const setup = () => {
  const repository = { insert: jest.fn().mockResolvedValue(undefined) };
  const logger = new OrderAuditLogger(new AuditManager({ repository }));
  const context = logger.createContext({
    actorId: "user-1",
    actorRole: "waiter",
    branchId,
    correlationId: "order-correlation-1",
  });
  return { context, logger, repository };
};

const eventFrom = (repository) => repository.insert.mock.calls[0][0];

describe("order audit event contracts", () => {
  test.each([
    ["dine-in", tableId],
    ["takeaway", null],
  ])("builds schema-valid ORDER.SEND_TO_KITCHEN for %s", async (orderType, relatedTableId) => {
    const { context, logger, repository } = setup();

    await logger.sentToKitchen(
      {
        context,
        order: { _id: orderId, status: "sent_to_kitchen" },
        kot: {
          _id: kotId,
          password: "must-not-appear",
          authorization: "Bearer must-not-appear",
        },
        previousStatus: "pending",
        orderType,
        tableId: relatedTableId,
      },
      { session },
    );

    const event = eventFrom(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.ORDER_SEND_TO_KITCHEN,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      actor: "user-1",
      actorRole: "waiter",
      actorType: ACTOR_TYPES.USER,
      branchId,
      entityId: orderId,
      correlationId: "order-correlation-1",
      transactionId: "cafe",
      metadata: {
        service: "orders",
        parentEntityType: relatedTableId ? "TABLE" : "KOT",
        parentEntityId: relatedTableId || kotId,
        affectedEntityIds: [kotId],
        affectedCount: 1,
      },
    });
    expect(event.changes).toEqual([
      expect.objectContaining({
        path: "status",
        operation: "STATUS_TRANSITION",
        before: "pending",
        after: "sent_to_kitchen",
      }),
    ]);
    expect(JSON.stringify(event)).not.toMatch(
      /must-not-appear|password|authorization|cookie|jwt|token|secret/i,
    );
    expect(repository.insert).toHaveBeenCalledWith(event, { session });
  });

  test.each([
    ["preparing", AUDIT_ACTIONS.KOT_START_PREPARATION, "pending"],
    ["ready", AUDIT_ACTIONS.KOT_MARK_READY, "preparing"],
    ["served", AUDIT_ACTIONS.KOT_SERVE, "ready"],
  ])("audits KOT transition to %s", async (newStatus, action, previousStatus) => {
    const { context, logger, repository } = setup();

    await logger.kitchenStatusChanged(
      {
        context,
        kot: { _id: kotId },
        previousStatus,
        newStatus,
      },
      { session },
    );

    const event = eventFrom(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      entityId: kotId,
      branchId,
      correlationId: "order-correlation-1",
      transactionId: "cafe",
    });
    expect(event.changes[0]).toMatchObject({
      path: "status",
      operation: "STATUS_TRANSITION",
      before: previousStatus,
      after: newStatus,
    });
  });

  test("writes a minimal sanitized failure event outside the transaction", async () => {
    const { context, logger, repository } = setup();
    const databaseError = Object.assign(
      new Error("MongoDB password=secret; stack and request payload"),
      { code: 112, stack: "sensitive stack", authorization: "Bearer token" },
    );

    await logger.failure({
      action: AUDIT_ACTIONS.ORDER_SEND_TO_KITCHEN,
      context,
      entityId: orderId,
      error: databaseError,
    });

    const event = eventFrom(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.ORDER_SEND_TO_KITCHEN,
      outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: orderId,
      correlationId: "order-correlation-1",
      transactionId: null,
      changes: [],
      metadata: { service: "orders", errorCode: "ORDER_TRANSACTION_FAILED" },
    });
    expect(JSON.stringify(event)).not.toMatch(
      /mongodb|password|secret|stack|payload|authorization|bearer|token/i,
    );
    expect(repository.insert).toHaveBeenCalledWith(event, {});
    expect(errorCode({ statusCode: 409 })).toBe("ORDER_HTTP_409");
  });
});
