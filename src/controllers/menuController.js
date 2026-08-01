const menuService = require("../services/menuService");
const { forwardError } = require("./controllerUtils");

const createMenuItem = async (req, res, next) => {
  try {
    const menuItem = await menuService.createMenuItem(req.body);
    res
      .status(201)
      .json({ message: "Menu item created successfully", menuItem });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const listMenuItems = async (req, res, next) => {
  try {
    const { branchId: _branchId, ...query } = req.query;
    const result = await menuService.listMenuItems(query);
    res.status(200).json({
      menuItems: result.items,
      ...(result.pagination && { pagination: result.pagination }),
    });
  } catch (err) {
    forwardError(next, err, "Failed to fetch menu items");
  }
};
const updateMenuItem = async (req, res, next) => {
  try {
    const menuItem = await menuService.updateMenuItem(
      req.params.ItemId,
      req.body,
    );
    res
      .status(200)
      .json({ message: "Menu item updated successfully", menuItem });
  } catch (err) {
    forwardError(next, err, err.message, 400);
  }
};
const deleteMenuItem = async (req, res, next) => {
  try {
    const item = await menuService.deleteMenuItem(req.params.ItemId);
    res.status(200).json({ message: "Menu item deleted successfully", item });
  } catch (err) {
    forwardError(next, err);
  }
};
module.exports = {
  createMenuItem,
  listMenuItems,
  updateMenuItem,
  deleteMenuItem,
};
