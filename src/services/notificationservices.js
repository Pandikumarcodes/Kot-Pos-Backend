// ── EVENT NAMES ───────────────────────────────────────────────

const EVENTS = {
  ORDER_NEW: "order:new",
  KOT_UPDATED: "kot:updated",
  TABLE_UPDATED: "table:updated",
  BILLING_UPDATED: "billing:created",
};

// ─────────────────────────────────────────────────────────────
// notify.newOrder
// Called when: waiter sends dine-in order OR cashier sends takeaway
// Emits to:    kitchen + admin
// Chef sees:   new KOT card instantly
// ─────────────────────────────────────────────────────────────
const newOrder = (io, kot) => {
  if (!io || !kot) return;
  io.to("kitchen").emit(EVENTS.ORDER_NEW, kot);
  io.to("admin").emit(EVENTS.ORDER_NEW, kot);
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
  if (!io || !kot) return;
  io.to("kitchen").emit(EVENTS.KOT_UPDATED, kot);
  io.to("waiters").emit(EVENTS.KOT_UPDATED, kot);
  io.to("cashiers").emit(EVENTS.KOT_UPDATED, kot);
  io.to("admin").emit(EVENTS.KOT_UPDATED, kot);
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
const tableUpdated = (io, table) => {
  if (!io || !table) return;
  io.to("admin").emit(EVENTS.TABLE_UPDATED, table);
  io.to("waiters").emit(EVENTS.TABLE_UPDATED, table);
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
const billingUpdated = (io, bill) => {
  if (!io || !bill) return;
  io.to("admin").emit(EVENTS.BILLING_UPDATED, bill);
  io.to("cashiers").emit(EVENTS.BILLING_UPDATED, bill);
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
