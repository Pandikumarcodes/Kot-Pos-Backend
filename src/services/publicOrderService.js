const tableRepository = require("../repositories/TableRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const settingsRepository = require("../repositories/SettingsRepository");
const AppError = require("../utils/AppError");
const { cache, cacheKeys } = require("../infrastructure/cache");

const getQrMenu = async (tableId) => {
  const table = await tableRepository.findPublicByIdLean(tableId);
  if (!table) throw new AppError("Table not found", 404);
  const menuItems = await cache.getOrSet(
    cacheKeys.availableMenu({ branchId: table.branchId }),
    () => menuRepository.listAvailableLean(),
    { ttlSeconds: 120 },
  );
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
  const settings = await cache.getOrSet(
    cacheKeys.settings({ branchId: table.branchId }),
    async () => (await settingsRepository.findScopedLean({ branchId: table.branchId ?? null }))
      ?? (await settingsRepository.findScopedLean({ branchId: null })),
    { ttlSeconds: 600 },
  );
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

const placePublicOrder = async (
  tableId,
  { customerName, customerPhone, items },
) => {
  const table = await tableRepository.findPublicByIdLean(tableId);
  if (!table) throw new AppError("Table not found", 404);
  const branchId = table.branchId;
  if (!branchId) {
    throw new AppError(
      "Branch configuration missing. Please ask a staff member for help.",
      400,
    );
  }
  const menuItems = await menuRepository.findByIds(
    items.map((item) => item.itemId),
    { availableOnly: true, lean: true },
  );
  if (menuItems.length !== items.length)
    throw new AppError("Some items are unavailable", 400);
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
  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const kot = await kitchenRepository.createOrder({
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
    await tableRepository.updateStateInScope(
      { type: "branch", isGlobal: false, branchId },
      table._id,
      { status: "occupied" },
    );
  }
  return { orderId: kot._id, totalAmount };
};

const getPublicOrderStatus = async (orderId) => {
  const kot = await kitchenRepository.findPublicStatus(orderId);
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
