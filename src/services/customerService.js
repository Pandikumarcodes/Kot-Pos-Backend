const Customer = require("../models/customer");
const AppError = require("../utils/AppError");

const listCustomers = () => Customer.find().sort({ lastVisit: -1 });

const getCustomer = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const createCustomer = async ({ name, phone, email, address }) => {
  if (await Customer.findOne({ phone })) {
    throw new AppError("Customer with this phone already exists", 400);
  }
  return Customer.create({ name, phone, email, address });
};

const updateCustomer = async (customerId, { name, phone, email, address }) => {
  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { name, phone, email, address },
    { new: true, runValidators: true },
  );
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const deleteCustomer = async (customerId) => {
  const customer = await Customer.findByIdAndDelete(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
