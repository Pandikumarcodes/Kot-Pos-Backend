const kitchenRepository = require("../repositories/KitchenRepository");
const AppError = require("../utils/AppError");
const { notify } = require("./notificationservices");
const userRepository = require("../repositories/UserRepository");
const TransactionManager = require("../infrastructure/transaction/TransactionManager");
const orderAudit = require("../modules/orders/OrderAuditLogger");
const { AUDIT_ACTIONS } = require("../infrastructure/audit");

const transactionManager = new TransactionManager();

const listActiveOrders = (scopeToBranch) =>
  kitchenRepository.listActive(
    scopeToBranch({ status: { $in: ["pending", "preparing", "ready"] } }),
  );

const getOrder = async (orderId, scopeToBranch) => {
  const order = await kitchenRepository.findScoped(
    scopeToBranch({ _id: orderId }),
  );
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

const updateOrderStatus = async (
  orderId,
  status,
  scopeToBranch,
  io,
  { userId = null, actorRole = null, correlationId = null } = {},
) => {
  const filter = scopeToBranch({ _id: orderId });
  const action = orderAudit.kitchenAction(status);
  if (!action) {
    const unchangedWorkflowOrder = await kitchenRepository.updateStatus(
      filter,
      status,
    );
    if (!unchangedWorkflowOrder) throw new AppError("Order not found", 404);
    notify.kotUpdated(io, unchangedWorkflowOrder);
    return unchangedWorkflowOrder;
  }

  let auditContext = orderAudit.createContext({
    actorId: userId,
    actorRole,
    branchId: filter.branchId || null,
    correlationId,
  });
  let order;
  try {
    order = await transactionManager.execute(async (session) => {
      const existing = await kitchenRepository.findScoped(filter, { session });
      if (!existing) throw new AppError("Order not found", 404);

      const actorId = userId || existing.createdBy;
      const actor = actorRole || !actorId
        ? null
        : await userRepository.findByIdWithSelection(actorId, "role", { session });
      auditContext = orderAudit.createContext({
        actorId,
        actorRole: actorRole || actor?.role || null,
        branchId: existing.branchId || filter.branchId || null,
        correlationId: auditContext.correlationId,
      });
      const previousStatus = existing.status;

      const updated = await kitchenRepository.updateStatus(filter, status, {
        session,
      });
      if (!updated) throw new AppError("Order not found", 404);
      await orderAudit.kitchenStatusChanged(
        {
          context: auditContext,
          kot: updated,
          previousStatus,
          newStatus: status,
        },
        { session },
      );
      return updated;
    });
  } catch (error) {
    try {
      await orderAudit.failure({
        action,
        context: auditContext,
        entityId: orderId,
        error,
      });
    } catch (_auditFailure) {
      // A secondary audit outage must not replace the workflow error.
    }
    throw error;
  }
  notify.kotUpdated(io, order);
  return order;
};

module.exports = { listActiveOrders, getOrder, updateOrderStatus };
