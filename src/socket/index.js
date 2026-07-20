const jwt = require("jsonwebtoken");
const User = require("../models/users");

const SOCKET_ROLES = new Set(["admin", "manager", "chef", "waiter", "cashier"]);

const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
};

const getHandshakeToken = (socket) => {
  const authorization = socket.handshake.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  return (
    socket.handshake.auth?.token ||
    bearerToken ||
    getCookieValue(socket.handshake.headers.cookie, "token")
  );
};

const getSocketRoom = (user) => {
  const branchId = user.branchId?.toString() || "global";
  return `branch:${branchId}:role:${user.role}`;
};

const authenticateSocket = async (socket, next) => {
  try {
    const token = getHandshakeToken(socket);
    if (!token) throw new Error("Missing token");

    const { _id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(_id);

    if (!user || user.status !== "active" || !SOCKET_ROLES.has(user.role)) {
      throw new Error("Unauthorized socket user");
    }

    // Only a branchless admin is permitted to receive global events.
    if (!user.branchId && user.role !== "admin") {
      throw new Error("User has no branch assignment");
    }

    socket.data.user = {
      id: user._id.toString(),
      role: user.role,
      branchId: user.branchId?.toString() ?? null,
    };
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
};

const initSocket = (io) => {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const room = getSocketRoom(user);

    // Room selection is derived exclusively from the authenticated user.
    socket.join(room);
    socket.emit("room:joined", {
      role: user.role,
      branchId: user.branchId,
    });
  });
};

module.exports = { initSocket, authenticateSocket, getSocketRoom };
