const mongoose = require("mongoose");
const TableOrder = require("../../models/waiter");

const validOrder = (overrides = {}) => ({
  tableId: new mongoose.Types.ObjectId(),
  createdBy: new mongoose.Types.ObjectId(),
  items: [
    {
      itemId: new mongoose.Types.ObjectId(),
      name: "Dosa",
      quantity: 1,
      price: 125,
    },
  ],
  totalAmount: 125,
  status: "served",
  ...overrides,
});

describe("TableOrder billing lifecycle", () => {
  test("keeps served as the canonical pre-billing state", () => {
    const order = new TableOrder(validOrder());

    expect(order.validateSync()).toBeUndefined();
    expect(order.status).toBe("served");
    expect(order.billId).toBeNull();
  });

  test("stores the deterministic bill reference separately from served status", () => {
    const billId = new mongoose.Types.ObjectId();
    const order = new TableOrder(validOrder({ billId }));

    expect(order.validateSync()).toBeUndefined();
    expect(order.status).toBe("served");
    expect(order.billId.toString()).toBe(billId.toString());
  });
});
