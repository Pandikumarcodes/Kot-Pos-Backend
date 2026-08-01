const menuRepository = require("../repositories/MenuRepository");
const AppError = require("../utils/AppError");

const toMenuResponse = (menuItem) => ({
  _id: menuItem._id,
  ItemName: menuItem.ItemName,
  category: menuItem.category,
  price: menuItem.price,
  available: menuItem.available,
});

const createMenuItem = async ({ ItemName, category, price, available }) => {
  if (await menuRepository.findByName(ItemName))
    throw new AppError("This Item already Exists", 400);
  const menuItem = await menuRepository.createMenuDocument({
    ItemName,
    category,
    price,
    available,
  });
  return toMenuResponse(menuItem);
};

const listMenuItems = () => menuRepository.listAll();

const updateMenuItem = async (ItemId, { price, available }) => {
  const updateFields = {};
  if (price !== undefined) updateFields.price = price;
  if (available !== undefined) updateFields.available = available;
  const menuItem = await menuRepository.updateMenuItem(ItemId, updateFields);
  if (!menuItem) throw new AppError("Menu item not found", 404);
  return toMenuResponse(menuItem);
};

const deleteMenuItem = async (ItemId) => {
  const item = await menuRepository.deleteMenuItem(ItemId);
  if (!item) throw new AppError("Menu item not found", 404);
  return { _id: item._id, ItemName: item.ItemName };
};

const listAvailableMenu = ({ category, search }) => {
  const filter = { available: true };
  if (category) filter.category = category;
  if (search) filter.ItemName = { $regex: search, $options: "i" };
  return menuRepository.listAvailable(filter);
};

module.exports = {
  createMenuItem,
  listMenuItems,
  updateMenuItem,
  deleteMenuItem,
  listAvailableMenu,
};
