const MenuItem = require("../models/menuItems");
const {
  jsonEnv,
  saveIfMissing,
  removeSeedRecords,
  runSeed,
} = require("./utils");

const DEFAULT_MENU = [
  {
    ItemName: "Paneer Butter Masala",
    category: "main_course",
    price: 220,
    available: true,
  },
  { ItemName: "Veg Fried Rice", category: "rice", price: 180, available: true },
  { ItemName: "Butter Naan", category: "bread", price: 45, available: true },
  {
    ItemName: "Fresh Lime Soda",
    category: "beverage",
    price: 80,
    available: true,
  },
];
async function seedMenu({ force = false, clean = false } = {}) {
  const menu = jsonEnv("SEED_MENU_JSON", DEFAULT_MENU);
  if (clean)
    await removeSeedRecords(
      menu.map(({ ItemName }) => ({
        Model: MenuItem,
        filter: { ItemName },
        label: `menu item ${ItemName}`,
      })),
    );
  return Promise.all(
    menu.map((item) =>
      saveIfMissing(
        MenuItem,
        { ItemName: item.ItemName },
        item,
        `menu item ${item.ItemName}`,
        { force },
      ),
    ),
  );
}

if (require.main === module)
  require("./utils")
    .executeSeed((options) => runSeed("menu", seedMenu, options))
    .then((code) => (process.exitCode = code));
module.exports = { seedMenu };
