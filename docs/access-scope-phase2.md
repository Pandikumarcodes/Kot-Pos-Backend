# Access-scope Phase 2 notes

## MenuItem and Table limitations

`MenuItem` and `Table` remain global collections. Neither model has a `branchId`,
so the backend does not claim branch ownership or enforce a branch filter for
these resources. Existing behavior is intentionally unchanged.

Future schema work must add ownership and indexes before menu/table branch
isolation is implemented. No data migration is part of Phase 2.

## Phase 3 compatibility cleanup

The following request compatibility fields were removed from the middleware:

- `req.branchId`
- `req.isSuperAdmin`
- `req.branchFilter`
- `req.branchMemberFilter`
- `req.scopeToBranch`
- `req.scopeToBranchMembers`

Billing and user controllers now pass `req.accessScope`. `branchMemberIds`
remains as an explicit resolved member-ID list for models that do not contain
`branchId`.

The removal is complete in Phase 3; no production compatibility consumers
remain. The former fields are not scheduled for reintroduction.

`MenuItem` continues to receive explicit scope context only for cache/request
contracts; it does not claim branch ownership because its schema is global.

No new production code should consume these compatibility fields.
