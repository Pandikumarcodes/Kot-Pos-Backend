# Phase 5C — Direct Branch Ownership Enforcement

## Status

Implemented in the backend. `branchId` remains optional and immutable; no frontend routes or tenant architecture were changed.

## Migrated operational paths

- `BillingRepository` list, get, count, payment, and delete scopes now add the authoritative direct `branchId` predicate.
- `OrderRepository` and `TakeawayOrderRepository` list, get, status, and kitchen-transition access paths now use direct branch scope.
- Table list, ID lookup, update, delete, allocation/free, billing-state changes, and public QR resolution use direct branch ownership. A public QR lookup rejects branchless tables rather than assigning ownership.
- Waiter cashier conversion validates the table, orders, unpaid Billing record, and status updates inside the same branch scope.
- Reports and the AI daily summary use direct branch ownership for Billing and TableOrder/KOT operational data.

`createdBy` remains actor/audit information only. Branch member arrays are no longer used by these operational paths.

## Historical Billing policy

The 16 historical branchless/completed Billing records are not returned by normal branch lists, gets, payments, deletes, or reports. The repository retains `listHistoricalBranchless` as an explicit archival compatibility helper for a separately reviewed historical flow. It is not wired to operational routes and does not infer or assign a branch.

Migration, verification, and rollback helpers remain available.

## Cross-branch guarantees

ID-based operations compose `_id` with direct `branchId`. Linked Table, TableOrder, KOT, TakeAway, and Billing records are created or looked up under the same branch scope, so a resource ID from another branch resolves as not found and cannot be mutated.

## Tests

Focused Phase 5C tests cover Billing/Table/TableOrder/TakeAway read and mutation filters, creator reassignment, direct ownership authority, historical Billing exclusion, cross-branch relation rejection, same-branch validation, and string/ObjectId scope values. Existing transaction, audit, Socket.IO, ownership migration, and access-scope suites remain the regression targets.

### Fixture migration

- Normal Table, waiter-table, TableOrder, Billing, TakeAway, KOT, cashier, and waiter fixtures now carry direct branch ownership and matching authenticated branch scope.
- Mocked repository assertions were changed to direct `branchId` filters; creator-derived and branch-member `$in` expectations were removed.
- Intentional branchless fixtures remain for historical Billing compatibility, missing/invalid access-scope rejection, and explicitly global-admin cases.
- Targeted Table, waiter-table, waiter-order, cashier Billing, cashier KOT, and related contract suites: **159/159 passed**. Ownership/access-scope and Billing/TableOrder transaction suites: **119/119 passed**.

The final seven integration failures were all fixture or mock drift: two stale access-aware repository expectations, one stale cross-branch response assertion, and four stale stock-log repository/filter assertions. They were migrated to the current direct branch and access-scope contracts. No production file required modification.

The complete six-suite integration cleanup now passes **58/58**:

- OperationalQueryIntegration: 10/10
- MasterDataQueryIntegration: 9/9
- InventoryQueryIntegration: 18/18
- StockLogQueryIntegration: 5/5
- InventoryTransactions: 12/12
- KitchenAuditTransactions: 4/4

## Remaining compatibility debt

- `scopedOwnershipFilter`, `memberConstraint`, and branch-member loading remain only for migration/compatibility consumers and should not be reintroduced into operational reads.
- Historical Billing archival access requires an explicitly reviewed caller before it is exposed.
- Final integration mocks use current access-aware repository names and `{ type: "branch", isGlobal: false, branchId }` scope objects; no creator/member fallback was restored.
- The combined all-suite run previously timed out; targeted Phase 5C suites are deterministic and complete.
