function checkSocket({ socket, lifecycle } = {}) {
  if (!socket) return { status: "unhealthy", reason: "Socket.IO instance is not initialized" };
  if (lifecycle?.getState?.() === "draining") return { status: "unhealthy", reason: "lifecycle is draining" };
  const attached = Boolean(socket.httpServer || socket.engine?.httpServer || socket.server);
  return attached ? { status: "healthy" } : { status: "unhealthy", reason: "Socket.IO is not attached to an HTTP server" };
}

module.exports = { checkSocket };
