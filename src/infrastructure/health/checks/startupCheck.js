function checkStartup({ lifecycle } = {}) {
  const state = lifecycle?.getState?.();
  if (state === "draining") return { status: "unhealthy", reason: "lifecycle is draining" };
  if (state !== "ready" || !lifecycle?.isStartupCompleted?.()) return { status: "unhealthy", reason: "startup is not complete" };
  return { status: "healthy" };
}

module.exports = { checkStartup };
