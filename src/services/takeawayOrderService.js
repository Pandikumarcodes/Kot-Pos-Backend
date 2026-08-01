const takeawayOrderRepository = require("../repositories/TakeawayOrderRepository");
const menuRepository = require("../repositories/MenuRepository");
const kitchenRepository = require("../repositories/KitchenRepository");
const AppError = require("../utils/AppError");
const { deductStockForKot } = require("./inventoryService");
const { notify } = require("./notificationservices");

const createTakeawayOrder = async (input, { userId, branchId }) => {
  const { customerName, customerPhone, items } = input;
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
  const order = await takeawayOrderRepository.createOrderDocument({
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

const listTakeawayOrders = (branchMemberFilter) =>
  takeawayOrderRepository.listScoped(branchMemberFilter);

const getTakeawayOrder = async (orderId, scopeToBranchMembers) => {
  const order = await takeawayOrderRepository.findScopedWithDetails(
    scopeToBranchMembers({ _id: orderId }),
  );
  if (!order) throw new AppError("This order Id not found", 404);
  return order;
};

const sendToKitchen = async (
  orderId,
  { scopeToBranchMembers, branchId, io },
) => {
  const filter = scopeToBranchMembers({ _id: orderId });
  const existing = await takeawayOrderRepository.findOne(filter);
  if (!existing) throw new AppError("Order not found", 404);
  if (existing.status === "sent_to_kitchen") {
    throw new AppError("Order has already been sent to kitchen", 409);
  }
  const order = await takeawayOrderRepository.updateStatus(
    filter,
    "sent_to_kitchen",
  );
  const kot = await kitchenRepository.createOrder({
    branchId,
    orderType: "takeaway",
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    createdBy: order.createdBy,
    items: order.items,
    totalAmount: order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ),
    status: "pending",
  });
  notify.newOrder(io, kot);
  return order;
};

const updateStatus = async (orderId, status, scopeToBranchMembers) => {
  const order = await takeawayOrderRepository.updateStatus(
    scopeToBranchMembers({ _id: orderId }),
    status,
  );
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
