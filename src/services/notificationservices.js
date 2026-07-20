// ── EVENT NAMES ───────────────────────────────────────────────

const EVENTS = {
  ORDER_NEW: "order:new",
  KOT_UPDATED: "kot:updated",
  TABLE_UPDATED: "table:updated",
  BILLING_UPDATED: "billing:created",
};

const roleRoom = (branchId, role) =>
  `branch:${branchId?.toString() || "global"}:role:${role}`;

const emitToRoles = (io, branchId, roles, event, payload) => {
  if (!io || !branchId) return;

  roles.forEach((role) => io.to(roleRoom(branchId, role)).emit(event, payload));

  // A branchless admin is the explicit super-admin role and may observe all
  // branches. Other clients only receive their own branch room.
  roles
    .filter((role) => role === "admin")
    .forEach((role) => io.to(roleRoom("global", role)).emit(event, payload));
};

// ─────────────────────────────────────────────────────────────
// notify.newOrder
// Called when: waiter sends dine-in order OR cashier sends takeaway
// Emits to:    kitchen + admin
// Chef sees:   new KOT card instantly
// ─────────────────────────────────────────────────────────────
const newOrder = (io, kot) => {
  if (!io || !kot?.branchId) return;
  emitToRoles(io, kot.branchId, ["chef", "admin", "manager"], EVENTS.ORDER_NEW, kot);
  console.log(
    `📤 [notify] order:new → kitchen + admin` +
      ` | type: ${kot.orderType}` +
      ` | id: ${kot._id}`,
  );
};

// ─────────────────────────────────────────────────────────────
// notify.kotUpdated
// Called when: chef changes status (preparing / ready / cancelled)
// Emits to:    kitchen + waiters + cashiers + admin
// Who cares:
//   - kitchen  → chef's own screen updates
//   - waiters  → "order ready, go serve table X"
//   - cashiers → "takeaway ready for pickup"
//   - admin    → live dashboard
// ─────────────────────────────────────────────────────────────
const kotUpdated = (io, kot) => {
  if (!io || !kot?.branchId) return;
  emitToRoles(
    io,
    kot.branchId,
    ["chef", "waiter", "cashier", "admin", "manager"],
    EVENTS.KOT_UPDATED,
    kot,
  );
  console.log(
    `📤 [notify] kot:updated → all rooms` +
      ` | status: ${kot.status}` +
      ` | type: ${kot.orderType}` +
      ` | id: ${kot._id}`,
  );
};

// ─────────────────────────────────────────────────────────────
// notify.tableUpdated
// Called when: table allocated, freed, or status changes
// Emits to:    admin + waiters
// ─────────────────────────────────────────────────────────────
const tableUpdated = (io, table, branchId = table?.branchId) => {
  if (!io || !table || !branchId) return;
  emitToRoles(
    io,
    branchId,
    ["admin", "manager", "waiter"],
    EVENTS.TABLE_UPDATED,
    table,
  );
  console.log(
    `📤 [notify] table:updated → admin + waiters` +
      ` | table: ${table.tableNumber}` +
      ` | status: ${table.status}`,
  );
};

// ─────────────────────────────────────────────────────────────
// notify.billingUpdated
// Called when: bill created or marked paid
// Emits to:    admin + cashiers
// ─────────────────────────────────────────────────────────────
const billingUpdated = (io, bill, branchId = bill?.branchId) => {
  if (!io || !bill || !branchId) return;
  emitToRoles(
    io,
    branchId,
    ["admin", "manager", "cashier"],
    EVENTS.BILLING_UPDATED,
    bill,
  );
  console.log(
    `📤 [notify] billing:created → admin + cashiers` +
      ` | bill: ${bill.billNumber}` +
      ` | amount: ${bill.totalAmount}`,
  );
};

// ─────────────────────────────────────────────────────────────
// notify.toRoom — generic emitter for custom use cases
// notify.toRoom(io, "kitchen", "custom:event", payload)
// ─────────────────────────────────────────────────────────────

const toRoom = (io, room, event, payload) => {
  if (!io || !room || !event) return;
  io.to(room).emit(event, payload);
  console.log(`📤 [notify] ${event} → ${room}`);
};

// ─────────────────────────────────────────────────────────────
// notify.toAll — broadcast to every connected socket
// ─────────────────────────────────────────────────────────────

const toAll = (io, event, payload) => {
  if (!io || !event) return;
  io.emit(event, payload);
  console.log(`📤 [notify] ${event} → ALL`);
};

// ── Export ────────────────────────────────────────────────────
const notify = {
  newOrder,
  kotUpdated,
  tableUpdated,
  billingUpdated,
  toRoom,
  toAll,
};

module.exports = { notify, EVENTS };
