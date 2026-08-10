const createBaseRepository = require("./BaseRepository");
const Table = require("../models/tables");
const { leanQuery } = require("./readQuery");

const baseRepository = createBaseRepository(Table);

const findByNumberAndBranch = (tableNumber, branchId, options = {}) =>
  baseRepository.findOne({ branchId, tableNumber }, undefined, options);

const findByIdAndBranch = (id, branchId, options = {}) =>
  baseRepository.findOne({ _id: id, branchId }, undefined, options);

const findAllByBranch = (branchId, options = {}) =>
  leanQuery(baseRepository.findMany({ branchId }, undefined, options));

const updateByIdAndBranch = (id, branchId, update, options = {}) =>
  Table.findOneAndUpdate(
    { _id: id, branchId },
    update,
    { new: true, runValidators: true, ...options },
  );

const deleteByIdAndBranch = (id, branchId, options = {}) =>
  Table.findOneAndDelete({ _id: id, branchId }, options);

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
  findByNumberAndBranch,
  findByIdAndBranch,
  findAllByBranch,
  updateByIdAndBranch,
  deleteByIdAndBranch,
  createTableDocument,
  listAll,
  updateTable,
  deleteTable,
  updateState,
  findByIdLean,
};
