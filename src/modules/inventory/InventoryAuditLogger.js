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

// Driver diagnostics and error messages must never enter an audit event.
const errorCode = (error) => {
  const status = error?.statusCode ?? error?.status;
  return Number.isInteger(status)
    ? `INVENTORY_HTTP_${status}`
    : "INVENTORY_TRANSACTION_FAILED";
};

const adjustmentType = (before, after) => {
  if (after > before) return "INCREASE";
  if (after < before) return "DECREASE";
  return "NO_CHANGE";
};

const quantityOperation = (before, after) => {
  if (after > before) return CHANGE_OPERATIONS.INCREMENT;
  if (after < before) return CHANGE_OPERATIONS.DECREMENT;
  return CHANGE_OPERATIONS.UPDATE;
};

const sanitizedReason = (reason) => {
  const value = String(reason || "Manual adjustment");
  if (
    /\b(password|token|jwt|authorization|cookies?|api[-_ ]?keys?|secrets?|bearer)\b/i.test(
      value,
    ) ||
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
  ) {
    return "[REDACTED]";
  }
  return value.slice(0, 100);
};

class InventoryAuditLogger {
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
      actor: actorId || "inventory-service",
      actorRole,
      actorType: actorId ? ACTOR_TYPES.USER : ACTOR_TYPES.SERVICE,
      branchId,
      correlationId: correlationId(suppliedCorrelationId),
      source: "APPLICATION",
    });
  }

  async created({ context, item, initialQuantity, stockLogId }, { session }) {
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.INVENTORY_CREATE,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(item._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.CREATE,
          before: {},
          after: {
            name: item.name,
            unit: item.unit,
            currentStock: initialQuantity,
            costPerUnit: item.costPerUnit,
            menuItemId: identifier(item.menuItemId),
          },
        },
        metadata: {
          service: "inventory",
          parentEntityType: item.menuItemId ? "MENU" : undefined,
          parentEntityId: identifier(item.menuItemId),
          affectedEntityIds: stockLogId ? [identifier(stockLogId)] : undefined,
          affectedCount: (stockLogId ? 1 : 0) + (item.menuItemId ? 1 : 0),
          businessReference: [
            "inventory:create",
            stockLogId ? "stock-log:create" : null,
            item.menuItemId ? "menu-availability:create" : null,
          ]
            .filter(Boolean)
            .join(";"),
        },
      },
      { session },
    );
  }

  async restocked(
    { context, item, previousQuantity, addedQuantity, stockLogId, availabilityChanged },
    { session },
  ) {
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.INVENTORY_RESTOCK,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(item._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: CHANGE_OPERATIONS.INCREMENT,
          before: { currentStock: previousQuantity },
          after: { currentStock: item.currentStock },
        },
        metadata: {
          service: "inventory",
          parentEntityType: item.menuItemId ? "MENU" : undefined,
          parentEntityId: identifier(item.menuItemId),
          affectedEntityIds: stockLogId ? [identifier(stockLogId)] : undefined,
          affectedCount: (stockLogId ? 1 : 0) + (availabilityChanged ? 1 : 0),
          businessReference: `stock-log:create;added:${addedQuantity};menu-availability:${
            availabilityChanged ? "status-transition" : "unchanged"
          }`,
        },
      },
      { session },
    );
  }

  async adjusted(
    { context, item, previousQuantity, reason, stockLogId, availabilityChanged },
    { session },
  ) {
    const type = adjustmentType(previousQuantity, item.currentStock);
    return this.manager.record(
      {
        action: AUDIT_ACTIONS.INVENTORY_ADJUST,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(item._id),
        context,
        transactionId: transactionId(session),
        change: {
          operation: quantityOperation(previousQuantity, item.currentStock),
          before: { currentStock: previousQuantity },
          after: { currentStock: item.currentStock },
        },
        metadata: {
          service: "inventory",
          reasonCode: sanitizedReason(reason),
          parentEntityType: item.menuItemId ? "MENU" : undefined,
          parentEntityId: identifier(item.menuItemId),
          affectedEntityIds: stockLogId ? [identifier(stockLogId)] : undefined,
          affectedCount: (stockLogId ? 1 : 0) + (availabilityChanged ? 1 : 0),
          businessReference: `adjustment:${type};stock-log:create;menu-availability:${
            availabilityChanged ? "status-transition" : "unchanged"
          }`,
        },
      },
      { session },
    );
  }

  async failure({ action, context, entityId, error }) {
    return this.manager.record({
      action,
      outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: identifier(entityId),
      context,
      metadata: {
        service: "inventory",
        errorCode: errorCode(error),
      },
    });
  }
}

module.exports = new InventoryAuditLogger();
module.exports.InventoryAuditLogger = InventoryAuditLogger;
module.exports.adjustmentType = adjustmentType;
module.exports.correlationId = correlationId;
module.exports.errorCode = errorCode;
module.exports.sanitizedReason = sanitizedReason;
module.exports.transactionId = transactionId;
