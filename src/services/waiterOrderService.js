const TableOrder = require("../models/waiter");
const MenuItem = require("../models/menuItems");
const Kot = require("../models/kot");
const Table = require("../models/tables");
const Billing = require("../models/billings");
const AppError = require("../utils/AppError");
const { generateBillNumber } = require("./billingService");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");

const getTableOrders = async (tableId, scopeToBranchMembers) => {
  const orders = await TableOrder.find(scopeToBranchMembers({
    tableId,
    status: { $nin: ["cancelled", "served"] },
  })).populate("createdBy", "username").sort({ createdAt: 1 });
  const allItems = orders.flatMap((order, index) => order.items.map((item) => ({
    ...item.toObject(),
    orderId: order._id,
    round: index + 1,
    status: order.status,
  })));
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
  const existingBill = await Billing.findOne(scopeToBranchMembers({ tableId, paymentStatus: "unpaid" }));
  if (existingBill) {
    throw new AppError("An unpaid bill already exists for this table. Please ask the cashier to collect payment first.", 400);
  }
  const phone = (customerPhone || "").replace(/\D/g, "");
  const validPhone = phone.length === 10 ? phone : "0000000000";
  const orders = await TableOrder.find(scopeToBranchMembers(activeFilter));
  if (!orders.length) throw new AppError("No active orders found for this table", 400);
  const allItems = orders.flatMap((order) => order.items);
  const bill = await Billing.create({
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
  await TableOrder.updateMany(scopeToBranchMembers(activeFilter), { status: "served" });
  await Table.findByIdAndUpdate(tableId, { status: "billing" });
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const createOrder = async (input, { branchId, userId }) => {
  const { tableNumber, customerName, tableId, items } = input;
  const menuItems = await MenuItem.find({ _id: { $in: items.map((item) => item.itemId) } });
  if (menuItems.length !== items.length) throw new AppError("Some menu items not found", 400);
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find((entry) => entry._id.toString() === item.itemId);
    return { itemId: menuItem._id, name: menuItem.ItemName, quantity: item.quantity, price: menuItem.price };
  });
  const order = new TableOrder({
    tableNumber,
    customerName: customerName || "Walk-in",
    tableId,
    createdBy: userId,
    items: orderItems,
    totalAmount: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
  });
  await order.save();
  if (branchId) {
    deductStockForKot(order.items, branchId, order._id, userId)
      .catch((err) => console.error("Stock deduction failed:", err.message));
  }
  return order;
};

const listOrders = (branchMemberFilter) =>
  TableOrder.find(branchMemberFilter).populate("createdBy", "username").sort({ createdAt: -1 });

const getOrder = async (orderId, scopeToBranchMembers) => {
  const order = await TableOrder.findOne(scopeToBranchMembers({ _id: orderId }))
    .populate("createdBy", "username")
    .populate("items.itemId", "ItemName price");
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const sendToKitchen = async (orderId, { scopeToBranchMembers, branchId, io }) => {
  const existing = await TableOrder.findOne(scopeToBranchMembers({ _id: orderId }));
  if (!existing) throw new AppError("Order not found", 404);
  if (existing.status === "sent_to_kitchen") {
    throw new AppError("Order has already been sent to kitchen", 409);
  }
  const order = await TableOrder.findOneAndUpdate(
    scopeToBranchMembers({ _id: orderId }),
    { status: "sent_to_kitchen" },
    { new: true },
  );
  const table = await Table.findById(order.tableId);
  const kot = await Kot.create({
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
  const order = await TableOrder.findOneAndUpdate(
    scopeToBranchMembers({ _id: orderId }),
    { status },
    { new: true },
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

module.exports = { getTableOrders, sendToCashier, createOrder, listOrders, getOrder, sendToKitchen, updateStatus };
