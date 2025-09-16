const express = require("express");
const KOT = require("../models/kot");
const router = express.Router();

router.post("/insert-test-order", async (req, res) => {
  try {
    const newOrder = await KOT.create({
      orderType: "dine-in",
      tableNumber: 5,
      tableId: "68c6a25c5e149bf74ea3793f",
      customerName: "John",
      customerPhone: "9999999999",
      createdBy: "68c564c271ae83a38dd6fb04",
      items: [
        {
          itemId: "68c5447cc49707afa0841f37",
          name: "Idly",
          quantity: 2,
          price: 20,
        },
        {
          itemId: "68c5446ec49707afa0841f33",
          name: "Dosa",
          quantity: 1,
          price: 60,
        },
      ],
      totalAmount: 100,
      status: "pending",
    });

    res.status(201).json({ message: "Test order inserted", order: newOrder });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { router };
