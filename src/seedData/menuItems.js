const BASE_MENU_ITEMS = [
  ["Garlic Bread", "starter", 80],
  ["French Fries", "starter", 120],
  ["Tomato Soup", "starter", 90],
  ["Paneer Butter Masala", "main_course", 280],
  ["Chicken Biryani", "main_course", 320],
  ["Veg Pasta", "main_course", 220],
  ["Dal Makhani", "main_course", 180],
  ["Palak Paneer", "main_course", 250],
  ["Butter Naan", "bread", 40],
  ["Roti", "bread", 25],
  ["Paratha", "bread", 60],
  ["Steamed Rice", "rice", 80],
  ["Veg Fried Rice", "rice", 160],
  ["Gulab Jamun", "dessert", 80],
  ["Ice Cream", "dessert", 100],
  ["Chocolate Brownie", "dessert", 150],
  ["Mango Lassi", "beverage", 80],
  ["Fresh Lime Soda", "beverage", 60],
  ["Cold Coffee", "beverage", 120],
  ["Masala Chai", "beverage", 40],
  ["Spring Rolls", "snacks", 140],
  ["Samosa", "snacks", 30],
  ["Sandwich", "snacks", 120],
  ["Green Salad", "side_dish", 80],
  ["Raita", "side_dish", 60],
  ["Thali Special", "combo", 350],
  ["Chef Special Platter", "special", 450],
];

const ADDITIONAL_MENU_ITEMS = [
  ["Paneer Tikka", "starter", 260],
  ["Chicken Tikka", "starter", 320],
  ["Hara Bhara Kebab", "starter", 220],
  ["Crispy Corn", "starter", 180],
  ["Tandoori Mushroom", "starter", 240],
  ["Malai Broccoli", "starter", 260],
  ["Amritsari Fish", "starter", 360],
  ["Chicken Tandoori", "main_course", 420],
  ["Mutton Rogan Josh", "main_course", 460],
  ["Butter Chicken", "main_course", 360],
  ["Kadai Chicken", "main_course", 340],
  ["Chicken Chettinad", "main_course", 380],
  ["Mutton Keema", "main_course", 440],
  ["Mushroom Masala", "main_course", 260],
  ["Kadai Paneer", "main_course", 290],
  ["Shahi Paneer", "main_course", 300],
  ["Veg Kolhapuri", "main_course", 270],
  ["Malai Kofta", "main_course", 290],
  ["Chana Masala", "main_course", 190],
  ["Masala Dosa", "main_course", 150],
  ["Rasmalai", "dessert", 140],
  ["Gajar Halwa", "dessert", 120],
  ["Phirni", "dessert", 110],
  ["Brownie Sundae", "dessert", 190],
  ["Filter Coffee", "beverage", 60],
  ["Sweet Lassi", "beverage", 80],
  ["Masala Buttermilk", "beverage", 60],
  ["Watermelon Juice", "beverage", 100],
  ["Pineapple Juice", "beverage", 100],
  ["Ginger Lemon Tea", "beverage", 55],
  ["Pakora Basket", "snacks", 160],
  ["Vada Pav", "snacks", 90],
  ["Masala Papad", "snacks", 70],
  ["Mysore Bonda", "snacks", 100],
  ["Boondi Raita", "side_dish", 70],
  ["Papad Platter", "side_dish", 60],
  ["Seasonal Salad", "side_dish", 110],
  ["Kachumber Salad", "side_dish", 100],
  ["Garlic Naan", "bread", 55],
  ["Cheese Naan", "bread", 110],
  ["Tandoori Roti", "bread", 35],
  ["Jeera Rice", "rice", 130],
  ["Veg Pulao", "rice", 180],
  ["Lemon Rice", "rice", 140],
  ["Mutton Biryani", "rice", 420],
  ["Curd Rice", "rice", 120],
  ["Family Feast Combo", "combo", 980],
  ["South Indian Combo", "combo", 290],
  ["Biryani Meal Combo", "combo", 420],
  ["Kids Meal Combo", "combo", 240],
  ["Weekend Grill Special", "special", 520],
  ["Seasonal Mango Special", "special", 180],
  ["Chef's Tasting Bowl", "special", 390],
];

const MENU_DISTRIBUTION = {
  starter: 10,
  main_course: 18,
  dessert: 7,
  beverage: 10,
  snacks: 7,
  side_dish: 6,
  bread: 6,
  rice: 7,
  combo: 5,
  special: 4,
};

function buildMenuItems() {
  const rows = [...BASE_MENU_ITEMS, ...ADDITIONAL_MENU_ITEMS].map(
    ([ItemName, category, price]) => ({
      ItemName,
      category,
      price,
      available: true,
    }),
  );
  if (rows.length !== 80)
    throw new Error(`Expected 80 menu fixtures, got ${rows.length}`);
  for (const [category, count] of Object.entries(MENU_DISTRIBUTION)) {
    if (rows.filter((row) => row.category === category).length !== count)
      throw new Error(`Menu distribution failed for ${category}`);
  }
  [
    "Seasonal Mango Special",
    "Weekend Grill Special",
    "Watermelon Juice",
    "Mutton Keema",
  ].forEach((name) => {
    rows.find((row) => row.ItemName === name).available = false;
  });
  return rows;
}

module.exports = { MENU_DISTRIBUTION, buildMenuItems };
