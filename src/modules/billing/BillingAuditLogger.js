const crypto = require("node:crypto");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  CHANGE_OPERATIONS,
  AuditContext,
  AuditManager,
} = require("../../infrastructure/audit");

const auditManager = new AuditManager();

const identifier = (value) =>
  value === null || value === undefined ? null : String(value);

const correlationId = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : crypto.randomUUID();

const transactionId = (session) => {
  const value = session?.id?.id ?? session?.id;
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (value?.buffer && Buffer.isBuffer(value.buffer)) {
    return value.buffer.toString("hex");
  }
  if (value?.toHexString) return value.toHexString();
  if (["string", "number", "bigint"].includes(typeof value)) {
    return String(value);
  }
  const rendered = value?.toString?.();
  return rendered && rendered !== "[object Object]" ? rendered : null;
};

const errorCode = (error) => {
  const candidate = error?.code;
  if (Number.isInteger(candidate)) return `BILLING_ERROR_${candidate}`;
  if (
    typeof candidate === "string" &&
    /^[A-Z0-9_.-]{1,100}$/i.test(candidate)
  ) {
    return candidate.toUpperCase();
  }
  const status = error?.statusCode ?? error?.status;
  return Number.isInteger(status)
    ? `BILLING_HTTP_${status}`
    : "BILLING_TRANSACTION_FAILED";
};

const actorContext = ({
  actorId,
  actorRole = null,
  branchId,
  correlationId: suppliedCorrelationId,
}) =>
  new AuditContext({
    actor: actorId || "billing-service",
    actorRole,
    actorType: actorId ? ACTOR_TYPES.USER : ACTOR_TYPES.SERVICE,
    branchId,
    correlationId: correlationId(suppliedCorrelationId),
    source: "APPLICATION",
  });

class BillingAuditLogger {
  constructor(manager = auditManager) {
    this.manager = manager;
  }

  createContext(values) {
    return actorContext(values);
  }

  async billCreated(
    {
      context,
      bill,
      tableId,
      orderIds,
      orderStatusBefore = null,
      tableStatusBefore = "occupied",
    },
    { session },
  ) {
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.BILLING_CREATE,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(bill._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.CREATE,
          before: {},
          after: {
            billNumber: bill.billNumber,
            totalAmount: bill.totalAmount,
            paymentStatus: bill.paymentStatus,
            paymentMethod: bill.paymentMethod,
            tableId: identifier(tableId),
          },
        },
        metadata: {
          service: "billing",
          parentEntityType: "TABLE",
          parentEntityId: identifier(tableId),
          affectedEntityIds: orderIds.map(identifier),
          affectedCount: orderIds.length,
          businessReference: orderStatusBefore
            ? `orders:${orderStatusBefore}->served;table:${tableStatusBefore}->billing`
            : `orders:active->served;table:${tableStatusBefore}->billing`,
        },
      },
      { session },
    );
  }

  async paymentCollected(
    { context, bill, beforePaymentStatus, beforePaymentMethod },
    { session },
  ) {
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.PAYMENT_COLLECT,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(bill._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
          before: {
            paymentStatus: beforePaymentStatus,
            paymentMethod: beforePaymentMethod,
            amount: null,
          },
          after: {
            paymentStatus: bill.paymentStatus,
            paymentMethod: bill.paymentMethod,
            amount: bill.totalAmount,
            paidAt: bill.paidAt,
          },
        },
        metadata: {
          service: "billing",
          parentEntityType: bill.tableId ? "TABLE" : undefined,
          parentEntityId: identifier(bill.tableId),
          businessReference: bill.tableId
            ? "table:billing->available"
            : "payment:collected",
        },
      },
      { session },
    );
  }

  async failure({ action, context, entityId, error, tableId = null }) {
    return this.manager.record({
      action,
      outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: identifier(entityId),
      context,
      metadata: {
        service: "billing",
        errorCode: errorCode(error),
        parentEntityType: tableId ? "TABLE" : undefined,
        parentEntityId: identifier(tableId),
      },
    });
  }
}

module.exports = new BillingAuditLogger();
module.exports.BillingAuditLogger = BillingAuditLogger;
module.exports.correlationId = correlationId;
module.exports.errorCode = errorCode;
module.exports.transactionId = transactionId;
