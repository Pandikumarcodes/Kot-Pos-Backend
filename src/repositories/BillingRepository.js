const createBaseRepository = require("./BaseRepository");
const Billing = require("../models/billings");

const baseRepository = createBaseRepository(Billing);

const countCreatedSince = (date, options = {}) =>
  baseRepository.count({ createdAt: { $gte: date } }, options);

const createBillDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const createBill = (data, options = {}) => baseRepository.create(data, options);

const listScoped = (filter, options = {}) =>
  baseRepository
    .findMany(filter, undefined, options)
    .populate("createdBy", "username role")
    .sort({ createdAt: -1 });

const findScopedWithCreator = (filter, options = {}) =>
  baseRepository
    .findOne(filter, undefined, options)
    .populate("createdBy", "username role");

const findScoped = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options);

const deleteScoped = (filter, options = {}) =>
  baseRepository.deleteOne(filter, options);

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  countCreatedSince,
  createBillDocument,
  createBill,
  listScoped,
  findScopedWithCreator,
  findScoped,
  deleteScoped,
  listLean,
};
