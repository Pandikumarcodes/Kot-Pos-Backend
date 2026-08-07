jest.mock("../repositories/SettingsRepository", () => ({
  findScoped: jest.fn(),
  createSettings: jest.fn(),
  updateScoped: jest.fn(),
}));
jest.mock("../infrastructure/cache", () => ({
  cache: { getOrSet: jest.fn((key, factory) => factory()), del: jest.fn(), invalidatePattern: jest.fn() },
  cacheKeys: { settings: jest.fn(({ branchId }) => `settings:${branchId}`) },
}));
jest.mock("../modules/administration/AdministrationAuditLogger", () => ({
  createContext: jest.fn((values = {}) => values),
  settingsChanged: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));

const settingsRepository = require("../repositories/SettingsRepository");
const settingsService = require("../services/settingsService");
const { assertBillingScope, normalizeBillingFilter } = require("../repositories/BillingRepository");

describe("scope safety contracts", () => {
  test("billing repository rejects missing and global scope", () => {
    expect(() => assertBillingScope()).toThrow();
    expect(() => assertBillingScope({ type: "global", isGlobal: true, branchId: null }, {
      createdBy: { $in: [] },
    })).toThrow();
  });

  test("billing membership filter normalizes and drops malformed member IDs", () => {
    const filter = normalizeBillingFilter({
      createdBy: { $in: ["not-an-id"] },
    });
    expect(filter.createdBy.$in).toEqual([]);
  });

  test("branch settings use an explicit branch filter", async () => {
    settingsRepository.findScoped.mockResolvedValue({ branchId: "branch-a" });
    await settingsService.getSettings({ type: "branch", isGlobal: false, branchId: "branch-a" });
    expect(settingsRepository.findScoped).toHaveBeenCalledWith({ branchId: "branch-a" });
  });

  test("global settings without selected branch are rejected before repository access", async () => {
    await expect(settingsService.getSettings({ type: "global", isGlobal: true, branchId: null }))
      .rejects.toMatchObject({ status: 403 });
    expect(settingsRepository.findScoped).not.toHaveBeenCalledWith({});
  });

  test("cashier settings remain sanitized", () => {
    const result = settingsService.sanitizeCashierSettings({
      businessName: "POS",
      fssai: "secret",
      paymentMethods: { cash: 1, card: 0, upi: true },
    });
    expect(result).toEqual({
      businessName: "POS",
      paymentMethods: { cash: true, card: false, upi: true },
    });
  });
});
