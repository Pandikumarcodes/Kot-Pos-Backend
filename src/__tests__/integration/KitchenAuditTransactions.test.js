const mockExecute = jest.fn();

jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({ execute: mockExecute })),
);
jest.mock("../../repositories/KitchenRepository", () => ({
  findScoped: jest.fn(), findByScope: jest.fn(),
  updateStatus: jest.fn(), updateStatusByScope: jest.fn(),
}));
jest.mock("../../repositories/UserRepository", () => ({
  findByIdWithSelection: jest.fn(),
}));
jest.mock("../../services/notificationservices", () => ({
  notify: { kotUpdated: jest.fn() },
}));
jest.mock("../../modules/orders/OrderAuditLogger", () => ({
  createContext: jest.fn((values) => ({
    actor: values.actorId || "order-service",
    actorRole: values.actorRole || null,
    branchId: values.branchId,
    correlationId: values.correlationId || "kitchen-correlation-1",
  })),
  kitchenAction: jest.fn((status) => ({
    preparing: "KOT.START_PREPARATION",
    ready: "KOT.MARK_READY",
    served: "KOT.SERVE",
  })[status] || null),
  kitchenStatusChanged: jest.fn(),
  failure: jest.fn(),
}));

const kitchenRepository = require("../../repositories/KitchenRepository");
const userRepository = require("../../repositories/UserRepository");
const { notify } = require("../../services/notificationservices");
const orderAudit = require("../../modules/orders/OrderAuditLogger");
const kitchenService = require("../../services/kitchenService");

const session = { id: "kitchen-session-1" };
const branchId = "branch-1";
const orderId = "kot-1";
const io = { name: "io" };
const scopeToBranch = { type: "branch", isGlobal: false, branchId };

let state;
let failureAudits;
let phase;

beforeEach(() => {
  jest.clearAllMocks();
  state = {
    kot: { _id: orderId, branchId, createdBy: "chef-1", status: "pending" },
    audits: [],
  };
  failureAudits = [];
  phase = "idle";

  mockExecute.mockImplementation(async (work) => {
    const snapshot = JSON.parse(JSON.stringify(state));
    phase = "active";
    try {
      const result = await work(session);
      phase = "committed";
      return result;
    } catch (error) {
      state = snapshot;
      phase = "rolled_back";
      throw error;
    }
  });
  kitchenRepository.findByScope.mockImplementation(async () => ({ ...state.kot }));
  kitchenRepository.updateStatusByScope.mockImplementation(async (_scope, _filter, status) => {
    state.kot.status = status;
    return { ...state.kot };
  });
  userRepository.findByIdWithSelection.mockResolvedValue({ role: "chef" });
  orderAudit.kitchenStatusChanged.mockImplementation(async (intent, options) => {
    state.audits.push({ ...intent, session: options.session });
  });
  orderAudit.failure.mockImplementation(async (intent) => failureAudits.push(intent));
  notify.kotUpdated.mockImplementation(() => {
    if (phase !== "committed") throw new Error("notification before commit");
  });
});

describe("kitchen audit transactions", () => {
  test.each([
    ["preparing", "pending", "KOT.START_PREPARATION"],
    ["ready", "preparing", "KOT.MARK_READY"],
    ["served", "ready", "KOT.SERVE"],
  ])("commits %s status and audit before notification", async (status, previous, action) => {
    state.kot.status = previous;

    const order = await kitchenService.updateOrderStatus(
      orderId,
      status,
      scopeToBranch,
      io,
      { userId: "chef-1", actorRole: "chef", correlationId: "corr-explicit" },
    );

    expect(order.status).toBe(status);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      previousStatus: previous,
      newStatus: status,
      session,
      context: {
        actor: "chef-1",
        actorRole: "chef",
        branchId,
        correlationId: "corr-explicit",
      },
    });
    expect(orderAudit.kitchenAction).toHaveBeenCalledWith(status);
    expect(orderAudit.kitchenAction.mock.results[0].value).toBe(action);
    expect(phase).toBe("committed");
    expect(notify.kotUpdated).toHaveBeenCalledWith(io, order);
  });

  test("rolls back status and success audit, then writes failure outside", async () => {
    const original = new Error("audit unavailable");
    orderAudit.kitchenStatusChanged.mockImplementation(async (intent, options) => {
      state.audits.push({ ...intent, session: options.session });
      throw original;
    });

    await expect(
      kitchenService.updateOrderStatus(orderId, "preparing", scopeToBranch, io),
    ).rejects.toBe(original);

    expect(state.kot.status).toBe("pending");
    expect(state.audits).toHaveLength(0);
    expect(failureAudits).toHaveLength(1);
    expect(failureAudits[0]).toMatchObject({
      action: "KOT.START_PREPARATION",
      entityId: orderId,
      context: expect.objectContaining({ branchId, correlationId: "kitchen-correlation-1" }),
    });
    expect(notify.kotUpdated).not.toHaveBeenCalled();
  });

  test("rejects an invalid status transition without notifying", async () => {
    state.kot.status = "pending";

    await expect(
      kitchenService.updateOrderStatus(orderId, "ready", scopeToBranch, io),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(state.kot.status).toBe("pending");
    expect(notify.kotUpdated).not.toHaveBeenCalled();
    expect(orderAudit.kitchenStatusChanged).not.toHaveBeenCalled();
  });
});
