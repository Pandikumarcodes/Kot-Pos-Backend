# Phase 5D — Ownership Constraint Hardening

## Status

Complete. Production ownership remains direct `branchId`-based; no frontend, tenant architecture, or historical Billing records were changed.

## Model readiness matrix

| Model | branchId | Required | Immutable | Indexed | Readiness | Branchless policy |
|---|---|---:|---:|---:|---|---|
| Billing | yes | conditional for new documents | yes | yes | Historical compatibility required | Hydrated historical completed Bills remain readable only through the explicit archival helper. |
| Table | yes | yes | yes | yes | Ready to require | No legitimate new branchless operational creation. |
| TableOrder | yes | yes | yes | yes | Ready to require | No legitimate new branchless operational creation. |
| TakeAway | yes | yes | yes | yes | Ready to require | No legitimate new branchless operational creation. |
| Inventory | yes | yes | yes | yes | Ready | No legitimate branchless creation path. |
| KOT | yes | yes | yes | yes | Ready | No legitimate branchless creation path. |
| StockLog | yes | yes | yes | yes | Ready | No legitimate branchless creation path. |

## Constraints and historical Billing

Table, TableOrder, and TakeAway now require an immutable branchId. Inventory, KOT, and StockLog retain required ownership and now explicitly mark branchId immutable at the schema level. Billing uses a conditional required validator for new documents: new Bills must have branchId, while hydrated historical branchless completed Bills remain readable. The documented `listHistoricalBranchless` helper remains the only compatibility path and is read-only in policy.

## Index review

No speculative indexes were added. Existing branch indexes cover Billing list/payment queries, Table status and recency queries, TableOrder status/table queries, and TakeAway status/recency queries. KOT and Inventory already have branch compound indexes; StockLog retains its inventory/createdAt index and direct branch filtering through its scoped repository.

## Creation and mutation guarantees

Operational creation services derive branchId from validated access scope: Billing, Table, TableOrder, TakeAway, Inventory, StockLog, and KOT creation paths do not treat request body branchId as authoritative. Controllers strip query branchId overrides before service calls. Schema immutability and repository/update guards reject branchId mutation; migration tooling remains the intentional exception.

## Verification

- Phase 5D model constraint tests: 8/8.
- Phase 5C integration cleanup: 58/58.
- Targeted Phase 5C suites: 159/159.
- Ownership/access-scope and transaction suites: 119/119.
- No production regression was found.

The giant combined suite remains a known infrastructure timeout and was not required for this gate.
