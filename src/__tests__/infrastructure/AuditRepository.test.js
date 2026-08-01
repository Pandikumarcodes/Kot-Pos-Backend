const mongoose = require("mongoose");
const auditRepository = require("../../repositories/AuditRepository");
const {
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AuditValidationError,
  RETENTION_CLASSES,
} = require("../../infrastructure/audit");

describe("AuditRepository query contracts", () => {
  test("builds allowlisted filters and an inclusive time range", () => {
    const query = auditRepository.search({
      actor: "user-1",
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      outcome: AUDIT_OUTCOMES.FAILURE,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-01T23:59:59.999Z",
    });

    expect(query.getFilter()).toEqual({
      actor: "user-1",
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      outcome: AUDIT_OUTCOMES.FAILURE,
      timestamp: {
        $gte: new Date("2026-08-01T00:00:00.000Z"),
        $lte: new Date("2026-08-01T23:59:59.999Z"),
      },
    });
    expect(query.getOptions()).toEqual(
      expect.objectContaining({ sort: { timestamp: -1, _id: -1 }, limit: 50 }),
    );
  });

  test("uses timestamp and ObjectId as a stable descending cursor", () => {
    const id = new mongoose.Types.ObjectId();
    const timestamp = new Date("2026-08-01T12:00:00.000Z");
    const query = auditRepository.search(
      { entityId: "inventory-1" },
      { limit: 10, cursor: { timestamp, id: id.toString() } },
    );

    expect(query.getFilter()).toEqual({
      entityId: "inventory-1",
      $and: [
        {
          $or: [
            { timestamp: { $lt: timestamp } },
            { timestamp, _id: { $lt: id } },
          ],
        },
      ],
    });
    expect(query.getOptions().limit).toBe(10);
  });

  test.each([
    [{ outcome: "UNKNOWN" }, {}, "outcome is invalid"],
    [{ action: "UNKNOWN.ACTION" }, {}, "action is invalid"],
    [{ from: "not-a-date" }, {}, "from must be a valid date"],
    [{}, { limit: 0 }, "Audit search limit must be between 1 and 100"],
    [{}, { cursor: { timestamp: new Date(), id: "bad-id" } }, "cursor is invalid"],
  ])("rejects invalid search input", (filters, options, message) => {
    expect(() => auditRepository.search(filters, options)).toThrow(message);
  });

  test("builds a retention count without exposing deletion", () => {
    const before = new Date("2025-01-01T00:00:00.000Z");
    const query = auditRepository.countForRetention({
      retentionClass: RETENTION_CLASSES.OPERATIONAL,
      before,
    });

    expect(query.getFilter()).toEqual({
      retentionClass: RETENTION_CLASSES.OPERATIONAL,
      timestamp: { $lt: before },
    });
    expect(auditRepository.deleteMany).toBeUndefined();
  });

  test("uses typed validation errors for invalid repository input", () => {
    expect(() => auditRepository.search(null, { limit: 1 })).toThrow(
      AuditValidationError,
    );
    expect(() =>
      auditRepository.countForRetention({
        retentionClass: null,
        before: new Date(),
      }),
    ).toThrow(AuditValidationError);
  });
});
