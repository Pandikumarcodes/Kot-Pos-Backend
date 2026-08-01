const createBaseRepository = require("./BaseRepository");
const Billing = require("../models/billings");

const baseRepository = createBaseRepository(Billing);

const countCreatedSince = (date) =>
  baseRepository.count({ createdAt: { $gte: date } });

const createBillDocument = (data) => baseRepository.createDocument(data);

const createBill = (data) => baseRepository.create(data);

const listScoped = (filter) =>
  baseRepository
    .findMany(filter)
    .populate("createdBy", "username role")
    .sort({ createdAt: -1 });

const findScopedWithCreator = (filter) =>
  baseRepository.findOne(filter).populate("createdBy", "username role");

const findScoped = (filter) => baseRepository.findOne(filter);

const deleteScoped = (filter) => Billing.findOneAndDelete(filter);

const listLean = (filter) => baseRepository.findMany(filter).lean();

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
