# 🍽️ KOT — Kitchen Order Ticket System

A role-based Restaurant Management REST API built with **Node.js**, **Express.js**, **MongoDB**, and **JWT Auth via Cookies**. It manages the full lifecycle of a restaurant order — from waiter to kitchen to billing.

---

## 📌 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Folder Structure](#-folder-structure)
- [Environment Variables](#-environment-variables)
- [Installation & Setup](#-installation--setup)
- [API Endpoints](#-api-endpoints)

---

## 🧾 Project Overview

KOT (Kitchen Order Ticket) is a backend system for restaurants to manage:

- **Staff authentication** with role-based access (Admin, Cashier, Waiter, Chef)
- **Menu & Table management** by admins
- **Order placement** by waiters and cashiers
- **KOT queue management** by chefs in the kitchen
- **Billing & reports** by cashiers

---

## 🛠 Tech Stack

| Layer         | Technology                  |
| ------------- | --------------------------- |
| Runtime       | Node.js                     |
| Framework     | Express.js                  |
| Database      | MongoDB                     |
| ODM           | Mongoose                    |
| Auth          | JWT (via HTTP-only Cookies) |
| Body Parsing  | express.json, body-parser   |
| Cookie Parser | cookie-parser               |

---

## 📁 Folder Structure

```
kot/
├── config/
│   └── Database.js           # MongoDB connection
├── routes/
│   ├── auth.js               # Auth routes
│   ├── testRouter.js         # Dev/test routes
│   ├── admin/
│   │   ├── adminUser.js      # Admin user management
│   │   ├── adminMenu.js      # Menu management
│   │   └── adminTable.js     # Table management
│   ├── cashier/
│   │   ├── cashierBilling.js # Billing
│   │   ├── cashierKotOrder.js# KOT orders
│   │   └── cashierReports.js # Reports
│   ├── waiter/
│   │   ├── waiterOrderRouter.js  # Order placement
│   │   └── waiterTableRouter.js  # Table status
│   └── chef/
│       └── chefRouter.js     # KOT queue
├── .env
├── package.json
└── server.js                 # Entry point
```

---

## 🔐 Environment Variables

Create a `.env` file in the root of the project:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/kot
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
COOKIE_EXPIRES_IN=7
NODE_ENV=development
```

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `PORT`              | Server port (default: 3000)       |
| `MONGO_URI`         | MongoDB connection string         |
| `JWT_SECRET`        | Secret key for signing JWT tokens |
| `JWT_EXPIRES_IN`    | JWT expiry duration (e.g. `7d`)   |
| `COOKIE_EXPIRES_IN` | Cookie expiry in days             |
| `NODE_ENV`          | `development` or `production`     |

---

## 🚀 Installation & Setup

### Prerequisites

- Node.js `v18+`
- MongoDB running locally or a MongoDB Atlas URI

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Pandikumarcodes/Kot-Pos-Backend.git
cd kot

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Then edit .env with your values

# 4. Start the server
node server.js

# Or with nodemon for development
npx nodemon server.js
```

Server will start at: `http://localhost:3000`

---

## 📡 API Endpoints

All routes use `http://localhost:3000` as the base URL.  
Protected routes require a valid JWT stored in an HTTP-only cookie (set on login).

---

### 🔐 Auth — `/auth`

| Method | Endpoint         | Description                   | Access  |
| ------ | ---------------- | ----------------------------- | ------- |
| POST   | `/auth/register` | Register a new user           | Public  |
| POST   | `/auth/login`    | Login and receive auth cookie | Public  |
| POST   | `/auth/logout`   | Logout and clear cookie       | Private |
| GET    | `/auth/profile`  | Get current user's profile    | Private |

---

### 👤 Admin — Users `/admin`

| Method | Endpoint           | Description              | Access |
| ------ | ------------------ | ------------------------ | ------ |
| GET    | `/admin/users`     | List all users           | Admin  |
| POST   | `/admin/users`     | Create a new staff user  | Admin  |
| GET    | `/admin/users/:id` | Get a user by ID         | Admin  |
| PUT    | `/admin/users/:id` | Update user details/role | Admin  |
| DELETE | `/admin/users/:id` | Delete a user            | Admin  |

---

### 🍽️ Admin — Menu `/admin`

| Method | Endpoint          | Description           | Access |
| ------ | ----------------- | --------------------- | ------ |
| GET    | `/admin/menu`     | Get all menu items    | Admin  |
| POST   | `/admin/menu`     | Add a new menu item   | Admin  |
| GET    | `/admin/menu/:id` | Get a menu item by ID | Admin  |
| PUT    | `/admin/menu/:id` | Update a menu item    | Admin  |
| DELETE | `/admin/menu/:id` | Delete a menu item    | Admin  |

---

### 🪑 Admin — Tables `/admin`

| Method | Endpoint            | Description          | Access |
| ------ | ------------------- | -------------------- | ------ |
| GET    | `/admin/tables`     | List all tables      | Admin  |
| POST   | `/admin/tables`     | Add a new table      | Admin  |
| GET    | `/admin/tables/:id` | Get a table by ID    | Admin  |
| PUT    | `/admin/tables/:id` | Update table details | Admin  |
| DELETE | `/admin/tables/:id` | Remove a table       | Admin  |

---

### 💳 Cashier — Billing `/cashier`

| Method | Endpoint                   | Description            | Access  |
| ------ | -------------------------- | ---------------------- | ------- |
| GET    | `/cashier/billing`         | Get all bills          | Cashier |
| POST   | `/cashier/billing/:kotId`  | Generate bill from KOT | Cashier |
| PATCH  | `/cashier/billing/:id/pay` | Mark a bill as paid    | Cashier |

---

### 🧾 Cashier — KOT Orders `/cashier`

| Method | Endpoint                  | Description            | Access  |
| ------ | ------------------------- | ---------------------- | ------- |
| GET    | `/cashier/kot`            | Get all KOT orders     | Cashier |
| POST   | `/cashier/kot`            | Create a new KOT order | Cashier |
| PATCH  | `/cashier/kot/:id/cancel` | Cancel a KOT order     | Cashier |

---

### 📊 Cashier — Reports `/cashier`

| Method | Endpoint                   | Description             | Access  |
| ------ | -------------------------- | ----------------------- | ------- |
| GET    | `/cashier/reports/daily`   | Daily sales report      | Cashier |
| GET    | `/cashier/reports/summary` | Revenue summary & stats | Cashier |

---

### 🧑‍🍳 Waiter `/waiter`

| Method | Endpoint                    | Description                     | Access |
| ------ | --------------------------- | ------------------------------- | ------ |
| GET    | `/waiter/orders`            | View all assigned orders        | Waiter |
| POST   | `/waiter/orders`            | Place a new order for a table   | Waiter |
| PATCH  | `/waiter/orders/:id`        | Update/add items to an order    | Waiter |
| GET    | `/waiter/tables`            | Get all tables and their status | Waiter |
| PATCH  | `/waiter/tables/:id/status` | Update table status             | Waiter |

---

### 👨‍🍳 Chef `/chef`

| Method | Endpoint              | Description                  | Access |
| ------ | --------------------- | ---------------------------- | ------ |
| GET    | `/chef/kot`           | View all pending KOT tickets | Chef   |
| PATCH  | `/chef/kot/:id/start` | Mark KOT as in preparation   | Chef   |
| PATCH  | `/chef/kot/:id/ready` | Mark KOT as ready to serve   | Chef   |

---

### 🧪 Test `/test` _(Dev Only)_

| Method | Endpoint           | Description                  | Access  |
| ------ | ------------------ | ---------------------------- | ------- |
| GET    | `/test/ping`       | Server health check          | Public  |
| GET    | `/test/auth-check` | Verify cookie/JWT auth works | Private |

---

## 📝 Notes

- All private routes expect a valid JWT cookie set during `/auth/login`
- Role-based middleware should restrict routes to their respective roles (Admin, Cashier, Waiter, Chef)
- The `adminReportRouter` and `cashierOnlineRouter` are commented out and reserved for future use

---

## 📄 License

[MIT](LICENSE)
