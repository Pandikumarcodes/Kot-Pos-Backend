# Phase 5B TakeAway manual resolution

Generated from `ownership-backfill-dry-run-propagated.json`, `unresolved-ownership-resolution.json`, and `docs/phase5B-manual-resolution-report.md`.

## Safety contract

`--takeaway-map=<path>` is optional and dry-run remains the default. A non-null entry is accepted only when its TakeAway ID and branch ID are valid ObjectIds, the TakeAway record exists in the scanned collection, and the branch exists. A mapped record emits:

```json
{"source":"takeaway-map","branchId":"<branch id>","referencedIds":["<takeaway id>"]}
```

Direct branch evidence, creator evidence, or linked evidence that differs from the map produces `conflicting`; it is never auto-resolved. Null template entries are ignored. Unknown mapped record IDs are rejected.

## Unresolved TakeAway records

All 17 records are `active` / `sent_to_kitchen`; none is completed or cancelled. Creator branch metadata and linked KOT/order/billing references are absent or have no usable branch evidence. The supplied artifacts do not contain item arrays, so item counts and total amounts are `unknown`, not inferred.

| Record ID | Status | Created | Updated | Creator | Items | Total | Linked references | Lifecycle | Recommended action |
|---|---|---|---|---|---:|---:|---|---|---|
| 6a4ba5504bf11a64def1ff63 | sent_to_kitchen | 2026-07-06T12:53:36.907Z | 2026-07-06T12:53:37.143Z | 69b813ddd7840638331a924a (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a4ba5e24bf11a64def204bf | sent_to_kitchen | 2026-07-06T12:56:02.124Z | 2026-07-06T12:56:02.278Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a4bacdf4bf11a64def20a66 | sent_to_kitchen | 2026-07-06T13:25:51.914Z | 2026-07-06T13:25:52.111Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a4bad3b4bf11a64def20e43 | sent_to_kitchen | 2026-07-06T13:27:23.822Z | 2026-07-06T13:27:24.009Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a4bad9a4bf11a64def21201 | sent_to_kitchen | 2026-07-06T13:28:58.851Z | 2026-07-06T13:28:59.124Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6a2f5f143debb7ef05bd47 | sent_to_kitchen | 2026-07-29T16:50:39.735Z | 2026-07-29T16:50:39.919Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6b4e386c73f7dd78e5c6ab | sent_to_kitchen | 2026-07-30T13:14:32.113Z | 2026-07-30T13:14:32.315Z | 69b813ddd7840638331a924a (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6b53896c73f7dd78e5c795 | sent_to_kitchen | 2026-07-30T13:37:13.661Z | 2026-07-30T13:37:13.809Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6dd0c36fcde921ad6d1eda | sent_to_kitchen | 2026-08-01T10:56:03.122Z | 2026-08-01T10:56:03.403Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6df6d6d258593f8a5f5228 | sent_to_kitchen | 2026-08-01T13:38:30.581Z | 2026-08-01T13:38:30.819Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6dfaa3d1aac66788957d3f | sent_to_kitchen | 2026-08-01T13:54:43.661Z | 2026-08-01T13:54:43.904Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a6e1b9e45ef35903b83e2f9 | sent_to_kitchen | 2026-08-01T16:15:26.968Z | 2026-08-01T16:15:27.569Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a73575037ed464248dd54d7 | sent_to_kitchen | 2026-08-05T15:31:28.899Z | 2026-08-05T15:31:29.596Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a7357a837ed464248dd552b | sent_to_kitchen | 2026-08-05T15:32:56.964Z | 2026-08-05T15:32:57.670Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a7357ca37ed464248dd555e | sent_to_kitchen | 2026-08-05T15:33:30.366Z | 2026-08-05T15:33:31.054Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a7415e861a243dbf35c3e1c | sent_to_kitchen | 2026-08-06T05:04:40.922Z | 2026-08-06T05:04:41.270Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |
| 6a74163561a243dbf35c3e4a | sent_to_kitchen | 2026-08-06T05:05:57.958Z | 2026-08-06T05:05:58.277Z | 69bc0b4fb3106afed60c1ff9 (branch null) | unknown | unknown | KOT/order/billing: none | active | assign branch manually |

Active unresolved: **17**. Historical unresolved: **0**. Unknown lifecycle: **0**.

## Dry-run command

```powershell
npm run ownership:backfill -- --dry-run --table-map=table-branch-map.completed.json --takeaway-map=takeaway-branch-map.template.json --report-file=ownership-backfill-dry-run-takeaway.json --checkpoint-file=ownership.checkpoint.takeaway.json
```

Replace nulls only with operationally approved branch IDs before a later reconciliation. Do not use `--apply` until unresolved active records and all conflicts are reviewed.
