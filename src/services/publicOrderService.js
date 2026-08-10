const tableRepository = require("../repositories/TableRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const settingsRepository = require("../repositories/SettingsRepository");
const Branch = require("../models/Branch");
const AppError = require("../utils/AppError");
const { cache, cacheKeys } = require("../infrastructure/cache");
const { notify } = require("./notificationservices");

const findBranchStatus = async (branchId) => {
  const query = Branch.findById(branchId);
  return query?.select ? query.select("isActive").lean() : query;
};

const assertPublicOrderingBranchActive = async (branchId) => {
  const branch = await findBranchStatus(branchId);
  if (!branch || branch.isActive !== true) {
    throw new AppError("Branch is inactive", 403);
  }
};

const getQrMenu = async (tableId) => {
  const table = await tableRepository.findByIdLean(tableId);
  if (!table) throw new AppError("Table not found", 404);
  if (!table.branchId) {
    throw new AppError(
      "Branch configuration missing. Please ask a staff member for help.",
      400,
    );
  }
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
  { io } = {},
) => {
  const table = await tableRepository.findByIdLean(tableId);
  if (!table) throw new AppError("Table not found", 404);
  const branchId = table.branchId ?? null;
  if (!branchId) {
    throw new AppError(
      "Branch configuration missing. Please ask a staff member for help.",
      400,
    );
  }
  await assertPublicOrderingBranchActive(branchId);
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
    const updatedTable = await tableRepository.updateByIdAndBranch(
      table._id,
      branchId,
      { status: "occupied" },
      { new: true },
    );
    if (!updatedTable) throw new AppError("Table not found", 404);
    notify.tableUpdated(io, updatedTable);
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
