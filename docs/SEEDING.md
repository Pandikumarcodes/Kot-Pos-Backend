# Demo Seeding

The demo seed is implemented by `src/seed.js` and deterministic fixture builders under `src/seedData/`.

## Safety guard

Every seed mode refuses to run unless both conditions are true:

1. `NODE_ENV` is exactly `development`.
2. The connected MongoDB database name is exactly `Kot-Pos`.

The guard is evaluated after connection using the actual database name. Do not weaken or bypass it.

The seed uses MongoDB transactions and therefore requires a replica set or sharded cluster.

Seed arguments are strictly allowlisted. An unknown argument is an error and cannot fall through to full mode. `--clean`, `--customers-only`, and `--operations-only` are mutually exclusive.

## Modes

### Full seed

```powershell
npm run seed
```

Creates the full deterministic dataset and verifies exact counts, relationships, payment consistency, stock reconciliation, and mandatory indexes.

This mode does not delete existing data. It expects an empty compatible database. Running it repeatedly against seeded data will generally fail because of uniqueness constraints or exact-count verification.

### Clean and seed

```powershell
npm run seed -- --clean
```

After the safety guard succeeds, this mode deletes data from the primary application collections and then creates the complete fixture set.

The cleanup covers users, branches, tables, settings, menu, inventory, customers, stock logs, KOTs, bills, TableOrders, and TakeAway records.

Cleanup occurs before the later fixture transaction. If fixture creation fails, the prior cleanup is not rolled back. Treat this as destructive development-only behavior.

### Customer-only reseed

```powershell
npm run seed -- --customers-only
```

This mode:

1. Loads Billing, KOT, TableOrder, and TakeAway customer snapshots.
2. Verifies those names/phones match the deterministic customer fixture.
3. Refuses the operation if snapshots are incompatible.
4. Deletes and recreates only Customer records inside a transaction.
5. Recalculates total orders, total spend, and last visit.
6. Verifies 120 customers and 120 unique phones.
7. Leaves historical transactions unchanged.

`--clean` and `--customers-only` cannot be combined.

### Operational demo reseed

> **THIS COMMAND IS FOR THE DISPOSABLE DEMO DATABASE ONLY.**

```powershell
npm run seed -- --operations-only
```

All three prerequisites are mandatory:

1. `NODE_ENV=development`
2. The connected database name is exactly `Kot-Pos`
3. `DEMO_SEED_ENABLED=true`

The opt-in defaults to denied (`DEMO_SEED_ENABLED=false` in `.env.example`). Back up a hosted demo before resetting it. Never enable or run this mode against a production database or a database containing valuable data.

Before deleting anything, the command verifies the deterministic foundation fingerprint: 3 canonical branches, 25 correctly assigned demo users, 80 exact menu items, 120 exact customer name/phone identities, 45 inventory records, the expected global/per-branch Settings topology, and the pristine 90-row StockLog baseline. A mismatch aborts without mutation. IDs are discovered from those records and are never hardcoded.

The command preserves Branch, User, MenuItem, Customer, Inventory, StockLog, Settings, and AuditEvent documents. It deletes and recreates only Bills, KOTs, TableOrders, TakeAways, and Tables, in one MongoDB transaction. Customer documents and ObjectIds remain in place; their `totalOrders`, `totalSpent`, and `lastVisit` metrics are recalculated in that same transaction.

Inventory and StockLogs are not rewritten, and no runtime order or inventory-deduction service is called. If a preserved `StockLog.kotId` references a KOT that would be deleted, the command refuses with a runtime-stock-history error. AuditEvents remain append-only and unchanged. Their operational entity IDs are logical strings, so an old AuditEvent may continue to refer to a pre-reset demo operational ID.

Critical counts, distributions, relationships, totals, uniqueness, workflow consistency, customer metrics, and preserved inventory/StockLog contents are verified before commit. Any failure rolls back the entire operational reset. A lightweight count and foundation check runs again after commit.

Rerunning the command against the unchanged pristine foundation replaces rather than accumulates operational records and produces the same logical demo story. MongoDB ObjectIds for Tables and other recreated operational documents change on every successful run.

## Demo hierarchy

The seed creates:

```text
1 branchless superadmin
3 active branches
3 branch admins (one per branch)
21 additional branch staff
25 users total
```

Branch staff composition:

| Branch fixture | Manager | Waiter | Chef | Cashier | Tables | Inventory |
|---|---:|---:|---:|---:|---:|---:|
| Branch 1 | 1 | 3 | 2 | 2 | 14 | 17 |
| Branch 2 | 1 | 3 | 2 | 1 | 12 | 15 |
| Branch 3 | 1 | 2 | 2 | 1 | 10 | 13 |

Every branch is initially inserted inactive, assigned its seeded admin through `Branch.adminUser`, then activated within the fixture transaction.

## Encoded data counts

Verification expects exactly:

| Data | Count |
|---|---:|
| Users | 25 |
| Superadmins | 1 |
| Branch admins | 3 |
| Branches | 3 |
| Tables | 36 |
| Menu items | 80 |
| Inventory items | 45 |
| Customers | 120 |
| TableOrders | 116 |
| TakeAway records | 42 |
| KOTs | 143 |
| Bills | 133 |
| Paid bills | 128 |
| Unpaid bills | 5 |
| Billing-state tables | 5 |
| Stock logs | 90 |

The combined historical/current source-order count is 158 TableOrder and TakeAway records.

## Menu fixture

The menu is global and contains 80 items across:

| Category | Count |
|---|---:|
| starter | 10 |
| main_course | 18 |
| dessert | 7 |
| beverage | 10 |
| snacks | 7 |
| side_dish | 6 |
| bread | 6 |
| rice | 7 |
| combo | 5 |
| special | 4 |

Four menu items are seeded unavailable.

## Operational fixture shape

The seed includes:

- Up to 119 days of historical dine-in/takeaway activity.
- Paid bills with cash/card/UPI distributions.
- Cancelled historical records.
- Current occupied, reserved, available, and billing tables.
- Active KOTs in pending, preparing, and ready states.
- Current paid takeaway activity and five unpaid table bills.
- Low, near-threshold, and healthy inventory.
- Two coherent stock logs per inventory item.
- Customer metrics derived from transaction snapshots.
- One global Settings row and one Settings row per branch.

## Verification

After insertion, the seed verifies:

- Exact topology/counts.
- One superadmin and three branch admins.
- Bill paid/unpaid consistency with `paidAt` and payment method.
- Unique bill numbers and customer phone numbers.
- Inventory never negative.
- Latest StockLog value reconciles to current stock.
- Required User, Branch, and Table indexes exist.

Any verification failure rejects the seed run.

## Credentials

All seeded accounts use `SEED_ADMIN_PASSWORD` when supplied; the implementation contains a development fallback. The script prints demo usernames after success, but never prints the effective password or password hashes.

Do not copy seed output into committed documentation, logs, screenshots, issue trackers, or production configuration. Use placeholders in public materials:

```text
Superadmin: <provided-separately>
Branch admin: <provided-separately>
Operational role account: <provided-separately>
Password: <provided-separately>
```

Never use the demo seed against production or a database containing valuable data.
