const BaseRepository = require("./BaseRepository");
const Table = require("../models/tables");

class TableRepository extends BaseRepository {
  constructor() {
    super(Table);
  }

  findByNumber(tableNumber) {
    return this.findOne({ tableNumber });
  }

  createTableDocument(data) {
    return this.createDocument(data);
  }

  listAll() {
    return this.findMany();
  }

  updateTable(id, update) {
    return this.updateById(id, update, { new: true, runValidators: true });
  }

  deleteTable(id) {
    return this.deleteById(id);
  }

  updateState(id, update) {
    return this.updateById(id, update);
  }

  findByIdLean(id) {
    return this.findById(id).lean();
  }
}

module.exports = new TableRepository();
module.exports.TableRepository = TableRepository;
