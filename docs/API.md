# API Reference

This file inventories the currently mounted routes. Runtime Swagger UI, checked-in OpenAPI JSON, and generated Postman collections are produced from `src/docs/openapi.js`.

## Base URLs and conventions

- Versioned API prefix: `/api/v1`
- Access authentication: HTTP-only `token` cookie or `Authorization: Bearer <access-token>`
- Refresh authentication: HTTP-only `refreshToken` cookie
- Object IDs: 24-character MongoDB ObjectId strings
- JSON body limit: 10 KB
- List query features vary by module and may include `page`, `limit`, `search`, `sort`, `order`, `fields`, and allowlisted filters.

Response envelopes are not yet uniform. Controllers retain endpoint-specific legacy response shapes. Validation errors commonly return `error` plus `validationErrors`; shared authentication and normalized errors return `success`, `message`, and `error`.

## Swagger and generated artifacts

When the application is running:

- Swagger UI: `GET /api/docs`
- Runtime OpenAPI JSON: `GET /api/docs.json`
- Checked-in JSON: `docs/openapi.json`
- Generated Postman collections: `docs/postman/`

The generated source of truth currently declares 71 paths and 85 operations. This includes both mounted branch-admin lifecycle endpoints.

## Auth

Base path: `/api/v1/auth`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/signup` | Public, signup-limited | Register a branchless waiter account |
| POST | `/login` | Public, auth-limited | Validate credentials and set access/refresh cookies |
| GET | `/me` | Any authenticated role | Load current database user identity |
| POST | `/refresh` | Refresh cookie | Rotate refresh token and issue a new access token |
| POST | `/logout` | Public/idempotent | Revoke refresh hash when identifiable and clear cookies |

Public signup cannot create privileged roles.

## Superadmin

Base path: `/api/v1/admin`

All routes below require an authenticated, branchless `superadmin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/branches` | List branches and designated admins |
| POST | `/branches` | Create an inactive branch and branch settings |
| PUT | `/branches/:id` | Update branch details or activation state |
| DELETE | `/branches/:id` | Deactivate a branch; it is not physically deleted |
| POST | `/branches/:id/assign-staff` | Assign an ordinary existing user to the branch |
| POST | `/branches/:id/assign-admin` | Assign/replace the admin with an existing eligible user |
| POST | `/branches/:id/admin` | Create a new admin and assign/replace atomically |
| POST | `/branches/:id/remove-staff` | Remove ordinary staff from the branch |
| GET | `/branches/:id/staff` | List staff in a branch |
| GET | `/branches/unassigned-staff` | List branchless non-superadmin users |
| GET | `/branches/:id/summary` | Count today's/active KOTs and active staff |

A branch cannot be activated until `Branch.adminUser` identifies the active admin user for that branch.

### Branch-admin lifecycle contracts

Both endpoints require a valid access token and a branchless `superadmin`. The `:id` path value must be a 24-character MongoDB ObjectId.

- `POST /branches/:id/assign-admin` accepts only the used field `userId` (a required ObjectId). The candidate must exist, be active, not be a superadmin, and not belong to another branch. Success is `200` with `{ message, branch, user, previousAdmin }`; `previousAdmin` is `null` when no admin was replaced.
- `POST /branches/:id/admin` accepts `username` (required, at most 254 characters), `password` (required, 5–72 characters and subject to the strong-password validator), and optional `status` (`active` or `locked`, default `active`). Success is `201` with the same `{ message, branch, user, previousAdmin }` shape. Password and refresh-token data are never returned.

Both workflows are transactional. Replacing an admin demotes the previous admin to `manager`; token hashes are cleared where the service requires revocation. Common failures are `400` for invalid input or duplicate username, `401` for missing/invalid authentication, `403` for non-superadmin access or an ineligible superadmin candidate, `404` for a missing branch/candidate, `409` for candidate/branch-admin state conflicts, `429` for the admin API rate limit, and `500` for an unexpected transaction or persistence failure.

## Admin

These routes are grouped by function even though most share `/api/v1/admin`.

### Users

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/create-user` | admin | Create ordinary staff in the admin's branch |
| GET | `/api/v1/admin/users` | admin, manager | List branch staff with optional query controls |
| PUT | `/api/v1/admin/update-role/:userId` | admin, manager | Change an ordinary staff role |
| DELETE | `/api/v1/admin/deleteUser/:userId` | admin | Delete ordinary branch staff |

The generic staff API cannot create or manage superadmins or branch admins.

### Menu

Menu data is currently global even though these routes require branch middleware.

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/menu` | admin, manager | Create a menu item |
| GET | `/api/v1/admin/menuItems` | admin, manager, waiter, chef, cashier | List/search/filter menu items |
| PUT | `/api/v1/admin/menu-item/:ItemId` | admin, manager | Change price and/or availability |
| DELETE | `/api/v1/admin/delete/:ItemId` | admin | Delete a menu item |

### Tables

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/tables` | admin, manager | Create a branch-owned table |
| GET | `/api/v1/admin/tables` | admin, manager, waiter, cashier | List branch tables |
| GET | `/api/v1/admin/tables/:id` | admin, manager, waiter, cashier | Get a branch table |
| PUT | `/api/v1/admin/tables/:id` | admin, manager | Update capacity/status |
| DELETE | `/api/v1/admin/tables/:id` | admin | Delete a branch table |

### Customers

Customer data is currently global; branch middleware only controls which staff can reach the routes.

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/customers` | admin, manager | List/search customers |
| GET | `/api/v1/admin/customers/:customerId` | admin, manager | Get customer |
| POST | `/api/v1/admin/customers` | admin, manager | Create customer |
| PUT | `/api/v1/admin/customers/:customerId` | admin, manager | Update customer |
| DELETE | `/api/v1/admin/customers/:customerId` | admin | Delete customer |

### Inventory

Base path: `/api/v1/admin/inventory`. Roles: admin and manager.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List branch inventory with query controls and low-stock filter |
| POST | `/` | Create inventory and optional initial stock log |
| PUT | `/:id` | Update inventory metadata |
| POST | `/:id/restock` | Add stock and write a stock log |
| POST | `/:id/adjust` | Apply a signed manual adjustment |
| GET | `/:id/logs` | List branch/inventory stock logs |
| DELETE | `/:id` | Soft-deactivate inventory |

### Full settings

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/settings` | admin, manager | Read branch settings |
| PUT | `/api/v1/admin/settings` | admin | Create/update branch settings |

## Waiter

Base path: `/api/v1/waiter`

Order routes allow waiter, manager, admin, and cashier. Table allocation routes allow waiter, manager, and admin.

| Method | Path | Purpose |
|---|---|---|
| GET | `/menu` | List available global menu items |
| GET | `/orders/table/:tableId` | Read active branch-member-created orders for a table |
| POST | `/orders/table/:tableId/send-to-cashier` | Atomically create an unpaid bill and set the table to billing |
| POST | `/orders` | Create a dine-in TableOrder |
| GET | `/orders` | List branch-member-created TableOrders |
| GET | `/orders/:orderId` | Get a scoped TableOrder |
| PUT | `/orders/:orderId/send` | Atomically mark sent and create a KOT |
| PUT | `/orders/:orderId/served` | Mark the TableOrder served |
| PUT | `/orders/:orderId/cancel` | Mark the TableOrder cancelled |
| POST | `/allocate/:tableId` | Set table occupied and store customer snapshot |
| PUT | `/free/:tableId` | Set table available and clear customer snapshot |

The manual free endpoint does not check for unpaid bills. Marking a TableOrder served before `send-to-cashier` excludes it from that billing query.

## Kitchen

Base path: `/api/v1/chef`. Roles: chef, admin, and manager.

| Method | Path | Purpose |
|---|---|---|
| GET | `/kot` | List branch KOTs in pending/preparing/ready states |
| GET | `/kot/:orderId` | Get branch KOT |
| PUT | `/kot/:orderId/start` | Set KOT to preparing |
| PUT | `/kot/:orderId/ready` | Set KOT to ready |
| PUT | `/kot/:orderId/cancel` | Set KOT to cancelled |

KOT state and originating TableOrder/TakeAway state are separate records and are not synchronized in every transition.

## Cashier

Base path: `/api/v1/cashier`

### Billing

Roles: cashier, admin, and manager.

| Method | Path | Purpose |
|---|---|---|
| POST | `/billing` | Create a direct bill from menu item IDs |
| GET | `/bills` | List creator-membership-scoped bills |
| GET | `/bills/:billId` | Get scoped bill |
| PUT | `/bills/:billId/pay` | Atomically collect payment and release linked table |
| DELETE | `/bills/:billId` | Delete scoped bill |

### Takeaway

Roles: cashier, admin, and manager.

| Method | Path | Purpose |
|---|---|---|
| POST | `/takeaway-orders` | Create takeaway order |
| GET | `/takeaway-orders` | List scoped takeaway orders |
| GET | `/takeaway/:orderId` | Get takeaway order |
| PUT | `/takeaway/:orderId/send` | Atomically mark sent and create takeaway KOT |
| PUT | `/takeaway/:orderId/received` | Mark order received |
| PUT | `/takeaway/:orderId/cancel` | Mark order cancelled |

Takeaway completion does not automatically create a bill.

## Public QR

Base path: `/api/v1/public`. No authentication is required; the public rate limiter applies.

| Method | Path | Purpose |
|---|---|---|
| GET | `/menu/:tableId` | Return table, branch restaurant details, and available global menu |
| POST | `/order/:tableId` | Create a branch-owned dine-in KOT directly |
| GET | `/order/:orderId/status` | Return KOT status, items, total, and timestamp |

Branch ownership is derived from the persisted table. Order placement rejects inactive branches; menu/status reads do not currently perform the same active-branch check. Public orders do not deduct inventory or emit `order:new` in the current implementation.

## Reports

### Admin reports

Base path: `/api/v1/admin/reports`. Roles: admin and manager.

| Method | Path | Purpose |
|---|---|---|
| GET | `/summary` | Revenue, order, bill, and average-order summary |
| GET | `/top-items` | Top KOT items |
| GET | `/payments` | Paid bill totals by method |
| GET | `/hourly` | Paid bill count/revenue by hour |

Supported report ranges are `today`, `week`, `month`, and `custom` with validated optional dates.

### Cashier report

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/cashier/income` | cashier | Today's paid income created by the current cashier |

## AI

Base path: `/api/v1/ai`. Roles: admin and manager assigned to an active branch. The frontend calls these internal KOT POS endpoints; only the backend AI service calls Google Gemini through `@google/genai` with `GEMINI_API_KEY`.

The service attempts `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-preview`, and `gemini-3-flash-preview` in that order. A `429` from one model waits three seconds before trying the next configured model name; non-`429` provider errors stop the model loop.

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat` | Send a 1–2000 character question and optional context; returns `{ reply }` |
| GET | `/inventory-alerts` | Return locally calculated `{ alerts, counts }` for branch inventory |
| GET | `/daily-summary` | Return `{ data, aiSummary }` for yesterday's branch operations |

The chat service allowlists known dashboard fields from client-supplied `context` and limits `topItems` to five before building the Gemini prompt. It returns `503` when `GEMINI_API_KEY` was not configured. Once a provider call starts, quota errors and other provider failures are converted into safe plain-text replies rather than exposing provider details.

Inventory alerts do not call Gemini: the service calculates alert levels from branch-scoped inventory and recent deduction logs. Its current stock-log/threshold field assumptions do not fully match the persistence schema, so the forecast is not authoritative.

Daily summary queries branch-scoped KOT, billing-member, and inventory data. Both the structured result and Gemini-generated text use 600-second cache entries. If Gemini is unavailable, unconfigured, or fails, the endpoint returns deterministic local summary text. Default AI rate limiting is 30 requests per 60 seconds, subject to global `RATE_LIMIT_WINDOW[_MS]` and `RATE_LIMIT_MAX` overrides; `429` includes `Retry-After`. Authentication/branch failures return `401`/`403`, validation returns `400`, and unexpected service failures return `500`. Gemini keys are never accepted in requests or returned in responses.

```text
Frontend -> KOT POS backend AI route -> AI service -> Google Gemini API -> KOT POS JSON response
```

## Settings

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/settings` | admin, manager, cashier | Read the receipt-safe subset of branch settings |

Full settings management is documented under Admin.

## Health and version

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/version` | Current/supported API version metadata |
| GET | `/health` | Process liveness and lifecycle state |
| GET | `/ready` | MongoDB, Socket.IO, startup, and lifecycle readiness |

## Rate-limit mapping

- Auth routes: strict auth limiter; signup also has a stricter signup limiter.
- Admin/waiter/cashier/chef routes: general API limiter.
- Report paths: report limiter where mounted before general admin routing.
- Waiter order and cashier billing paths: order limiter plus broader API limiter.
- Public and AI routes: dedicated limiters.

Rate-limit store failures are fail-open. See [Redis and BullMQ](REDIS-BULLMQ.md).
