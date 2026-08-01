const createBaseRepository = require("./BaseRepository");
const MenuItem = require("../models/menuItems");

const baseRepository = createBaseRepository(MenuItem);

const findByName = (ItemName) => baseRepository.findOne({ ItemName });

const createMenuDocument = (data) => baseRepository.createDocument(data);

const listAll = () => baseRepository.findMany().lean();

const updateMenuItem = (id, update) =>
  baseRepository.updateById(id, update, { new: true, runValidators: true });

const deleteMenuItem = (id) => baseRepository.deleteById(id);

const listAvailable = (filter = { available: true }) =>
  baseRepository
    .findMany(filter)
    .select("ItemName price category description image available")
    .sort({ category: 1, ItemName: 1 });

const listAvailableLean = () =>
  baseRepository.findMany({ available: true }).lean();

const findByIds = (ids, { availableOnly = false, lean = false } = {}) => {
  const filter = { _id: { $in: ids } };
  if (availableOnly) filter.available = true;
  const query = baseRepository.findMany(filter);
  return lean && query && typeof query.lean === "function" ? query.lean() : query;
};

const updateAvailability = (id, available) =>
  baseRepository.updateById(id, { available });

module.exports = {
  ...baseRepository,
  findByName,
  createMenuDocument,
  listAll,
  updateMenuItem,
  deleteMenuItem,
  listAvailable,
  listAvailableLean,
  findByIds,
  updateAvailability,
};
