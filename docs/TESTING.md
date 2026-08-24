# Testing Guide

## Framework and configuration

The backend uses Jest with the Node test environment and Supertest for HTTP route tests.

Configuration from `package.json`:

- Test roots: `src`.
- Match pattern: `src/__tests__/**/*.test.js`.
- Default test timeout: 10 seconds.
- Coverage directory: `coverage`.
- Coverage collection: routes, middleware, and utilities, excluding tests.
- Global thresholds: 70% lines, 70% functions, 65% branches.

The repository currently contains 56 `.test.js` files.

## Commands

```powershell
npm run test:backend
npm run test:backend:watch
npm run test:backend:coverage
npm run test:backend:ci
```

Script behavior:

| Script | Command |
|---|---|
| `test:backend` | `jest` |
| `test:backend:watch` | `jest --watch` |
| `test:backend:coverage` | `jest --coverage` |
| `test:backend:ci` | `jest --ci --coverage --forceExit` |

Rate limiting is automatically bypassed when `NODE_ENV=test` or explicit E2E mode is enabled.

## Test organization

### Feature route tests

- `auth.test.js`: signup, login, current user, refresh, logout.
- `adminTest/`: branch, customer, inventory, menu, reports, settings, tables, users, public QR.
- `cashierTest/`: billing, takeaway, cashier reports.
- `chefTest/`: kitchen KOT operations.
- `waitersTest/`: waiter order/table workflows and branch isolation.
- `settingsRead.test.js`: receipt-settings contract.
- `socket.test.js`: socket authentication and table update behavior.

These suites commonly mock Mongoose models/repositories and exercise Express routers with Supertest.

### Security tests

`SecurityTest/` covers:

- Unauthenticated and unauthorized access.
- Role escalation attempts.
- Invalid tokens.
- Login/signup/session security.
- Rate limiting behavior.
- Helmet headers.
- CORS allow/deny/preflight behavior.
- Input and payload validation.

### Infrastructure tests

`infrastructure/` covers:

- Audit event model and policy infrastructure.
- Audit repository query contracts.
- Redis cache behavior.
- BullMQ queue/worker infrastructure.
- Transaction manager retries, rollback, and session cleanup.
- Repository session forwarding.
- Startup validation.
- Lifecycle/health checks.
- Graceful shutdown.
- Production-hardening behavior.

### Integration-style tests

`integration/` covers service orchestration with controlled mocks/in-memory state:

- Administration, billing, inventory, and order audit contracts.
- Billing/payment transactions.
- Inventory transactions.
- Dine-in/takeaway order transactions.
- Kitchen audit transactions.
- Operational/master-data/stock-log query plans.
- Health and startup application integration.

These tests validate transaction boundaries and session propagation but generally do not start real MongoDB, Redis, or BullMQ services.

### Model and utility tests

- `models/`: table ownership and mandatory index reconciliation.
- `utils/queryInfrastructure.test.js`: validation, pagination, search, filters, sorting, projection, BSON preservation, and QueryBuilder.
- Seed tests: deterministic fixture topology and customer-only reseed safeguards.

## Mocking strategy

The suite frequently mocks:

- Mongoose static methods and query chains.
- Repositories.
- `TransactionManager` with a synthetic session.
- Socket.IO emitters.
- Redis/BullMQ connections.
- Audit repositories.

This makes the suite fast and focused but means passing tests do not prove:

- Live replica-set transaction compatibility.
- Actual Redis/BullMQ interoperability.
- Multi-instance Socket.IO delivery.
- Deployment environment correctness.
- MongoDB index reconciliation against production data volumes.

## API documentation validation

The repository contains a standalone documentation validator:

```powershell
node scripts/validate-api-docs.js
```

It parses generated Postman JSON, validates schema references, and checks hard-coded OpenAPI counts. It is not exposed as an npm script.

Current known result: it fails because runtime and regenerated checked-in OpenAPI now have 69 paths/83 operations while the script expects 68/82. The mounted branch-admin assignment/create operations are also absent from the OpenAPI source and generated Postman collections.

Generating artifacts:

```powershell
npm run docs:generate
```

This command writes OpenAPI and Postman artifacts. Review generated diffs before committing.

## Recommended local verification order

```powershell
npm ci
npm run test:backend
npm run test:backend:coverage
node scripts/validate-api-docs.js
git diff --check
```

The documentation validator is expected to remain red until its count and missing-route drift are corrected.

## Adding tests

When changing a workflow, test at the narrowest useful levels:

1. Validator/query utility unit behavior.
2. Service/repository behavior and scoped filters.
3. Transaction session propagation and rollback behavior.
4. Route authentication, role, branch, validation, and response contract.
5. Security regression for cross-branch and privilege-escalation cases.

For new branch-owned models, explicitly test that a valid ID from another branch returns no resource and cannot be mutated.

## Test-environment caution

Importing the application initializes Winston rotating-file transports even when console output is silent. Tests can therefore touch files under `logs/`. Ensure generated logs and coverage remain ignored and do not use strict read-only worktrees for a full Jest run.
