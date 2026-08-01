const createBaseRepository = require("./BaseRepository");
const Customer = require("../models/customer");

const baseRepository = createBaseRepository(Customer);

const listByLastVisit = (options = {}) =>
  baseRepository.findMany({}, undefined, options).sort({ lastVisit: -1 });

const findByPhone = (phone, options = {}) =>
  baseRepository.findOne({ phone }, undefined, options);

const createCustomer = (data, options = {}) =>
  baseRepository.create(data, options);

const updateCustomer = (id, update, options = {}) =>
  baseRepository.updateById(id, update, {
    new: true,
    runValidators: true,
    ...options,
  });

const deleteCustomer = (id, options = {}) =>
  baseRepository.deleteById(id, options);

module.exports = {
  ...baseRepository,
  listByLastVisit,
  findByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
