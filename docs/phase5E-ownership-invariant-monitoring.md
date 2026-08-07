# Phase 5E — Ownership invariant monitoring

## Invariants

Tables, TableOrders, TakeAways, Inventory, KOTs, and StockLogs must have a direct, existing `branchId`. New Billing documents must have one; direct ownership is authoritative and immutable. Linked operational records must have matching branch IDs. The checker also detects orphaned branch references.

## Warning and critical rules

Known historical completed, branchless Billing records are reported as `historical-branchless-billing` warnings. Branchless operational/non-completed Billing is critical. Billing created on or after `PHASE5D_ENFORCEMENT_CUTOFF` is critical; set that environment variable to the Phase 5D enforcement timestamp for production checks. All other missing ownership, orphan references, and cross-branch links are critical. No correction is performed.

## Usage

```text
npm run ownership:check
```

The command uses the ownership migration DNS and bounded MongoDB timeout settings. It prints JSON:

```json
{"checkedAt":"...","status":"warning","collections":{},"violations":[],"warnings":[...]}
```

Exit status is `0` for clean or warnings-only, `1` for critical violations, and `2` for connection/execution failure. The script is read-only.

## Successful live verification

Phase 5E live verification completed successfully. The live database was reached
after DNS verification succeeded with `nslookup` using `8.8.8.8` and Node
`dns.resolveSrv` using `8.8.8.8` and `1.1.1.1`.

The read-only ownership invariant check returned `status: warning` with no
critical violations. The checked counts were:

- Table: 11
- TableOrder: 69
- TakeAway: 21
- Inventory: 24
- KOT: 79
- StockLog: 16
- Billing: 68

There were 16 warnings, all classified as
`historical-branchless-billing`. These are intentionally retained
historical/completed branchless Billing compatibility records and are expected
under the historical compatibility policy.

The result contained no orphan branch violations, no cross-branch violations,
and no branchless operational violations.

Phase 5E: **COMPLETE**

## Operational runbook

Run after deployment and during incident triage. For a critical result, preserve the JSON output, inspect the entity IDs and related branches, stop any unsafe writer if necessary, and repair through an approved migration/change process. Never auto-correct from this checker. Runtime ownership guard rejections are written by Winston as structured `ownership.invariant.violation` events without full documents or secrets.

## CI recommendation

Do not make CI depend on live Atlas unless CI provides a reliable isolated database and credentials. The current recommendation is to run unit tests and retain `npm run ownership:check` as a deployment/operations check; a future CI job may invoke it only in an explicitly provisioned database environment.
