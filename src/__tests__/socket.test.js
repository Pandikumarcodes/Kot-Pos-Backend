const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "socket_test_secret";

jest.mock("../models/users");
const User = require("../models/users");

const {
  authenticateSocket,
  getSocketRoom,
  initSocket,
} = require("../socket");

const makeSocket = (overrides = {}) => ({
  handshake: { auth: {}, headers: {} },
  data: {},
  join: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  ...overrides,
});

const makeToken = (userId = "user_123") =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });

describe("Socket.IO authentication", () => {
  beforeEach(() => jest.clearAllMocks());

  it("authenticates a valid active user and derives role and branch from the database", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    const user = { _id: "user_123", role: "chef", branchId: "branch_123", status: "active" };
    User.findById.mockResolvedValue(user);
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: "user_123", role: "chef", branchId: "branch_123" });
    expect(getSocketRoom(socket.data.user)).toBe("branch:branch_123:role:chef");
  });

  it("rejects a missing or invalid user even with a valid JWT", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue(null);
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthorized" }));
    expect(socket.data.user).toBeUndefined();
  });

  it("rejects inactive accounts", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue({ _id: "user_123", role: "admin", status: "locked" });
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthorized" }));
  });

  it("joins only the server-derived room and does not register a client room selector", () => {
    let connectionHandler;
    const io = {
      use: jest.fn(),
      on: jest.fn((event, handler) => {
        if (event === "connection") connectionHandler = handler;
      }),
    };
    const socket = makeSocket({
      data: { user: { id: "user_123", role: "cashier", branchId: "branch_123" } },
    });

    initSocket(io);
    connectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith("branch:branch_123:role:cashier");
    expect(socket.on).not.toHaveBeenCalled();
  });
});
