const mongoose = require("mongoose");

const ALLOWED_CATEGORIES = [
  {
    key: "starter",
    description: "Light dishes served before the main course.",
    exampleItems: ["Garlic Bread", "French Fries", "Tomato Soup"],
  },
  {
    key: "main_course",
    description: "Hearty dishes that form the main part of the meal.",
    exampleItems: ["Paneer Butter Masala", "Chicken Biryani", "Veg Pasta"],
  },
  {
    key: "dessert",
    description: "Sweet dishes usually served after the main meal.",
    exampleItems: ["Ice Cream", "Gulab Jamun", "Chocolate Brownie"],
  },
  {
    key: "beverage",
    description: "Cold or hot drinks served anytime.",
    exampleItems: ["Coffee", "Fresh Juice", "Soda"],
  },
  {
    key: "snacks",
    description: "Quick light-bite items served anytime.",
    exampleItems: ["Samosa", "Sandwich", "Spring Rolls"],
  },
  {
    key: "side_dish",
    description: "Accompaniments that go along with main meals.",
    exampleItems: ["Green Salad", "Raita", "Chutney"],
  },
  {
    key: "bread",
    description: "Flatbreads usually served with curries.",
    exampleItems: ["Butter Naan", "Roti", "Paratha"],
  },
  {
    key: "rice",
    description: "Rice-based dishes served as a main.",
    exampleItems: ["Steamed Rice", "Veg Fried Rice", "Pulao"],
  },
  {
    key: "combo",
    description: "Preset combinations of items served together.",
    exampleItems: ["Burger + Fries + Coke", "Thali", "Pizza Combo"],
  },
  {
    key: "special",
    description: "Chef’s special or seasonal dishes.",
    exampleItems: ["Paneer Tikka Special", "Festival Special Platter"],
  },
];

const menuItemSchema = new mongoose.Schema(
  {
    ItemName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ALLOWED_CATEGORIES.map((c) => c.key),
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);
