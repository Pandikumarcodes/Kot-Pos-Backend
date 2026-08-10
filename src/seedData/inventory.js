const INVENTORY_NAMES = [
  ["Paneer", "kg", "dairy", 12, 3, 320],
  ["Chicken", "kg", "raw_material", 20, 5, 180],
  ["Rice", "kg", "raw_material", 40, 10, 60],
  ["Tomatoes", "kg", "produce", 15, 4, 40],
  ["Onions", "kg", "produce", 20, 5, 30],
  ["Butter", "kg", "dairy", 8, 2, 480],
  ["Mango Pulp", "l", "beverage", 10, 3, 120],
  ["Cooking Oil", "l", "raw_material", 25, 6, 140],
  ["Takeaway Boxes", "pcs", "packaging", 200, 50, 5],
  ["Maida", "kg", "raw_material", 15, 4, 45],
  ["Mushrooms", "kg", "produce", 18, 5, 180],
  ["Potatoes", "kg", "produce", 28, 8, 35],
  ["Capsicum", "kg", "produce", 13, 4, 80],
  ["Garam Masala", "kg", "raw_material", 7, 2, 420],
  ["Cream", "l", "dairy", 9, 3, 220],
];
const BRANCH_COUNTS = [17, 15, 13];

function buildInventory(branches) {
  let globalIndex = 0;
  return branches.flatMap(({ _id }, branchIndex) =>
    Array.from({ length: BRANCH_COUNTS[branchIndex] }, (_, index) => {
      const [baseName, unit, category, healthyStock, threshold, cost] =
        INVENTORY_NAMES[index % INVENTORY_NAMES.length];
      const shape =
        globalIndex < 10 ? "low" : globalIndex < 18 ? "near" : "healthy";
      const currentStock =
        shape === "low"
          ? threshold
          : shape === "near"
            ? threshold + 1
            : healthyStock + branchIndex * 2;
      globalIndex += 1;
      return {
        branchId: _id,
        name: `${baseName}${branchIndex ? ` - ${branches[branchIndex].definition.key}` : ""}`,
        unit,
        category,
        currentStock,
        lowStockThreshold: threshold,
        costPerUnit: cost,
        supplier: "KOT POS Demo Supplier",
        isActive: true,
      };
    }),
  );
}

module.exports = { BRANCH_COUNTS, buildInventory };
