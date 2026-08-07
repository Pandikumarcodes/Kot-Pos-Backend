const mockExecute = jest.fn();
const mockAuditCreated = jest.fn();
const mockAuditRestocked = jest.fn();
const mockAuditAdjusted = jest.fn();
const mockAuditFailure = jest.fn();

jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({ execute: mockExecute })),
);
jest.mock("../../repositories/InventoryRepository", () => ({
  createInventory: jest.fn(),
  findByScope: jest.fn(),
  findScopedById: jest.fn(),
  save: jest.fn(),
}));
jest.mock("../../repositories/StockLogRepository", () => ({
  createLog: jest.fn(),
}));
jest.mock("../../repositories/MenuRepository", () => ({
  updateAvailability: jest.fn(),
}));
jest.mock("../../repositories/UserRepository", () => ({
  findByIdWithSelection: jest.fn(),
}));
jest.mock("../../modules/inventory/InventoryAuditLogger", () => ({
  createContext: jest.fn((values) => ({
    actor: values.actorId,
    actorRole: values.actorRole,
    branchId: values.branchId,
    correlationId: values.correlationId || "inventory-correlation-1",
  })),
  created: mockAuditCreated,
  restocked: mockAuditRestocked,
  adjusted: mockAuditAdjusted,
  failure: mockAuditFailure,
}));

const inventoryRepository = require("../../repositories/InventoryRepository");
const stockLogRepository = require("../../repositories/StockLogRepository");
const menuRepository = require("../../repositories/MenuRepository");
const userRepository = require("../../repositories/UserRepository");
const inventoryAudit = require("../../modules/inventory/InventoryAuditLogger");
const inventoryService = require("../../services/inventoryService");

const session = { id: "inventory-transaction-session" };
const branchId = "branch-1";
const otherBranchId = "branch-2";
const userId = "user-1";
const inventoryId = "inventory-1";
const menuItemId = "menu-1";
const branchFilter = { type: "branch", isGlobal: false, branchId };
const context = {
  scope: { type: "branch", isGlobal: false, branchId },
  branchId,
  userId,
};
const clone = (value) => JSON.parse(JSON.stringify(value));

let state;
let failure;
let transactionPhase;

const initialState = () => ({
  inventory: [
    {
      _id: inventoryId,
      branchId,
      name: "Paneer",
      unit: "kg",
      currentStock: 0,
      lowStockThreshold: 2,
      menuItemId,
    },
    {
      _id: "inventory-2",
      branchId: otherBranchId,
      name: "Other branch item",
      unit: "pcs",
      currentStock: 8,
      lowStockThreshold: 2,
      menuItemId: null,
    },
  ],
  stockLogs: [],
  audits: [],
  menus: {
    [menuItemId]: { _id: menuItemId, available: false },
  },
});

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
      if (failure.commit) throw failure.commit;
      transactionPhase = "committed";
      return result;
    } catch (error) {
      state = snapshot;
      transactionPhase = "rolled_back";
      throw error;
    }
  });

  userRepository.findByIdWithSelection.mockResolvedValue({ role: "manager" });
  mockAuditCreated.mockImplementation(async (intent, options) => {
    state.audits.push({ action: "INVENTORY.CREATE", intent, options });
  });
  mockAuditRestocked.mockImplementation(async (intent, options) => {
    state.audits.push({ action: "INVENTORY.RESTOCK", intent, options });
  });
  mockAuditAdjusted.mockImplementation(async (intent, options) => {
    state.audits.push({ action: "INVENTORY.ADJUST", intent, options });
  });
  mockAuditFailure.mockImplementation(async (intent) => {
    state.audits.push({ action: intent.action, outcome: "FAILURE", intent });
  });

  inventoryRepository.findScopedById.mockImplementation(
    async (id, filter) => {
      const item = state.inventory.find(
        (candidate) =>
          candidate._id === id &&
          Object.entries(filter).every(
            ([key, value]) => candidate[key] === value,
          ),
      );
      return item ? clone(item) : null;
    },
  );
  inventoryRepository.findByScope.mockImplementation(async (id, scope) => {
    const item = state.inventory.find((candidate) =>
      candidate._id === id && candidate.branchId === scope.branchId);
    return item ? clone(item) : null;
  });
  inventoryRepository.save.mockImplementation(async (item) => {
    const index = state.inventory.findIndex(
      (candidate) => candidate._id === item._id,
    );
    state.inventory[index] = clone(item);
    if (failure.inventoryUpdate) throw failure.inventoryUpdate;
    return item;
  });
  inventoryRepository.createInventory.mockImplementation(async (data) => {
    const item = { _id: `inventory-${state.inventory.length + 1}`, ...clone(data) };
    state.inventory.push(item);
    if (failure.inventoryCreate) throw failure.inventoryCreate;
    return clone(item);
  });
  stockLogRepository.createLog.mockImplementation(async (data) => {
    const log = { _id: `log-${state.stockLogs.length + 1}`, ...clone(data) };
    state.stockLogs.push(log);
    if (failure.stockLogCreate) throw failure.stockLogCreate;
    return log;
  });
  menuRepository.updateAvailability.mockImplementation(
    async (id, available) => {
      state.menus[id] = { ...state.menus[id], available };
      if (failure.menuUpdate) throw failure.menuUpdate;
      return state.menus[id];
    },
  );
});

describe("Inventory restock transaction", () => {
  test("commits inventory, stock log, and menu availability together", async () => {
    const item = await inventoryService.restockItem(
      inventoryId,
      branchFilter,
      { quantity: 5, note: "Supplier delivery" },
      context,
    );

    expect(item.currentStock).toBe(5);
    expect(state.inventory[0].currentStock).toBe(5);
    expect(state.stockLogs).toEqual([
      expect.objectContaining({
        inventoryId,
        branchId,
        type: "restock",
        quantity: 5,
        stockBefore: 0,
        stockAfter: 5,
      }),
    ]);
    expect(state.menus[menuItemId].available).toBe(true);
    expect(transactionPhase).toBe("committed");
    expect(state.audits).toHaveLength(1);
    expect(mockAuditRestocked).toHaveBeenCalledWith(
      expect.objectContaining({
        previousQuantity: 0,
        addedQuantity: 5,
        availabilityChanged: true,
        context: expect.objectContaining({
          actor: userId,
          actorRole: "manager",
          branchId,
          correlationId: "inventory-correlation-1",
        }),
      }),
      { session },
    );
    expect(inventoryRepository.findByScope).toHaveBeenCalledWith(
      inventoryId,
      branchFilter,
      { session },
    );
    expect(inventoryRepository.save).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(stockLogRepository.createLog).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(menuRepository.updateAvailability).toHaveBeenCalledWith(
      menuItemId,
      true,
      { session },
    );
  });

  test.each([
    ["inventory update", "inventoryUpdate"],
    ["stock log creation", "stockLogCreate"],
    ["menu update", "menuUpdate"],
  ])("rolls back every write and preserves the original error when %s fails", async (_label, key) => {
    const originalError = new Error(`${key} failed`);
    const before = clone(state);
    failure[key] = originalError;

    await expect(
      inventoryService.restockItem(
        inventoryId,
        branchFilter,
        { quantity: 5 },
        context,
      ),
    ).rejects.toBe(originalError);

    expect({ ...state, audits: [] }).toEqual(before);
    expect(state.stockLogs).toHaveLength(0);
    expect(state.menus[menuItemId].available).toBe(false);
    expect(transactionPhase).toBe("rolled_back");
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
    expect(mockAuditFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INVENTORY.RESTOCK",
        entityId: inventoryId,
        error: originalError,
      }),
    );
  });

  test("keeps branch isolation inside the transaction", async () => {
    const before = clone(state);

    await expect(
      inventoryService.restockItem(
        "inventory-2",
        branchFilter,
        { quantity: 2 },
        context,
      ),
    ).rejects.toMatchObject({
      name: "AppError",
      message: "Item not found",
      statusCode: 404,
    });

    expect({ ...state, audits: [] }).toEqual(before);
    expect(transactionPhase).toBe("rolled_back");
  });

  test("rolls back the success audit on commit failure and writes only failure audit", async () => {
    const originalError = new Error("restock commit failed");
    failure.commit = originalError;

    await expect(
      inventoryService.restockItem(
        inventoryId,
        branchFilter,
        { quantity: 5 },
        context,
      ),
    ).rejects.toBe(originalError);

    expect(state.inventory[0].currentStock).toBe(0);
    expect(state.stockLogs).toHaveLength(0);
    expect(state.menus[menuItemId].available).toBe(false);
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
  });
});

describe("Manual stock adjustment transaction", () => {
  beforeEach(() => {
    state.inventory[0].currentStock = 4;
    state.menus[menuItemId].available = true;
  });

  test("commits the adjustment, log, and zero-stock availability change", async () => {
    const item = await inventoryService.adjustStock(
      inventoryId,
      branchFilter,
      { quantity: -10, note: "Damaged stock" },
      context,
    );

    expect(item.currentStock).toBe(0);
    expect(state.inventory[0].currentStock).toBe(0);
    expect(state.stockLogs[0]).toEqual(
      expect.objectContaining({
        type: "adjustment",
        quantity: -10,
        stockBefore: 4,
        stockAfter: 0,
      }),
    );
    expect(state.menus[menuItemId].available).toBe(false);
    expect(transactionPhase).toBe("committed");
    expect(mockAuditAdjusted).toHaveBeenCalledWith(
      expect.objectContaining({
        previousQuantity: 4,
        reason: "Damaged stock",
        availabilityChanged: true,
      }),
      { session },
    );
    expect(menuRepository.updateAvailability).toHaveBeenCalledWith(
      menuItemId,
      false,
      { session },
    );
  });

  test("rolls back the adjustment and preserves the original error", async () => {
    const originalError = new Error("adjustment menu update failed");
    const before = clone(state);
    failure.menuUpdate = originalError;

    await expect(
      inventoryService.adjustStock(
        inventoryId,
        branchFilter,
        { quantity: -4 },
        context,
      ),
    ).rejects.toBe(originalError);

    expect({ ...state, audits: [] }).toEqual(before);
    expect(state.stockLogs).toHaveLength(0);
    expect(transactionPhase).toBe("rolled_back");
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
  });

  test("rolls back the success audit on commit failure and writes only failure audit", async () => {
    const originalError = new Error("adjustment commit failed");
    failure.commit = originalError;

    await expect(
      inventoryService.adjustStock(
        inventoryId,
        branchFilter,
        { quantity: -4, note: "Expired" },
        context,
      ),
    ).rejects.toBe(originalError);

    expect(state.inventory[0].currentStock).toBe(4);
    expect(state.stockLogs).toHaveLength(0);
    expect(state.menus[menuItemId].available).toBe(true);
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
  });
});

describe("Inventory creation transaction", () => {
  const input = {
    name: "Tomatoes",
    unit: "kg",
    currentStock: 6,
    lowStockThreshold: 2,
    menuItemId,
  };

  test("commits the item, initial stock log, and menu availability", async () => {
    const item = await inventoryService.createInventory(input, context);

    expect(state.inventory).toContainEqual(
      expect.objectContaining({ _id: item._id, branchId, currentStock: 6 }),
    );
    expect(state.stockLogs).toEqual([
      expect.objectContaining({
        inventoryId: item._id,
        type: "restock",
        quantity: 6,
        stockBefore: 0,
        stockAfter: 6,
      }),
    ]);
    expect(state.menus[menuItemId].available).toBe(true);
    expect(transactionPhase).toBe("committed");
    expect(mockAuditCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuantity: 6,
        context: expect.objectContaining({ actorRole: "manager" }),
      }),
      { session },
    );
    expect(inventoryRepository.createInventory).toHaveBeenCalledWith(
      expect.objectContaining({ branchId, currentStock: 6 }),
      { session },
    );
    expect(stockLogRepository.createLog).toHaveBeenCalledWith(
      expect.any(Object),
      { session },
    );
    expect(menuRepository.updateAvailability).toHaveBeenCalledWith(
      menuItemId,
      true,
      { session },
    );
  });

  test("rolls back the item and initial log while preserving the original error", async () => {
    const originalError = new Error("creation menu update failed");
    const before = clone(state);
    failure.menuUpdate = originalError;

    await expect(
      inventoryService.createInventory(input, context),
    ).rejects.toBe(originalError);

    expect({ ...state, audits: [] }).toEqual(before);
    expect(state.stockLogs).toHaveLength(0);
    expect(state.menus[menuItemId].available).toBe(false);
    expect(transactionPhase).toBe("rolled_back");
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
  });

  test("rolls back an in-transaction audit when commit fails, then writes failure outside", async () => {
    const originalError = new Error("commit failed");
    failure.commit = originalError;

    await expect(
      inventoryService.createInventory(input, context),
    ).rejects.toBe(originalError);

    expect(state.inventory).toHaveLength(2);
    expect(state.stockLogs).toHaveLength(0);
    expect(state.audits).toEqual([
      expect.objectContaining({ outcome: "FAILURE" }),
    ]);
    expect(inventoryAudit.failure).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INVENTORY.CREATE",
        error: originalError,
      }),
    );
  });
});
