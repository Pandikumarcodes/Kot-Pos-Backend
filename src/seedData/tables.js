const buildDemoTables = (branchId) => {
  if (!branchId) throw new Error("Demo tables require a branchId");

  return [
    { branchId, tableNumber: 1, capacity: 2, status: "available" },
    { branchId, tableNumber: 2, capacity: 4, status: "available" },
    { branchId, tableNumber: 3, capacity: 4, status: "available" },
    { branchId, tableNumber: 4, capacity: 6, status: "available" },
    { branchId, tableNumber: 5, capacity: 8, status: "available" },
    {
      branchId,
      tableNumber: 6,
      capacity: 2,
      status: "occupied",
      currentCustomer: { name: "Ravi Kumar", phone: "9876543210" },
    },
    {
      branchId,
      tableNumber: 7,
      capacity: 4,
      status: "occupied",
      currentCustomer: { name: "Priya Sharma", phone: "9123456789" },
    },
    { branchId, tableNumber: 8, capacity: 6, status: "reserved" },
  ];
};

module.exports = { buildDemoTables };
