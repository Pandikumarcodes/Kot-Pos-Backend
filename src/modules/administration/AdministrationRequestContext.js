const crypto = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,200}$/;

const correlationIdFrom = (req) => {
  const supplied = req?.get?.("x-correlation-id") || req?.get?.("x-request-id");
  return typeof supplied === "string" && SAFE_CORRELATION_ID.test(supplied)
    ? supplied
    : crypto.randomUUID();
};

const run = (req, callback) =>
  storage.run(
    Object.freeze({
      req,
      correlationId: correlationIdFrom(req),
    }),
    callback,
  );

const current = () => {
  const store = storage.getStore();
  const user = store?.req?.user;
  return {
    actorId: user?._id ?? null,
    actorRole: user?.role ?? null,
    branchId: user?.branchId ?? store?.req?.branchId ?? null,
    correlationId: store?.correlationId ?? crypto.randomUUID(),
    requestId: store?.req?.get?.("x-request-id") ?? null,
    route: store?.req?.originalUrl ?? null,
    method: store?.req?.method ?? null,
  };
};

module.exports = { current, correlationIdFrom, run };
