const mongoose = require("mongoose");
const AuditEvent = require("../../models/AuditEvent");
const {
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  ACTOR_TYPES,
  AuditManager,
} = require("../../infrastructure/audit");
const {
  BillingAuditLogger,
  errorCode,
  transactionId,
} = require("../../modules/billing/BillingAuditLogger");

const branchId = new mongoose.Types.ObjectId().toString();
const tableId = new mongoose.Types.ObjectId().toString();
const billId = new mongoose.Types.ObjectId().toString();
const orderId = new mongoose.Types.ObjectId().toString();
const session = { id: "mongo-transaction-1" };

const setup = () => {
  const repository = { insert: jest.fn().mockResolvedValue(undefined) };
  const logger = new BillingAuditLogger(new AuditManager({ repository }));
  const context = logger.createContext({
    actorId: "user-1",
    actorRole: "cashier",
    branchId,
    correlationId: "correlation-1",
  });
  return { context, logger, repository };
};

const persistedEvent = (repository) => repository.insert.mock.calls[0][0];

describe("billing audit event contracts", () => {
  test("builds a schema-valid BILLING.CREATE event with branch, actor, references, and transaction", async () => {
    const { context, logger, repository } = setup();
    const bill = {
      _id: billId,
      billNumber: "BILL-20260801-001",
      totalAmount: 250,
      paymentStatus: "unpaid",
      paymentMethod: "none",
      authorization: "Bearer must-not-appear",
      cardNumber: "4111111111111111",
    };

    await logger.billCreated(
      {
        context,
        bill,
        tableId,
        orderIds: [orderId],
        orderStatusBefore: "sent_to_kitchen",
      },
      { session },
    );

    const event = persistedEvent(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      schemaVersion: 1,
      action: AUDIT_ACTIONS.BILLING_CREATE,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      actor: "user-1",
      actorRole: "cashier",
      actorType: ACTOR_TYPES.USER,
      branchId,
      entityId: billId,
      correlationId: "correlation-1",
      transactionId: "mongo-transaction-1",
      metadata: {
        source: "APPLICATION",
        service: "billing",
        parentEntityType: "TABLE",
        parentEntityId: tableId,
        affectedEntityIds: [orderId],
        affectedCount: 1,
        businessReference:
          "orders:sent_to_kitchen->served;table:occupied->billing",
      },
    });
    expect(event.changes.every((change) => change.operation === "CREATE")).toBe(true);
    const serialized = JSON.stringify(event).toLowerCase();
    for (const forbidden of [
      "must-not-appear",
      "4111111111111111",
      "authorization",
      "cookie",
      "password",
      "token",
      "cvv",
      "pin",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(repository.insert).toHaveBeenCalledWith(event, { session });
  });

  test("builds PAYMENT.COLLECT with status transition, amount, method, and table release", async () => {
    const { context, logger, repository } = setup();
    const paidAt = new Date("2026-08-01T12:00:00.000Z");

    await logger.paymentCollected(
      {
        context,
        bill: {
          _id: billId,
          tableId,
          totalAmount: 250,
          paymentStatus: "paid",
          paymentMethod: "upi",
          paidAt,
        },
        beforePaymentStatus: "unpaid",
        beforePaymentMethod: "none",
      },
      { session },
    );

    const event = persistedEvent(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.PAYMENT_COLLECT,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      branchId,
      entityId: billId,
      correlationId: "correlation-1",
      transactionId: "mongo-transaction-1",
      metadata: {
        parentEntityType: "TABLE",
        parentEntityId: tableId,
        businessReference: "table:billing->available",
      },
    });
    expect(event.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "paymentStatus",
          before: "unpaid",
          after: "paid",
        }),
        expect.objectContaining({ path: "paymentMethod", after: "upi" }),
        expect.objectContaining({ path: "amount", before: null, after: 250 }),
      ]),
    );
  });

  test("failure event is minimal, sanitized, and written without a session", async () => {
    const { context, logger, repository } = setup();
    const databaseError = Object.assign(
      new Error("Mongo connection failed; password=secret; stack details"),
      { code: "WRITE_CONFLICT", stack: "sensitive stack" },
    );

    await logger.failure({
      action: AUDIT_ACTIONS.PAYMENT_COLLECT,
      context,
      entityId: billId,
      tableId,
      error: databaseError,
    });

    const event = persistedEvent(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({
      action: AUDIT_ACTIONS.PAYMENT_COLLECT,
      outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: billId,
      correlationId: "correlation-1",
      transactionId: null,
      changes: [],
      metadata: { errorCode: "WRITE_CONFLICT" },
    });
    expect(JSON.stringify(event)).not.toMatch(/password|secret|stack|mongo connection/i);
    expect(repository.insert).toHaveBeenCalledWith(event, {});
  });

  test("normalizes safe transaction and error identifiers", () => {
    expect(transactionId({ id: { id: Buffer.from("abcd", "hex") } })).toBe("abcd");
    expect(errorCode({ statusCode: 409 })).toBe("BILLING_HTTP_409");
    expect(errorCode({ code: "unsafe error: credentials" })).toBe(
      "BILLING_TRANSACTION_FAILED",
    );
  });
});
