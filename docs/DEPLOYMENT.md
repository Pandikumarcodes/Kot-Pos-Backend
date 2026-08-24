# Deployment Guide

This document describes the deployment behavior present in the repository. Platform-specific manifests are not currently included.

## Current process model

Production starts one Node.js process:

```powershell
npm ci
npm start
```

`npm start` executes `node src/app.js`. Express, Socket.IO, optional BullMQ workers, and scheduled jobs run in the same process.

There is no separate build step.

## Prerequisites

- Node.js and npm. The repository does not currently declare an `engines` version, so pin and test a runtime version in the deployment platform.
- MongoDB replica set or sharded MongoDB cluster for transaction-backed workflows.
- Network access from the application to MongoDB.
- Redis when shared caching, effective rate limiting, or BullMQ is required.
- HTTPS termination for production cookie security.
- Persistent or externally collected log storage if rotating files must survive restarts.

## Required environment names

Copy the checked-in `.env.example` to `.env` for local development, then replace every secret placeholder. Production deployments should configure the same names through the platform's environment or secret manager.

```text
MONGO_URI
JWT_SECRET
REFRESH_TOKEN_SECRET
PORT
NODE_ENV
```

Startup requires both secrets to be at least 16 characters, a valid MongoDB URI, a valid port, and an environment of development/test/staging/production.

## Optional environment names

### HTTP and lifecycle

```text
BACKEND_URL
FRONTEND_URL
LOG_LEVEL
MONGO_TIMEOUT
MONGO_TIMEOUT_MS
SHUTDOWN_TIMEOUT_MS
```

### Redis and rate limiting

```text
CACHE_TTL
RATE_LIMIT_MAX
RATE_LIMIT_WINDOW
RATE_LIMIT_WINDOW_MS
REDIS_CONNECT_TIMEOUT_MS
REDIS_OPERATION_TIMEOUT_MS
REDIS_TIMEOUT
REDIS_URL
```

### BullMQ/email

```text
DAILY_REPORT_RECIPIENTS
EMAIL_WEBHOOK_URL
ENABLE_BACKGROUND_JOBS
QUEUE_COMPLETED_RETENTION_SECONDS
QUEUE_CONCURRENCY
QUEUE_RETRY_ATTEMPTS
QUEUE_RETRY_DELAY_MS
```

### Integrations and documentation

```text
DOCS_PASSWORD
DOCS_USERNAME
GEMINI_API_KEY
```

### Development/test

```text
E2E_TESTING
SEED_ADMIN_PASSWORD
```

`SLOW_REQUEST_MS` is also accepted by startup validation but is not used by runtime request logging. `CSRF_SECRET` is only referenced by commented-out code and is therefore not a current configuration variable.

`GEMINI_API_KEY` is optional for application startup. When present, the backend initializes Google Gemini through `@google/genai`; the key must remain server-side. Without it, chat returns `503`, while the daily-summary endpoint uses its local fallback narrative. Inventory alerts remain available because their calculation is local.

Store values in the platform's secret manager. Do not commit `.env`.

## Startup sequence

The process:

1. Loads `.env` from the repository root.
2. Creates Express, HTTP, and Socket.IO servers.
3. Validates environment configuration.
4. Connects MongoDB.
5. Reconciles mandatory indexes and attempts optional indexes.
6. Attempts the optional Redis cache connection.
7. Starts BullMQ only when explicitly enabled.
8. Starts listening and marks lifecycle ready.

Failure establishing required MongoDB/index state terminates startup. Redis cache connection failure logs a warning and permits startup. Configured BullMQ scheduler failure can terminate startup because it is awaited.

## Health checks

Use:

- `GET /health` for liveness.
- `GET /ready` for readiness.

Readiness requires healthy MongoDB, Socket.IO/startup checks, and lifecycle state `ready`. Configure the orchestrator/load balancer to remove instances that fail `/ready` and restart instances that fail `/health` persistently.

`/api/version` reports API version metadata but is not a health endpoint.

## Graceful shutdown

SIGTERM and SIGINT trigger:

1. Lifecycle transition to draining.
2. Stop accepting HTTP connections.
3. Run registered shutdown handlers, including Redis/background jobs.
4. Close Socket.IO.
5. Disconnect MongoDB.
6. Exit success or failure after the configured timeout.

The deployment platform must allow enough termination grace time for `SHUTDOWN_TIMEOUT_MS` plus platform overhead.

## CORS and cookies

- Set `FRONTEND_URL` to exact allowed frontend origin(s), comma-separated when needed.
- Production cookies use `Secure` and `SameSite=None`, so the frontend must use HTTPS and credentials.
- The backend always also allows two localhost origins; this is a current implementation limitation.
- Dedicated CSRF middleware is not active. Review [Security](SECURITY.md) before deploying cross-site cookie authentication.

## Proxy and networking

Express uses `trust proxy = 1`. Deploy behind exactly one trusted proxy hop or review this setting, because client IP and rate-limit identity can be affected by proxy headers.

The application replaces Node's DNS servers with public Google and Cloudflare resolvers at process startup. This was added for Windows MongoDB Atlas SRV resolution and may conflict with private DNS/service discovery. Validate it in the target network.

## Redis behavior

Without Redis:

- The server still starts.
- Cache is bypassed.
- Rate limiting fails open and provides no traffic protection.
- BullMQ is unavailable.

For production brute-force and traffic controls, Redis should be treated as operationally required even though application startup treats caching as optional.

## BullMQ deployment

Workers run in the web process when enabled. Consequences:

- Every application replica starts its own workers.
- Repeatable-job scheduler upserts reduce duplicate schedule definitions, but worker capacity scales with replicas.
- Web and job workloads compete for CPU/memory.
- A configured Redis outage may affect web startup.

There is no dedicated worker script or process entry point. Do not claim independent worker deployment until one is added.

## Socket.IO scaling

There is no Socket.IO Redis adapter. Multiple backend replicas do not share room membership or events. A single replica is the only configuration with complete current event delivery.

If horizontally scaling HTTP traffic, realtime correctness requires application changes or accepting that cross-instance events will be missed.

## Logging

Winston writes:

- Console logs.
- Daily combined logs retained for 14 days.
- Daily error logs retained for 30 days.
- Compressed archived rotations.

File logs live under `logs/`, which is gitignored. Ephemeral hosting can discard them; ship console logs or mount persistent storage as appropriate.

## Swagger exposure

- `/api/docs`
- `/api/docs.json`

In production these endpoints require Basic auth only when both documentation credential variables exist. If either is absent, Swagger remains public. Configure both or restrict these paths at the proxy.

## Production checklist

- Pin a tested Node version externally until `engines` is added.
- Use a replica-set/sharded MongoDB deployment.
- Use strong independent JWT and refresh secrets.
- Configure exact frontend/backend URLs and HTTPS.
- Provision Redis if rate limiting or jobs matter.
- Decide whether background workers should run in the web process.
- Configure email webhook and recipients only when required.
- Protect Swagger.
- Configure `/health` and `/ready` probes.
- Allow graceful termination time.
- Centralize or persist logs.
- Run tests and inspect required index creation against a staging copy.
- Resolve OpenAPI generation drift before publishing API artifacts.
- Review CSRF, global data ownership, manual table release, and Socket.IO scaling limitations.

## Absent deployment artifacts

The repository currently contains none of the following:

- Dockerfile or Docker Compose.
- Kubernetes manifests or Helm chart.
- Procfile.
- Render, Railway, Fly, or Vercel deployment configuration.
- PM2 or other process-manager configuration.
- CI/CD workflows.
- Infrastructure-as-code.
- Standalone BullMQ worker entry point.

Platform deployment must supply those concerns externally.

## Production keep-alive

When production mode and `BACKEND_URL` are set, the process sends a request to `<BACKEND_URL>/health` every 14 minutes. This is an application-level keep-alive workaround, not a replacement for platform health checks or an availability guarantee.
