# Production hardening notes

## Socket.IO deployment model

Socket.IO currently runs as a single-node component. Authentication derives one branch/role room from the database user and disconnect cleanup removes application metadata; Socket.IO itself removes room membership. Reconnection performs the normal handshake authentication again.

If the application is later deployed behind multiple active Node.js instances, add the official Redis Socket.IO adapter as a separate rollout. It is intentionally not enabled now because it adds operational coupling without a benefit for the current single-node architecture.

## Optional environment settings

Existing defaults remain in effect when these are absent:

`CACHE_TTL`, `QUEUE_CONCURRENCY`, `QUEUE_RETRY_ATTEMPTS`, `RATE_LIMIT_WINDOW` (milliseconds), `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `SLOW_REQUEST_MS`, `REDIS_TIMEOUT`, `REDIS_OPERATION_TIMEOUT_MS`, `MONGO_TIMEOUT`, and `MONGO_TIMEOUT_MS`.

`REDIS_URL` enables shared Redis rate-limit counters and the existing cache/queue integrations. Redis rate limiting fails open during a Redis outage so optional infrastructure does not turn requests into application errors.
