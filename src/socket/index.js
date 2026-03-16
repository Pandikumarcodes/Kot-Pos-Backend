// ─────────────────────────────────────────────────────────────
// src/socket/index.js
//
// Handles ONLY connection lifecycle and room joining.
// All emit logic has moved to src/services/notificationService.js
// ─────────────────────────────────────────────────────────────

const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Client joins their role-based room ────────────────────
    socket.on("join:room", (role) => {
      const roomMap = {
        chef: "kitchen",
        waiter: "waiters",
        cashier: "cashiers",
        admin: "admin",
        manager: "admin",
      };

      const room = roomMap[role];
      if (!room) return;

      socket.join(room);
      console.log(
        `👤 Socket ${socket.id} joined room: "${room}" (role: ${role})`,
      );

      // Confirm back to client
      socket.emit("room:joined", { room, role });
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} — ${reason}`);
    });
  });
};

// Only initSocket is exported — emit functions live in notificationService
module.exports = { initSocket };
