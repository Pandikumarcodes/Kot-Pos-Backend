const createBaseRepository = require("./BaseRepository");
const Customer = require("../models/customer");

const baseRepository = createBaseRepository(Customer);

const listByLastVisit = () =>
  baseRepository.findMany().sort({ lastVisit: -1 });

const findByPhone = (phone) => baseRepository.findOne({ phone });

const createCustomer = (data) => baseRepository.create(data);

const updateCustomer = (id, update) =>
  baseRepository.updateById(id, update, { new: true, runValidators: true });

const deleteCustomer = (id) => baseRepository.deleteById(id);

module.exports = {
  ...baseRepository,
  listByLastVisit,
  findByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
