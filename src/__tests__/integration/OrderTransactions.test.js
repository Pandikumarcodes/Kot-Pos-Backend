const mockExecute = jest.fn();

jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({ execute: mockExecute })),
);
jest.mock("../../repositories/OrderRepository", () => ({
  findOne: jest.fn(),
  updateStatus: jest.fn(),
}));
jest.mock("../../repositories/TakeawayOrderRepository", () => ({
  findOne: jest.fn(),
  updateStatus: jest.fn(),
}));
jest.mock("../../repositories/TableRepository", () => ({
  findByIdAndBranch: jest.fn(),
}));
jest.mock("../../repositories/KitchenRepository", () => ({
  createOrder: jest.fn(),
}));
jest.mock("../../repositories/UserRepository", () => ({
  findByIdWithSelection: jest.fn(),
}));
jest.mock("../../repositories/MenuRepository", () => ({}));
jest.mock("../../repositories/BillingRepository", () => ({}));
jest.mock("../../services/billingService", () => ({}));
jest.mock("../../services/inventoryService", () => ({
  deductStockForKot: jest.fn(),
}));
jest.mock("../../services/notificationservices", () => ({
  notify: {
    newOrder: jest.fn(),
  },
}));
jest.mock("../../modules/orders/OrderAuditLogger", () => ({
  createContext: jest.fn((values) => ({
    actor: values.actorId || "order-service",
    actorRole: values.actorRole || null,
    branchId: values.branchId,
    correlationId: values.correlationId || "order-correlation-1",
  })),
  sentToKitchen: jest.fn(),
  failure: jest.fn(),
}));

const orderRepository = require("../../repositories/OrderRepository");
const takeawayOrderRepository = require("../../repositories/TakeawayOrderRepository");
const tableRepository = require("../../repositories/TableRepository");
const kitchenRepository = require("../../repositories/KitchenRepository");
const userRepository = require("../../repositories/UserRepository");
const orderAudit = require("../../modules/orders/OrderAuditLogger");
const { notify } = require("../../services/notificationservices");
const waiterOrderService = require("../../services/waiterOrderService");
const takeawayOrderService = require("../../services/takeawayOrderService");

const session = { id: "order-transaction-session" };
const branchId = "branch-1";
const io = { name: "io" };
const scopeToBranchMembers = (filter) => ({
  ...filter,
  createdBy: { $in: ["branch-user-1"] },
});
const context = { scopeToBranchMembers, branchId, io };
const clone = (value) => JSON.parse(JSON.stringify(value));

const dineInOrder = {
  _id: "dine-order-1",
  tableId: "table-1",
  tableNumber: 7,
  customerName: "Ravi",
  createdBy: "branch-user-1",
  status: "pending",
  items: [{ itemId: "item-1", name: "Dosa", quantity: 2, price: 90 }],
  totalAmount: 180,
};
const takeawayOrder = {
  _id: "takeaway-order-1",
  customerName: "Maya",
  customerPhone: "9876543210",
  createdBy: "branch-user-1",
  status: "pending",
  items: [{ itemId: "item-2", name: "Idli", quantity: 3, price: 40 }],
};

let state;
let failure;
let transactionPhase;
let failureAudits;

beforeEach(() => {
  jest.clearAllMocks();
  state = {
    dineInOrders: [clone(dineInOrder)],
    takeawayOrders: [clone(takeawayOrder)],
    tables: {
      "table-1": { _id: "table-1", branchId: "branch-1", tableNumber: 7 },
    },
    kots: [],
    audits: [],
  };
  failure = {};
  failureAudits = [];
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

  orderRepository.findOne.mockImplementation(async () => state.dineInOrders[0]);
  takeawayOrderRepository.findOne.mockImplementation(
    async () => state.takeawayOrders[0],
  );
  tableRepository.findByIdAndBranch.mockImplementation(async (id, ownerBranchId) => {
    const table = state.tables[id];
    return table?.branchId === ownerBranchId ? table : null;
  });
  orderRepository.updateStatus.mockImplementation(async (_filter, status) => {
    state.dineInOrders[0].status = status;
    if (failure.orderUpdate) throw failure.orderUpdate;
    return clone(state.dineInOrders[0]);
  });
  takeawayOrderRepository.updateStatus.mockImplementation(
    async (_filter, status) => {
      state.takeawayOrders[0].status = status;
      if (failure.orderUpdate) throw failure.orderUpdate;
      return clone(state.takeawayOrders[0]);
    },
  );
  kitchenRepository.createOrder.mockImplementation(async (data) => {
    const kot = { _id: `kot-${state.kots.length + 1}`, ...clone(data) };
    state.kots.push(kot);
    if (failure.kotCreate) throw failure.kotCreate;
    return kot;
  });
  userRepository.findByIdWithSelection.mockResolvedValue({ role: "waiter" });
  orderAudit.sentToKitchen.mockImplementation(async (intent, options) => {
    state.audits.push({ ...intent, session: options.session });
  });
  orderAudit.failure.mockImplementation(async (intent) => {
    failureAudits.push(intent);
  });
  notify.newOrder.mockImplementation(() => {
    if (transactionPhase !== "committed") {
      throw new Error("Notification emitted before transaction commit");
    }
  });
});

describe("Dine-in order to kitchen transaction", () => {
  test("commits the status and KOT atomically", async () => {
    const order = await waiterOrderService.sendToKitchen(
      dineInOrder._id,
      context,
    );

    expect(order.status).toBe("sent_to_kitchen");
    expect(state.dineInOrders[0].status).toBe("sent_to_kitchen");
    expect(state.kots).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      previousStatus: "pending",
      orderType: "dine-in",
      tableId: "table-1",
      session,
      context: {
        actor: "branch-user-1",
        actorRole: "waiter",
        branchId,
        correlationId: "order-correlation-1",
      },
    });
    expect(state.kots[0]).toEqual(
      expect.objectContaining({ branchId, orderType: "dine-in", tableId: "table-1" }),
    );
    expect(orderRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: dineInOrder._id,
        createdBy: { $in: ["branch-user-1"] },
      }),
      undefined,
      { session },
    );
    expect(tableRepository.findByIdAndBranch).toHaveBeenCalledWith(
      "table-1",
      branchId,
      { session },
    );
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(
      expect.any(Object),
      "sent_to_kitchen",
      { session },
    );
    expect(kitchenRepository.createOrder).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
  });

  test.each([
    ["KOT creation", "kotCreate"],
    ["order update", "orderUpdate"],
  ])("rolls back all writes and preserves the original error when %s fails", async (_label, key) => {
    const originalError = new Error(`${key} failed`);
    const before = clone(state);
    failure[key] = originalError;

    await expect(
      waiterOrderService.sendToKitchen(dineInOrder._id, context),
    ).rejects.toBe(originalError);

    expect(state).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.newOrder).not.toHaveBeenCalled();
    expect(state.audits).toHaveLength(0);
    expect(failureAudits).toHaveLength(1);
    expect(failureAudits[0]).toMatchObject({
      entityId: dineInOrder._id,
      context: expect.objectContaining({ branchId, correlationId: "order-correlation-1" }),
    });
  });

  test("emits order:new only after commit", async () => {
    await waiterOrderService.sendToKitchen(dineInOrder._id, context);

    expect(transactionPhase).toBe("committed");
    expect(notify.newOrder).toHaveBeenCalledTimes(1);
    expect(notify.newOrder).toHaveBeenCalledWith(io, state.kots[0]);
  });

  test("rejects a cross-linked foreign table and rolls back without an event", async () => {
    state.tables["table-1"].branchId = "branch-2";
    const before = clone(state);

    await expect(
      waiterOrderService.sendToKitchen(dineInOrder._id, context),
    ).rejects.toMatchObject({ message: "Table not found", statusCode: 404 });

    expect(state).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
    expect(kitchenRepository.createOrder).not.toHaveBeenCalled();
    expect(notify.newOrder).not.toHaveBeenCalled();
  });
});

describe("Takeaway order to kitchen transaction", () => {
  test("commits the status and KOT before notification", async () => {
    const order = await takeawayOrderService.sendToKitchen(
      takeawayOrder._id,
      context,
    );

    expect(order.status).toBe("sent_to_kitchen");
    expect(state.takeawayOrders[0].status).toBe("sent_to_kitchen");
    expect(state.kots).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      previousStatus: "pending",
      orderType: "takeaway",
      session,
      context: {
        actor: "branch-user-1",
        actorRole: "waiter",
        branchId,
        correlationId: "order-correlation-1",
      },
    });
    expect(state.kots[0]).toEqual(
      expect.objectContaining({ branchId, orderType: "takeaway", totalAmount: 120 }),
    );
    expect(takeawayOrderRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: takeawayOrder._id,
        createdBy: { $in: ["branch-user-1"] },
      }),
      undefined,
      { session },
    );
    expect(takeawayOrderRepository.updateStatus).toHaveBeenCalledWith(
      expect.any(Object),
      "sent_to_kitchen",
      { session },
    );
    expect(kitchenRepository.createOrder).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(transactionPhase).toBe("committed");
    expect(notify.newOrder).toHaveBeenCalledWith(io, state.kots[0]);
  });

  test.each([
    ["KOT creation", "kotCreate"],
    ["order update", "orderUpdate"],
  ])("rolls back all writes and preserves the original error when %s fails", async (_label, key) => {
    const originalError = new Error(`${key} failed`);
    const before = clone(state);
    failure[key] = originalError;

    await expect(
      takeawayOrderService.sendToKitchen(takeawayOrder._id, context),
    ).rejects.toBe(originalError);

    expect(state).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
    expect(notify.newOrder).not.toHaveBeenCalled();
    expect(state.audits).toHaveLength(0);
    expect(failureAudits).toHaveLength(1);
  });
});
