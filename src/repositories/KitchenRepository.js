const createBaseRepository = require("./BaseRepository");
const Kot = require("../models/kot");

const baseRepository = createBaseRepository(Kot);

const listActive = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).sort({ createdAt: 1 });

const findScoped = (filter, options = {}) =>
  baseRepository.findOne(filter, undefined, options);

const updateStatus = (filter, status, options = {}) =>
  Kot.findOneAndUpdate(filter, { status }, { new: true, ...options });

const createOrder = (data, options = {}) =>
  baseRepository.create(data, options);

const findPublicStatus = (id, options = {}) =>
  baseRepository
    .findById(id, undefined, options)
    .select("status totalAmount items createdAt")
    .lean();

const countByFilter = (filter, options = {}) =>
  baseRepository.count(filter, options);

const listLean = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).lean();

module.exports = {
  ...baseRepository,
  listActive,
  findScoped,
  updateStatus,
  createOrder,
  findPublicStatus,
  countByFilter,
  listLean,
};
