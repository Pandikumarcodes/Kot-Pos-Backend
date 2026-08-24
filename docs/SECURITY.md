# Security Model

This document records implemented controls and known limitations. It is not a security certification.

## Authentication

HTTP authentication uses HS256 access JWTs with a 15-minute expiry and current-user database loading. Tokens are accepted from an HTTP-only cookie or Bearer header. Refresh JWTs use a separate secret, seven-day expiry, server-side token hashing, timing-safe comparison, and rotation.

Passwords are validated for strength, capped at 72 UTF-8 bytes, hashed with bcrypt cost 12, excluded from ordinary queries, and removed during serialization. Login uses a dummy bcrypt comparison for nonexistent users.

See [Authentication and RBAC](AUTH-RBAC.md) for detailed token and logout behavior.

## RBAC

Routes use explicit role allowlists. There is no automatic inheritance:

- Superadmin manages branches and is excluded from operational APIs.
- Admin has the broadest branch-operational authority.
- Manager has most operational authority with staff/settings/destructive restrictions.
- Waiter, chef, and cashier receive workflow-specific access.

Services add protections that routes alone do not express, particularly around superadmin and branch-admin mutation.

## Branch isolation

`branchScope`:

- Requires an authenticated current user.
- Rejects a branch-assigned superadmin.
- Uses the current User's branch for non-superadmins.
- Validates optional superadmin branch selectors as ObjectIds.
- Adds direct branch filters and helper functions to the request.
- Loads and verifies the assigned branch is active.

`branchMemberScope` builds a `createdBy: {$in: memberIds}` filter from current users assigned to the branch.

Known ownership gaps:

- MenuItem and Customer are global.
- Billing, TableOrder, and TakeAway use creator membership instead of persisted branch ownership.
- Reassigning staff can alter historical visibility.

## Inactive branch enforcement

Inactive branches are rejected by branch-scoped HTTP middleware and authenticated Socket.IO connections. Public order placement also performs an active-branch check.

Public QR menu retrieval and public order-status retrieval do not currently apply that check. `/auth/me` is also available to an active account even when its branch is inactive.

## Helmet and CSP

Helmet is the first Express middleware. CSP allows self-hosted scripts/styles/fonts, inline styles, data/HTTPS images, configured connection destinations, and local WebSocket endpoints. Object and frame sources are disabled. Cross-origin embedder policy is disabled.

The current production WebSocket CSP construction prefixes `BACKEND_URL` with `wss://`; if the configured value already includes `https://`, that entry is malformed.

## CORS

CORS uses an exact allowlist:

- `http://localhost:5173`
- `http://localhost:3000`
- comma-separated configured frontend origins
- requests without an Origin header

Credentials are enabled and wildcard origins are not used. Localhost origins remain allowed in production.

## Cookies and CSRF

Both authentication cookies are HTTP-only. Production uses `secure: true` and `SameSite=None` for cross-site frontend deployments.

The repository contains a CSRF configuration file, but all implementation lines are commented out and no CSRF middleware is mounted. CORS helps control browser origins but is not a complete CSRF defense for cross-site cookies. State-changing cookie-authenticated endpoints should be treated as lacking dedicated CSRF protection.

## Rate limiting

Rate limiters protect authentication, signup, normal API traffic, reports, orders/billing, public traffic, and AI traffic. Counters are shared through Redis.

The store is intentionally fail-open. Redis absence, timeout, or errors allow requests, and there is no in-memory fallback. Tests/E2E mode bypasses limiters entirely.

See [Redis and BullMQ](REDIS-BULLMQ.md).

## Input validation

Joi validates route parameters, query strings, and request bodies for the mounted feature APIs. Controls include:

- ObjectId patterns.
- Enum and numeric range checks.
- Array/item requirements.
- Search and pagination limits.
- Password byte bounds.
- Phone format on takeaway orders.

Validation converts compatible input types. Default validation allows unknown fields unless an individual validator disables it. Services generally destructure only known fields, but a strict allowlist is not universal.

## NoSQL sanitization

The global sanitizer recursively rewrites body and route-parameter keys that begin with `$` or contain `.`, and rewrites `$` in string values.

It intentionally does not modify `req.query` because Express 5 exposes it through a read-only getter. Query safety depends on Joi schemas and QueryBuilder allowlists. New query endpoints must not forward raw query objects into MongoDB.

## Request and error logging

Winston writes console output and daily rotating combined/error files. Request logs include method, URL, status, response time, IP, user agent, and authenticated identity when available.

The global error handler redacts sensitive keys and normalizes Mongoose, JWT, duplicate-key, cast, and operational errors. Most routers install a local handler first, however, so some service messages and 500 errors bypass global normalization.

## Audit logging

`AuditEvent` is an append-only, strict MongoDB model with:

- Policy-registered actions.
- Actor, branch, entity, outcome, correlation, and transaction identity.
- Allowlisted before/after change paths.
- Password/token/authorization/cookie/key/card redaction.
- Payload depth, array, string, key, and total byte limits.
- Retention-class TTL expiry.
- Mutation-blocking model middleware.

Integrated coverage includes login/logout, branch lifecycle and admin replacement, staff create/role/delete, settings update, critical order/KOT workflows, table-to-bill/payment, and inventory create/restock/adjust.

Audit coverage is not complete. Menu, Customer, Table, direct bill, ordinary order status, automatic deduction, ordinary branch assignment, signup, and refresh operations are not consistently recorded. No audit search/export API is mounted.

## Additional controls

- JSON and URL-encoded bodies are capped at 10 KB.
- Access algorithms are restricted to HS256 in HTTP middleware.
- Refresh algorithms are restricted to HS256.
- Required startup secrets must be at least 16 characters.
- Required uniqueness/ownership indexes are reconciled before readiness.
- Graceful shutdown stops accepting traffic before resource cleanup.

## Known security limitations

1. Dedicated CSRF protection is inactive while production cookies can be cross-site.
2. Rate limiting disappears during Redis failure.
3. Router-local errors can expose internal messages.
4. Socket JWT verification lacks the HTTP algorithm/token-type checks.
5. Public order status is authorized only by possession of an ObjectId.
6. Global Menu/Customer data breaks strict tenant isolation.
7. Creator-membership scope is mutable historical ownership.
8. Localhost CORS origins remain enabled in production.
9. Access tokens cannot be revoked before expiry.
10. Socket.IO lacks cross-instance event transport.
11. Documentation Basic auth is enabled in production only when both credential variables are supplied; otherwise docs remain public.

## Secrets handling

Never commit `.env`, JWT secrets, MongoDB/Redis URLs, email webhook credentials, Gemini keys, documentation credentials, seed passwords, real demo passwords, or generated authentication tokens. The repository ignores `.env`, logs, coverage, and dependencies, but deployment secret storage remains the operator's responsibility.
