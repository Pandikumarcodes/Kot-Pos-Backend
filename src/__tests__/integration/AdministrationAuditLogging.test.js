const mongoose = require("mongoose");
const AuditEvent = require("../../models/AuditEvent");
const {
  ACTOR_TYPES,
  AUDIT_ACTIONS,
  AUDIT_OUTCOMES,
  AuditManager,
} = require("../../infrastructure/audit");
const {
  AdministrationAuditLogger,
  errorCode,
  transactionId,
} = require("../../modules/administration/AdministrationAuditLogger");
const administrationRequestContext = require("../../modules/administration/AdministrationRequestContext");

const branchId = new mongoose.Types.ObjectId().toString();
const otherBranchId = new mongoose.Types.ObjectId().toString();
const staffId = new mongoose.Types.ObjectId().toString();
const branchEntityId = new mongoose.Types.ObjectId().toString();
const settingsId = new mongoose.Types.ObjectId().toString();
const session = { id: { id: Buffer.from("cafe", "hex") } };

const setup = (scope = branchId) => {
  const repository = {
    insert: jest.fn().mockResolvedValue(undefined),
    insertMany: jest.fn().mockResolvedValue(undefined),
  };
  const logger = new AdministrationAuditLogger(new AuditManager({ repository }));
  const context = logger.createContext({ actorId: "admin-1", actorRole: "admin",
    branchId: scope, correlationId: "administration-correlation-1" });
  return { context, logger, repository };
};
const inserted = (repository) => repository.insert.mock.calls[0][0];
const expectContract = (event, action, entityId = staffId, scope = branchId) => {
  expect(new AuditEvent(event).validateSync()).toBeUndefined();
  expect(event).toMatchObject({ schemaVersion: 1, action,
    outcome: AUDIT_OUTCOMES.SUCCESS, actor: "admin-1", actorRole: "admin",
    actorType: ACTOR_TYPES.USER, branchId: scope, entityId,
    correlationId: "administration-correlation-1", transactionId: "cafe",
    metadata: { source: "APPLICATION", service: "administration" } });
  expect(event.timestamp).toBeInstanceOf(Date);
};

describe("administration audit event contracts", () => {
  test("request scope resolves the authenticated actor without controller changes", async () => {
    const req = { method: "PUT", originalUrl: "/api/v1/admin/settings",
      get: jest.fn((name) => name === "x-correlation-id" ? "request-correlation" : null) };
    await administrationRequestContext.run(req, async () => {
      req.user = { _id: "admin-from-request", role: "admin", branchId };
      const logger = new AdministrationAuditLogger({});
      const context = logger.createContext();
      expect(context).toMatchObject({ actor: "admin-from-request", actorRole: "admin",
        branchId, correlationId: "request-correlation", route: req.originalUrl,
        method: "PUT" });
    });
  });

  test("STAFF.CREATE captures actor, branch, staff snapshot, correlation, and transaction", async () => {
    const { context, logger, repository } = setup();
    await logger.staffCreated({ context, staff: { _id: staffId, username: "chef1",
      role: "chef", status: "active", branchId, password: "never-store" } }, { session });
    const event = inserted(repository);
    expectContract(event, AUDIT_ACTIONS.STAFF_CREATE);
    expect(event.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "role", before: null, after: "chef" }),
      expect.objectContaining({ path: "status", before: null, after: "active" }),
    ]));
    expect(JSON.stringify(event)).not.toContain("never-store");
  });

  test("STAFF.UPDATE stores changed fields only", async () => {
    const { context, logger, repository } = setup();
    await logger.staffUpdated({ context, staffId,
      before: { username: "chef1", role: "chef", status: "active", branchId },
      after: { username: "chef-two", role: "chef", status: "active", branchId } }, { session });
    const event = inserted(repository);
    expectContract(event, AUDIT_ACTIONS.STAFF_UPDATE);
    expect(event.changes).toHaveLength(1);
    expect(event.changes[0]).toMatchObject({ path: "username", before: "chef1", after: "chef-two" });
  });

  test("STAFF.DELETE captures the deleted staff snapshot", async () => {
    const { context, logger, repository } = setup();
    await logger.staffDeleted({ context, staff: { _id: staffId, username: "chef1",
      role: "chef", status: "active", branchId } }, { session });
    expectContract(inserted(repository), AUDIT_ACTIONS.STAFF_DELETE);
  });

  test("role change emits one STAFF.ROLE_CHANGE and one security ROLE_ASSIGNMENT", async () => {
    const { context, logger, repository } = setup();
    await logger.roleChanged({ context, staffId, previousRole: "waiter", newRole: "manager" }, { session });
    const events = repository.insertMany.mock.calls[0][0];
    expect(events).toHaveLength(2);
    expect(events.map(({ action }) => action)).toEqual([
      AUDIT_ACTIONS.STAFF_ROLE_CHANGE, AUDIT_ACTIONS.ROLE_ASSIGNMENT,
    ]);
    for (const event of events) expectContract(event, event.action);
    expect(new Set(events.map(({ eventId }) => eventId)).size).toBe(2);
    expect(repository.insertMany).toHaveBeenCalledTimes(1);
  });

  test("status, account lock/unlock, and permission transitions preserve previous and new values", async () => {
    const { context, logger, repository } = setup();
    await logger.statusChanged({ context, staffId, previousStatus: "active", newStatus: "locked" }, { session });
    await logger.accountLockChanged({ context, staffId, previousStatus: "active", locked: true }, { session });
    await logger.accountLockChanged({ context, staffId, previousStatus: "locked", locked: false }, { session });
    await logger.permissionChanged({ context, staffId, previousPermission: "read", newPermission: "write" }, { session });
    const events = repository.insert.mock.calls.map(([event]) => event);
    expect(events.map(({ action }) => action)).toEqual([
      AUDIT_ACTIONS.STAFF_STATUS_CHANGE, AUDIT_ACTIONS.ACCOUNT_LOCK,
      AUDIT_ACTIONS.ACCOUNT_UNLOCK, AUDIT_ACTIONS.PERMISSION_CHANGE,
    ]);
    events.forEach((event) => expectContract(event, event.action));
  });

  test("BRANCH.CREATE, UPDATE, and DELETE are schema-valid and branch isolated", async () => {
    const { context, logger, repository } = setup(branchEntityId);
    const before = { name: "Old", address: "A", isActive: true };
    const after = { _id: branchEntityId, name: "New", address: "A", isActive: true };
    await logger.branchCreated({ context, branch: after }, { session });
    await logger.branchUpdated({ context, branchId: branchEntityId, before, after }, { session });
    await logger.branchDeleted({ context, branch: { ...after, isActive: false }, previousActive: true }, { session });
    const events = repository.insert.mock.calls.map(([event]) => event);
    [AUDIT_ACTIONS.BRANCH_CREATE, AUDIT_ACTIONS.BRANCH_UPDATE, AUDIT_ACTIONS.BRANCH_DELETE]
      .forEach((action, index) => expectContract(events[index], action, branchEntityId, branchEntityId));
    expect(events[1].changes).toHaveLength(1);
    expect(events[1].changes[0].path).toBe("name");
  });

  test("SETTINGS.UPDATE and RESET retain category and changed fields while redacting nested secrets", async () => {
    const { context, logger, repository } = setup();
    const before = { taxRate: 5, paymentMethods: { cash: true, apiKey: "old-key",
      paymentCredentials: { privateKey: "old-private-key" } } };
    const after = { taxRate: 12, paymentMethods: { cash: true, apiKey: "new-key",
      paymentCredentials: { privateKey: "new-private-key" } } };
    await logger.settingsChanged({ context, settingsId, before, after, category: "billing" }, { session });
    await logger.settingsChanged({ context, settingsId, before: after,
      after: { taxRate: 5 }, category: "billing", reset: true }, { session });
    const events = repository.insert.mock.calls.map(([event]) => event);
    expectContract(events[0], AUDIT_ACTIONS.SETTINGS_UPDATE, settingsId);
    expectContract(events[1], AUDIT_ACTIONS.SETTINGS_RESET, settingsId);
    expect(events[0].metadata.businessReference).toBe("billing");
    expect(events[0].changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "taxRate", before: 5, after: 12 }),
    ]));
    expect(events[0].changes.some(({ path }) => /api.?key/i.test(path))).toBe(false);
    expect(JSON.stringify(events)).not.toMatch(/old-key|new-key|private-key|paymentCredentials/i);
  });

  test.each([
    [AUDIT_ACTIONS.AUTH_LOGIN, "authenticated"],
    [AUDIT_ACTIONS.AUTH_LOGOUT, "logged_out"],
    [AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE, "password_changed"],
    [AUDIT_ACTIONS.AUTH_PROFILE_UPDATE, "profile_updated"],
  ])("%s captures identity, outcome, timestamp, and correlation without credentials", async (action, statusAfter) => {
    const { context, logger, repository } = setup();
    await logger.authentication({ action, context, userId: staffId,
      statusBefore: "authenticated", statusAfter }, { session });
    const event = inserted(repository);
    expectContract(event, action, staffId);
    expect(JSON.stringify(event)).not.toMatch(/password=|bearer |refresh.?token|cookie|secret-value/i);
  });

  test("branch identities remain isolated for the same entity and correlation shape", async () => {
    const first = setup(branchId);
    const second = setup(otherBranchId);
    await first.logger.statusChanged({ context: first.context, staffId,
      previousStatus: "active", newStatus: "locked" }, { session });
    await second.logger.statusChanged({ context: second.context, staffId,
      previousStatus: "locked", newStatus: "active" }, { session });
    expect(inserted(first.repository).branchId).toBe(branchId);
    expect(inserted(second.repository).branchId).toBe(otherBranchId);
  });

  test("FAILURE is minimal, sanitized, sessionless, and does not expose diagnostics", async () => {
    const { context, logger, repository } = setup();
    const error = Object.assign(new Error("MongoDB password=secret-value"), {
      code: 11000, stack: "private stack", authorization: "Bearer jwt-value",
    });
    await logger.failure({ action: AUDIT_ACTIONS.STAFF_CREATE, context,
      entityId: staffId, error });
    const event = inserted(repository);
    expect(new AuditEvent(event).validateSync()).toBeUndefined();
    expect(event).toMatchObject({ action: AUDIT_ACTIONS.STAFF_CREATE,
      outcome: AUDIT_OUTCOMES.FAILURE, actor: "admin-1", branchId,
      entityId: staffId, correlationId: "administration-correlation-1",
      transactionId: null, changes: [], metadata: {
        service: "administration", errorCode: "ADMIN_OPERATION_FAILED",
      } });
    expect(JSON.stringify(event)).not.toMatch(/mongodb|password|secret-value|private stack|authorization|bearer|jwt-value/i);
    expect(repository.insert).toHaveBeenCalledWith(event, {});
  });

  test("normalizes transaction and error identifiers", () => {
    expect(transactionId(session)).toBe("cafe");
    expect(errorCode({ statusCode: 403, message: "secret" })).toBe("ADMIN_HTTP_403");
    expect(errorCode({ code: 11000, message: "MongoDB duplicate" })).toBe("ADMIN_OPERATION_FAILED");
  });
});
