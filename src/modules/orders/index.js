// Orders module boundary for waiter, cashier KOT, and chef workflows.
module.exports = {
  cashierKotRouter: require("../../routes/cashier/cashierKotOrder").cashierKotRouter,
  waiterOrderRouter: require("../../routes/waiter/waiterOrderRouter").waiterOrderRouter,
  waiterTableRouter: require("../../routes/waiter/waiterTableRouter").waiterTableRouter,
  chefRouter: require("../../routes/chef/chefRouter").chefRouter,
};
