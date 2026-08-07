const createBaseRepository = require("./BaseRepository");
const Table = require("../models/tables");
const { leanQuery } = require("./readQuery");
const { directBranchFilter, assertBranchIdImmutableUpdate } = require("../utils/operationalOwnership");

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
const findPublicByIdLean = (id, options = {}) =>
  baseRepository.findOne({ _id: id, branchId: { $exists: true, $ne: null } }, undefined, options).lean();

const findByNumberInScope = (scope, tableNumber, options = {}) =>
  baseRepository.findOne(directBranchFilter(scope, { tableNumber }), undefined, options);
const listScoped = (scope, options = {}) =>
  leanQuery(baseRepository.findMany(directBranchFilter(scope), undefined, options));
const findByIdInScope = (scope, id, options = {}) =>
  baseRepository.findOne(directBranchFilter(scope, { _id: id }), undefined, options);
const updateTableInScope = (scope, id, update, options = {}) => {
  assertBranchIdImmutableUpdate(update);
  return Table.findOneAndUpdate(
    directBranchFilter(scope, { _id: id }),
    update,
    { new: true, runValidators: true, ...options },
  );
};
const deleteTableInScope = (scope, id, options = {}) =>
  baseRepository.deleteOne(directBranchFilter(scope, { _id: id }), options);

const updateStateInScope = (scope, id, update, options = {}) => {
  assertBranchIdImmutableUpdate(update);
  return Table.findOneAndUpdate(
    directBranchFilter(scope, { _id: id }),
    update,
    { new: true, ...options },
  );
};

module.exports = {
  ...baseRepository,
  findByNumber,
  createTableDocument,
  listAll,
  updateTable,
  deleteTable,
  updateState,
  findByIdLean,
  findPublicByIdLean,
  findByNumberInScope,
  listScoped,
  findByIdInScope,
  updateTableInScope,
  deleteTableInScope,
  updateStateInScope,
};
