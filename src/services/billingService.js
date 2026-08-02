const billingRepository = require("../repositories/BillingRepository");
const menuRepository = require("../repositories/MenuRepository");
const tableRepository = require("../repositories/TableRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");
const billingAudit = require("../modules/billing/BillingAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");
const {
  buildOperationalPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./operationalQuery");

const BILLING_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [
    { field: "customerName", mode: "partial" },
    { field: "customerPhone", mode: "partial" },
    { field: "billNumber", mode: "partial" },
  ],
  filters: {
    status: {
      field: "paymentStatus",
      type: "enum",
      values: ["unpaid", "paid"],
    },
  },
  sorting: {
    fields: { billDate: "createdAt", paymentStatus: "paymentStatus" },
    defaultField: "billDate",
    defaultOrder: "desc",
  },
  fieldSelection: {
    fields: {
      id: "_id", customerName: "customerName", customerPhone: "customerPhone",
      billNumber: "billNumber", tableId: "tableId", tableNumber: "tableNumber",
      items: "items", totalAmount: "totalAmount", paymentStatus: "paymentStatus",
      paymentMethod: "paymentMethod", paidAt: "paidAt", createdBy: "createdBy",
      createdAt: "createdAt", updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "customerName", "customerPhone", "billNumber", "tableId",
      "tableNumber", "items", "totalAmount", "paymentStatus", "paymentMethod",
      "paidAt", "createdBy", "createdAt", "updatedAt",
    ],
  },
});

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
  const menuItems = await Promise.all(
    items.map((item) => menuRepository.findById(item.itemId)),
  );
  const detailedItems = [];
  for (const [index, item] of items.entries()) {
    const menuItem = menuItems[index];
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

const listBills = async ({ query = {}, scopeToBranchMembers }) => {
  if (!hasQueryControls(query)) {
    const bills = await billingRepository.listScoped(scopeToBranchMembers({}));
    if (!bills.length) throw new AppError("No Bills found", 404);
    return { items: bills };
  }
  const paginated = usesPagination(query);
  const plan = buildOperationalPlan({
    query,
    policy: BILLING_QUERY_POLICY,
    trustedConstraints: [scopeToBranchMembers({})],
  });
  const dataPromise = billingRepository.listScoped(
    plan.filter,
    repositoryOptions(plan, paginated),
  );
  const [bills, total] = paginated
    ? await Promise.all([dataPromise, billingRepository.count(plan.filter)])
    : [await dataPromise, null];
  if (!bills.length) throw new AppError("No Bills found", 404);
  return {
    items: bills,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
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
  {
    scopeToBranchMembers,
    branchId,
    userId = null,
    actorRole = null,
    correlationId = null,
    io,
  },
) => {
  let auditContext = billingAudit.createContext({
    actorId: userId,
    actorRole,
    branchId,
    correlationId,
  });
  let tableId = null;
  let bill;
  try {
    bill = await transactionManager.execute(async (session) => {
      const billToPay = await billingRepository.findScoped(
        scopeToBranchMembers({ _id: billId }),
        { session },
      );
      if (!billToPay) throw new AppError("Bill not found", 404);
      if (billToPay.paymentStatus === "paid")
        throw new AppError("Bill is already paid", 400);

      if (!userId && billToPay.createdBy) {
        auditContext = billingAudit.createContext({
          actorId: billToPay.createdBy,
          actorRole,
          branchId,
          correlationId: auditContext.correlationId,
        });
      }
      const beforePaymentStatus = billToPay.paymentStatus;
      const beforePaymentMethod = billToPay.paymentMethod;
      tableId = billToPay.tableId;
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

      await billingAudit.paymentCollected(
        {
          context: auditContext,
          bill: billToPay,
          beforePaymentStatus,
          beforePaymentMethod,
        },
        { session },
      );

      return billToPay;
    });
  } catch (error) {
    try {
      await billingAudit.failure({
        action: AUDIT_ACTIONS.PAYMENT_COLLECT,
        context: auditContext,
        entityId: billId,
        tableId,
        error,
      });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the workflow error.
    }
    throw error;
  }
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
