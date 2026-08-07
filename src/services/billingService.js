const billingRepository = require("../repositories/BillingRepository");
const counterRepository = require("../repositories/CounterRepository");
const menuRepository = require("../repositories/MenuRepository");
const tableRepository = require("../repositories/TableRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");
const billingAudit = require("../modules/billing/BillingAuditLogger");
const logger = require("../config/logger");
const { normalizeObjectId } = require("../utils/branchId");
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
      branchId: "branchId",
      createdAt: "createdAt", updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "customerName", "customerPhone", "billNumber", "tableId",
      "tableNumber", "items", "totalAmount", "paymentStatus", "paymentMethod",
      "paidAt", "createdBy", "branchId", "createdAt", "updatedAt",
    ],
  },
});

const transactionManager = new TransactionManager();

const requireBillingScope = (scope) => {
  if (!scope || scope.type !== "branch" || !scope.branchId) {
    throw new AppError("A valid branch scope is required for billing", 403);
  }
  return { branchId: scope.branchId };
};

const normalizeBillingScopeFilter = (filter = {}) => {
  if (!filter.createdBy || !("$in" in filter.createdBy)) return { ...filter };
  return {
    ...filter,
    createdBy: {
      ...filter.createdBy,
      $in: (Array.isArray(filter.createdBy.$in) ? filter.createdBy.$in : [])
        .map(normalizeObjectId)
        .filter(Boolean),
    },
  };
};

const generateBillNumber = async (options = {}) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10).replace(/-/g, "");
  const todayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const key = `billing:${today}`;
  const session = options.session;

  // Bootstrap a counter from existing bills once. This prevents a newly
  // introduced counter from issuing BILL-...-001 when that number already exists.
  const existingCounter = await counterRepository.findOne({ key }, { session });
  if (!existingCounter) {
    const existingMax = await billingRepository.findMaxSequenceForDate(
      todayStart,
      tomorrow,
      today,
      options,
    );
    await counterRepository.findOneAndUpdate(
      { key },
      { $setOnInsert: { key, sequence: existingMax } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session,
      },
    );
  }

  const counter = await counterRepository.findOneAndUpdate(
    { key },
    { $inc: { sequence: 1 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session,
    },
  );
  return `BILL-${today}-${String(counter.sequence).padStart(3, "0")}`;
};

const createBill = async (input, { userId, branchId, scope, io }) => {
  requireBillingScope(scope);
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
    branchId: scope.branchId,
    createdBy: userId,
  });
  notify.billingUpdated(io, bill, branchId);
  return bill;
};

const listBills = async ({ query = {}, scope }) => {
  const scopedFilter = normalizeBillingScopeFilter(requireBillingScope(scope));
  if (!hasQueryControls(query)) {
    const bills = await billingRepository.listScoped(scopedFilter, {}, scope);
    return { items: bills };
  }
  const paginated = usesPagination(query);
  const plan = buildOperationalPlan({
    query,
    policy: BILLING_QUERY_POLICY,
    trustedConstraints: [scopedFilter],
  });
  // QueryBuilder composes trusted constraints under $and. Keep the validated
  // membership constraint explicit at the repository boundary as well.
  const repositoryFilter = { ...plan.filter, ...scopedFilter };
  const dataPromise = billingRepository.listScoped(
    repositoryFilter,
    repositoryOptions(plan, paginated),
    scope,
  );
  let bills;
  let total = null;
  try {
    if (paginated) {
      [bills, total] = await Promise.all([
        dataPromise,
        billingRepository.count(repositoryFilter, {}, scope),
      ]);
    } else {
      bills = await dataPromise;
    }
  } catch (error) {
    logger.error("BillingService.listBills repository failure", {
      name: error?.name,
      message: error?.message,
      code: error?.code ?? null,
      stack: error?.stack,
      normalizedBranchId: scope.branchId,
      page: plan.pagination?.page ?? null,
      limit: plan.pagination?.limit ?? null,
      sort: query.sort ?? null,
      order: query.order ?? null,
      filter: repositoryFilter,
    });
    throw error;
  }
  const items = Array.isArray(bills) ? bills : [];
  return {
    items,
    ...(paginated && { pagination: paginationFor(plan, total) }),
  };
};

const getBill = async (billId, scope) => {
  const bill = await billingRepository.findScopedWithCreator(
    { _id: billId, ...requireBillingScope(scope) },
    {},
    scope,
  );
  if (!bill) throw new AppError("Bill not found", 404);
  return bill;
};

const payBill = async (
  billId,
  paymentMethod,
  {
    scope,
    branchId,
    userId = null,
    actorRole = null,
    correlationId = null,
    io,
  },
) => {
  const effectiveScope = scope || (branchId ? { type: "branch", isGlobal: false, branchId } : scope);
  const billingScope = requireBillingScope(effectiveScope);
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
        { _id: billId, ...billingScope },
        { session },
        effectiveScope,
      );
      if (!billToPay) throw new AppError("Bill not found", 404);
      if (billToPay.paymentStatus === "paid")
        throw new AppError("Bill is already paid", 409);

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
        if (typeof tableRepository.updateTableInScope === "function") {
          await tableRepository.updateTableInScope(
            effectiveScope,
            billToPay.tableId,
            { status: "available", currentCustomer: null },
            { session },
          );
        } else {
          await tableRepository.updateState(
            billToPay.tableId,
            { status: "available", currentCustomer: null },
            { session },
          );
        }
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

const deleteBill = async (billId, scope) => {
  const bill = await billingRepository.deleteScoped(
    { _id: billId, ...requireBillingScope(scope) },
    {},
    scope,
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
