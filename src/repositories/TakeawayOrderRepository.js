const createBaseRepository = require("./BaseRepository");
const TakeAway = require("../models/takeAway");

const baseRepository = createBaseRepository(TakeAway);

const createOrderDocument = (data, options = {}) =>
  baseRepository.createDocument(data, options);

const listScoped = (filter, options = {}) =>
  baseRepository.findMany(filter, undefined, options).sort({ createdAt: -1 });

const findScopedWithDetails = (filter, options = {}) =>
  baseRepository
    .findOne(filter, undefined, options)
    .populate("createdBy", "username")
    .populate("items.itemId", "ItemName price");

const updateStatus = (filter, status, options = {}) =>
  TakeAway.findOneAndUpdate(filter, { status }, { new: true, ...options });

module.exports = {
  ...baseRepository,
  createOrderDocument,
  listScoped,
  findScopedWithDetails,
  updateStatus,
};
