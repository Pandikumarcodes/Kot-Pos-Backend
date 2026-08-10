const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "socket_test_secret";

jest.mock("../models/users");
jest.mock("../models/Branch", () => ({ findById: jest.fn() }));
const User = require("../models/users");
const Branch = require("../models/Branch");

const {
  authenticateSocket,
  getSocketRoom,
  initSocket,
} = require("../socket");
const { notify, EVENTS } = require("../services/notificationservices");

const makeSocket = (overrides = {}) => ({
  handshake: { auth: {}, headers: {} },
  data: {},
  join: jest.fn(),
  emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  ...overrides,
});

const makeToken = (userId = "user_123") =>
  jwt.sign({ _id: userId }, process.env.JWT_SECRET, { expiresIn: "15m" });

const mockBranchActive = (isActive = true) => {
  Branch.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: "branch_123", isActive }),
    }),
  });
};

describe("Socket.IO authentication", () => {
  beforeEach(() => jest.clearAllMocks());

  it("authenticates a valid active user and derives role and branch from the database", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    const user = { _id: "user_123", role: "chef", branchId: "branch_123", status: "active" };
    User.findById.mockResolvedValue(user);
    mockBranchActive(true);
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: "user_123", role: "chef", branchId: "branch_123" });
    expect(getSocketRoom(socket.data.user)).toBe("branch:branch_123:role:chef");
  });

  it("rejects branch staff assigned to an inactive branch", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue({
      _id: "user_123",
      role: "waiter",
      branchId: "branch_123",
      status: "active",
    });
    mockBranchActive(false);
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthorized" }));
    expect(socket.data.user).toBeUndefined();
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

  it("authenticates a branchless superadmin in its distinct global room", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue({
      _id: "user_123", role: "superadmin", branchId: null, status: "active",
    });
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(getSocketRoom(socket.data.user)).toBe("branch:global:role:superadmin");
    expect(Branch.findById).not.toHaveBeenCalled();
  });

  it("does not infer global identity for a branchless admin", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue({
      _id: "user_123", role: "admin", branchId: null, status: "active",
    });
    const next = jest.fn();

    await authenticateSocket(socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthorized" }));
    expect(socket.data.user).toBeUndefined();
  });

  it("rejects a branch-assigned superadmin", async () => {
    const socket = makeSocket({ handshake: { auth: { token: makeToken() }, headers: {} } });
    User.findById.mockResolvedValue({
      _id: "user_123", role: "superadmin", branchId: "branch_123", status: "active",
    });
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
    expect(socket.once).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });

  it("clears authenticated socket metadata on disconnect", () => {
    let connectionHandler;
    const io = { use: jest.fn(), on: jest.fn((event, handler) => { if (event === "connection") connectionHandler = handler; }) };
    const socket = makeSocket({ data: { user: { id: "user_123", role: "chef", branchId: "branch_123" } } });
    initSocket(io);
    connectionHandler(socket);
    socket.once.mock.calls[0][1]();
    expect(socket.data.user).toBeUndefined();
  });
});

describe("table:updated invalidation", () => {
  it("emits the existing payload in the resolved operational branch rooms", () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    const table = { _id: "table_123", tableNumber: 7, status: "occupied" };

    notify.tableUpdated(io, table, "branch_operational");

    expect(EVENTS.TABLE_UPDATED).toBe("table:updated");
    expect(io.to.mock.calls.map(([room]) => room)).toEqual([
      "branch:branch_operational:role:admin",
      "branch:branch_operational:role:manager",
      "branch:branch_operational:role:waiter",
    ]);
    expect(io.emit).toHaveBeenCalledTimes(3);
    expect(io.emit).toHaveBeenCalledWith(EVENTS.TABLE_UPDATED, table);
  });

  it("does not route a persisted table through a mismatched acting branch", () => {
    const io = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    const table = {
      _id: "table_123",
      branchId: "branch_owner",
      tableNumber: 7,
      status: "occupied",
    };

    notify.tableUpdated(io, table, "branch_actor");

    expect(io.to).not.toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalled();
  });
});
