const takeawayOrderRepository = require("../repositories/TakeawayOrderRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { assertBranchScope } = require("../utils/accessScope");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");
const userRepository = require("../repositories/UserRepository");
const orderAudit = require("../modules/orders/OrderAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const {
  buildOperationalPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./operationalQuery");

const TAKEAWAY_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [],
  filters: {
    status: {
      field: "status",
      type: "enum",
      values: ["pending", "sent_to_kitchen", "received", "cancelled"],
    },
  },
  sorting: {
    fields: { createdAt: "createdAt", status: "status" },
    defaultField: "createdAt",
    defaultOrder: "desc",
  },
  fieldSelection: {
    fields: {
      id: "_id", customerName: "customerName", customerPhone: "customerPhone",
      items: "items", status: "status", createdBy: "createdBy", branchId: "branchId",
      createdAt: "createdAt", updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "customerName", "customerPhone", "items", "status", "createdBy", "branchId",
      "createdAt", "updatedAt",
    ],
  },
});

const transactionManager = new TransactionManager();
const scopeForContext = (scope, branchId) =>
  scope || (branchId ? { type: "branch", isGlobal: false, branchId } : scope);

const createTakeawayOrder = async (input, { scope, userId }) => {
  const branchId = assertBranchScope(scope).branchId;
  const { customerName, customerPhone, items } = input;
  const menuItems = await menuRepository.findByIds(
    items.map((item) => item.itemId),
  );
  if (menuItems.length !== items.length)
    throw new AppError("Some menu items not found", 400);
  const menuItemsById = new Map(
    menuItems.map((menuItem) => [menuItem._id.toString(), menuItem]),
  );
  const orderItems = items.map((item) => {
    const menuItem = menuItemsById.get(item.itemId);
    return {
      itemId: menuItem._id,
      name: menuItem.ItemName,
      quantity: item.quantity,
      price: menuItem.price,
    };
  });
  const order = await takeawayOrderRepository.createOrderDocument({
    branchId,
    customerName,
    customerPhone,
    createdBy: userId,
    items: orderItems,
    totalAmount: orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ),
  });
  if (branchId) {
    deductStockForKot(order.items, branchId, order._id, userId).catch((err) =>
      console.error("Stock deduction failed:", err.message),
    );
  }
  return order;
};

const listTakeawayOrders = async ({ scope }, query = {}) => {
  assertBranchScope(scope);
  if (!hasQueryControls(query)) {
    return { items: await takeawayOrderRepository.listScopedByAccess({ scope }) };
  }
  const paginated = usesPagination(query);
  const plan = buildOperationalPlan({
    query,
    policy: TAKEAWAY_QUERY_POLICY,
    trustedConstraints: [{ branchId: scope.branchId }],
  });
  const dataPromise = takeawayOrderRepository.listScopedByAccess({ scope, filter: plan.filter, options: repositoryOptions(plan, paginated) });
  const [items, total] = paginated
    ? await Promise.all([dataPromise, takeawayOrderRepository.countScopedByAccess({ scope, filter: plan.filter })])
    : [await dataPromise, null];
  return {
    items,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const getTakeawayOrder = async (orderId, { scope }) => {
  const order = await takeawayOrderRepository.findByAccess(scope, null, { _id: orderId });
  if (!order) throw new AppError("This order Id not found", 404);
  return order;
};

const sendToKitchen = async (
  orderId,
  {
    scope,
    branchId: contextBranchId,
    userId = null,
    actorRole = null,
    correlationId = null,
    io,
  },
) => {
  const effectiveScope = scopeForContext(scope, contextBranchId);
  const branchId = assertBranchScope(effectiveScope).branchId;
  assertBranchScope(effectiveScope);
  const filter = { _id: orderId };
  let auditContext = orderAudit.createContext({
    actorId: userId,
    actorRole,
    branchId,
    correlationId,
  });
  let kotId = null;
  let result;
  try {
    result = await transactionManager.execute(async (session) => {
    const existing = typeof takeawayOrderRepository.findByAccess === "function"
      ? await takeawayOrderRepository.findByAccess(effectiveScope, null, filter, { session })
      : await takeawayOrderRepository.findOne({ branchId, ...filter }, undefined, { session });
    if (!existing) throw new AppError("Order not found", 404);

    const actorId = userId || existing.createdBy;
    const actor = actorRole
      ? null
      : await userRepository.findByIdWithSelection(actorId, "role", { session });
    auditContext = orderAudit.createContext({
      actorId,
      actorRole: actorRole || actor?.role || null,
      branchId,
      correlationId: auditContext.correlationId,
    });
    if (existing.status === "sent_to_kitchen") {
      throw new AppError("Order has already been sent to kitchen", 409);
    }
    const previousStatus = existing.status;

    const updatedOrder = typeof takeawayOrderRepository.updateStatusByAccess === "function"
      ? await takeawayOrderRepository.updateStatusByAccess(effectiveScope, null, filter, "sent_to_kitchen", { session })
      : await takeawayOrderRepository.updateStatus({ branchId, ...filter }, "sent_to_kitchen", { session });
    if (!updatedOrder) throw new AppError("Order not found", 404);

    const createdKot = await kitchenRepository.createOrder(
      {
        branchId,
        orderType: "takeaway",
        customerName: updatedOrder.customerName,
        customerPhone: updatedOrder.customerPhone,
        createdBy: updatedOrder.createdBy,
        items: updatedOrder.items,
        totalAmount: updatedOrder.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ),
        status: "pending",
      },
      { session },
    );

    kotId = createdKot._id;
    await orderAudit.sentToKitchen(
      {
        context: auditContext,
        order: updatedOrder,
        kot: createdKot,
        previousStatus,
        orderType: "takeaway",
      },
      { session },
    );

    return { order: updatedOrder, kot: createdKot };
    });
  } catch (error) {
    try {
      await orderAudit.failure({
        action: AUDIT_ACTIONS.ORDER_SEND_TO_KITCHEN,
        context: auditContext,
        entityId: orderId,
        error,
        parentEntityId: kotId,
      });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the workflow error.
    }
    throw error;
  }

  const { order, kot } = result;
  notify.newOrder(io, kot);
  return order;
};

const updateStatus = async (orderId, status, { scope, branchId }) => {
  const effectiveScope = scopeForContext(scope, branchId);
  const order = typeof takeawayOrderRepository.updateStatusByAccess === "function"
    ? await takeawayOrderRepository.updateStatusByAccess(effectiveScope, null, { _id: orderId }, status)
    : await takeawayOrderRepository.updateStatus({ branchId, _id: orderId }, status);
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

module.exports = {
  createTakeawayOrder,
  listTakeawayOrders,
  getTakeawayOrder,
  sendToKitchen,
  updateStatus,
};
