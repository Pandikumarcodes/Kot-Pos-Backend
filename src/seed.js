const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const User = require("./models/users");
const Branch = require("./models/Branch");
const Table = require("./models/tables");
const MenuItem = require("./models/menuItems");
const Settings = require("./models/settings");
const Inventory = require("./models/Inventory");
const Customer = require("./models/customer");
const Kot = require("./models/kot");
const Billing = require("./models/billings");
const TableOrder = require("./models/waiter");
const TakeAway = require("./models/takeAway");
const StockLog = require("./models/StockLog");

const CLEAN = process.argv.includes("--clean");

async function seed() {
  try {
    console.log("\n🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected!\n");

    if (CLEAN) {
      console.log("🧹 Cleaning existing seed data...");
      await Promise.all([
        StockLog.deleteMany({}),
        TakeAway.deleteMany({}),
        TableOrder.deleteMany({}),
        Billing.deleteMany({}),
        Kot.deleteMany({}),
        Inventory.deleteMany({}),
        Customer.deleteMany({}),
        Settings.deleteMany({}),
        MenuItem.deleteMany({}),
        Table.deleteMany({}),
        User.deleteMany({ username: /_test$/ }),
        Branch.deleteMany({ name: /Test Branch/ }),
      ]);
      console.log("✅ Clean complete!\n");
    }

    // ── 1. Branch ─────────────────────────────────────────────
    console.log("🏪 Seeding Branch...");
    let branch = await Branch.findOne({ name: "Test Branch - Main" });
    if (!branch) {
      branch = await Branch.create({
        name: "Test Branch - Main",
        address: "123 MG Road, Bengaluru, Karnataka",
        phone: "9876543210",
        email: "main@kotpos.in",
        gstin: "29ABCDE1234F1Z5",
        isActive: true,
      });
      console.log("  ✅ Branch created:", branch.name);
    } else {
      console.log("  ⚠️  Already exists:", branch.name);
    }

    // ── 2. Users ──────────────────────────────────────────────
    console.log("\n👥 Seeding Users...");
    const usersData = [
      {
        username: "admin_test",
        password: "Test@1234!",
        role: "admin",
        status: "active",
        branchId: null,
      },
      {
        username: "manager_test",
        password: "Test@1234!",
        role: "manager",
        status: "active",
        branchId: branch._id,
      },
      {
        username: "waiter_test",
        password: "Test@1234!",
        role: "waiter",
        status: "active",
        branchId: branch._id,
      },
      {
        username: "cashier_test",
        password: "Test@1234!",
        role: "cashier",
        status: "active",
        branchId: branch._id,
      },
      {
        username: "chef_test",
        password: "Test@1234!",
        role: "chef",
        status: "active",
        branchId: branch._id,
      },
    ];

    const createdUsers = {};
    for (const u of usersData) {
      let user = await User.findOne({ username: u.username });
      if (!user) {
        user = await new User(u).save();
        console.log(`  ✅ Created: ${u.username} (${u.role})`);
      } else {
        console.log(`  ⚠️  Exists:  ${u.username} (${u.role})`);
      }
      createdUsers[u.role] = user;
    }

    await Branch.findByIdAndUpdate(branch._id, {
      adminUser: createdUsers.admin._id,
    });

    // ── 3. Settings ───────────────────────────────────────────
    console.log("\n⚙️  Seeding Settings...");
    if (!(await Settings.findOne({ branchId: branch._id }))) {
      await Settings.create({
        branchId: branch._id,
        businessName: "KOT POS Restaurant",
        address: "123 MG Road, Bengaluru",
        phone: "9876543210",
        email: "info@kotpos.in",
        gstin: "29ABCDE1234F1Z5",
        taxRate: 5,
        takeawayEnabled: true,
      });
      console.log("  ✅ Branch settings created");
    } else {
      console.log("  ⚠️  Branch settings already exist");
    }

    if (!(await Settings.findOne({ branchId: null }))) {
      await Settings.create({
        branchId: null,
        businessName: "KOT POS Restaurant",
        address: "123 MG Road, Bengaluru",
        phone: "9876543210",
      });
      console.log("  ✅ Global settings created");
    } else {
      console.log("  ⚠️  Global settings already exist");
    }

    // ── 4. Tables ─────────────────────────────────────────────
    console.log("\n🪑 Seeding Tables...");
    const tablesData = [
      { tableNumber: 1, capacity: 2, status: "available" },
      { tableNumber: 2, capacity: 4, status: "available" },
      { tableNumber: 3, capacity: 4, status: "available" },
      { tableNumber: 4, capacity: 6, status: "available" },
      { tableNumber: 5, capacity: 8, status: "available" },
      {
        tableNumber: 6,
        capacity: 2,
        status: "occupied",
        currentCustomer: { name: "Ravi Kumar", phone: "9876543210" },
      },
      {
        tableNumber: 7,
        capacity: 4,
        status: "occupied",
        currentCustomer: { name: "Priya Sharma", phone: "9123456789" },
      },
      { tableNumber: 8, capacity: 6, status: "reserved" },
    ];

    const createdTables = [];
    for (const t of tablesData) {
      let table = await Table.findOne({ tableNumber: t.tableNumber });
      if (!table) {
        table = await Table.create(t);
        console.log(`  ✅ Table ${t.tableNumber} (${t.status})`);
      } else {
        console.log(`  ⚠️  Table ${t.tableNumber} already exists`);
      }
      createdTables.push(table);
    }

    // ── 5. Menu Items ─────────────────────────────────────────
    console.log("\n🍽️  Seeding Menu Items...");
    const menuData = [
      {
        ItemName: "Garlic Bread",
        category: "starter",
        price: 80,
        available: true,
      },
      {
        ItemName: "French Fries",
        category: "starter",
        price: 120,
        available: true,
      },
      {
        ItemName: "Tomato Soup",
        category: "starter",
        price: 90,
        available: true,
      },
      {
        ItemName: "Spring Rolls",
        category: "starter",
        price: 140,
        available: true,
      },
      {
        ItemName: "Paneer Butter Masala",
        category: "main_course",
        price: 280,
        available: true,
      },
      {
        ItemName: "Chicken Biryani",
        category: "main_course",
        price: 320,
        available: true,
      },
      {
        ItemName: "Veg Pasta",
        category: "main_course",
        price: 220,
        available: true,
      },
      {
        ItemName: "Dal Makhani",
        category: "main_course",
        price: 180,
        available: true,
      },
      {
        ItemName: "Palak Paneer",
        category: "main_course",
        price: 250,
        available: true,
      },
      {
        ItemName: "Butter Naan",
        category: "bread",
        price: 40,
        available: true,
      },
      { ItemName: "Roti", category: "bread", price: 25, available: true },
      { ItemName: "Paratha", category: "bread", price: 60, available: true },
      {
        ItemName: "Steamed Rice",
        category: "rice",
        price: 80,
        available: true,
      },
      {
        ItemName: "Veg Fried Rice",
        category: "rice",
        price: 160,
        available: true,
      },
      {
        ItemName: "Gulab Jamun",
        category: "dessert",
        price: 80,
        available: true,
      },
      {
        ItemName: "Ice Cream",
        category: "dessert",
        price: 100,
        available: true,
      },
      {
        ItemName: "Chocolate Brownie",
        category: "dessert",
        price: 150,
        available: true,
      },
      {
        ItemName: "Mango Lassi",
        category: "beverage",
        price: 80,
        available: true,
      },
      {
        ItemName: "Fresh Lime Soda",
        category: "beverage",
        price: 60,
        available: true,
      },
      {
        ItemName: "Cold Coffee",
        category: "beverage",
        price: 120,
        available: true,
      },
      {
        ItemName: "Masala Chai",
        category: "beverage",
        price: 40,
        available: true,
      },
      { ItemName: "Samosa", category: "snacks", price: 30, available: true },
      { ItemName: "Sandwich", category: "snacks", price: 120, available: true },
      {
        ItemName: "Green Salad",
        category: "side_dish",
        price: 80,
        available: true,
      },
      { ItemName: "Raita", category: "side_dish", price: 60, available: true },
      {
        ItemName: "Thali Special",
        category: "combo",
        price: 350,
        available: true,
      },
      {
        ItemName: "Chef Special Platter",
        category: "special",
        price: 450,
        available: false,
      },
    ];

    const createdMenuItems = [];
    for (const item of menuData) {
      let menuItem = await MenuItem.findOne({ ItemName: item.ItemName });
      if (!menuItem) {
        menuItem = await MenuItem.create(item);
        console.log(`  ✅ ${item.ItemName} — ₹${item.price}`);
      } else {
        console.log(`  ⚠️  ${item.ItemName} already exists`);
      }
      createdMenuItems.push(menuItem);
    }

    // ── 6. Inventory ──────────────────────────────────────────
    console.log("\n📦 Seeding Inventory...");
    const inventoryData = [
      {
        name: "Paneer",
        unit: "kg",
        currentStock: 5,
        lowStockThreshold: 2,
        category: "dairy",
        costPerUnit: 320,
        supplier: "Fresh Dairy Co",
      },
      {
        name: "Chicken",
        unit: "kg",
        currentStock: 8,
        lowStockThreshold: 3,
        category: "raw_material",
        costPerUnit: 180,
        supplier: "Poultry Farm",
      },
      {
        name: "Rice",
        unit: "kg",
        currentStock: 25,
        lowStockThreshold: 5,
        category: "raw_material",
        costPerUnit: 60,
        supplier: "Rice Mills",
      },
      {
        name: "Tomatoes",
        unit: "kg",
        currentStock: 3,
        lowStockThreshold: 2,
        category: "produce",
        costPerUnit: 40,
        supplier: "Local Market",
      },
      {
        name: "Onions",
        unit: "kg",
        currentStock: 10,
        lowStockThreshold: 3,
        category: "produce",
        costPerUnit: 30,
        supplier: "Local Market",
      },
      {
        name: "Butter",
        unit: "kg",
        currentStock: 2,
        lowStockThreshold: 1,
        category: "dairy",
        costPerUnit: 480,
        supplier: "Fresh Dairy Co",
      },
      {
        name: "Mango Pulp",
        unit: "l",
        currentStock: 4,
        lowStockThreshold: 2,
        category: "beverage",
        costPerUnit: 120,
        supplier: "Fruit Supplier",
      },
      {
        name: "Cooking Oil",
        unit: "l",
        currentStock: 15,
        lowStockThreshold: 5,
        category: "raw_material",
        costPerUnit: 140,
        supplier: "Oil Traders",
      },
      {
        name: "Takeaway Boxes",
        unit: "pcs",
        currentStock: 200,
        lowStockThreshold: 50,
        category: "packaging",
        costPerUnit: 5,
        supplier: "Pack Mart",
      },
      {
        name: "Maida",
        unit: "kg",
        currentStock: 1,
        lowStockThreshold: 3,
        category: "raw_material",
        costPerUnit: 45,
        supplier: "Flour Mills",
      },
    ];

    const createdInventory = [];
    for (const item of inventoryData) {
      let inv = await Inventory.findOne({
        branchId: branch._id,
        name: item.name,
      });
      if (!inv) {
        inv = await Inventory.create({ ...item, branchId: branch._id });
        console.log(`  ✅ ${item.name} — ${item.currentStock} ${item.unit}`);
      } else {
        console.log(`  ⚠️  ${item.name} already exists`);
      }
      createdInventory.push(inv);
    }

    // ── 7. Customers ──────────────────────────────────────────
    console.log("\n👤 Seeding Customers...");
    const customersData = [
      {
        name: "Ravi Kumar",
        phone: "9876543210",
        email: "ravi@example.com",
        totalOrders: 8,
        totalSpent: 2400,
      },
      {
        name: "Priya Sharma",
        phone: "9123456789",
        email: "priya@example.com",
        totalOrders: 5,
        totalSpent: 1800,
      },
      {
        name: "Arjun Nair",
        phone: "9988776655",
        email: "arjun@example.com",
        totalOrders: 12,
        totalSpent: 4200,
      },
      {
        name: "Meena Iyer",
        phone: "9654321098",
        email: "meena@example.com",
        totalOrders: 3,
        totalSpent: 900,
      },
      {
        name: "Walk-in Guest",
        phone: "0000000000",
        email: "",
        totalOrders: 1,
        totalSpent: 350,
      },
    ];

    for (const c of customersData) {
      if (!(await Customer.findOne({ phone: c.phone }))) {
        await Customer.create(c);
        console.log(`  ✅ ${c.name}`);
      } else {
        console.log(`  ⚠️  ${c.name} already exists`);
      }
    }

    // ── 8. KOT Orders ─────────────────────────────────────────
    console.log("\n🎫 Seeding KOT Orders...");
    const paneerId = createdMenuItems.find(
      (m) => m.ItemName === "Paneer Butter Masala",
    )?._id;
    const lassiId = createdMenuItems.find(
      (m) => m.ItemName === "Mango Lassi",
    )?._id;
    const nanId = createdMenuItems.find(
      (m) => m.ItemName === "Butter Naan",
    )?._id;
    const riceId = createdMenuItems.find(
      (m) => m.ItemName === "Steamed Rice",
    )?._id;
    const table6 = createdTables.find((t) => t.tableNumber === 6);
    const table7 = createdTables.find((t) => t.tableNumber === 7);

    const kotData = [
      {
        branchId: branch._id,
        orderType: "dine-in",
        tableNumber: 6,
        tableId: table6._id,
        customerName: "Ravi Kumar",
        customerPhone: "9876543210",
        createdBy: createdUsers.waiter._id,
        items: [
          {
            itemId: paneerId,
            name: "Paneer Butter Masala",
            quantity: 2,
            price: 280,
          },
          { itemId: nanId, name: "Butter Naan", quantity: 4, price: 40 },
        ],
        totalAmount: 720,
        status: "preparing",
      },
      {
        branchId: branch._id,
        orderType: "dine-in",
        tableNumber: 7,
        tableId: table7._id,
        customerName: "Priya Sharma",
        customerPhone: "9123456789",
        createdBy: createdUsers.waiter._id,
        items: [
          { itemId: riceId, name: "Steamed Rice", quantity: 2, price: 80 },
          { itemId: lassiId, name: "Mango Lassi", quantity: 2, price: 80 },
        ],
        totalAmount: 320,
        status: "pending",
      },
      {
        branchId: branch._id,
        orderType: "takeaway",
        customerName: "Arjun Nair",
        customerPhone: "9988776655",
        createdBy: createdUsers.cashier._id,
        items: [
          {
            itemId: paneerId,
            name: "Paneer Butter Masala",
            quantity: 1,
            price: 280,
          },
          { itemId: nanId, name: "Butter Naan", quantity: 2, price: 40 },
        ],
        totalAmount: 360,
        status: "ready",
      },
    ];

    const createdKots = [];
    for (const k of kotData) {
      const kot = await Kot.create(k);
      console.log(
        `  ✅ KOT: ${kot.orderType} — ₹${kot.totalAmount} (${kot.status})`,
      );
      createdKots.push(kot);
    }

    // ── 9. Table Orders ───────────────────────────────────────
    console.log("\n📋 Seeding Table Orders...");
    await TableOrder.create({
      tableNumber: 6,
      tableId: table6._id,
      customerName: "Ravi Kumar",
      createdBy: createdUsers.waiter._id,
      items: [
        {
          itemId: paneerId,
          name: "Paneer Butter Masala",
          quantity: 2,
          price: 280,
        },
        { itemId: nanId, name: "Butter Naan", quantity: 4, price: 40 },
      ],
      totalAmount: 720,
      status: "sent_to_kitchen",
    });
    console.log("  ✅ Table Order: Table 6 — ₹720");

    await TableOrder.create({
      tableNumber: 7,
      tableId: table7._id,
      customerName: "Priya Sharma",
      createdBy: createdUsers.waiter._id,
      items: [
        { itemId: riceId, name: "Steamed Rice", quantity: 2, price: 80 },
        { itemId: lassiId, name: "Mango Lassi", quantity: 2, price: 80 },
      ],
      totalAmount: 320,
      status: "pending",
    });
    console.log("  ✅ Table Order: Table 7 — ₹320");

    // ── 10. Takeaway Orders ───────────────────────────────────
    console.log("\n🥡 Seeding Takeaway Orders...");
    await TakeAway.create({
      customerName: "Arjun Nair",
      customerPhone: "9988776655",
      createdBy: createdUsers.cashier._id,
      items: [
        {
          itemId: paneerId,
          name: "Paneer Butter Masala",
          quantity: 1,
          price: 280,
        },
        { itemId: nanId, name: "Butter Naan", quantity: 2, price: 40 },
      ],
      totalAmount: 360,
      status: "sent_to_kitchen",
    });
    console.log("  ✅ Takeaway: Arjun Nair — ₹360");

    await TakeAway.create({
      customerName: "Meena Iyer",
      customerPhone: "9654321098",
      createdBy: createdUsers.cashier._id,
      items: [{ itemId: lassiId, name: "Mango Lassi", quantity: 2, price: 80 }],
      totalAmount: 160,
      status: "pending",
    });
    console.log("  ✅ Takeaway: Meena Iyer — ₹160");

    // ── 11. Bills ─────────────────────────────────────────────
    console.log("\n💳 Seeding Bills...");
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

    const billsData = [
      {
        billNumber: `BILL-${today}-001`,
        customerName: "Ravi Kumar",
        customerPhone: "9876543210",
        items: [
          {
            itemId: paneerId,
            name: "Paneer Butter Masala",
            quantity: 2,
            price: 280,
            total: 560,
          },
          {
            itemId: nanId,
            name: "Butter Naan",
            quantity: 4,
            price: 40,
            total: 160,
          },
        ],
        totalAmount: 720,
        paymentStatus: "paid",
        paymentMethod: "upi",
        paidAt: new Date(),
        createdBy: createdUsers.cashier._id,
        tableId: table6._id,
        tableNumber: 6,
      },
      {
        billNumber: `BILL-${today}-002`,
        customerName: "Arjun Nair",
        customerPhone: "9988776655",
        items: [
          {
            itemId: paneerId,
            name: "Paneer Butter Masala",
            quantity: 1,
            price: 280,
            total: 280,
          },
          {
            itemId: nanId,
            name: "Butter Naan",
            quantity: 2,
            price: 40,
            total: 80,
          },
        ],
        totalAmount: 360,
        paymentStatus: "paid",
        paymentMethod: "cash",
        paidAt: new Date(),
        createdBy: createdUsers.cashier._id,
      },
      {
        billNumber: `BILL-${today}-003`,
        customerName: "Priya Sharma",
        customerPhone: "9123456789",
        items: [
          {
            itemId: riceId,
            name: "Steamed Rice",
            quantity: 2,
            price: 80,
            total: 160,
          },
          {
            itemId: lassiId,
            name: "Mango Lassi",
            quantity: 2,
            price: 80,
            total: 160,
          },
        ],
        totalAmount: 320,
        paymentStatus: "unpaid",
        paymentMethod: "none",
        createdBy: createdUsers.cashier._id,
        tableId: table7._id,
        tableNumber: 7,
      },
    ];

    for (const bill of billsData) {
      if (!(await Billing.findOne({ billNumber: bill.billNumber }))) {
        await Billing.create(bill);
        console.log(
          `  ✅ ${bill.billNumber} — ₹${bill.totalAmount} (${bill.paymentStatus})`,
        );
      } else {
        console.log(`  ⚠️  ${bill.billNumber} already exists`);
      }
    }

    // ── 12. Stock Logs ────────────────────────────────────────
    console.log("\n📊 Seeding Stock Logs...");
    const paneerInv = createdInventory.find((i) => i.name === "Paneer");
    if (paneerInv) {
      await StockLog.create([
        {
          branchId: branch._id,
          inventoryId: paneerInv._id,
          type: "restock",
          quantity: 10,
          stockBefore: 0,
          stockAfter: 10,
          note: "Initial stock",
          doneBy: createdUsers.admin._id,
        },
        {
          branchId: branch._id,
          inventoryId: paneerInv._id,
          type: "kot_deduct",
          quantity: -2,
          stockBefore: 10,
          stockAfter: 8,
          note: "KOT deduction",
          kotId: createdKots[0]._id,
          doneBy: createdUsers.waiter._id,
        },
        {
          branchId: branch._id,
          inventoryId: paneerInv._id,
          type: "adjustment",
          quantity: -1,
          stockBefore: 8,
          stockAfter: 7,
          note: "Spillage adjustment",
          doneBy: createdUsers.admin._id,
        },
      ]);
      console.log("  ✅ Stock logs created");
    }

    // ── Final Summary ─────────────────────────────────────────
    console.log("\n" + "═".repeat(55));
    console.log("🎉  SEEDING COMPLETE!");
    console.log("═".repeat(55));
    console.log("\n🔑 Test Credentials (password: Test@1234! for all)");
    console.log("   admin_test   → /admin/dashboard");
    console.log("   manager_test → /admin/dashboard");
    console.log("   waiter_test  → /waiter/tables");
    console.log("   cashier_test → /cashier/billing");
    console.log("   chef_test    → /chef/kot");
    console.log("\n📌 Update e2e/flows/Qr.spec.ts with this Table ID:");
    console.log(`   const TEST_TABLE_ID = "${createdTables[0]._id}";`);
    console.log("\n📊 Seeded:");
    console.log("   1 Branch · 5 Users · 8 Tables · 27 Menu Items");
    console.log("   10 Inventory Items · 5 Customers · 3 KOTs");
    console.log("   2 Table Orders · 2 Takeaways · 3 Bills · 3 Stock Logs");
    console.log("═".repeat(55) + "\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
