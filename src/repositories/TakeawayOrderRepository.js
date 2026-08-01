const createBaseRepository = require("./BaseRepository");
const TakeAway = require("../models/takeAway");

const baseRepository = createBaseRepository(TakeAway);

const createOrderDocument = (data) => baseRepository.createDocument(data);

const listScoped = (filter) =>
  baseRepository.findMany(filter).sort({ createdAt: -1 });

const findScopedWithDetails = (filter) =>
  baseRepository
    .findOne(filter)
    .populate("createdBy", "username")
    .populate("items.itemId", "ItemName price");

const updateStatus = (filter, status) =>
  TakeAway.findOneAndUpdate(filter, { status }, { new: true });

module.exports = {
  ...baseRepository,
  createOrderDocument,
  listScoped,
  findScopedWithDetails,
  updateStatus,
};
