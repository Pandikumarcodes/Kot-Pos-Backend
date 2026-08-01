const BaseRepository = require("./BaseRepository");
const Customer = require("../models/customer");

class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer);
  }

  listByLastVisit() {
    return this.findMany().sort({ lastVisit: -1 });
  }

  findByPhone(phone) {
    return this.findOne({ phone });
  }

  createCustomer(data) {
    return this.create(data);
  }

  updateCustomer(id, update) {
    return this.updateById(id, update, { new: true, runValidators: true });
  }

  deleteCustomer(id) {
    return this.deleteById(id);
  }
}

module.exports = new CustomerRepository();
module.exports.CustomerRepository = CustomerRepository;
