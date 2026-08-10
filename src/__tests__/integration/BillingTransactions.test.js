const mockExecute = jest.fn();
const mockAuditCreateContext = jest.fn();
const mockBillCreated = jest.fn();
const mockPaymentCollected = jest.fn();
const mockAuditFailure = jest.fn();

jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({ execute: mockExecute })),
);
jest.mock("../../repositories/BillingRepository", () => ({
  countCreatedSince: jest.fn(),
  findScoped: jest.fn(),
  createBill: jest.fn(),
  save: jest.fn(),
}));
jest.mock("../../repositories/OrderRepository", () => ({
  findMany: jest.fn(),
  updateManyStatus: jest.fn(),
}));
jest.mock("../../repositories/TableRepository", () => ({
  findByIdAndBranch: jest.fn(),
  updateByIdAndBranch: jest.fn(),
}));
jest.mock("../../repositories/MenuRepository", () => ({}));
jest.mock("../../repositories/KitchenRepository", () => ({}));
jest.mock("../../services/inventoryService", () => ({}));
jest.mock("../../services/notificationservices", () => ({
  notify: {
    billingUpdated: jest.fn(),
    tableUpdated: jest.fn(),
  },
}));
jest.mock("../../modules/billing/BillingAuditLogger", () => ({
  createContext: mockAuditCreateContext,
  billCreated: mockBillCreated,
  paymentCollected: mockPaymentCollected,
  failure: mockAuditFailure,
}));

const billingRepository = require("../../repositories/BillingRepository");
const orderRepository = require("../../repositories/OrderRepository");
const tableRepository = require("../../repositories/TableRepository");
const { notify } = require("../../services/notificationservices");
const billingService = require("../../services/billingService");
const waiterOrderService = require("../../services/waiterOrderService");

const session = { id: "billing-transaction-session" };
const tableId = "table-1";
const billId = "bill-1";
const originalOrder = {
  _id: "order-1",
  tableId,
  createdBy: "user-1",
  status: "sent_to_kitchen",
  totalAmount: 250,
  items: [
    {
      itemId: "item-1",
      name: "Dosa",
      quantity: 2,
      price: 125,
    },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const scopeToBranchMembers = (filter) => ({
  ...filter,
  createdBy: { $in: ["user-1"] },
});

let state;
let failure;
let transactionPhase;

const initialState = () => ({
  audits: [],
  bills: [],
  orders: [clone(originalOrder)],
  tables: {
    [tableId]: {
      _id: tableId,
      branchId: "branch-1",
      status: "occupied",
      currentCustomer: { name: "Ravi", phone: "9876543210" },
    },
  },
});

const transactionContext = {
  scopeToBranchMembers,
  branchId: "branch-1",
  userId: "user-1",
  actorRole: "waiter",
  correlationId: "billing-correlation-1",
  io: { name: "io" },
};

beforeEach(() => {
  jest.clearAllMocks();
  state = initialState();
  failure = {};
  transactionPhase = "idle";

  mockAuditCreateContext.mockImplementation((values) => ({
    actor: values.actorId || "billing-service",
    actorRole: values.actorRole || null,
    branchId: values.branchId,
    correlationId: values.correlationId || "generated-correlation",
  }));
  mockBillCreated.mockImplementation(async ({ context, bill, tableId, orderIds }, options) => {
    state.audits.push({
      action: "BILLING.CREATE",
      outcome: "SUCCESS",
      actor: context.actor,
      actorRole: context.actorRole,
      branchId: context.branchId,
      correlationId: context.correlationId,
      transactionId: options.session.id,
      entityId: bill._id,
      tableId,
      orderIds,
    });
    if (failure.auditWrite) throw failure.auditWrite;
  });
  mockPaymentCollected.mockImplementation(async ({ context, bill, beforePaymentStatus }, options) => {
    state.audits.push({
      action: "PAYMENT.COLLECT",
      outcome: "SUCCESS",
      actor: context.actor,
      branchId: context.branchId,
      correlationId: context.correlationId,
      transactionId: options.session.id,
      entityId: bill._id,
      amount: bill.totalAmount,
      paymentMethod: bill.paymentMethod,
      beforePaymentStatus,
      afterPaymentStatus: bill.paymentStatus,
    });
    if (failure.auditWrite) throw failure.auditWrite;
  });
  mockAuditFailure.mockImplementation(async ({ action, context, entityId, error }) => {
    state.audits.push({
      action,
      outcome: "FAILURE",
      actor: context.actor,
      branchId: context.branchId,
      correlationId: context.correlationId,
      entityId,
      errorCode: error.code || "BILLING_TRANSACTION_FAILED",
    });
  });

  mockExecute.mockImplementation(async (work) => {
    const snapshot = clone(state);
    transactionPhase = "active";
    try {
      const result = await work(session);
      transactionPhase = "committed";
      return result;
    } catch (error) {
      state = snapshot;
      transactionPhase = "rolled_back";
      throw error;
    }
  });

  tableRepository.findByIdAndBranch.mockImplementation(async (id, branchId) => {
    const table = state.tables[id];
    return table?.branchId === branchId ? table : null;
  });
  orderRepository.findMany.mockImplementation(async () => state.orders);
  billingRepository.findScoped.mockImplementation(async (filter) => {
    if (filter._id) {
      const storedBill = state.bills.find((bill) => bill._id === filter._id);
      return storedBill ? { ...clone(storedBill) } : null;
    }
    return (
      state.bills.find(
        (bill) =>
          bill.tableId === filter.tableId &&
          bill.paymentStatus === filter.paymentStatus,
      ) || null
    );
  });
  billingRepository.countCreatedSince.mockResolvedValue(0);
  billingRepository.createBill.mockImplementation(async (data) => {
    const bill = { _id: `bill-${state.bills.length + 1}`, ...clone(data) };
    state.bills.push(bill);
    if (failure.billCreate) throw failure.billCreate;
    return bill;
  });
  orderRepository.updateManyStatus.mockImplementation(async (_filter, status) => {
    state.orders.forEach((order) => {
      order.status = status;
    });
    if (failure.orderUpdate) throw failure.orderUpdate;
    return { modifiedCount: state.orders.length };
  });
  billingRepository.save.mockImplementation(async (bill) => {
    const index = state.bills.findIndex((stored) => stored._id === bill._id);
    state.bills[index] = clone(bill);
    if (failure.billUpdate) throw failure.billUpdate;
    return bill;
  });
  tableRepository.updateByIdAndBranch.mockImplementation(async (id, branchId, update) => {
    if (state.tables[id]?.branchId !== branchId) return null;
    state.tables[id] = { ...state.tables[id], ...clone(update) };
    if (failure.tableUpdate) throw failure.tableUpdate;
    return state.tables[id];
  });
  notify.billingUpdated.mockImplementation(() => {
    if (transactionPhase !== "committed") {
      throw new Error("Notification emitted before transaction commit");
    }
    if (failure.notification) throw failure.notification;
  });
  notify.tableUpdated.mockImplementation(() => {
    if (transactionPhase !== "committed") {
      throw new Error("Table notification emitted before transaction commit");
    }
  });
});

describe("Send Table to Cashier transaction", () => {
  const input = {
    customerName: "Ravi",
    customerPhone: "9876543210",
    tableNumber: 1,
  };

  test("commits bill, order, and table changes before notification", async () => {
    const bill = await waiterOrderService.sendToCashier(
      tableId,
      input,
      transactionContext,
    );

    expect(bill._id).toBe("bill-1");
    expect(state.bills).toHaveLength(1);
    expect(state.orders[0].status).toBe("served");
    expect(state.tables[tableId].status).toBe("billing");
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "BILLING.CREATE",
        outcome: "SUCCESS",
        actor: "user-1",
        actorRole: "waiter",
        branchId: "branch-1",
        correlationId: "billing-correlation-1",
        transactionId: session.id,
        entityId: "bill-1",
        tableId,
        orderIds: ["order-1"],
      }),
    ]);
    expect(notify.billingUpdated).toHaveBeenCalledTimes(1);
    expect(transactionPhase).toBe("committed");
    expect(tableRepository.findByIdAndBranch).toHaveBeenCalledWith(
      tableId,
      "branch-1",
      { session },
    );
    expect(billingRepository.createBill).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(orderRepository.updateManyStatus).toHaveBeenCalledWith(
      expect.any(Object),
      "served",
      { session },
    );
    expect(tableRepository.updateByIdAndBranch).toHaveBeenCalledWith(
      tableId,
      "branch-1",
      { status: "billing" },
      { session, new: true },
    );
    expect(notify.tableUpdated).toHaveBeenCalledWith(
      transactionContext.io,
      state.tables[tableId],
    );
  });

  test.each([
    ["bill creation", "billCreate"],
    ["order update", "orderUpdate"],
    ["table update", "tableUpdate"],
  ])("rolls back all writes when %s fails", async (_label, failureKey) => {
    const originalError = new Error(`${failureKey} failed`);
    const before = clone(state);
    failure[failureKey] = originalError;

    await expect(
      waiterOrderService.sendToCashier(tableId, input, transactionContext),
    ).rejects.toBe(originalError);

    expect(state.bills).toEqual(before.bills);
    expect(state.orders).toEqual(before.orders);
    expect(state.tables).toEqual(before.tables);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "BILLING.CREATE",
        outcome: "FAILURE",
        correlationId: "billing-correlation-1",
      }),
    ]);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.billingUpdated).not.toHaveBeenCalled();
    expect(notify.tableUpdated).not.toHaveBeenCalled();
  });

  test("rejects a foreign table and emits no post-commit event", async () => {
    state.tables[tableId].branchId = "branch-2";
    const before = clone(state);

    await expect(
      waiterOrderService.sendToCashier(tableId, input, transactionContext),
    ).rejects.toMatchObject({ message: "Table not found", statusCode: 404 });

    expect(state.bills).toEqual(before.bills);
    expect(state.orders).toEqual(before.orders);
    expect(state.tables).toEqual(before.tables);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.tableUpdated).not.toHaveBeenCalled();
    expect(notify.billingUpdated).not.toHaveBeenCalled();
  });

  test("rolls back business writes and the success audit when audit persistence fails", async () => {
    const before = clone(state);
    failure.auditWrite = Object.assign(new Error("audit failed"), {
      code: "AUDIT_WRITE_ERROR",
    });

    await expect(
      waiterOrderService.sendToCashier(tableId, input, transactionContext),
    ).rejects.toBe(failure.auditWrite);

    expect(state.bills).toEqual(before.bills);
    expect(state.orders).toEqual(before.orders);
    expect(state.tables).toEqual(before.tables);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "BILLING.CREATE",
        outcome: "FAILURE",
        errorCode: "AUDIT_WRITE_ERROR",
      }),
    ]);
    expect(notify.tableUpdated).not.toHaveBeenCalled();
  });

  test("does not write a failure audit for a post-commit notification error", async () => {
    failure.notification = new Error("socket unavailable");

    await expect(
      waiterOrderService.sendToCashier(tableId, input, transactionContext),
    ).rejects.toBe(failure.notification);

    expect(transactionPhase).toBe("committed");
    expect(state.bills).toHaveLength(1);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "BILLING.CREATE",
        outcome: "SUCCESS",
      }),
    ]);
    expect(mockAuditFailure).not.toHaveBeenCalled();
  });
});

describe("Pay Bill transaction", () => {
  beforeEach(() => {
    state.bills.push({
      _id: billId,
      tableId,
      paymentStatus: "unpaid",
      paymentMethod: "none",
      paidAt: null,
      totalAmount: 250,
      createdBy: "cashier-1",
    });
  });

  test("commits payment and table release before notification", async () => {
    const bill = await billingService.payBill(billId, "upi", {
      scopeToBranchMembers,
      branchId: "branch-1",
      io: transactionContext.io,
      userId: "cashier-1",
      actorRole: "cashier",
      correlationId: "payment-correlation-1",
    });

    expect(bill.paymentStatus).toBe("paid");
    expect(state.bills[0].paymentStatus).toBe("paid");
    expect(state.bills[0].paymentMethod).toBe("upi");
    expect(state.tables[tableId]).toEqual(
      expect.objectContaining({ status: "available", currentCustomer: null }),
    );
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "PAYMENT.COLLECT",
        outcome: "SUCCESS",
        actor: "cashier-1",
        branchId: "branch-1",
        correlationId: "payment-correlation-1",
        transactionId: session.id,
        entityId: billId,
        amount: 250,
        paymentMethod: "upi",
        beforePaymentStatus: "unpaid",
        afterPaymentStatus: "paid",
      }),
    ]);
    expect(billingRepository.save).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(tableRepository.updateByIdAndBranch).toHaveBeenCalledWith(
      tableId,
      "branch-1",
      { status: "available", currentCustomer: null },
      { session, new: true },
    );
    expect(notify.tableUpdated).toHaveBeenCalledWith(
      transactionContext.io,
      state.tables[tableId],
    );
    expect(notify.billingUpdated).toHaveBeenCalledTimes(1);
    expect(transactionPhase).toBe("committed");
  });

  test.each([
    ["bill update", "billUpdate"],
    ["table release", "tableUpdate"],
  ])("rolls back all writes when %s fails", async (_label, failureKey) => {
    const originalError = new Error(`${failureKey} failed`);
    const before = clone(state);
    failure[failureKey] = originalError;

    await expect(
      billingService.payBill(billId, "cash", {
        scopeToBranchMembers,
        branchId: "branch-1",
        io: transactionContext.io,
      }),
    ).rejects.toBe(originalError);

    expect(state.bills).toEqual(before.bills);
    expect(state.orders).toEqual(before.orders);
    expect(state.tables).toEqual(before.tables);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "PAYMENT.COLLECT",
        outcome: "FAILURE",
      }),
    ]);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.billingUpdated).not.toHaveBeenCalled();
    expect(notify.tableUpdated).not.toHaveBeenCalled();
  });

  test("cannot pay a cross-linked bill or release its foreign table", async () => {
    state.tables[tableId].branchId = "branch-2";
    const before = clone(state);

    await expect(
      billingService.payBill(billId, "cash", {
        scopeToBranchMembers,
        branchId: "branch-1",
        io: transactionContext.io,
      }),
    ).rejects.toMatchObject({ message: "Table not found", statusCode: 404 });

    expect(state.bills).toEqual(before.bills);
    expect(state.tables).toEqual(before.tables);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.tableUpdated).not.toHaveBeenCalled();
    expect(notify.billingUpdated).not.toHaveBeenCalled();
  });

  test("generates failure audit outside a rolled-back payment transaction", async () => {
    failure.auditWrite = Object.assign(new Error("payment audit failed"), {
      code: "AUDIT_WRITE_ERROR",
    });

    await expect(
      billingService.payBill(billId, "cash", {
        scopeToBranchMembers,
        branchId: "branch-1",
        io: transactionContext.io,
        userId: "cashier-1",
        actorRole: "cashier",
        correlationId: "payment-failure-correlation",
      }),
    ).rejects.toBe(failure.auditWrite);

    expect(state.bills[0].paymentStatus).toBe("unpaid");
    expect(state.tables[tableId].status).toBe("occupied");
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "PAYMENT.COLLECT",
        outcome: "FAILURE",
        actor: "cashier-1",
        branchId: "branch-1",
        correlationId: "payment-failure-correlation",
        errorCode: "AUDIT_WRITE_ERROR",
      }),
    ]);
    expect(notify.tableUpdated).not.toHaveBeenCalled();
  });

  test("does not misclassify a post-commit payment notification error", async () => {
    failure.notification = new Error("socket unavailable");

    await expect(
      billingService.payBill(billId, "cash", {
        scopeToBranchMembers,
        branchId: "branch-1",
        io: transactionContext.io,
        userId: "cashier-1",
        correlationId: "payment-notification-correlation",
      }),
    ).rejects.toBe(failure.notification);

    expect(transactionPhase).toBe("committed");
    expect(state.bills[0].paymentStatus).toBe("paid");
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "PAYMENT.COLLECT",
        outcome: "SUCCESS",
      }),
    ]);
    expect(mockAuditFailure).not.toHaveBeenCalled();
  });
});
