# KOT POS Backend

KOT POS Backend is a multi-branch restaurant operations API built with Node.js, Express, MongoDB, Redis, BullMQ, and Socket.IO. It coordinates dine-in and takeaway ordering, kitchen tickets, billing, tables, inventory, branch staff, reports, settings, public QR orders, and real-time updates from one backend.

The implementation is designed around a branchless global superadmin, one designated admin per branch, branch-scoped operational staff, repository-backed persistence, and MongoDB transactions for critical multi-document workflows.

> Documentation status: this README and the linked documents describe the current implementation. Known gaps are stated explicitly; planned behavior is not presented as implemented.

## Problem solved

Restaurant operations often split orders, kitchen state, payments, tables, and inventory across disconnected tools. KOT POS provides a single API that:

- Converts waiter, cashier, and public QR orders into kitchen workflows.
- Keeps operational access aligned with staff roles and branch assignment.
- Moves dine-in tables from service to billing and release.
- Records stock movements and changes menu availability when linked stock reaches zero.
- Pushes branch-local operational updates to connected clients.
- Supports centralized branch administration without giving the superadmin implicit operational access.

## Capabilities

- JWT authentication with access and rotating refresh tokens.
- HTTP-only cookie and Bearer-token support.
- Six roles: `superadmin`, `admin`, `manager`, `waiter`, `chef`, and `cashier`.
- Superadmin branch and branch-admin lifecycle management.
- Dine-in, takeaway, kitchen, billing, table, customer, inventory, report, settings, public QR, and AI APIs.
- MongoDB transactions for payments, order-to-KOT transitions, inventory stock changes, and branch-admin replacement.
- Optional Redis caching and Redis-backed rate limiting.
- Optional BullMQ queues and workers.
- Authenticated Socket.IO rooms segmented by branch and role.
- Append-only MongoDB audit events for selected security, financial, and operational workflows.
- OpenAPI/Swagger UI, generated Postman artifacts, health checks, startup validation, and graceful shutdown.
- A deterministic three-branch demo seed.

## Architecture

The dominant request path is:

```text
Route -> middleware -> controller -> service -> repository -> Mongoose -> MongoDB
```

Middleware handles authentication, role authorization, branch context, active-branch enforcement, validation, sanitization, logging, and rate limiting. Services own business rules, transaction boundaries, audit writes, cache invalidation, and real-time notifications.

Redis is optional for caching and rate limiting. BullMQ is optional and enabled separately. Socket.IO shares the HTTP server and sends events to branch-and-role rooms.

See [Architecture](docs/ARCHITECTURE.md) for the component diagram and request lifecycle.

## Tech stack

- Node.js and CommonJS
- Express 5
- MongoDB and Mongoose
- JWT and bcrypt
- Joi
- Redis (`redis`) and BullMQ (`ioredis`)
- Socket.IO
- Helmet, CORS, and `express-rate-limit`
- Winston with daily rotating logs
- OpenAPI 3.0 and Swagger UI
- Jest and Supertest
- Google Gemini through `@google/genai`

## Role hierarchy

```text
Superadmin
  -> Branch
      -> Branch Admin
          -> Manager / Waiter / Chef / Cashier
```

- The `superadmin` must remain branchless and manages the global branch lifecycle.
- Every active branch must have one designated `admin` through `Branch.adminUser`.
- Branch staff authority is derived from the current database user and assigned branch.
- Superadmin is not included in operational role allowlists.

See [Authentication and RBAC](docs/AUTH-RBAC.md) for the permission matrix.

## Main restaurant workflow

```text
Table allocation
  -> waiter order
  -> send to kitchen
  -> KOT pending/preparing/ready
  -> send table orders to cashier
  -> unpaid bill + table billing state
  -> payment
  -> table available
```

Takeaway orders use a separate cashier workflow and can also generate KOTs. Public QR orders create branch-scoped KOTs directly.

The code does not yet enforce every table/order state transition as a formal state machine. See [Transactions](docs/TRANSACTIONS.md) for atomic boundaries and current workflow caveats.

## Branch isolation

`branchScope` loads branch context from the authenticated user, not from client-controlled input. Non-superadmin requests are rejected when the assigned branch is missing or inactive.

Direct `branchId` isolation currently applies to branches, tables, inventory, stock logs, KOTs, and settings. Billing, waiter orders, and takeaway orders are scoped indirectly through their creator's current branch membership. Menu and customer collections are currently global. These distinctions are documented in [Database](docs/DATABASE.md).

## API overview

The versioned API is mounted under `/api/v1`:

| Area                 | Base path                 |
| -------------------- | ------------------------- |
| Authentication       | `/api/v1/auth`            |
| Public QR            | `/api/v1/public`          |
| Admin and superadmin | `/api/v1/admin`           |
| Inventory            | `/api/v1/admin/inventory` |
| Waiter               | `/api/v1/waiter`          |
| Kitchen              | `/api/v1/chef`            |
| Cashier              | `/api/v1/cashier`         |
| Receipt settings     | `/api/v1/settings`        |
| AI                   | `/api/v1/ai`              |

Supporting endpoints are `/api/version`, `/health`, `/ready`, `/api/docs`, and `/api/docs.json`.

See [API reference](docs/API.md). The generated OpenAPI and Postman artifacts are synchronized with the documented mounted routes.

## AI integration

- Provider: Google Gemini, called server-side through `@google/genai`.
- Backend credential: `GEMINI_API_KEY`; it is optional at startup and never returned to the browser.
- Models, tried in order: `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-preview`, then `gemini-3-flash-preview`.
- REST abstraction: the frontend calls `/api/v1/ai/*`; it does not call Gemini directly.
- Access: authenticated `admin` and `manager` users assigned to an active branch.
- Protection: the AI router has a default limit of 30 requests per 60 seconds. Global rate-limit environment overrides also apply to it.
- Features: Gemini-backed assistant chat, locally calculated inventory alerts, and a cached daily business summary whose narrative uses Gemini when available.
- Resilience: chat returns safe quota/connection text after provider-call failures; daily summaries use deterministic local text when Gemini is missing or fails. Chat itself returns `503` when no key was configured.

The server allowlists known dashboard context fields before sending a chat prompt to Gemini. Daily-summary data and generated summary text are cached for 600 seconds through the optional cache layer. No fine-tuning, vector database, RAG, embeddings, agents, or function calling is implemented.

```text
React client -> KOT POS AI API -> AI service -> Google Gemini API -> structured KOT POS response
```

## Real-time updates

Socket.IO authenticates the current user and joins a server-derived room:

```text
branch:<branchId>:role:<role>
```

Events cover new KOTs, KOT updates, table changes, and billing changes. Events remain branch-local. See [Real-time API](docs/REALTIME.md).

## Redis and BullMQ

- Redis cache failures are non-fatal and requests bypass the cache.
- The Redis-backed rate limiter is deliberately fail-open when its store is unavailable.
- BullMQ starts only when `ENABLE_BACKGROUND_JOBS=true` and a Redis URL is configured.
- Scheduled jobs currently include a daily sales report and queue cleanup.

See [Redis and BullMQ](docs/REDIS-BULLMQ.md).

## Transactions

Critical workflows use MongoDB sessions with snapshot reads, majority writes, and transient-error retries. This requires a MongoDB replica set or sharded cluster.

Transactional workflows include branch-admin replacement, inventory create/restock/adjust, order-to-KOT transitions, table-to-bill creation, payment/table release, and demo seeding.

See [Transactions](docs/TRANSACTIONS.md).

## Testing

The repository contains 56 Jest files covering routes, RBAC, security, Socket.IO authentication, query infrastructure, models/indexes, transactions, audit behavior, cache, queues, health, graceful shutdown, and seed fixtures.

```powershell
npm run test:backend
npm run test:backend:watch
npm run test:backend:coverage
npm run test:backend:ci
```

See [Testing](docs/TESTING.md).

## Demo seed

The deterministic development seed creates one superadmin, three branches, one admin per branch, branch staff, 36 tables, 80 menu items, 45 inventory records, 120 customers, and expanded order, billing, KOT, and stock history.

```powershell
npm run seed
npm run seed -- --clean
npm run seed -- --customers-only
```

All seed modes require `NODE_ENV=development` and a database named exactly `Kot-Pos`. See [Seeding](docs/SEEDING.md) before running destructive modes.

## Local setup

### Prerequisites

- Node.js and npm
- MongoDB replica set or MongoDB Atlas deployment for transaction-backed workflows
- Redis only when caching, shared rate limiting, or background jobs are required

### Install and run

```text
git clone https://github.com/Pandikumarcodes/Kot-Pos-Backend
cd kot-pos-backend
npm ci
# Copy .env.example to .env, then replace placeholders.
npm run dev
```

Use your operating system's normal copy command or file manager to copy `.env.example` to `.env`. Do not commit `.env`.

## Environment variables

Required at startup:

```text
MONGO_URI
JWT_SECRET
REFRESH_TOKEN_SECRET
PORT
NODE_ENV
```

Optional or feature-specific:

```text
BACKEND_URL
CACHE_TTL
DAILY_REPORT_RECIPIENTS
DOCS_PASSWORD
DOCS_USERNAME
E2E_TESTING
EMAIL_WEBHOOK_URL
ENABLE_BACKGROUND_JOBS
FRONTEND_URL
GEMINI_API_KEY
LOG_LEVEL
MONGO_TIMEOUT
MONGO_TIMEOUT_MS
QUEUE_COMPLETED_RETENTION_SECONDS
QUEUE_CONCURRENCY
QUEUE_RETRY_ATTEMPTS
QUEUE_RETRY_DELAY_MS
RATE_LIMIT_MAX
RATE_LIMIT_WINDOW
RATE_LIMIT_WINDOW_MS
REDIS_CONNECT_TIMEOUT_MS
REDIS_OPERATION_TIMEOUT_MS
REDIS_TIMEOUT
REDIS_URL
SEED_ADMIN_PASSWORD
SHUTDOWN_TIMEOUT_MS
SLOW_REQUEST_MS
```

`SLOW_REQUEST_MS` is accepted by startup validation but is not otherwise used. `CSRF_SECRET` is not included in `.env.example` because it appears only in inactive commented configuration.

See [Deployment](docs/DEPLOYMENT.md) for configuration behavior without exposing values.

## Run commands

```powershell
npm start
npm run dev
npm run seed
npm run docs:generate
npm run test:backend
```

There are currently no lint, format, build, migration, or dedicated worker scripts.

## API documentation

When the server is running:

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs.json`
- Version metadata: `/api/version`

Generated artifacts are stored in `docs/openapi.json` and `docs/postman/`. See [API reference](docs/API.md) for the known generation drift.

## Deployment

The repository currently deploys as a direct Node.js process with `npm start`. It includes startup validation, health/readiness endpoints, required-index reconciliation, structured rotating logs, and graceful shutdown.

It does **not** currently contain Docker, Compose, Kubernetes, Render, Railway, Fly, Vercel, Procfile, process-manager, or CI/CD configuration. See [Deployment](docs/DEPLOYMENT.md).

## Demo credentials

Use deployment-specific or seed-generated credentials. The workspace-level [Demo Guide](../docs/DEMO-GUIDE.md) lists the deterministic seeded usernames and the recommended walkthrough. Do not commit the effective seed password or real credentials.

```text
Superadmin username: superadmin
Branch admin username: admin.indiranagar
Manager username: manager.indiranagar.1
Waiter username: waiter.indiranagar.1
Chef username: chef.indiranagar.1
Cashier username: cashier.indiranagar.1
Password: SuperAdmin@123
```

## Frontend repository

Frontend: `https://github.com/Pandikumarcodes/Kot-pos-frontend

## Documentation index

- [Project system design](../docs/SYSTEM-DESIGN.md)
- [Project data flows](../docs/DATA-FLOW.md)
- [Project roles and permissions](../docs/ROLE-PERMISSIONS.md)
- [Recruiter demo guide](../docs/DEMO-GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Authentication and RBAC](docs/AUTH-RBAC.md)
- [Database](docs/DATABASE.md)
- [Transactions](docs/TRANSACTIONS.md)
- [Redis and BullMQ](docs/REDIS-BULLMQ.md)
- [Real-time](docs/REALTIME.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Seeding](docs/SEEDING.md)
- [Deployment](docs/DEPLOYMENT.md)
