const Billing = require("../models/billings");
const MenuItem = require("../models/menuItems");
const Table = require("../models/tables");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const generateBillNumber = async () => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await Billing.countDocuments({ createdAt: { $gte: todayStart } });
  return `BILL-${today}-${(todayCount + 1).toString().padStart(3, "0")}`;
};

const createBill = async (input, { userId, branchId, io }) => {
  const { customerName, customerPhone, items, paymentStatus, paymentMethod } = input;
  const detailedItems = [];
  for (const item of items) {
    const menuItem = await MenuItem.findById(item.itemId);
    if (!menuItem) throw new AppError(`Menu item not found for ID: ${item.itemId}`, 404);
    detailedItems.push({
      itemId: menuItem._id,
      name: menuItem.ItemName,
      quantity: item.quantity,
      price: menuItem.price,
      total: menuItem.price * item.quantity,
    });
  }
  const bill = new Billing({
    billNumber: await generateBillNumber(),
    customerName,
    customerPhone,
    items: detailedItems,
    totalAmount: detailedItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    paymentStatus,
    paymentMethod,
    createdBy: userId,
  });
  await bill.save();
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const listBills = async ({ status, search, scopeToBranchMembers }) => {
  const filter = {};
  if (status) filter.paymentStatus = status;
  if (search) {
    filter.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
      { billNumber: { $regex: search, $options: "i" } },
    ];
  }
  const bills = await Billing.find(scopeToBranchMembers(filter))
    .populate("createdBy", "username role")
    .sort({ createdAt: -1 });
  if (!bills.length) throw new AppError("No Bills found", 404);
  return bills;
};

const getBill = async (billId, scopeToBranchMembers) => {
  const bill = await Billing.findOne(scopeToBranchMembers({ _id: billId }))
    .populate("createdBy", "username role");
  if (!bill) throw new AppError("Bill not found", 404);
  return bill;
};

const payBill = async (billId, paymentMethod, { scopeToBranchMembers, branchId, io }) => {
  const bill = await Billing.findOne(scopeToBranchMembers({ _id: billId }));
  if (!bill) throw new AppError("Bill not found", 404);
  if (bill.paymentStatus === "paid") throw new AppError("Bill is already paid", 400);
  bill.paymentStatus = "paid";
  bill.paidAt = new Date();
  if (paymentMethod) bill.paymentMethod = paymentMethod;
  await bill.save();
  if (bill.tableId) {
    await Table.findByIdAndUpdate(bill.tableId, { status: "available", currentCustomer: null });
  }
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const deleteBill = async (billId, scopeToBranchMembers) => {
  const bill = await Billing.findOneAndDelete(scopeToBranchMembers({ _id: billId }));
  if (!bill) throw new AppError("Bill not found", 404);
  return { id: bill._id, customerName: bill.customerName, totalAmount: bill.totalAmount, billNumber: bill.billNumber };
};

module.exports = { generateBillNumber, createBill, listBills, getBill, payBill, deleteBill };
