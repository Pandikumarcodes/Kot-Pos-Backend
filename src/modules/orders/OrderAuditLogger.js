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

// Database driver details and error messages are deliberately collapsed.
const errorCode = (error) => {
  const status = error?.statusCode ?? error?.status;
  return Number.isInteger(status)
    ? `ORDER_HTTP_${status}`
    : "ORDER_TRANSACTION_FAILED";
};

const kitchenAction = (status) => {
  const actions = {
    preparing: AUDIT_ACTIONS.KOT_START_PREPARATION,
    ready: AUDIT_ACTIONS.KOT_MARK_READY,
    served: AUDIT_ACTIONS.KOT_SERVE,
  };
  return actions[status] || null;
};

class OrderAuditLogger {
  constructor(manager = auditManager) {
    this.manager = manager;
  }

  createContext({
    actorId,
    actorRole = null,
    branchId,
    correlationId: suppliedCorrelationId,
  }) {
    return new AuditContext({
      actor: actorId || "order-service",
      actorRole,
      actorType: actorId ? ACTOR_TYPES.USER : ACTOR_TYPES.SERVICE,
      branchId,
      correlationId: correlationId(suppliedCorrelationId),
      source: "APPLICATION",
    });
  }

  async sentToKitchen(
    { context, order, kot, previousStatus = "pending", orderType, tableId },
    { session },
  ) {
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.ORDER_SEND_TO_KITCHEN,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(order._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
          before: { status: previousStatus },
          after: { status: order.status },
        },
        metadata: {
          service: "orders",
          parentEntityType: tableId ? "TABLE" : "KOT",
          parentEntityId: identifier(tableId || kot._id),
          affectedEntityIds: [identifier(kot._id)],
          affectedCount: 1,
          businessReference: `${orderType};kot:create`,
        },
      },
      { session },
    );
  }

  async kitchenStatusChanged(
    { context, kot, previousStatus, newStatus },
    { session },
  ) {
    const action = kitchenAction(newStatus);
    if (!action) return null;
    return this.manager.record(
      {
        action,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(kot._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
          before: { status: previousStatus },
          after: { status: newStatus },
        },
        metadata: { service: "orders" },
      },
      { session },
    );
  }

  async failure({ action, context, entityId, error, parentEntityId = null }) {
    return this.manager.record({
      action,
      outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: identifier(entityId),
      context,
      metadata: {
        service: "orders",
        errorCode: errorCode(error),
        parentEntityType: parentEntityId ? "KOT" : undefined,
        parentEntityId: identifier(parentEntityId),
      },
    });
  }
}

module.exports = new OrderAuditLogger();
module.exports.OrderAuditLogger = OrderAuditLogger;
module.exports.correlationId = correlationId;
module.exports.errorCode = errorCode;
module.exports.kitchenAction = kitchenAction;
module.exports.transactionId = transactionId;
