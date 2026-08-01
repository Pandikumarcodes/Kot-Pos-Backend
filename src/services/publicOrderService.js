const Table = require("../models/tables");
const MenuItem = require("../models/menuItems");
const Kot = require("../models/kot");
const Settings = require("../models/settings");
const Branch = require("../models/Branch");
const AppError = require("../utils/AppError");

const getQrMenu = async (tableId) => {
  const table = await Table.findById(tableId).lean();
  if (!table) throw new AppError("Table not found", 404);
  const menuItems = await MenuItem.find({ available: true }).lean();
  const menu = menuItems.reduce((groups, item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push({
      _id: item._id,
      ItemName: item.ItemName,
      price: item.price,
      category: item.category,
    });
    return groups;
  }, {});
  const settings = (await Settings.findOne({ branchId: table.branchId ?? null }).lean())
    ?? (await Settings.findOne({ branchId: null }).lean());
  return {
    table: {
      _id: table._id,
      tableNumber: table.tableNumber,
      capacity: table.capacity,
      status: table.status,
      branchId: table.branchId ?? null,
    },
    restaurant: {
      name: settings?.businessName ?? "KOT POS Restaurant",
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
    },
    menu,
    categories: Object.keys(menu),
  };
};

const placePublicOrder = async (tableId, { customerName, customerPhone, items }) => {
  const table = await Table.findById(tableId).lean();
  if (!table) throw new AppError("Table not found", 404);
  let branchId = table.branchId ?? null;
  if (!branchId) {
    const branch = await Branch.findOne({ isActive: true }).lean();
    if (branch) {
      branchId = branch._id;
      await Table.findByIdAndUpdate(table._id, { branchId: branch._id });
    }
  }
  if (!branchId) {
    throw new AppError("Branch configuration missing. Please ask a staff member for help.", 400);
  }
  const menuItems = await MenuItem.find({
    _id: { $in: items.map((item) => item.itemId) },
    available: true,
  }).lean();
  if (menuItems.length !== items.length) throw new AppError("Some items are unavailable", 400);
  const orderItems = items.map((item) => {
    const menuItem = menuItems.find((entry) => entry._id.toString() === item.itemId);
    return { itemId: menuItem._id, name: menuItem.ItemName, quantity: item.quantity, price: menuItem.price };
  });
  const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const kot = await Kot.create({
    branchId,
    orderType: "dine-in",
    tableNumber: table.tableNumber,
    tableId: table._id,
    customerName: customerName || "Guest",
    customerPhone: customerPhone || "",
    createdBy: null,
    items: orderItems,
    totalAmount,
    status: "pending",
  });
  if (table.status === "available") {
    await Table.findByIdAndUpdate(table._id, { status: "occupied" });
  }
  return { orderId: kot._id, totalAmount };
};

const getPublicOrderStatus = async (orderId) => {
  const kot = await Kot.findById(orderId).select("status totalAmount items createdAt").lean();
  if (!kot) throw new AppError("Order not found", 404);
  const statusMessages = {
    pending: "Your order has been received! Kitchen is preparing...",
    preparing: "Kitchen is preparing your order 🍳",
    ready: "Your order is ready! Waiter will serve you shortly 🎉",
    served: "Enjoy your meal! 😊",
    cancelled: "Your order was cancelled. Please ask a waiter for help.",
  };
  return {
    status: kot.status,
    message: statusMessages[kot.status] ?? "Processing...",
    items: kot.items,
    total: kot.totalAmount,
    orderedAt: kot.createdAt,
  };
};

module.exports = { getQrMenu, placePublicOrder, getPublicOrderStatus };
