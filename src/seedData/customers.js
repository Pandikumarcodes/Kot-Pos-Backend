const FIRST_NAMES = [
  "Aarav",
  "Aditi",
  "Aditya",
  "Akash",
  "Amrita",
  "Ananya",
  "Arjun",
  "Bhavna",
  "Chetan",
  "Deepa",
  "Dev",
  "Diya",
  "Gaurav",
  "Isha",
  "Karan",
  "Kavya",
  "Manish",
  "Meera",
  "Neha",
  "Nikhil",
  "Nisha",
  "Pooja",
  "Pranav",
  "Priya",
  "Rahul",
  "Rakesh",
  "Ravi",
  "Rhea",
  "Rohan",
  "Sakshi",
  "Sameer",
  "Sanjay",
  "Shreya",
  "Sneha",
  "Suresh",
  "Tanvi",
  "Varun",
  "Vikram",
  "Vinay",
  "Yash",
];
const LAST_NAMES = [
  "Kumar",
  "Sharma",
  "Nair",
  "Iyer",
  "Reddy",
  "Patil",
  "Joshi",
  "Menon",
  "Gupta",
  "Bhat",
];

function buildCustomers() {
  const rows = [];
  for (let i = 0; i < 120; i += 1) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}`;
    rows.push({
      name,
      phone: String(7000000000 + i),
      email: `${name.toLowerCase().replace(/ /g, ".")}.${i + 1}@kotpos.demo`,
      totalOrders: 0,
      totalSpent: 0,
      lastVisit: null,
    });
  }
  // Keep the original recognizable foundation profiles at deterministic positions.
  [
    ["Ravi Kumar", "9876543210", "ravi@kotpos.demo"],
    ["Priya Sharma", "9123456789", "priya@kotpos.demo"],
    ["Arjun Nair", "9988776655", "arjun@kotpos.demo"],
    ["Meena Iyer", "9654321098", "meena@kotpos.demo"],
  ].forEach(([name, phone, email], i) =>
    Object.assign(rows[i], { name, phone, email }),
  );
  return rows;
}

module.exports = { buildCustomers };
