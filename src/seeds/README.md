# Production seed system

Run from the project root:

```bash
npm run seed
npm run seed -- --admin-only
npm run seed:admin
npm run seed -- --clean --force
```

`--clean` is guarded and requires `--force`. It removes only records matching the deterministic seed identities configured by this system; it does not drop collections or the database. `--force` updates those matching seed records and, for the admin, replaces the password. Without it, existing records are preserved.

The scripts reuse `src/config/Database.js` and call `connectDB()`; they never call `mongoose.connect()` directly. All writes use hydrated model documents and `save()`, preserving schema validation and model middleware (including password hashing). They close the Mongoose connection on success and failure and return exit code 0 on success, 1 on seed/runtime failure, and 2 on invalid command-line usage.

## Configuration

`SEED_ADMIN_PASSWORD` (or `SUPERADMIN_PASSWORD`) is required and must satisfy the existing strong-password validation. `SEED_ADMIN_USERNAME` defaults to `admin`. Do not put production credentials in source control.

Optional JSON-array variables customize data: `SEED_BRANCHES_JSON`, `SEED_USERS_JSON`, `SEED_SETTINGS_JSON`, `SEED_MENU_JSON`, `SEED_INVENTORY_JSON`, `SEED_TABLES_JSON`, and `SEED_CUSTOMERS_JSON`. Staff entries use `{ "username", "password", "role", "status", "branch" }`; `branch` is the branch name and may be omitted. Empty default staff/customers arrays intentionally create no accounts or customer PII. Other defaults are safe starter configuration and can be replaced before production use.

Example:

```bash
SEED_USERS_JSON='[{"username":"chef.main","password":"Use-a-secret-from-your-secret-manager-9!","role":"chef","branch":"Main Branch"}]'
```

The full seed order is super admin, branches, users, settings, menu, inventory, tables, and customers. Dependencies are resolved from existing branch and menu documents; no audit events, stock logs, orders, or business transactions are generated.
