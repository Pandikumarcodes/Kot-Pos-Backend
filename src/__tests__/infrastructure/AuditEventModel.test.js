const AuditEvent = require("../../models/AuditEvent");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AUDIT_LEVELS,
  RETENTION_CLASSES,
} = require("../../infrastructure/audit");

const validEvent = (overrides = {}) => ({
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  schemaVersion: 1,
  timestamp: new Date("2026-08-01T12:00:00.000Z"),
  level: AUDIT_LEVELS.CRITICAL,
  retentionClass: RETENTION_CLASSES.SECURITY,
  expiresAt: new Date("2028-07-31T12:00:00.000Z"),
  actor: "user-1",
  actorRole: "admin",
  actorType: ACTOR_TYPES.USER,
  branchId: "507f1f77bcf86cd799439011",
  entityType: "USER",
  entityId: "user-2",
  action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
  outcome: AUDIT_OUTCOMES.SUCCESS,
  changes: [],
  metadata: { source: "HTTP" },
  correlationId: "correlation-1",
  transactionId: null,
  ...overrides,
});

describe("AuditEvent model", () => {
  test("accepts the canonical event shape", () => {
    const document = new AuditEvent(validEvent());

    expect(document.validateSync()).toBeUndefined();
  });

  test("rejects unknown fields instead of silently persisting them", () => {
    expect(() => new AuditEvent(validEvent({ password: "secret" }))).toThrow(
      /not in schema and strict mode is set to throw/,
    );
  });

  test("defines TTL expiry and a valid partial index for failures", () => {
    const indexes = AuditEvent.schema.indexes();
    const ttlIndex = indexes.find(([fields]) => fields.expiresAt === 1);
    const outcomeIndex = indexes.find(
      ([fields]) => fields.outcome === 1 && fields.timestamp === -1,
    );

    expect(ttlIndex?.[1]).toEqual(expect.objectContaining({ expireAfterSeconds: 0 }));
    expect(outcomeIndex?.[1].partialFilterExpression).toEqual({
      outcome: {
        $in: [
          AUDIT_OUTCOMES.FAILURE,
          AUDIT_OUTCOMES.DENIED,
          AUDIT_OUTCOMES.PARTIAL,
          AUDIT_OUTCOMES.NO_OP,
        ],
      },
    });
  });

  test("blocks update and delete queries before they reach MongoDB", async () => {
    await expect(AuditEvent.updateOne({}, { outcome: "FAILURE" })).rejects.toThrow(
      "AuditEvent is append-only",
    );
    await expect(AuditEvent.deleteOne({})).rejects.toThrow(
      "AuditEvent is append-only",
    );
  });
});
