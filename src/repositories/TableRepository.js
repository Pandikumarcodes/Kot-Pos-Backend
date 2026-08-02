const createBaseRepository = require("./BaseRepository");
const Table = require("../models/tables");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(Table);

const findByNumber = (tableNumber, options = {}) =>
  baseRepository.findOne({ tableNumber }, undefined, options);

const createTableDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const listAll = (options = {}) =>
  leanQuery(baseRepository.findMany({}, undefined, options));

const updateTable = (id, update, options = {}) =>
  baseRepository.updateById(id, update, {
    new: true,
    runValidators: true,
    ...options,
  });

const deleteTable = (id, options = {}) =>
  baseRepository.deleteById(id, options);

const updateState = (id, update, options = {}) =>
  baseRepository.updateById(id, update, options);

const findByIdLean = (id, options = {}) =>
  baseRepository.findById(id, undefined, options).lean();

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
