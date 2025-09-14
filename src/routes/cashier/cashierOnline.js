// const express = require("express");
// const { userAuth, allowRoles } = require("../middlewares/auth");
// const cashierOnlineRouter = express.Router();
// cashierOnlineRouter.use(userAuth, allowRoles(["cashier"]));

// cashierOnlineRouter.post("/online-order", (req, res) => {
//   res.json({ message: "Online order placed" });
// });

// cashierOnlineRouter.get("/online-order", (req, res) => {
//   res.json({ message: "View all online orders" });
// });
// cashierOnlineRouter.put("/cashier/online-order/:orderId/status", (req, res) => {
//   res.json({ message: "Update order status (confirmed/cancelled)s" });
// });
// module.exports = { cashierOnlineRouter };
