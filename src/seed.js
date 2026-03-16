require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./models/users");
const MenuItem = require("./models/menuItems");
const Table = require("./models/tables");
const Kot = require("./models/kot");
const Billing = require("./models/billings");
const Settings = require("./models/settings");
const Branch = require("./models/Branch"); // ✅ new

// ── Colours for console output ────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ─────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────

// ── 1. USERS ─────────────────────────────────────────────────
// ✅ admin has branchId: null  → super-admin, sees all branches
// ✅ all other staff get branchId assigned after branch is created
const USERS = [
  {
    username: "admin",
    password: "Admin@1234",
    role: "admin",
    status: "active",
    branchId: null, // ✅ super-admin — no branch restriction
  },
  {
    username: "manager",
    password: "Manager@1234",
    role: "manager",
    status: "active",
    branchId: "ASSIGN", // placeholder — replaced with real branchId below
  },
  {
    username: "waiter1",
    password: "Waiter@1234",
    role: "waiter",
    status: "active",
    branchId: "ASSIGN",
  },
  {
    username: "waiter2",
    password: "Waiter@5678",
    role: "waiter",
    status: "active",
    branchId: "ASSIGN",
  },
  {
    username: "chef1",
    password: "Chef@12345",
    role: "chef",
    status: "active",
    branchId: "ASSIGN",
  },
  {
    username: "cashier1",
    password: "Cashier@1234",
    role: "cashier",
    status: "active",
    branchId: "ASSIGN",
  },
];

// ── 2. MENU ITEMS ─────────────────────────────────────────────
const MENU_ITEMS = [
  // Starters
  {
    ItemName: "Veg Spring Rolls",
    category: "starter",
    price: 120,
    available: true,
  },
  { ItemName: "Chicken 65", category: "starter", price: 180, available: true },
  {
    ItemName: "Paneer Tikka",
    category: "starter",
    price: 160,
    available: true,
  },
  { ItemName: "Tomato Soup", category: "starter", price: 80, available: true },
  {
    ItemName: "Mushroom Soup",
    category: "starter",
    price: 90,
    available: false,
  },
  // Main Course
  {
    ItemName: "Paneer Butter Masala",
    category: "main_course",
    price: 220,
    available: true,
  },
  {
    ItemName: "Chicken Biryani",
    category: "main_course",
    price: 280,
    available: true,
  },
  {
    ItemName: "Dal Makhani",
    category: "main_course",
    price: 180,
    available: true,
  },
  {
    ItemName: "Veg Fried Rice",
    category: "main_course",
    price: 160,
    available: true,
  },
  {
    ItemName: "Chicken Curry",
    category: "main_course",
    price: 240,
    available: true,
  },
  {
    ItemName: "Palak Paneer",
    category: "main_course",
    price: 200,
    available: true,
  },
  // Bread
  { ItemName: "Butter Naan", category: "bread", price: 40, available: true },
  { ItemName: "Tandoori Roti", category: "bread", price: 30, available: true },
  { ItemName: "Garlic Naan", category: "bread", price: 50, available: true },
  { ItemName: "Lachha Paratha", category: "bread", price: 55, available: true },
  // Rice
  { ItemName: "Steamed Rice", category: "rice", price: 80, available: true },
  { ItemName: "Jeera Rice", category: "rice", price: 100, available: true },
  { ItemName: "Veg Pulao", category: "rice", price: 130, available: true },
  // Beverages
  { ItemName: "Mango Lassi", category: "beverage", price: 80, available: true },
  { ItemName: "Masala Chai", category: "beverage", price: 30, available: true },
  {
    ItemName: "Fresh Lime Soda",
    category: "beverage",
    price: 60,
    available: true,
  },
  { ItemName: "Cold Coffee", category: "beverage", price: 90, available: true },
  {
    ItemName: "Mineral Water",
    category: "beverage",
    price: 20,
    available: true,
  },
  // Snacks
  {
    ItemName: "Samosa (2 pcs)",
    category: "snacks",
    price: 40,
    available: true,
  },
  { ItemName: "Masala Papad", category: "snacks", price: 50, available: true },
  { ItemName: "Veg Sandwich", category: "snacks", price: 90, available: true },
  // Side Dish
  {
    ItemName: "Boondi Raita",
    category: "side_dish",
    price: 60,
    available: true,
  },
  {
    ItemName: "Green Salad",
    category: "side_dish",
    price: 70,
    available: true,
  },
  // Dessert
  {
    ItemName: "Gulab Jamun (2 pcs)",
    category: "dessert",
    price: 80,
    available: true,
  },
  {
    ItemName: "Chocolate Ice Cream",
    category: "dessert",
    price: 90,
    available: true,
  },
  { ItemName: "Kheer", category: "dessert", price: 70, available: true },
];

// ── 3. TABLES ─────────────────────────────────────────────────
const TABLES = [
  { tableNumber: 1, capacity: 2, status: "available" },
  { tableNumber: 2, capacity: 2, status: "available" },
  { tableNumber: 3, capacity: 4, status: "occupied" },
  { tableNumber: 4, capacity: 4, status: "occupied" },
  { tableNumber: 5, capacity: 4, status: "available" },
  { tableNumber: 6, capacity: 6, status: "reserved" },
  { tableNumber: 7, capacity: 6, status: "available" },
  { tableNumber: 8, capacity: 8, status: "occupied" },
  { tableNumber: 9, capacity: 2, status: "available" },
  { tableNumber: 10, capacity: 8, status: "available" },
];

// ─────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────
async function seed() {
  try {
    console.log(c.cyan("\n🌱 KOT POS — Seeding database...\n"));

    // ── Connect ──────────────────────────────────────────────
    await mongoose.connect(process.env.MONGO_URI);
    console.log(c.green("✅ Connected to MongoDB\n"));

    // ── Clear existing data ───────────────────────────────────
    console.log(c.yellow("🗑️  Clearing existing data..."));
    await Promise.all([
      User.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      Kot.deleteMany({}),
      Billing.deleteMany({}),
      Settings.deleteMany({}),
      Branch.deleteMany({}), // ✅ clear branches too
    ]);
    console.log(c.green("✅ Cleared\n"));

    // ── Seed Branch ───────────────────────────────────────────
    // ✅ Create the default branch first so we have its _id
    console.log(c.yellow("🏪 Seeding branches..."));
    const defaultBranch = await Branch.create({
      name: "Koramangala",
      address: "123, MG Road, Bengaluru, Karnataka - 560001",
      phone: "9876543210",
      email: "koramangala@kotrestaurant.com",
      gstin: "29AABCT1332L1ZP",
      isActive: true,
    });
    console.log(
      c.green(
        `✅ Branch created: ${defaultBranch.name} (${defaultBranch._id})\n`,
      ),
    );

    // ── Seed Users ────────────────────────────────────────────
    console.log(c.yellow("👤 Seeding users..."));
    const createdUsers = [];
    for (const u of USERS) {
      // ✅ Replace "ASSIGN" placeholder with real branchId
      const userData = {
        ...u,
        branchId: u.branchId === "ASSIGN" ? defaultBranch._id : null,
      };
      const user = new User(userData);
      await user.save(); // triggers bcrypt pre-save hook
      createdUsers.push(user);

      const branchLabel = userData.branchId
        ? `branch: ${defaultBranch.name}`
        : "super-admin";
      console.log(
        `   ${c.green("+")} ${u.username.padEnd(12)} [${u.role.padEnd(8)}]  pw: ${u.password.padEnd(14)}  ${c.cyan(branchLabel)}`,
      );
    }
    console.log(c.green(`✅ ${createdUsers.length} users created\n`));

    // Update branch adminUser reference
    const adminUser = createdUsers.find((u) => u.role === "admin");
    await Branch.findByIdAndUpdate(defaultBranch._id, {
      adminUser: adminUser._id,
    });

    // Helpers
    const byRole = (role) => createdUsers.find((u) => u.role === role);
    const waiter = createdUsers.find((u) => u.role === "waiter");
    const cashier = byRole("cashier");

    // ── Seed Menu Items ───────────────────────────────────────
    console.log(c.yellow("🍽️  Seeding menu items..."));
    const createdItems = await MenuItem.insertMany(MENU_ITEMS);
    console.log(c.green(`✅ ${createdItems.length} menu items created\n`));

    const item = (name) => createdItems.find((i) => i.ItemName === name);

    // ── Seed Tables ───────────────────────────────────────────
    console.log(c.yellow("🪑 Seeding tables..."));
    const createdTables = await Table.insertMany(
      TABLES.map((t) => ({
        ...t,
        // ✅ Add branchId to every table
        branchId: defaultBranch._id,
        assignedWaiter: t.status === "occupied" ? waiter._id : null,
        currentCustomer:
          t.status === "occupied"
            ? { name: "Demo Customer", phone: "9876543210" }
            : undefined,
      })),
    );
    console.log(c.green(`✅ ${createdTables.length} tables created\n`));

    const table = (n) => createdTables.find((t) => t.tableNumber === n);

    // ── Seed KOT Orders ───────────────────────────────────────
    console.log(c.yellow("📋 Seeding KOT orders..."));
    const kotData = [
      {
        branchId: defaultBranch._id, // ✅
        orderType: "dine-in",
        tableNumber: 3,
        tableId: table(3)._id,
        customerName: "Rahul Sharma",
        customerPhone: "9876543210",
        createdBy: waiter._id,
        status: "pending",
        items: [
          {
            itemId: item("Paneer Tikka")._id,
            name: "Paneer Tikka",
            quantity: 1,
            price: 160,
          },
          {
            itemId: item("Tomato Soup")._id,
            name: "Tomato Soup",
            quantity: 2,
            price: 80,
          },
        ],
        totalAmount: 320,
      },
      {
        branchId: defaultBranch._id,
        orderType: "dine-in",
        tableNumber: 4,
        tableId: table(4)._id,
        customerName: "Priya Menon",
        customerPhone: "9845012345",
        createdBy: waiter._id,
        status: "preparing",
        items: [
          {
            itemId: item("Chicken Biryani")._id,
            name: "Chicken Biryani",
            quantity: 2,
            price: 280,
          },
          {
            itemId: item("Boondi Raita")._id,
            name: "Boondi Raita",
            quantity: 2,
            price: 60,
          },
          {
            itemId: item("Mango Lassi")._id,
            name: "Mango Lassi",
            quantity: 2,
            price: 80,
          },
        ],
        totalAmount: 840,
      },
      {
        branchId: defaultBranch._id,
        orderType: "dine-in",
        tableNumber: 8,
        tableId: table(8)._id,
        customerName: "Suresh Nair",
        customerPhone: "9988776655",
        createdBy: waiter._id,
        status: "ready",
        items: [
          {
            itemId: item("Paneer Butter Masala")._id,
            name: "Paneer Butter Masala",
            quantity: 1,
            price: 220,
          },
          {
            itemId: item("Butter Naan")._id,
            name: "Butter Naan",
            quantity: 3,
            price: 40,
          },
          {
            itemId: item("Jeera Rice")._id,
            name: "Jeera Rice",
            quantity: 1,
            price: 100,
          },
          {
            itemId: item("Masala Chai")._id,
            name: "Masala Chai",
            quantity: 2,
            price: 30,
          },
        ],
        totalAmount: 500,
      },
      {
        branchId: defaultBranch._id,
        orderType: "takeaway",
        customerName: "Deepak Verma",
        customerPhone: "9123456780",
        createdBy: cashier._id,
        status: "preparing",
        items: [
          {
            itemId: item("Chicken 65")._id,
            name: "Chicken 65",
            quantity: 1,
            price: 180,
          },
          {
            itemId: item("Veg Fried Rice")._id,
            name: "Veg Fried Rice",
            quantity: 1,
            price: 160,
          },
          {
            itemId: item("Cold Coffee")._id,
            name: "Cold Coffee",
            quantity: 2,
            price: 90,
          },
        ],
        totalAmount: 520,
      },
      {
        branchId: defaultBranch._id,
        orderType: "dine-in",
        tableNumber: 3,
        tableId: table(3)._id,
        customerName: "Anjali Singh",
        customerPhone: "9012345678",
        createdBy: waiter._id,
        status: "served",
        items: [
          {
            itemId: item("Dal Makhani")._id,
            name: "Dal Makhani",
            quantity: 1,
            price: 180,
          },
          {
            itemId: item("Garlic Naan")._id,
            name: "Garlic Naan",
            quantity: 2,
            price: 50,
          },
          {
            itemId: item("Gulab Jamun (2 pcs)")._id,
            name: "Gulab Jamun (2 pcs)",
            quantity: 1,
            price: 80,
          },
          {
            itemId: item("Fresh Lime Soda")._id,
            name: "Fresh Lime Soda",
            quantity: 2,
            price: 60,
          },
        ],
        totalAmount: 480,
      },
    ];

    const createdKots = await Kot.insertMany(kotData);
    console.log(c.green(`✅ ${createdKots.length} KOT orders created\n`));

    // ── Seed Bills ────────────────────────────────────────────
    console.log(c.yellow("🧾 Seeding bills..."));
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const billNum = (n) => `BILL-${dateStr}-${String(n).padStart(3, "0")}`;

    const billData = [
      {
        branchId: defaultBranch._id, // ✅
        billNumber: billNum(1),
        customerName: "Vikram Patel",
        customerPhone: "9876501234",
        items: [
          {
            itemId: item("Chicken Biryani")._id,
            name: "Chicken Biryani",
            quantity: 1,
            price: 280,
          },
          {
            itemId: item("Boondi Raita")._id,
            name: "Boondi Raita",
            quantity: 1,
            price: 60,
          },
          {
            itemId: item("Mango Lassi")._id,
            name: "Mango Lassi",
            quantity: 1,
            price: 80,
          },
        ],
        totalAmount: 420,
        paymentStatus: "paid",
        paymentMethod: "cash",
        createdBy: cashier._id,
      },
      {
        branchId: defaultBranch._id,
        billNumber: billNum(2),
        customerName: "Sneha Reddy",
        customerPhone: "9845067890",
        items: [
          {
            itemId: item("Paneer Tikka")._id,
            name: "Paneer Tikka",
            quantity: 2,
            price: 160,
          },
          {
            itemId: item("Butter Naan")._id,
            name: "Butter Naan",
            quantity: 4,
            price: 40,
          },
          {
            itemId: item("Dal Makhani")._id,
            name: "Dal Makhani",
            quantity: 1,
            price: 180,
          },
          {
            itemId: item("Cold Coffee")._id,
            name: "Cold Coffee",
            quantity: 2,
            price: 90,
          },
        ],
        totalAmount: 820,
        paymentStatus: "paid",
        paymentMethod: "upi",
        createdBy: cashier._id,
      },
      {
        branchId: defaultBranch._id,
        billNumber: billNum(3),
        customerName: "Arjun Kumar",
        customerPhone: "9901234567",
        items: [
          {
            itemId: item("Veg Spring Rolls")._id,
            name: "Veg Spring Rolls",
            quantity: 1,
            price: 120,
          },
          {
            itemId: item("Palak Paneer")._id,
            name: "Palak Paneer",
            quantity: 1,
            price: 200,
          },
          {
            itemId: item("Tandoori Roti")._id,
            name: "Tandoori Roti",
            quantity: 3,
            price: 30,
          },
          {
            itemId: item("Masala Chai")._id,
            name: "Masala Chai",
            quantity: 2,
            price: 30,
          },
          {
            itemId: item("Gulab Jamun (2 pcs)")._id,
            name: "Gulab Jamun (2 pcs)",
            quantity: 1,
            price: 80,
          },
        ],
        totalAmount: 550,
        paymentStatus: "unpaid",
        paymentMethod: "none",
        createdBy: cashier._id,
      },
    ];

    const createdBills = await Billing.insertMany(billData);
    console.log(c.green(`✅ ${createdBills.length} bills created\n`));

    // ── Seed Settings ─────────────────────────────────────────
    console.log(c.yellow("⚙️  Seeding settings..."));

    // ✅ Global settings (branchId: null) — fallback for all branches
    await Settings.create({
      branchId: null,
      businessName: "KOT Restaurant",
      email: "contact@kotrestaurant.com",
      phone: "9876543210",
      address: "Head Office, Bengaluru",
      gstin: "29AABCT1332L1ZP",
      fssai: "10020011003606",
      hsn: "996331",
      currency: "INR",
      timezone: "Asia/Kolkata",
      taxRate: 5,
      serviceCharge: 0,
      autoRoundOff: true,
      printReceipt: true,
      openTime: "09:00",
      closeTime: "23:00",
      avgServiceTime: 30,
      maxCapacity: 60,
      takeawayEnabled: true,
      deliveryEnabled: false,
      orderAlerts: true,
      lowStockAlerts: true,
      paymentMethods: { cash: true, card: true, upi: true },
    });

    // ✅ Branch-specific settings — overrides global for Koramangala branch
    await Settings.create({
      branchId: defaultBranch._id,
      businessName: "KOT Restaurant — Koramangala",
      email: "koramangala@kotrestaurant.com",
      phone: "9876543210",
      address: "123, MG Road, Bengaluru, Karnataka - 560001",
      gstin: "29AABCT1332L1ZP",
      fssai: "10020011003606",
      hsn: "996331",
      currency: "INR",
      timezone: "Asia/Kolkata",
      taxRate: 5,
      serviceCharge: 0,
      autoRoundOff: true,
      printReceipt: true,
      openTime: "09:00",
      closeTime: "23:00",
      avgServiceTime: 30,
      maxCapacity: 60,
      takeawayEnabled: true,
      deliveryEnabled: false,
      orderAlerts: true,
      lowStockAlerts: true,
      paymentMethods: { cash: true, card: true, upi: true },
    });

    console.log(c.green("✅ Settings created (global + branch)\n"));

    // ── Summary ───────────────────────────────────────────────
    console.log(
      c.bold(c.cyan("═══════════════════════════════════════════════")),
    );
    console.log(c.bold(c.cyan("  ✅ SEED COMPLETE")));
    console.log(
      c.bold(c.cyan("═══════════════════════════════════════════════")),
    );
    console.log("");
    console.log(c.bold("  Login credentials:"));
    console.log(
      "  ┌─────────────┬──────────────┬──────────┬───────────────────────┐",
    );
    console.log(
      "  │ Username    │ Password     │ Role     │ Branch                │",
    );
    console.log(
      "  ├─────────────┼──────────────┼──────────┼───────────────────────┤",
    );
    for (const u of USERS) {
      const branch =
        u.branchId === null ? "super-admin (all)" : defaultBranch.name;
      console.log(
        `  │ ${u.username.padEnd(11)} │ ${u.password.padEnd(12)} │ ${u.role.padEnd(8)} │ ${branch.padEnd(21)} │`,
      );
    }
    console.log(
      "  └─────────────┴──────────────┴──────────┴───────────────────────┘",
    );
    console.log("");
    console.log(
      `  Branch     : ${c.green(defaultBranch.name)} (${defaultBranch._id})`,
    );
    console.log(`  Menu items : ${c.green(createdItems.length)}`);
    console.log(`  Tables     : ${c.green(createdTables.length)}`);
    console.log(`  KOT orders : ${c.green(createdKots.length)}`);
    console.log(`  Bills      : ${c.green(createdBills.length)}`);
    console.log("");
    console.log(c.bold("  ℹ️  Super-admin:"));
    console.log(
      `     Login as ${c.cyan("admin")} → can access /admin/branches`,
    );
    console.log(
      `     All other users are scoped to ${c.cyan(defaultBranch.name)}\n`,
    );
  } catch (err) {
    console.error(c.red("\n❌ Seed failed:"), err.message);
    if (err.code === 11000) {
      console.error(
        c.yellow(
          "  Hint: Duplicate key — run seed again, data will be cleared first.",
        ),
      );
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log(c.cyan("🔌 Disconnected from MongoDB\n"));
    process.exit(0);
  }
}

seed();
