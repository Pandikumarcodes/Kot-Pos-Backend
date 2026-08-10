const crypto = require("node:crypto");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  CHANGE_OPERATIONS,
  AuditContext,
  AuditManager,
  Redactor,
} = require("../../infrastructure/audit");
const requestContext = require("./AdministrationRequestContext");
const { isSensitiveKey } = require("../../infrastructure/audit/Redactor");

const auditManager = new AuditManager();
const redactor = new Redactor();
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
  if (["string", "number", "bigint"].includes(typeof value)) return String(value);
  const rendered = value?.toString?.();
  return rendered && rendered !== "[object Object]" ? rendered : null;
};
const errorCode = (error) => {
  const status = error?.statusCode ?? error?.status;
  return Number.isInteger(status)
    ? `ADMIN_HTTP_${status}`
    : "ADMIN_OPERATION_FAILED";
};
const plain = (value, fields) => {
  if (!value) return {};
  return Object.fromEntries(
    fields
      .filter((field) => value[field] !== undefined)
      .map((field) => [field, identifierField(field, value[field])]),
  );
};
const identifierField = (field, value) =>
  field === "branchId" ? identifier(value) : value;
const removeSensitiveConfiguration = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(removeSensitiveConfiguration);
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (isSensitiveKey(key) || normalized.includes("paymentcredential")) return [];
    return [[key, removeSensitiveConfiguration(entry)]];
  }));
};

class AdministrationAuditLogger {
  constructor(manager = auditManager) {
    this.manager = manager;
  }

  createContext(overrides = {}) {
    const scoped = requestContext.current();
    const actorId = overrides.actorId ?? scoped.actorId;
    return new AuditContext({
      actor: actorId || "administration-service",
      actorRole: overrides.actorRole ?? scoped.actorRole,
      actorType: actorId ? ACTOR_TYPES.USER : ACTOR_TYPES.SERVICE,
      branchId: overrides.branchId ?? scoped.branchId,
      correlationId: correlationId(overrides.correlationId ?? scoped.correlationId),
      requestId: overrides.requestId ?? scoped.requestId,
      route: overrides.route ?? scoped.route,
      method: overrides.method ?? scoped.method,
      source: "APPLICATION",
    });
  }

  async changed({ action, context, entityId, operation, before = {}, after = {}, category, metadata = {} }, { session } = {}) {
    return this.manager.record(
      {
        action,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        entityId: identifier(entityId),
        context,
        transactionId: transactionId(session),
        change: { operation, before, after },
        metadata: {
          service: "administration",
          businessReference: category || metadata.businessReference,
          ...metadata,
        },
      },
      session ? { session } : {},
    );
  }

  staffCreated({ context, staff }, options) {
    return this.changed({
      action: AUDIT_ACTIONS.STAFF_CREATE,
      context,
      entityId: staff._id ?? staff.id,
      operation: CHANGE_OPERATIONS.CREATE,
      after: plain(staff, ["username", "role", "status", "branchId"]),
    }, options);
  }

  staffUpdated({ context, staffId, before, after }, options) {
    return this.changed({ action: AUDIT_ACTIONS.STAFF_UPDATE, context, entityId: staffId,
      operation: CHANGE_OPERATIONS.UPDATE,
      before: plain(before, ["username", "role", "status", "branchId"]),
      after: plain(after, ["username", "role", "status", "branchId"]) }, options);
  }

  staffDeleted({ context, staff }, options) {
    return this.changed({ action: AUDIT_ACTIONS.STAFF_DELETE, context,
      entityId: staff._id ?? staff.id, operation: CHANGE_OPERATIONS.DELETE,
      before: plain(staff, ["username", "role", "status", "branchId"]) }, options);
  }

  async roleChanged({ context, staffId, previousRole, newRole }, options = {}) {
    const common = {
      context,
      entityId: identifier(staffId),
      outcome: AUDIT_OUTCOMES.SUCCESS,
      transactionId: transactionId(options.session),
      change: { operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
        before: { role: previousRole }, after: { role: newRole } },
      metadata: { service: "administration" },
    };
    return this.manager.recordMany(
      [
        { ...common, action: AUDIT_ACTIONS.STAFF_ROLE_CHANGE },
        { ...common, action: AUDIT_ACTIONS.ROLE_ASSIGNMENT },
      ],
      options.session ? { session: options.session } : {},
    );
  }

  statusChanged({ context, staffId, previousStatus, newStatus }, options) {
    return this.changed({ action: AUDIT_ACTIONS.STAFF_STATUS_CHANGE, context,
      entityId: staffId, operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
      before: { status: previousStatus }, after: { status: newStatus } }, options);
  }

  permissionChanged({ context, staffId, previousPermission, newPermission }, options) {
    return this.changed({ action: AUDIT_ACTIONS.PERMISSION_CHANGE, context,
      entityId: staffId, operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
      before: { permission: previousPermission }, after: { permission: newPermission } }, options);
  }

  accountLockChanged({ context, staffId, previousStatus, locked }, options) {
    return this.changed({ action: locked ? AUDIT_ACTIONS.ACCOUNT_LOCK : AUDIT_ACTIONS.ACCOUNT_UNLOCK,
      context, entityId: staffId, operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
      before: { status: previousStatus }, after: { status: locked ? "locked" : "active" } }, options);
  }

  branchCreated({ context, branch }, options) {
    return this.changed({ action: AUDIT_ACTIONS.BRANCH_CREATE, context,
      entityId: branch._id ?? branch.id, operation: CHANGE_OPERATIONS.CREATE,
      after: plain(branch, ["name", "address", "phone", "email", "gstin", "isActive"]) }, options);
  }

  branchUpdated({ context, branchId, before, after }, options) {
    return this.changed({ action: AUDIT_ACTIONS.BRANCH_UPDATE, context, entityId: branchId,
      operation: CHANGE_OPERATIONS.UPDATE,
      before: plain(before, ["name", "address", "phone", "email", "gstin", "isActive"]),
      after: plain(after, ["name", "address", "phone", "email", "gstin", "isActive"]) }, options);
  }

  branchDeleted({ context, branch, previousActive }, options) {
    return this.changed({ action: AUDIT_ACTIONS.BRANCH_DELETE, context,
      entityId: branch._id ?? branch.id, operation: CHANGE_OPERATIONS.DELETE,
      before: { isActive: previousActive }, after: { isActive: branch.isActive } }, options);
  }

  branchAdminAssigned({ context, branchId, newAdmin }, options) {
    return this.changed({ action: AUDIT_ACTIONS.BRANCH_ADMIN_ASSIGN, context,
      entityId: branchId, operation: CHANGE_OPERATIONS.UPDATE,
      before: { adminUser: null },
      after: { adminUser: identifier(newAdmin?._id ?? newAdmin?.id ?? newAdmin) },
      metadata: { newAdmin: identifier(newAdmin?._id ?? newAdmin?.id ?? newAdmin) } }, options);
  }

  branchAdminReplaced({ context, branchId, previousAdmin, newAdmin }, options) {
    return this.changed({ action: AUDIT_ACTIONS.BRANCH_ADMIN_REPLACE, context,
      entityId: branchId, operation: CHANGE_OPERATIONS.UPDATE,
      before: { adminUser: identifier(previousAdmin?._id ?? previousAdmin?.id ?? previousAdmin) },
      after: { adminUser: identifier(newAdmin?._id ?? newAdmin?.id ?? newAdmin) },
      metadata: {
        previousAdmin: identifier(previousAdmin?._id ?? previousAdmin?.id ?? previousAdmin),
        newAdmin: identifier(newAdmin?._id ?? newAdmin?.id ?? newAdmin),
      } }, options);
  }

  settingsChanged({ context, settingsId, before, after, category = "general", reset = false }, options) {
    const fields = ["businessName", "email", "phone", "address", "gstin", "currency",
      "timezone", "openTime", "closeTime", "avgServiceTime", "maxCapacity",
      "takeawayEnabled", "deliveryEnabled", "taxRate", "fssai", "hsn",
      "serviceCharge", "autoRoundOff", "printReceipt", "paymentMethods",
      "orderAlerts", "lowStockAlerts", "emailNotifications"];
    const safeBefore = redactor.redact(removeSensitiveConfiguration(plain(before, fields)));
    const safeAfter = redactor.redact(removeSensitiveConfiguration(plain(after, fields)));
    return this.changed({ action: reset ? AUDIT_ACTIONS.SETTINGS_RESET : AUDIT_ACTIONS.SETTINGS_UPDATE,
      context, entityId: settingsId, operation: CHANGE_OPERATIONS.UPDATE,
      before: safeBefore, after: safeAfter, category }, options);
  }

  authentication({ action, context, userId, statusBefore = null, statusAfter = null }, options) {
    const hasStatus = statusBefore !== null || statusAfter !== null;
    return this.changed({ action, context, entityId: identifier(userId),
      operation: CHANGE_OPERATIONS.STATUS_TRANSITION,
      before: hasStatus ? { status: statusBefore } : {},
      after: hasStatus ? { status: statusAfter } : {} }, options);
  }

  failure({ action, context, entityId, error }) {
    return this.manager.record({ action, outcome: AUDIT_OUTCOMES.FAILURE,
      entityId: identifier(entityId), context, metadata: {
        service: "administration", errorCode: errorCode(error),
      } });
  }
}

module.exports = new AdministrationAuditLogger();
module.exports.AdministrationAuditLogger = AdministrationAuditLogger;
module.exports.errorCode = errorCode;
module.exports.transactionId = transactionId;
