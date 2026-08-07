jest.mock("../../repositories/BillingRepository", () => ({
  findMaxSequenceForDate: jest.fn(),
  findScoped: jest.fn(),
  createBillDocument: jest.fn(),
}));
jest.mock("../../repositories/CounterRepository", () => ({
  findOne: jest.fn(),
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
    counterRepository.findOne.mockResolvedValue({
      key: "billing:20260805",
      sequence: 0,
    });
  });

  afterEach(() => jest.useRealTimers());

  test("starts at 001 and passes the active session to the atomic increment", async () => {
    counterRepository.findOne.mockResolvedValueOnce(null);
    billingRepository.findMaxSequenceForDate.mockResolvedValue(0);
    counterRepository.findOneAndUpdate
      .mockResolvedValueOnce({ sequence: 0 })
      .mockResolvedValueOnce({ sequence: 1 });

    await expect(generateBillNumber({ session })).resolves.toBe(
      "BILL-20260805-001",
    );
    expect(counterRepository.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
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
    counterRepository.findOne.mockResolvedValueOnce(null);
    billingRepository.findMaxSequenceForDate.mockResolvedValue(1);
    counterRepository.findOneAndUpdate
      .mockResolvedValueOnce({ sequence: 1 })
      .mockResolvedValueOnce({ sequence: 2 });

    await expect(generateBillNumber({ session })).resolves.toBe(
      "BILL-20260805-002",
    );
    expect(billingRepository.findMaxSequenceForDate).toHaveBeenCalled();
  });

  test("allocates distinct values for concurrent atomic increments", async () => {
    let sequence = 0;
    counterRepository.findOneAndUpdate.mockImplementation(async () => ({
      sequence: ++sequence,
    }));

    await expect(
      Promise.all([
        generateBillNumber({ session }),
        generateBillNumber({ session }),
      ]),
    ).resolves.toEqual(["BILL-20260805-001", "BILL-20260805-002"]);
  });
});
