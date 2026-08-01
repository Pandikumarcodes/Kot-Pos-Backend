const orderRepository = require("../repositories/OrderRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const tableRepository = require("../repositories/TableRepository");
const billingRepository = require("../repositories/BillingRepository");
const AppError = require("../utils/AppError");
const { generateBillNumber } = require("./billingService");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");

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
  const activeFilter = { tableId, status: { $nin: ["cancelled", "served"] } };
  const existingBill = await billingRepository.findScoped(
    scopeToBranchMembers({ tableId, paymentStatus: "unpaid" }),
  );
  if (existingBill) {
    throw new AppError(
      "An unpaid bill already exists for this table. Please ask the cashier to collect payment first.",
      400,
    );
  }
  const phone = (customerPhone || "").replace(/\D/g, "");
  const validPhone = phone.length === 10 ? phone : "0000000000";
  const scopedActiveFilter = scopeToBranchMembers(activeFilter);
  const orders = await orderRepository.findMany(scopedActiveFilter);
  if (!orders.length)
    throw new AppError("No active orders found for this table", 400);
  const allItems = orders.flatMap((order) => order.items);
  const bill = await billingRepository.createBill({
    billNumber: await generateBillNumber(),
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
  });
  await orderRepository.updateManyStatus(scopedActiveFilter, "served");
  await tableRepository.updateState(tableId, { status: "billing" });
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
  const existing = await orderRepository.findOne(filter);
  if (!existing) throw new AppError("Order not found", 404);
  if (existing.status === "sent_to_kitchen") {
    throw new AppError("Order has already been sent to kitchen", 409);
  }
  const order = await orderRepository.updateStatus(filter, "sent_to_kitchen");
  const table = await tableRepository.findById(order.tableId);
  const kot = await kitchenRepository.createOrder({
    branchId,
    orderType: "dine-in",
    tableNumber: table?.tableNumber || order.tableNumber,
    tableId: order.tableId,
    customerName: order.customerName,
    createdBy: order.createdBy,
    items: order.items,
    totalAmount: order.totalAmount,
    status: "pending",
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
