# Redis, Rate Limiting, and BullMQ

Redis supports three separate concerns in this repository. Their failure behavior and client libraries are different and should not be conflated.

## 1. Application caching

Client library: `redis`.

Redis caching is optional. When `REDIS_URL` is missing, cache calls bypass Redis. When connection or individual operations fail, the service logs a warning and falls back to the database or uncached computation.

### Cached values

| Data | Key family | Typical TTL |
|---|---|---:|
| Menu query result | `kot-pos:v1:menu:<scope>:<encoded-query>` | 300 seconds |
| Available menu | `kot-pos:v1:menu-available:<scope>` | 120 seconds |
| Settings | `kot-pos:v1:settings:<scope>` | 600 seconds |
| AI daily summary | `kot-pos:v1:ai:daily-summary:<scope>:<date>` | 600 seconds |
| AI daily summary text | `kot-pos:v1:ai:daily-summary-text:<scope>:<date>` | 600 seconds |

The default cache TTL is configurable and otherwise 300 seconds.

### Cache behavior

- Reads return `undefined` on miss, bypass, invalid JSON, timeout, or Redis error.
- `getOrSet` loads authoritative data when no valid cached value exists.
- Writes/deletes return failure indicators rather than failing HTTP requests.
- Pattern invalidation uses `SCAN` with batches rather than blocking `KEYS`.
- In-process metrics count hits, misses, sets, deletes, errors, bypasses, and hit rate.

Menu mutations invalidate all menu and available-menu patterns. Settings updates invalidate their branch key or all settings keys for a global change.

### Isolation caveat

Menu cache keys contain a branch scope, but MenuItem records are global and repository menu queries do not filter by branch. The key prevents cross-key reuse; it does not create branch-owned menus.

## 2. Redis-backed rate limiting

Client library: the same `redis` connection used by caching.

The custom store implements increment, TTL, decrement with a Lua floor, and key reset for `express-rate-limit`.

### Default policies

| Limiter | Window | Maximum requests |
|---|---:|---:|
| Authentication | 15 minutes | 20 |
| Signup | 1 hour | 5 |
| General API | 1 minute | 200 |
| Reports | 1 minute | 80 |
| Order/billing | 1 minute | 60 |
| Public | 1 minute | 120 |
| AI | 1 minute | 30 |

Standard rate-limit headers are enabled and legacy headers are disabled. Most handlers include `Retry-After` in 429 responses.

`RATE_LIMIT_WINDOW`/`RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` override defaults globally, so setting one maximum affects every limiter created from the shared configuration.

### Fail-open behavior

Rate limiting is deliberately fail-open:

- `passOnStoreError` is true.
- Missing Redis, disconnected Redis, timeout, or store errors allow the request.
- There is no in-memory fallback.
- Test mode and explicit E2E mode replace limiters with no-op middleware.

This protects API availability during an optional Redis outage but removes brute-force and traffic controls for the duration of the outage.

## 3. BullMQ background processing

Client library: `ioredis`, using a separate shared connection because BullMQ requires `maxRetriesPerRequest: null`.

Background jobs start only when:

- `ENABLE_BACKGROUND_JOBS` is exactly `true`.
- `REDIS_URL` is configured.

The application creates queues, workers, and repeatable schedulers inside the main server process. There is no standalone worker entry point.

### Queues

| Queue | Job names |
|---|---|
| `kot-pos.email` | `password-reset-email`, `staff-invitation-email` |
| `kot-pos.inventory-alerts` | `low-inventory-alert` |
| `kot-pos.reports` | `daily-sales-report` |
| `kot-pos.cleanup` | `cleanup` |

### Workers

- Email worker sends password-reset and staff-invitation templates.
- Inventory worker sends low-inventory alert templates.
- Report worker loads a sales summary, optionally renders an attachment, and sends email.
- Cleanup worker removes completed and failed jobs from all queues after the supplied grace period.

All email delivery uses `EMAIL_WEBHOOK_URL`; no SMTP provider is implemented.

### Scheduling

- Daily sales report: cron pattern `0 21 * * *`.
- Cleanup: every 86,400,000 milliseconds.

The daily report receives configured recipients. Its automatically scheduled data does not include explicit branch filters, so its default report query is global across the records visible to the report implementation.

### Retry and retention

Defaults:

- Five attempts.
- Exponential backoff from 1000 milliseconds.
- Completed jobs retained for 86,400 seconds, capped at 1000 records.
- Failed jobs are not automatically removed by job options; the cleanup job can remove them.
- Worker concurrency is configurable and otherwise uses per-worker fallback values.

### Current producer coverage

`backgroundJobService` exposes enqueue methods for all job types, but no current feature service calls that facade. Consequently:

- Password reset, staff invitation, and low-stock email jobs are infrastructure only.
- Daily report and cleanup are the only jobs automatically scheduled at startup.

### Failure behavior

When no Redis URL exists, background startup returns without creating queues. When a URL is configured but Redis is unreachable, awaited BullMQ scheduler operations can fail server startup. This differs from fail-open cache startup.

## Configuration names

```text
CACHE_TTL
DAILY_REPORT_RECIPIENTS
EMAIL_WEBHOOK_URL
ENABLE_BACKGROUND_JOBS
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
```

Do not share values in documentation or commit them to source control.
