# KOT POS API documentation

## Executive summary

The backend exposes the current API under `/api/v1`. This sprint adds a generated OpenAPI 3.0.3 contract, Swagger UI, and importable Postman collections. Existing controllers, repositories, middleware behavior, response payloads, routes, authentication, authorization, and validation remain unchanged.

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs.json` and `docs/openapi.json`
- Current version: `v1`, also reported by `/api/version`
- Coverage: 68 route paths and 82 operations discovered from the mounted routers

The `Categories` documentation tag is intentionally empty: the current implementation has category filters on menu and inventory endpoints but no standalone category route.

## Application overview and architecture

Express is the HTTP boundary. Routes delegate to controllers, controllers delegate to services, and services use repositories/models. Joi validators run at route boundaries. MongoDB/Mongoose provides persistence and transaction support; Redis provides cache and shared infrastructure; BullMQ handles optional background work; Winston provides structured logging; Socket.IO handles realtime events. Health and readiness are mounted independently at `/health` and `/ready`.

## Authentication flow

1. Call `POST /api/v1/auth/login` with `username` and `password`.
2. The implementation sets access and refresh cookies. For API clients, copy the access JWT into Swagger's **Authorize** dialog or the Postman `accessToken` environment variable.
3. Send `Authorization: Bearer <access-token>` to protected endpoints. The backend also accepts its existing auth cookie.
4. Call `POST /api/v1/auth/refresh` when the refresh cookie is available.
5. Call `POST /api/v1/auth/logout` to clear authentication cookies.

The JWT verifier accepts the `HS256` algorithm and checks token type/user state. The OpenAPI role annotations are documentation metadata derived from the route middleware; enforcement remains in the existing middleware.

## Branch isolation

Branch-scoped routes use the authenticated user's branch context and branch-member filters. Super-admin branch administration routes operate across branches. Where accepted by the current middleware, `branchId` may be supplied as a query selector; it is not a license to bypass authorization. Frontend and QA clients should treat branch context as server-controlled.

## Error handling

The implementation returns legacy endpoint-specific payloads. Shared error helpers use `{ success: false, message, error }`; request validation returns `{ error, validationErrors }`; the global handler may include `stack` outside production. The OpenAPI `ErrorResponse` schema intentionally allows additional properties to preserve this compatibility.

Common statuses are documented as follows: `400` invalid input/business request, `401` missing or invalid credentials, `403` insufficient role/branch access, `404` missing resource/route, `409` conflict, `422` semantic validation where emitted, `429` rate limit, and `500` unexpected server error. Successful creation is generally `201`; ordinary reads and workflow changes are generally `200`. The current controllers do not emit `204`.

## Rate limiting

Rate limits are applied by existing middleware to authentication, admin, waiter, cashier, chef, public, order, report, and AI route groups. A `429` response means the client should back off and retry according to the deployment's configured window. The documentation does not promise a fixed quota because limits are environment-configurable.

## Caching and background jobs

Redis-backed caching is used by existing services and infrastructure. Cache behavior is an implementation detail: clients must rely on API responses, not cache timing. BullMQ jobs are optional at startup and are controlled by existing deployment configuration; asynchronous work may complete after the initiating HTTP response.

## Health endpoints

- `GET /health` is the liveness check.
- `GET /ready` is the readiness check and may return `503` while dependencies are unavailable.
- `GET /api/version` reports `current`, `supported`, and `deprecated` API versions.

## API versioning and compatibility

The current version is `v1`, with versioned business routes under `/api/v1`. `/api/version` is the source of truth for supported/deprecated versions. New versions should be introduced under a new prefix, existing versions should remain behaviorally compatible, and deprecations should be announced through the version endpoint and release notes before removal. No route changes are introduced by this documentation sprint.

## Swagger production access

In development, `/api/docs` is open. In production, set both `DOCS_USERNAME` and `DOCS_PASSWORD` to enable Basic Auth protection for `/api/docs` and `/api/docs.json`. Keep these values in the deployment secret manager; never commit them. The docs endpoint is an operational aid and should not be exposed publicly without an explicit access decision.

## Postman

Import either collection and its matching environment:

- `docs/postman/kot-pos-local.postman_collection.json` + `kot-pos-local.postman_environment.json`
- `docs/postman/kot-pos-production.postman_collection.json` + `kot-pos-production.postman_environment.json`

Run login first, set `accessToken` to the resulting JWT when using header-based authentication, and set `branchId` to a real branch ID for branch-scoped examples. Collections are generated from the OpenAPI source using `npm run docs:generate`.

## Synchronization rules

When a route, validator, auth role, or response shape changes, update `src/docs/openapi.js`, run `npm run docs:generate`, and review both collection imports. Do not document speculative endpoints.
