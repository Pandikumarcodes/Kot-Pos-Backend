# Phase 5B ownership migration

All migration commands are read-only unless `--apply` is explicitly supplied.

Examples:

```text
npm run ownership:audit -- --dry-run --report-file=ownership-audit.json
npm run ownership:backfill -- --dry-run --batch-size=250 --checkpoint-file=ownership.checkpoint.json --report-file=ownership-backfill.json
npm run ownership:backfill -- --apply --table-map=table-map.json --confirm-default-assignment
npm run ownership:verify -- --report-file=ownership-verify.json
npm run ownership:rollback -- --report-file=ownership-backfill.json --output-file=ownership-rollback.json
```

Tables require `--table-map` or an explicitly confirmed `--default-branch-id`. Unresolved, malformed, orphaned, and conflicting records are skipped. Existing non-null ownership is never overwritten.

Direct-only reads are not enabled by this phase. Read activation requires complete active-record ownership, zero unresolved active records and cross-branch conflicts, reconciled direct/compatibility totals, successful indexes, passing route tests, and a validated rollback report.
