const menuRepository = require("../repositories/MenuRepository");
const { cache, cacheKeys } = require("../infrastructure/cache");
const AppError = require("../utils/AppError");
const {
  buildMasterDataPlan,
  hasQueryControls,
  paginationFor,
  repositoryOptions,
  usesPagination,
} = require("./masterDataQuery");

const MENU_CATEGORIES = Object.freeze([
  "starter", "main_course", "dessert", "beverage", "snacks",
  "side_dish", "bread", "rice", "combo", "special",
]);

const MENU_QUERY_POLICY = Object.freeze({
  pagination: { defaultPage: 1, defaultLimit: 20, maxLimit: 100 },
  searchableFields: [
    { field: "ItemName", mode: "partial" },
    { field: "category", mode: "partial" },
  ],
  filters: {
    category: { field: "category", type: "enum", values: MENU_CATEGORIES },
    availability: { field: "available", type: "boolean" },
  },
  sorting: {
    fields: { name: "ItemName", price: "price", category: "category" },
    defaultField: "name",
    defaultOrder: "asc",
  },
  fieldSelection: {
    fields: {
      id: "_id",
      name: "ItemName",
      category: "category",
      price: "price",
      available: "available",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    defaultFields: [
      "id", "name", "category", "price", "available", "createdAt", "updatedAt",
    ],
  },
});

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
  await cache.invalidatePattern("kot-pos:v1:menu:*");
  await cache.invalidatePattern("kot-pos:v1:menu-available:*");
  return toMenuResponse(menuItem);
};

const listMenuItems = async (query = {}, { branchId } = {}) => {
  const key = cacheKeys.menu({ branchId, query });
  if (!hasQueryControls(query)) {
    const items = await cache.getOrSet(key, () => menuRepository.listAll(), { ttlSeconds: 300 });
    return { items };
  }

  return cache.getOrSet(key, async () => {
    const paginated = usesPagination(query);
    const plan = buildMasterDataPlan({ query, policy: MENU_QUERY_POLICY });
    const dataPromise = menuRepository.listAll({
      ...repositoryOptions(plan, paginated),
      filter: plan.filter,
    });
    const [items, total] = paginated
      ? await Promise.all([dataPromise, menuRepository.count(plan.filter)])
      : [await dataPromise, null];
    return { items, ...(paginated && { pagination: paginationFor(plan, total) }) };
  }, { ttlSeconds: 300 });
};

const updateMenuItem = async (ItemId, { price, available }) => {
  const updateFields = {};
  if (price !== undefined) updateFields.price = price;
  if (available !== undefined) updateFields.available = available;
  const menuItem = await menuRepository.updateMenuItem(ItemId, updateFields);
  if (!menuItem) throw new AppError("Menu item not found", 404);
  await cache.invalidatePattern("kot-pos:v1:menu:*");
  await cache.invalidatePattern("kot-pos:v1:menu-available:*");
  return toMenuResponse(menuItem);
};

const deleteMenuItem = async (ItemId) => {
  const item = await menuRepository.deleteMenuItem(ItemId);
  if (!item) throw new AppError("Menu item not found", 404);
  await cache.invalidatePattern("kot-pos:v1:menu:*");
  await cache.invalidatePattern("kot-pos:v1:menu-available:*");
  return { _id: item._id, ItemName: item.ItemName };
};

const listAvailableMenu = ({ category, search, branchId } = {}) => {
  if (!category && !search) {
    return cache.getOrSet(
      cacheKeys.availableMenu({ branchId }),
      () => menuRepository.listAvailable({ available: true }),
      { ttlSeconds: 120 },
    );
  }
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
