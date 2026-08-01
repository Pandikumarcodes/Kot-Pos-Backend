const billingRepository = require("../repositories/BillingRepository");
const menuRepository = require("../repositories/MenuRepository");
const tableRepository = require("../repositories/TableRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");

const transactionManager = new TransactionManager();

const generateBillNumber = async (options = {}) => {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = await billingRepository.countCreatedSince(
    todayStart,
    options,
  );
  return `BILL-${today}-${(todayCount + 1).toString().padStart(3, "0")}`;
};

const createBill = async (input, { userId, branchId, io }) => {
  const { customerName, customerPhone, items, paymentStatus, paymentMethod } =
    input;
  const detailedItems = [];
  for (const item of items) {
    const menuItem = await menuRepository.findById(item.itemId);
    if (!menuItem)
      throw new AppError(`Menu item not found for ID: ${item.itemId}`, 404);
    detailedItems.push({
      itemId: menuItem._id,
      name: menuItem.ItemName,
      quantity: item.quantity,
      price: menuItem.price,
      total: menuItem.price * item.quantity,
    });
  }
  const bill = await billingRepository.createBillDocument({
    billNumber: await generateBillNumber(),
    customerName,
    customerPhone,
    items: detailedItems,
    totalAmount: detailedItems.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    ),
    paymentStatus,
    paymentMethod,
    createdBy: userId,
  });
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
  const bills = await billingRepository.listScoped(
    scopeToBranchMembers(filter),
  );
  if (!bills.length) throw new AppError("No Bills found", 404);
  return bills;
};

const getBill = async (billId, scopeToBranchMembers) => {
  const bill = await billingRepository.findScopedWithCreator(
    scopeToBranchMembers({ _id: billId }),
  );
  if (!bill) throw new AppError("Bill not found", 404);
  return bill;
};

const payBill = async (
  billId,
  paymentMethod,
  { scopeToBranchMembers, branchId, io },
) => {
  const bill = await transactionManager.execute(async (session) => {
    const billToPay = await billingRepository.findScoped(
      scopeToBranchMembers({ _id: billId }),
      { session },
    );
    if (!billToPay) throw new AppError("Bill not found", 404);
    if (billToPay.paymentStatus === "paid")
      throw new AppError("Bill is already paid", 400);

    billToPay.paymentStatus = "paid";
    billToPay.paidAt = new Date();
    if (paymentMethod) billToPay.paymentMethod = paymentMethod;
    await billingRepository.save(billToPay, { session });

    if (billToPay.tableId) {
      await tableRepository.updateState(
        billToPay.tableId,
        {
          status: "available",
          currentCustomer: null,
        },
        { session },
      );
    }

    return billToPay;
  });
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const deleteBill = async (billId, scopeToBranchMembers) => {
  const bill = await billingRepository.deleteScoped(
    scopeToBranchMembers({ _id: billId }),
  );
  if (!bill) throw new AppError("Bill not found", 404);
  return {
    id: bill._id,
    customerName: bill.customerName,
    totalAmount: bill.totalAmount,
    billNumber: bill.billNumber,
  };
};

module.exports = {
  generateBillNumber,
  createBill,
  listBills,
  getBill,
  payBill,
  deleteBill,
};
