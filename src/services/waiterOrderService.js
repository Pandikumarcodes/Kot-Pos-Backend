const orderRepository = require("../repositories/OrderRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const tableRepository = require("../repositories/TableRepository");
const billingRepository = require("../repositories/BillingRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { generateBillNumber } = require("./billingService");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");

const transactionManager = new TransactionManager();

const getTableOrders = async (tableId, scopeToBranchMembers) => {
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
  const { scopeToBranchMembers, branchId, userId, io } = context;
  const bill = await transactionManager.execute(async (session) => {
    const table = await tableRepository.findById(tableId, undefined, {
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
    await orderRepository.updateManyStatus(
      scopedActiveFilter,
      "served",
      { session },
    );
    await tableRepository.updateState(
      tableId,
      { status: "billing" },
      { session },
    );
    return createdBill;
  });
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const createOrder = async (input, { branchId, userId }) => {
  const { tableNumber, customerName, tableId, items } = input;
  const menuItems = await menuRepository.findByIds(
    items.map((item) => item.itemId),
  );
  if (menuItems.length !== items.length)
    throw new AppError("Some menu items not found", 400);
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find(
      (entry) => entry._id.toString() === item.itemId,
    );
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

const listOrders = (branchMemberFilter) =>
  orderRepository.listScoped(branchMemberFilter);

const getOrder = async (orderId, scopeToBranchMembers) => {
  const order = await orderRepository.findScopedWithDetails(
    scopeToBranchMembers({ _id: orderId }),
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const sendToKitchen = async (
  orderId,
  { scopeToBranchMembers, branchId, io },
) => {
  const filter = scopeToBranchMembers({ _id: orderId });
  const { order, kot } = await transactionManager.execute(async (session) => {
    const existing = await orderRepository.findOne(filter, undefined, {
      session,
    });
    if (!existing) throw new AppError("Order not found", 404);

    const table = await tableRepository.findById(
      existing.tableId,
      undefined,
      { session },
    );
    if (!table) throw new AppError("Table not found", 404);

    if (existing.status === "sent_to_kitchen") {
      throw new AppError("Order has already been sent to kitchen", 409);
    }

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

    return { order: updatedOrder, kot: createdKot };
  });

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
