const createBaseRepository = require("./BaseRepository");
const Kot = require("../models/kot");

const baseRepository = createBaseRepository(Kot);

const listActive = (filter) =>
  baseRepository.findMany(filter).sort({ createdAt: 1 });

const findScoped = (filter) => baseRepository.findOne(filter);

const updateStatus = (filter, status) =>
  Kot.findOneAndUpdate(filter, { status }, { new: true });

const createOrder = (data) => baseRepository.create(data);

const findPublicStatus = (id) =>
  baseRepository
    .findById(id)
    .select("status totalAmount items createdAt")
    .lean();

const countByFilter = (filter) => baseRepository.count(filter);

const listLean = (filter) => baseRepository.findMany(filter).lean();

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
