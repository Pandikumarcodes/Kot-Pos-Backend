# Technical Debt Summary

This is a short index, not a substitute for the source-backed detail in [Database](DATABASE.md), [Security](SECURITY.md), and [Transactions](TRANSACTIONS.md).

## Critical

- Add immutable direct `branchId` ownership to Billing, TableOrder, and TakeAway; current visibility is creator-membership-derived.
- Enable dedicated CSRF protection for cookie-authenticated mutations.

## Major

- Make bill-number allocation concurrency-safe.
- Make automatic inventory deduction atomic or compensating; current staff draft deduction can partially succeed.
- Complete consistent pagination/query behavior on legacy list endpoints.
- Remove known N+1 query patterns.
- Enforce table/order/billing transitions consistently, including manual table release and served-order billing correlation.

## Minor

- Normalize endpoint, file, and response-envelope naming.
- Align the frontend `room:joined` listener (`{ room }`) with the backend payload (`{ role, branchId }`).
- Remove unused helpers and inactive configuration.
