# Phase 5B TakeAway automatic resolution

Generated 2026-08-07. No database writes were performed and `--apply` was not executed.

## Summary

- Total records inspected: **17**
- Safe-to-map: **0**
- Conflicts: **0**
- Unresolved: **17**

The local read-only evidence artifact `unresolved-ownership-resolution.json` was reviewed for all template IDs. A fresh MongoDB recheck was attempted, but the configured MongoDB SRV endpoint failed DNS resolution in both sandboxed and approved network execution (`ETIMEOUT` / `ECONNREFUSED`). No branch is inferred from that failure.

Evidence priority used: direct TakeAway.branchId, creator.branchId, linked KOT branch, linked order branch, linked billing branch, audit event branch. The supplied evidence shows no usable evidence at any priority for any record: direct branch is null, creator branch is null, linked KOT/order/billing references are null, and no usable audit branch is recorded. Therefore no candidate can be validated against Branch and the suggested map intentionally contains no entries.

## Record decisions

| takeawayId | status | createdAt | createdBy | creatorBranchId | linked evidence | candidateBranchId | evidenceSources | decision |
|---|---|---|---|---|---|---|---|---|
| 6a4ba5504bf11a64def1ff63 | sent_to_kitchen | 2026-07-06T12:53:36.907Z | 69b813ddd7840638331a924a | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a4ba5e24bf11a64def204bf | sent_to_kitchen | 2026-07-06T12:56:02.124Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a4bacdf4bf11a64def20a66 | sent_to_kitchen | 2026-07-06T13:25:51.914Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a4bad3b4bf11a64def20e43 | sent_to_kitchen | 2026-07-06T13:27:23.822Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a4bad9a4bf11a64def21201 | sent_to_kitchen | 2026-07-06T13:28:58.851Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6a2f5f143debb7ef05bd47 | sent_to_kitchen | 2026-07-29T16:50:39.735Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6b4e386c73f7dd78e5c6ab | sent_to_kitchen | 2026-07-30T13:14:32.113Z | 69b813ddd7840638331a924a | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6b53896c73f7dd78e5c795 | sent_to_kitchen | 2026-07-30T13:37:13.661Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6dd0c36fcde921ad6d1eda | sent_to_kitchen | 2026-08-01T10:56:03.122Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6df6d6d258593f8a5f5228 | sent_to_kitchen | 2026-08-01T13:38:30.581Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6dfaa3d1aac66788957d3f | sent_to_kitchen | 2026-08-01T13:54:43.661Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a6e1b9e45ef35903b83e2f9 | sent_to_kitchen | 2026-08-01T16:15:26.968Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a73575037ed464248dd54d7 | sent_to_kitchen | 2026-08-05T15:31:28.899Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a7357a837ed464248dd552b | sent_to_kitchen | 2026-08-05T15:32:56.964Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a7357ca37ed464248dd555e | sent_to_kitchen | 2026-08-05T15:33:30.366Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a7415e861a243dbf35c3e1c | sent_to_kitchen | 2026-08-06T05:04:40.922Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |
| 6a74163561a243dbf35c3e4a | sent_to_kitchen | 2026-08-06T05:05:57.958Z | 69bc0b4fb3106afed60c1ff9 | null | KOT/order/billing: none; audit: none | null | none | unresolved |

## Manual review records

All 17 records require manual review:

`6a4ba5504bf11a64def1ff63`, `6a4ba5e24bf11a64def204bf`, `6a4bacdf4bf11a64def20a66`, `6a4bad3b4bf11a64def20e43`, `6a4bad9a4bf11a64def21201`, `6a6a2f5f143debb7ef05bd47`, `6a6b4e386c73f7dd78e5c6ab`, `6a6b53896c73f7dd78e5c795`, `6a6dd0c36fcde921ad6d1eda`, `6a6df6d6d258593f8a5f5228`, `6a6dfaa3d1aac66788957d3f`, `6a6e1b9e45ef35903b83e2f9`, `6a73575037ed464248dd54d7`, `6a7357a837ed464248dd552b`, `6a7357ca37ed464248dd555e`, `6a7415e861a243dbf35c3e1c`, `6a74163561a243dbf35c3e4a`.

## Final dry-run command

```powershell
npm run ownership:backfill -- --dry-run --table-map=table-branch-map.completed.json --takeaway-map=takeaway-branch-map.suggested.json --report-file=ownership-backfill-dry-run-takeaway-suggested.json --checkpoint-file=ownership.checkpoint.takeaway-suggested.json
```
