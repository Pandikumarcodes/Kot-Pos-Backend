const MenuItem = require("../models/menuItems");
const AppError = require("../utils/AppError");

const toMenuResponse = (menuItem) => ({
  _id: menuItem._id,
  ItemName: menuItem.ItemName,
  category: menuItem.category,
  price: menuItem.price,
  available: menuItem.available,
});

const createMenuItem = async ({ ItemName, category, price, available }) => {
  if (await MenuItem.findOne({ ItemName })) throw new AppError("This Item already Exists", 400);
  const menuItem = new MenuItem({ ItemName, category, price, available });
  await menuItem.save();
  return toMenuResponse(menuItem);
};

const listMenuItems = () => MenuItem.find().lean();

const updateMenuItem = async (ItemId, { price, available }) => {
  const updateFields = {};
  if (price !== undefined) updateFields.price = price;
  if (available !== undefined) updateFields.available = available;
  const menuItem = await MenuItem.findByIdAndUpdate(ItemId, updateFields, {
    new: true,
    runValidators: true,
  });
  if (!menuItem) throw new AppError("Menu item not found", 404);
  return toMenuResponse(menuItem);
};

const deleteMenuItem = async (ItemId) => {
  const item = await MenuItem.findByIdAndDelete(ItemId);
  if (!item) throw new AppError("Menu item not found", 404);
  return { _id: item._id, ItemName: item.ItemName };
};

const listAvailableMenu = ({ category, search }) => {
  const filter = { available: true };
  if (category) filter.category = category;
  if (search) filter.ItemName = { $regex: search, $options: "i" };
  return MenuItem.find(filter)
    .select("ItemName price category description image available")
    .sort({ category: 1, ItemName: 1 });
};

module.exports = { createMenuItem, listMenuItems, updateMenuItem, deleteMenuItem, listAvailableMenu };
