const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test_jwt_secret";
process.env.NODE_ENV = "test";

jest.mock("../../models/users");
jest.mock("../../models/kot");
jest.mock("../../models/waiter");
jest.mock("../../models/takeAway");
jest.mock("../../models/Branch", () => ({ findById: jest.fn() }));
jest.mock("../../infrastructure/transaction/TransactionManager", () =>
  jest.fn().mockImplementation(() => ({
    execute: jest.fn((work) => work({ id: "completion-session" })),
  })),
);
jest.mock("../../modules/orders/OrderAuditLogger", () => ({
  createContext: jest.fn((values = {}) => ({
    ...values,
    correlationId: values.correlationId || "completion-correlation",
  })),
  kitchenAction: jest.fn(() => "KOT.SERVE"),
  kitchenStatusChanged: jest.fn().mockResolvedValue(undefined),
  failure: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../services/notificationservices", () => ({
  notify: {
    kotUpdated: jest.fn(),
    newOrder: jest.fn(),
    tableUpdated: jest.fn(),
    billingUpdated: jest.fn(),
  },
}));
jest.mock("../../services/inventoryService", () => ({
  deductStockForKot: jest.fn().mockResolvedValue(undefined),
}));

const User = require("../../models/users");
const Kot = require("../../models/kot");
const TableOrder = require("../../models/waiter");
const TakeAway = require("../../models/takeAway");
const Branch = require("../../models/Branch");
const orderAudit = require("../../modules/orders/OrderAuditLogger");
const { notify } = require("../../services/notificationservices");
const { chefRouter } = require("../../routes/chef/chefRouter");

const BRANCH_ID = new mongoose.Types.ObjectId().toString();
const OTHER_BRANCH_ID = new mongoose.Types.ObjectId().toString();
const KOT_ID = new mongoose.Types.ObjectId().toString();
const SOURCE_ORDER_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const session = { id: "completion-session" };

const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
const app = express();
app.use(express.json());
app.use(cookieParser());
app.set("io", io);
app.use("/api/v1/chef", chefRouter);

const token = (role = "chef", branchId = BRANCH_ID) =>
  jwt.sign({ _id: USER_ID, role, branchId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const activeBranch = (isActive = true) => {
  Branch.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: BRANCH_ID, isActive }),
    }),
  });
};

const user = (role = "chef", branchId = BRANCH_ID) => ({
  _id: USER_ID,
  role,
  branchId,
});

const readyKot = (orderType = "dine-in") => ({
  _id: KOT_ID,
  branchId: BRANCH_ID,
  sourceOrderId: SOURCE_ORDER_ID,
  orderType,
  status: "ready",
});

beforeEach(() => {
  jest.clearAllMocks();
  activeBranch();
  User.findById.mockResolvedValue(user());
  // branchMemberScope deliberately falls back to the authenticated member for
  // lightweight model doubles that do not implement distinct().
  User.find.mockReturnValue(undefined);
});

describe("Kitchen source-order completion", () => {
  it("serves the linked TableOrder by source ID, never by KOT ID, then completes the KOT", async () => {
    const kot = readyKot();
    const completedKot = { ...kot, status: "served" };
    Kot.findOne.mockResolvedValue(kot);
    TableOrder.findOneAndUpdate.mockResolvedValue({
      _id: SOURCE_ORDER_ID,
      status: "served",
    });
    Kot.findOneAndUpdate.mockResolvedValue(completedKot);

    const response = await request(app)
      .put(`/api/v1/chef/orders/${SOURCE_ORDER_ID}/served`)
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    expect(TableOrder.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: SOURCE_ORDER_ID,
        status: "sent_to_kitchen",
      }),
      { status: "served" },
      { new: true, session: expect.anything() },
    );
    expect(TableOrder.findOneAndUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ _id: KOT_ID }),
      expect.anything(),
      expect.anything(),
    );
    expect(Kot.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: KOT_ID,
        branchId: BRANCH_ID,
        sourceOrderId: SOURCE_ORDER_ID,
        status: "ready",
      }),
      { status: "served" },
      { new: true, session: expect.anything() },
    );
    expect(orderAudit.kitchenStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        kot: completedKot,
        previousStatus: "ready",
        newStatus: "served",
      }),
      { session: expect.anything() },
    );
    expect(notify.kotUpdated).toHaveBeenCalledWith(io, completedKot);
  });

  it("rejects a source order whose linked KOT is outside the actor branch", async () => {
    User.findById.mockResolvedValue(user("chef", OTHER_BRANCH_ID));
    Kot.findOne.mockResolvedValue(null);

    const response = await request(app)
      .put(`/api/v1/chef/orders/${SOURCE_ORDER_ID}/served`)
      .set("Cookie", `token=${token("chef", OTHER_BRANCH_ID)}`);

    expect(response.status).toBe(404);
    expect(Kot.findOne).toHaveBeenCalledWith(
      { sourceOrderId: SOURCE_ORDER_ID, branchId: OTHER_BRANCH_ID },
      undefined,
      { session: expect.anything() },
    );
    expect(TableOrder.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects inactive branches before reading the KOT or source order", async () => {
    activeBranch(false);

    const response = await request(app)
      .put(`/api/v1/chef/orders/${SOURCE_ORDER_ID}/served`)
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Branch is inactive");
    expect(Kot.findOne).not.toHaveBeenCalled();
    expect(TableOrder.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a source order that is not sent_to_kitchen and leaves the KOT ready", async () => {
    Kot.findOne.mockResolvedValue(readyKot());
    TableOrder.findOneAndUpdate.mockResolvedValue(null);
    TableOrder.findOne.mockResolvedValue({
      _id: SOURCE_ORDER_ID,
      status: "pending",
    });

    const response = await request(app)
      .put(`/api/v1/chef/orders/${SOURCE_ORDER_ID}/served`)
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("must be sent_to_kitchen");
    expect(Kot.findOneAndUpdate).not.toHaveBeenCalled();
    expect(orderAudit.failure).toHaveBeenCalledWith(
      expect.objectContaining({ action: "KOT.SERVE" }),
    );
    expect(notify.kotUpdated).not.toHaveBeenCalled();
  });

  it("uses the TakeAway received transition and never calls TableOrder", async () => {
    const kot = readyKot("takeaway");
    const completedKot = { ...kot, status: "served" };
    Kot.findOne.mockResolvedValue(kot);
    TakeAway.findOneAndUpdate.mockResolvedValue({
      _id: SOURCE_ORDER_ID,
      status: "received",
    });
    Kot.findOneAndUpdate.mockResolvedValue(completedKot);

    const response = await request(app)
      .put(`/api/v1/chef/takeaway/${SOURCE_ORDER_ID}/received`)
      .set("Cookie", `token=${token()}`);

    expect(response.status).toBe(200);
    expect(TakeAway.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: SOURCE_ORDER_ID,
        status: "sent_to_kitchen",
      }),
      { status: "received" },
      { new: true, session: expect.anything() },
    );
    expect(TableOrder.findOneAndUpdate).not.toHaveBeenCalled();
    expect(notify.kotUpdated).toHaveBeenCalledWith(io, completedKot);
  });

  it.each(["waiter", "cashier", "superadmin"])(
    "does not grant %s Kitchen completion access",
    async (role) => {
      User.findById.mockResolvedValue(
        user(role, role === "superadmin" ? null : BRANCH_ID),
      );

      const response = await request(app)
        .put(`/api/v1/chef/orders/${SOURCE_ORDER_ID}/served`)
        .set(
          "Cookie",
          `token=${token(role, role === "superadmin" ? null : BRANCH_ID)}`,
        );

      expect(response.status).toBe(403);
      expect(Kot.findOne).not.toHaveBeenCalled();
    },
  );
});
