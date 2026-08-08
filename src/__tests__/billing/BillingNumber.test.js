jest.mock("../../repositories/BillingRepository", () => ({
  findMaxSequenceForDate: jest.fn(),
  findScoped: jest.fn(),
  createBillDocument: jest.fn(),
}));
jest.mock("../../repositories/CounterRepository", () => ({
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
);
jest.mock("../../repositories/MenuRepository", () => ({}));
jest.mock("../../repositories/TableRepository", () => ({}));
jest.mock("../../services/notificationservices", () => ({
  notify: { billingUpdated: jest.fn() },
}));
jest.mock("../../modules/billing/BillingAuditLogger", () => ({}));

const billingRepository = require("../../repositories/BillingRepository");
const counterRepository = require("../../repositories/CounterRepository");
const { generateBillNumber } = require("../../services/billingService");

describe("atomic billing number generation", () => {
  const session = { id: "billing-number-session" };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-05T10:00:00.000Z"));
    jest.clearAllMocks();
    billingRepository.findMaxSequenceForDate.mockResolvedValue(0);
  });

  afterEach(() => jest.useRealTimers());

  test("starts at 001 with separate synchronization and atomic increment", async () => {
    counterRepository.findOneAndUpdate.mockResolvedValueOnce({ sequence: 1 });

    await expect(generateBillNumber({ session })).resolves.toBe(
      "BILL-20260805-001",
    );
    expect(counterRepository.updateOne).toHaveBeenCalledWith(
      { key: "billing:20260805" },
      { $max: { sequence: 0 } },
      expect.objectContaining({ upsert: true, session }),
    );
    expect(counterRepository.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { key: "billing:20260805" },
      { $inc: { sequence: 1 } },
      expect.objectContaining({
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session,
      }),
    );
  });

  test("bootstraps past an existing BILL-YYYYMMDD-001 record", async () => {
    billingRepository.findMaxSequenceForDate.mockResolvedValue(1);
    counterRepository.updateOne.mockResolvedValueOnce({ acknowledged: true });
    counterRepository.findOneAndUpdate.mockResolvedValueOnce({ sequence: 101 });

    await expect(generateBillNumber({ session })).resolves.toBe(
      "BILL-20260805-101",
    );
    expect(billingRepository.findMaxSequenceForDate).toHaveBeenCalled();
  });

  test.each([
    [100, 90, 101],
    [100, 100, 101],
    [100, 110, 111],
  ])("allocates above historical max %i with counter %i", async (historicalMax, _counterValue, next) => {
    billingRepository.findMaxSequenceForDate.mockResolvedValue(historicalMax);
    counterRepository.findOneAndUpdate.mockResolvedValue({ sequence: next });

    await expect(generateBillNumber()).resolves.toBe(`BILL-20260805-${String(next).padStart(3, "0")}`);
    expect(counterRepository.updateOne).toHaveBeenCalledWith(
      { key: "billing:20260805" },
      { $max: { sequence: historicalMax } },
      expect.objectContaining({ upsert: true }),
    );
  });

  test("initializes a missing counter from historical max before allocating", async () => {
    billingRepository.findMaxSequenceForDate.mockResolvedValue(100);
    counterRepository.findOneAndUpdate.mockResolvedValue({ sequence: 101 });

    await expect(generateBillNumber()).resolves.toBe("BILL-20260805-101");
    expect(counterRepository.updateOne).toHaveBeenCalledWith(
      { key: "billing:20260805" },
      { $max: { sequence: 100 } },
      expect.objectContaining({ upsert: true }),
    );
  });

  test("allocates distinct values for concurrent atomic increments", async () => {
    let sequence = 0;
    counterRepository.updateOne.mockResolvedValue({ acknowledged: true });
    counterRepository.findOneAndUpdate.mockImplementation(async () => ({
      sequence: ++sequence,
    }));

    await expect(
      Promise.all([
        generateBillNumber({ session }),
        generateBillNumber({ session }),
      ]),
    ).resolves.toEqual(["BILL-20260805-001", "BILL-20260805-002"]);
    expect(counterRepository.updateOne.mock.calls.every(([, update]) =>
      update.$max && !update.$inc,
    )).toBe(true);
    expect(counterRepository.findOneAndUpdate.mock.calls.every(([, update]) =>
      update.$inc && !update.$max,
    )).toBe(true);
  });

  test("does not reuse a sequence after a failed business transaction", async () => {
    counterRepository.updateOne.mockResolvedValue({ acknowledged: true });
    counterRepository.findOneAndUpdate
      .mockResolvedValueOnce({ sequence: 7 })
      .mockResolvedValueOnce({ sequence: 8 });

    await expect(generateBillNumber()).resolves.toBe("BILL-20260805-007");
    // The failed bill transaction is outside this allocator; the next call
    // receives the next atomic counter value rather than reusing 007.
    await expect(generateBillNumber()).resolves.toBe("BILL-20260805-008");
  });

  test("handles a concurrent first-counter upsert without a conflicting path update", async () => {
    const duplicateKey = Object.assign(new Error("duplicate counter key"), {
      code: 11000,
      keyPattern: { key: 1 },
    });
    counterRepository.updateOne
      .mockRejectedValueOnce(duplicateKey)
      .mockResolvedValueOnce({ acknowledged: true });
    counterRepository.findOneAndUpdate.mockResolvedValue({ sequence: 1 });

    await expect(generateBillNumber()).resolves.toBe("BILL-20260805-001");
    expect(counterRepository.updateOne).toHaveBeenNthCalledWith(
      2,
      { key: "billing:20260805" },
      { $max: { sequence: 0 } },
      {},
    );
  });

  test("retains global bill number uniqueness", () => {
    const Billing = require("../../models/billings");
    expect(Billing.schema.path("billNumber").options.unique).toBe(true);
  });
});
