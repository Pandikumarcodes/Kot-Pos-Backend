const kitchenRepository = require("../repositories/KitchenRepository");
const AppError = require("../utils/AppError");
const { assertBranchScope, branchConstraint } = require("../utils/accessScope");
const { notify } = require("./notificationservices");
const userRepository = require("../repositories/UserRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const orderAudit = require("../modules/orders/OrderAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const {
  buildOperationalPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./operationalQuery");

const ACTIVE_KITCHEN_STATUSES = Object.freeze(["pending", "preparing", "ready"]);
const ALLOWED_TRANSITIONS = Object.freeze({
  preparing: ["pending"],
  ready: ["preparing"],
  served: ["ready"],
  cancelled: ["pending", "preparing"],
});
const KITCHEN_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [],
  filters: {
    status: {
      field: "status", type: "enum", values: ACTIVE_KITCHEN_STATUSES,
    },
  },
  mandatoryFilter: { status: { $in: ACTIVE_KITCHEN_STATUSES } },
  sorting: {
    fields: { createdAt: "createdAt", status: "status" },
    defaultField: "createdAt",
    defaultOrder: "asc",
  },
  fieldSelection: {
    fields: {
      id: "_id", branchId: "branchId", orderType: "orderType",
      tableNumber: "tableNumber", tableId: "tableId", customerName: "customerName",
      customerPhone: "customerPhone", createdBy: "createdBy", items: "items",
      totalAmount: "totalAmount", status: "status", createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "branchId", "orderType", "tableNumber", "tableId", "customerName",
      "customerPhone", "createdBy", "items", "totalAmount", "status",
      "createdAt", "updatedAt",
    ],
  },
});

const transactionManager = new TransactionManager();

const listActiveOrders = async (scope, query = {}) => {
  assertBranchScope(scope);
  const activeFilter = { ...branchConstraint(scope), status: { $in: ACTIVE_KITCHEN_STATUSES } };
  if (!hasQueryControls(query)) {
    return { items: await kitchenRepository.listScoped({ scope, filter: { status: activeFilter.status } }) };
  }
  const paginated = usesPagination(query);
  const plan = buildOperationalPlan({
    query,
    policy: KITCHEN_QUERY_POLICY,
    trustedConstraints: [branchConstraint(scope)],
  });
  const dataPromise = kitchenRepository.listScoped({ scope, filter: plan.filter, options: repositoryOptions(plan, paginated) });
  const [items, total] = paginated
    ? await Promise.all([dataPromise, kitchenRepository.countScoped({ scope, filter: plan.filter })])
    : [await dataPromise, null];
  return {
    items,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const getOrder = async (orderId, scope) => {
  assertBranchScope(scope);
  const order = await kitchenRepository.findByScope(scope, { _id: orderId });
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const updateOrderStatus = async (
  orderId,
  status,
  scope,
  io,
  { userId = null, actorRole = null, correlationId = null } = {},
) => {
  assertBranchScope(scope);
  const filter = { _id: orderId };
  const action = orderAudit.kitchenAction(status);
  if (!action) {
    const existing = await kitchenRepository.findByScope(scope, filter);
    if (!existing) throw new AppError("Order not found", 404);
    const expectedStatuses = ALLOWED_TRANSITIONS[status] || [];
    if (!expectedStatuses.includes(existing.status)) {
      throw new AppError(`Cannot change order from ${existing.status} to ${status}`, 409);
    }
    const unchangedWorkflowOrder = await kitchenRepository.updateStatusByScope(
      scope, { ...filter, status: existing.status }, status,
    );
    if (!unchangedWorkflowOrder) throw new AppError("Order status changed; refresh and try again", 409);
    notify.kotUpdated(io, unchangedWorkflowOrder);
    return unchangedWorkflowOrder;
  }

  let auditContext = orderAudit.createContext({
    actorId: userId,
    actorRole,
    branchId: scope.branchId,
    correlationId,
  });
  let order;
  try {
    order = await transactionManager.execute(async (session) => {
      const existing = await kitchenRepository.findByScope(scope, filter, { session });
      if (!existing) throw new AppError("Order not found", 404);

      const actorId = userId || existing.createdBy;
      const actor = actorRole || !actorId
        ? null
        : await userRepository.findByIdWithSelection(actorId, "role", { session });
      auditContext = orderAudit.createContext({
        actorId,
        actorRole: actorRole || actor?.role || null,
        branchId: scope.branchId,
        correlationId: auditContext.correlationId,
      });
      const previousStatus = existing.status;
      const expectedStatuses = ALLOWED_TRANSITIONS[status] || [];
      if (!expectedStatuses.includes(previousStatus)) {
        throw new AppError(`Cannot change order from ${previousStatus} to ${status}`, 409);
      }

      const updated = await kitchenRepository.updateStatusByScope(
        scope,
        { ...filter, status: previousStatus },
        status,
        { session },
      );
      if (!updated) throw new AppError("Order status changed; refresh and try again", 409);
      await orderAudit.kitchenStatusChanged(
        {
          context: auditContext,
          kot: updated,
          previousStatus,
          newStatus: status,
        },
        { session },
      );
      return updated;
    });
  } catch (error) {
    try {
      await orderAudit.failure({
        action,
        context: auditContext,
        entityId: orderId,
        error,
      });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the workflow error.
    }
    throw error;
  }
  notify.kotUpdated(io, order);
  return order;
};

module.exports = { listActiveOrders, getOrder, updateOrderStatus };
