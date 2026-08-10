const orderRepository = require("../repositories/OrderRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const tableRepository = require("../repositories/TableRepository");
const billingRepository = require("../repositories/BillingRepository");
const userRepository = require("../repositories/UserRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { generateBillNumber } = require("./billingService");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");
const billingAudit = require("../modules/billing/BillingAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const orderAudit = require("../modules/orders/OrderAuditLogger");
const {
  buildOperationalPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./operationalQuery");

const ORDER_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [],
  filters: {
    status: {
      field: "status",
      type: "enum",
      values: ["pending", "sent_to_kitchen", "served", "cancelled"],
    },
  },
  sorting: {
    fields: { createdAt: "createdAt", status: "status" },
    defaultField: "createdAt",
    defaultOrder: "desc",
  },
  fieldSelection: {
    fields: {
      id: "_id", tableNumber: "tableNumber", customerName: "customerName",
      tableId: "tableId", createdBy: "createdBy", items: "items",
      totalAmount: "totalAmount", status: "status", createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "tableNumber", "customerName", "tableId", "createdBy", "items",
      "totalAmount", "status", "createdAt", "updatedAt",
    ],
  },
});

const transactionManager = new TransactionManager();

const getTableOrders = async (tableId, branchId, scopeToBranchMembers) => {
  const table = await tableRepository.findByIdAndBranch(tableId, branchId);
  if (!table) throw new AppError("Table not found", 404);
  const orders = await orderRepository.listTableActive(
    scopeToBranchMembers({
      tableId,
      status: { $nin: ["cancelled", "served"] },
    }),
  );
  const allItems = orders.flatMap((order, index) =>
    order.items.map((item) => ({
      ...item.toObject(),
      orderId: order._id,
      round: index + 1,
      status: order.status,
    })),
  );
  return {
    orders,
    allItems,
    grandTotal: orders.reduce((sum, order) => sum + order.totalAmount, 0),
  };
};

const sendToCashier = async (tableId, input, context) => {
  const { customerName, customerPhone, tableNumber } = input;
  const {
    scopeToBranchMembers,
    branchId,
    userId,
    actorRole = null,
    correlationId,
    io,
  } = context;
  const actor = actorRole
    ? null
    : await userRepository.findByIdWithSelection(userId, "role");
  const auditContext = billingAudit.createContext({
    actorId: userId,
    actorRole: actorRole || actor?.role || null,
    branchId,
    correlationId,
  });
  let createdBillId = null;
  let result;
  try {
    result = await transactionManager.execute(async (session) => {
    const table = await tableRepository.findByIdAndBranch(tableId, branchId, {
      session,
    });
    if (!table) throw new AppError("Table not found", 404);

    const activeFilter = {
      tableId,
      status: { $nin: ["cancelled", "served"] },
    };
    const scopedActiveFilter = scopeToBranchMembers(activeFilter);
    const orders = await orderRepository.findMany(
      scopedActiveFilter,
      undefined,
      { session },
    );
    if (!orders.length)
      throw new AppError("No active orders found for this table", 400);

    const existingBill = await billingRepository.findScoped(
      scopeToBranchMembers({ tableId, paymentStatus: "unpaid" }),
      { session },
    );
    if (existingBill) {
      throw new AppError(
        "An unpaid bill already exists for this table. Please ask the cashier to collect payment first.",
        400,
      );
    }

    const orderStatusBefore =
      new Set(orders.map((order) => order.status)).size === 1
        ? orders[0].status
        : "active";

    const phone = (customerPhone || "").replace(/\D/g, "");
    const validPhone = phone.length === 10 ? phone : "0000000000";
    const allItems = orders.flatMap((order) => order.items);
    const createdBill = await billingRepository.createBill(
      {
        billNumber: await generateBillNumber({ session }),
        customerName: customerName || "Walk-in",
        customerPhone: validPhone,
        items: allItems.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
        totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
        paymentStatus: "unpaid",
        paymentMethod: "none",
        tableId,
        tableNumber: tableNumber || null,
        createdBy: userId,
      },
      { session },
    );
    createdBillId = createdBill._id;
    await orderRepository.updateManyStatus(
      scopedActiveFilter,
      "served",
      { session },
    );
    const updatedTable = await tableRepository.updateByIdAndBranch(
      tableId,
      branchId,
      { status: "billing" },
      { session, new: true },
    );
    if (!updatedTable) throw new AppError("Table not found", 404);
    await billingAudit.billCreated(
      {
        context: auditContext,
        bill: createdBill,
        tableId,
        orderIds: orders.map((order) => order._id),
        orderStatusBefore,
        tableStatusBefore: table.status,
      },
      { session },
    );
    return { bill: createdBill, table: updatedTable };
    });
  } catch (error) {
    try {
      await billingAudit.failure({
        action: AUDIT_ACTIONS.BILLING_CREATE,
        context: auditContext,
        entityId: createdBillId || `table:${tableId}`,
        tableId,
        error,
      });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the workflow error.
    }
    throw error;
  }
  const { bill, table } = result;
  notify.tableUpdated(io, table);
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const createOrder = async (input, { branchId, userId }) => {
  const { tableNumber, customerName, tableId, items } = input;
  const table = await tableRepository.findByIdAndBranch(tableId, branchId);
  if (!table) throw new AppError("Table not found", 404);
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
  const order = await orderRepository.createOrderDocument({
    tableNumber,
    customerName: customerName || "Walk-in",
    tableId,
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

const listOrders = async (branchMemberFilter, query = {}) => {
  if (!hasQueryControls(query)) {
    return { items: await orderRepository.listScoped(branchMemberFilter) };
  }
  const paginated = usesPagination(query);
  const plan = buildOperationalPlan({
    query,
    policy: ORDER_QUERY_POLICY,
    trustedConstraints: [branchMemberFilter],
  });
  const dataPromise = orderRepository.listScoped(
    plan.filter,
    repositoryOptions(plan, paginated),
  );
  const [items, total] = paginated
    ? await Promise.all([dataPromise, orderRepository.countScoped(plan.filter)])
    : [await dataPromise, null];
  return {
    items,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const getOrder = async (orderId, scopeToBranchMembers) => {
  const order = await orderRepository.findScopedWithDetails(
    scopeToBranchMembers({ _id: orderId }),
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const sendToKitchen = async (
  orderId,
  {
    scopeToBranchMembers,
    branchId,
    userId = null,
    actorRole = null,
    correlationId = null,
    io,
  },
) => {
  const filter = scopeToBranchMembers({ _id: orderId });
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
    const existing = await orderRepository.findOne(filter, undefined, {
      session,
    });
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

    const table = await tableRepository.findByIdAndBranch(
      existing.tableId,
      branchId,
      { session },
    );
    if (!table) throw new AppError("Table not found", 404);

    if (existing.status === "sent_to_kitchen") {
      throw new AppError("Order has already been sent to kitchen", 409);
    }
    const previousStatus = existing.status;

    const updatedOrder = await orderRepository.updateStatus(
      filter,
      "sent_to_kitchen",
      { session },
    );
    if (!updatedOrder) throw new AppError("Order not found", 404);

    const createdKot = await kitchenRepository.createOrder(
      {
        branchId,
        orderType: "dine-in",
        tableNumber: table.tableNumber || updatedOrder.tableNumber,
        tableId: updatedOrder.tableId,
        customerName: updatedOrder.customerName,
        createdBy: updatedOrder.createdBy,
        items: updatedOrder.items,
        totalAmount: updatedOrder.totalAmount,
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
        orderType: "dine-in",
        tableId: updatedOrder.tableId,
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

const updateStatus = async (orderId, status, scopeToBranchMembers) => {
  const order = await orderRepository.updateStatus(
    scopeToBranchMembers({ _id: orderId }),
    status,
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

module.exports = {
  getTableOrders,
  sendToCashier,
  createOrder,
  listOrders,
  getOrder,
  sendToKitchen,
  updateStatus,
};
