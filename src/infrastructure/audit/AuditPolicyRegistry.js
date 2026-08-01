const AUDIT_LIMITS = require("./auditLimits");
const { AUDIT_ACTIONS, AUDIT_ACTION_VALUES } = require("./auditActions");
const {
  AUDIT_LEVELS: L,
  ENTITY_TYPES: E,
  RETENTION_CLASSES: R,
  RETENTION_DAYS,
} = require("./auditEnums");
const AuditValidationError = require("./errors/AuditValidationError");

const A = AUDIT_ACTIONS;
const definitions = new Map();

const register = (actions, entityType, level, retentionClass, paths = []) => {
  for (const action of actions) {
    if (definitions.has(action)) throw new Error(`Duplicate audit policy: ${action}`);
    definitions.set(
      action,
      Object.freeze({
        action,
        entityType,
        level,
        retentionClass,
        retentionDays: RETENTION_DAYS[retentionClass],
        allowedChangePaths: Object.freeze([...paths]),
        payloadLimits: Object.freeze({ ...AUDIT_LIMITS }),
      }),
    );
  }
};

register(
  [A.AUTH_SIGNUP, A.AUTH_LOGIN, A.AUTH_REFRESH, A.AUTH_LOGOUT,
    A.AUTH_ACCESS_DENIED, A.AUTH_ACCOUNT_LOCKED],
  E.AUTHENTICATION, L.CRITICAL, R.SECURITY,
  ["status", "refreshTokenState"],
);
register([A.USER_CREATE, A.USER_DELETE], E.USER, L.CRITICAL, R.SECURITY,
  ["username", "role", "status", "branchId"]);
register([A.USER_ROLE_CHANGE, A.USER_STATUS_CHANGE], E.USER, L.CRITICAL,
  R.SECURITY, ["role", "status"]);
register([A.STAFF_ASSIGN_BRANCH, A.STAFF_REMOVE_BRANCH], E.STAFF, L.CRITICAL,
  R.SECURITY, ["branchId"]);
register(
  [A.BRANCH_CREATE, A.BRANCH_UPDATE, A.BRANCH_ACTIVATE, A.BRANCH_DEACTIVATE],
  E.BRANCH, L.CRITICAL, R.SECURITY,
  ["name", "address", "phone", "email", "gstin", "isActive"],
);
register([A.SETTINGS_CREATE, A.SETTINGS_UPDATE], E.SETTINGS, L.CRITICAL,
  R.SECURITY,
  ["businessName", "email", "phone", "address", "gstin", "currency",
    "timezone", "openTime", "closeTime", "avgServiceTime", "maxCapacity",
    "takeawayEnabled", "deliveryEnabled", "taxRate", "fssai", "hsn",
    "serviceCharge", "autoRoundOff", "printReceipt", "paymentMethods.*",
    "orderAlerts", "lowStockAlerts", "emailNotifications"]);
register(
  [A.ORDER_CREATE, A.ORDER_SEND_TO_KITCHEN, A.ORDER_SEND_TO_CASHIER,
    A.ORDER_SERVE, A.ORDER_RECEIVE, A.ORDER_CANCEL, A.ORDER_STATUS_CHANGE],
  E.ORDER, L.BUSINESS, R.BUSINESS,
  ["status", "tableId", "tableNumber", "items", "totalAmount", "orderType"],
);
register(
  [A.KOT_CREATE, A.KOT_START_PREPARATION, A.KOT_MARK_READY, A.KOT_SERVE,
    A.KOT_CANCEL, A.KOT_STATUS_CHANGE],
  E.KOT, L.BUSINESS, R.BUSINESS,
  ["status", "items", "totalAmount", "orderType", "tableId"],
);
register([A.BILLING_CREATE, A.BILLING_UPDATE], E.BILLING, L.BUSINESS,
  R.FINANCIAL,
  ["billNumber", "items", "totalAmount", "paymentStatus", "paymentMethod",
    "paidAt", "tableId"]);
register([A.BILLING_DELETE], E.BILLING, L.CRITICAL, R.FINANCIAL,
  ["billNumber", "totalAmount", "paymentStatus", "paymentMethod", "tableId"]);
register([A.PAYMENT_COLLECT, A.PAYMENT_FAIL, A.PAYMENT_VOID, A.PAYMENT_REFUND],
  E.PAYMENT, L.CRITICAL, R.FINANCIAL,
  ["paymentStatus", "paymentMethod", "amount", "paidAt", "referenceId"]);
register(
  [A.INVENTORY_CREATE, A.INVENTORY_RESTOCK, A.INVENTORY_ADJUST,
    A.INVENTORY_DEDUCT, A.INVENTORY_RETURN, A.INVENTORY_DEACTIVATE],
  E.INVENTORY, L.CRITICAL, R.BUSINESS,
  ["name", "unit", "currentStock", "quantity", "stockBefore", "stockAfter",
    "costPerUnit", "isActive", "menuItemId"],
);
register([A.INVENTORY_UPDATE], E.INVENTORY, L.OPERATIONAL, R.OPERATIONAL,
  ["name", "unit", "lowStockThreshold", "category", "costPerUnit",
    "supplier", "menuItemId"]);
register([A.MENU_CREATE_ITEM, A.MENU_UPDATE_ITEM, A.MENU_DELETE_ITEM], E.MENU,
  L.BUSINESS, R.BUSINESS, ["ItemName", "category", "price", "available"]);
register([A.MENU_CHANGE_PRICE], E.MENU, L.CRITICAL, R.BUSINESS, ["price"]);
register([A.MENU_CHANGE_AVAILABILITY], E.MENU, L.OPERATIONAL, R.OPERATIONAL,
  ["available"]);
register([A.CUSTOMER_CREATE, A.CUSTOMER_UPDATE, A.CUSTOMER_DELETE], E.CUSTOMER,
  L.BUSINESS, R.BUSINESS, ["name", "phone", "email", "address"]);
register(
  [A.TABLE_CREATE, A.TABLE_UPDATE, A.TABLE_ALLOCATE, A.TABLE_FREE,
    A.TABLE_CHANGE_STATUS, A.TABLE_DELETE],
  E.TABLE, L.OPERATIONAL, R.OPERATIONAL,
  ["tableNumber", "capacity", "status", "assignedWaiter", "currentCustomer"],
);
register(
  [A.SYSTEM_SEED_START, A.SYSTEM_SEED_COMPLETE, A.SYSTEM_SEED_FAIL,
    A.SYSTEM_AUDIT_EXPORT, A.SYSTEM_CONFIG_CHANGE],
  E.SYSTEM, L.CRITICAL, R.SECURITY,
  ["state", "configuration", "affectedCount"],
);
register([A.SYSTEM_AUDIT_SEARCH], E.SYSTEM, L.TELEMETRY, R.TELEMETRY,
  ["state", "affectedCount"]);
register([A.SYSTEM_ARCHIVE, A.SYSTEM_RETENTION_PURGE], E.SYSTEM, L.OPERATIONAL,
  R.OPERATIONAL, ["state", "affectedCount"]);

if (definitions.size !== AUDIT_ACTION_VALUES.length) {
  throw new Error("Every audit action must have exactly one registered policy");
}

class AuditPolicyRegistry {
  constructor(policyDefinitions = definitions) {
    this.policies = new Map(policyDefinitions);
  }

  hasPolicy(action) {
    return this.policies.has(action);
  }

  getPolicy(action) {
    const policy = this.policies.get(action);
    if (!policy) throw new AuditValidationError(`Unknown audit action: ${action}`);
    return policy;
  }

  listActions() {
    return Object.freeze([...this.policies.keys()]);
  }
}

module.exports = AuditPolicyRegistry;
module.exports.defaultRegistry = new AuditPolicyRegistry();
