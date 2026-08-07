# Phase 5A direct branch ownership

## Compatibility modes

- Direct writes are enabled for Billing, Table, TableOrder, and TakeAway. New records take `req.accessScope.branchId`; request-supplied `branchId` is not used.
- Direct reads are authoritative when `branchId` is present.
- Legacy fallback remains enabled for branchless Billing, TableOrder, and TakeAway records using the validated branch-member creator set. A conflicting direct branch is never admitted through that fallback.
- Tables use the explicit deny policy for branchless historical records. They are not made visible to every branch and are not silently assigned.

## Index compatibility report

Added non-unique branch indexes for the four operational models and the safe status/date compounds. Billing retains global unique `billNumber`. Table retains global unique `tableNumber`; the future `{ branchId: 1, tableNumber: 1 }` unique target is deferred until an ownership/duplicate audit and backfill are complete. No required or branch-unique index was added.

## Ownership audit

`src/scripts/auditBranchOwnership.js` is read-only by default. It reports totals, direct/branchless counts, invalid branch references, creator-derived candidates, and unresolved counts, then closes MongoDB. It performs no updates or deletes and does not print credentials.
