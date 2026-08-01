const customerRepository = require("../repositories/CustomerRepository");
const AppError = require("../utils/AppError");

const listCustomers = () => customerRepository.listByLastVisit();

const getCustomer = async (customerId) => {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const createCustomer = async ({ name, phone, email, address }) => {
  if (await customerRepository.findByPhone(phone)) {
    throw new AppError("Customer with this phone already exists", 400);
  }
  return customerRepository.createCustomer({ name, phone, email, address });
};

const updateCustomer = async (customerId, { name, phone, email, address }) => {
  const customer = await customerRepository.updateCustomer(customerId, {
    name,
    phone,
    email,
    address,
  });
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

const deleteCustomer = async (customerId) => {
  const customer = await customerRepository.deleteCustomer(customerId);
  if (!customer) throw new AppError("Customer not found", 404);
  return customer;
};

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
