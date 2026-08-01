const mockExecute = jest.fn();

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
  findById: jest.fn(),
  updateState: jest.fn(),
}));
jest.mock("../../repositories/MenuRepository", () => ({}));
jest.mock("../../repositories/KitchenRepository", () => ({}));
jest.mock("../../services/inventoryService", () => ({}));
jest.mock("../../services/notificationservices", () => ({
  notify: {
    billingUpdated: jest.fn(),
  },
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
  bills: [],
  orders: [clone(originalOrder)],
  tables: {
    [tableId]: {
      _id: tableId,
      status: "occupied",
      currentCustomer: { name: "Ravi", phone: "9876543210" },
    },
  },
});

const transactionContext = {
  scopeToBranchMembers,
  branchId: "branch-1",
  userId: "user-1",
  io: { name: "io" },
};

beforeEach(() => {
  jest.clearAllMocks();
  state = initialState();
  failure = {};
  transactionPhase = "idle";

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

  tableRepository.findById.mockImplementation(async (id) => state.tables[id]);
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
  tableRepository.updateState.mockImplementation(async (id, update) => {
    state.tables[id] = { ...state.tables[id], ...clone(update) };
    if (failure.tableUpdate) throw failure.tableUpdate;
    return state.tables[id];
  });
  notify.billingUpdated.mockImplementation(() => {
    if (transactionPhase !== "committed") {
      throw new Error("Notification emitted before transaction commit");
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
    expect(notify.billingUpdated).toHaveBeenCalledTimes(1);
    expect(transactionPhase).toBe("committed");
    expect(tableRepository.findById).toHaveBeenCalledWith(
      tableId,
      undefined,
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
    expect(tableRepository.updateState).toHaveBeenCalledWith(
      tableId,
      { status: "billing" },
      { session },
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

    expect(state).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.billingUpdated).not.toHaveBeenCalled();
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
    });
  });

  test("commits payment and table release before notification", async () => {
    const bill = await billingService.payBill(billId, "upi", {
      scopeToBranchMembers,
      branchId: "branch-1",
      io: transactionContext.io,
    });

    expect(bill.paymentStatus).toBe("paid");
    expect(state.bills[0].paymentStatus).toBe("paid");
    expect(state.bills[0].paymentMethod).toBe("upi");
    expect(state.tables[tableId]).toEqual(
      expect.objectContaining({ status: "available", currentCustomer: null }),
    );
    expect(billingRepository.save).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(tableRepository.updateState).toHaveBeenCalledWith(
      tableId,
      { status: "available", currentCustomer: null },
      { session },
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

    expect(state).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.billingUpdated).not.toHaveBeenCalled();
  });
});
