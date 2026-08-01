const createBaseRepository = require("./BaseRepository");
const Table = require("../models/tables");

const baseRepository = createBaseRepository(Table);

const findByNumber = (tableNumber) =>
  baseRepository.findOne({ tableNumber });

const createTableDocument = (data) => baseRepository.createDocument(data);

const listAll = () => baseRepository.findMany();

const updateTable = (id, update) =>
  baseRepository.updateById(id, update, { new: true, runValidators: true });

const deleteTable = (id) => baseRepository.deleteById(id);

const updateState = (id, update) => baseRepository.updateById(id, update);

const findByIdLean = (id) => baseRepository.findById(id).lean();

module.exports = {
  ...baseRepository,
  findByNumber,
  createTableDocument,
  listAll,
  updateTable,
  deleteTable,
  updateState,
  findByIdLean,
};
