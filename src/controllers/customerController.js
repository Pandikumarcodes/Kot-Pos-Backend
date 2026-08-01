const customerService = require("../services/customerService");
const { forwardError } = require("./controllerUtils");

const listCustomers = async (req, res, next) => {
  try {
    const { branchId: _branchId, ...query } = req.query;
    const result = await customerService.listCustomers(query);
    res.status(200).json({
      customers: result.items || [],
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    forwardError(next, err);
  }
};
const getCustomer = async (req, res, next) => {
  try {
    res
      .status(200)
      .json({
        customer: await customerService.getCustomer(req.params.customerId),
      });
  } catch (err) {
    forwardError(next, err);
  }
};
const createCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.status(201).json({ message: "Customer created", customer });
  } catch (err) {
    forwardError(next, err);
  }
};
const updateCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.updateCustomer(
      req.params.customerId,
      req.body,
    );
    res.status(200).json({ message: "Customer updated", customer });
  } catch (err) {
    forwardError(next, err);
  }
};
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await customerService.deleteCustomer(
      req.params.customerId,
    );
    res.status(200).json({ message: "Customer deleted", customer });
  } catch (err) {
    forwardError(next, err);
  }
};
module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
