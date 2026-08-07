# Phase 5B manual ownership resolution report

Generated: 2026-08-06T18:21:55.498Z

## Decision

**NOT READY**. No branch was assigned automatically, no schema or frontend file was changed, and no `--apply` command was executed. Direct-only reads remain disabled.

## Summary

- Unique unresolved table count: **9
- Unresolved active records: **31
- Unresolved historical records (completed/cancelled): **116
- Unresolved unknown records: **0
- Safe-to-migrate records: Billing 9; Table 0; TableOrder 9; TakeAway 4.
- Conflicts: 0.
- Records requiring manual assignment: 9 table mappings plus 17 unresolved TakeAway records.

## Evidence reviewed

Current branchId, creator.branchId, linked orders, linked KOTs, linked billing records, audit events, creation-time activity, and explicit historical branch fields were checked. Usernames, passwords, phones, customer names, item contents, and amounts are omitted. A branch is never selected when evidence is absent or conflicting.

## Referenced unresolved tables

| Table ID | Number | Name | Status | Current branch | Created | Updated | Existing references | Evidence branches | Recommendation |
|---|---:|---|---|---|---|---|---|---|---|
| 69e35a5313f865ebe3fca142 | 1 | not stored | available | null | 2026-04-18T10:17:55.930Z | 2026-08-06T11:59:09.696Z | orders 21; KOTs 18; bills 13 | 69e35a5313f865ebe3fca128, 69b7cdfb5ef4d3634c66ce06 | assign branch manually |
| 69e35a5313f865ebe3fca145 | 2 | not stored | available | null | 2026-04-18T10:17:55.983Z | 2026-08-05T19:35:28.173Z | orders 9; KOTs 7; bills 7 | 69e35a5313f865ebe3fca128, 69b7cdfb5ef4d3634c66ce06 | assign branch manually |
| 69e35a5413f865ebe3fca148 | 3 | not stored | available | null | 2026-04-18T10:17:56.036Z | 2026-08-06T05:10:42.397Z | orders 7; KOTs 7; bills 6 | 69e35a5313f865ebe3fca128, 69b7cdfb5ef4d3634c66ce06 | assign branch manually |
| 69e35a5413f865ebe3fca14b | 4 | not stored | available | null | 2026-04-18T10:17:56.088Z | 2026-08-05T15:35:18.364Z | orders 6; KOTs 6; bills 5 | 69b7cdfb5ef4d3634c66ce06, 69e35a5313f865ebe3fca128 | assign branch manually |
| 69e35a5413f865ebe3fca14e | 5 | not stored | available | null | 2026-04-18T10:17:56.140Z | 2026-08-05T15:35:13.341Z | orders 8; KOTs 8; bills 5 | 69b7cdfb5ef4d3634c66ce06, 69e35a5313f865ebe3fca128 | assign branch manually |
| 69e35a5413f865ebe3fca151 | 6 | not stored | available | null | 2026-04-18T10:17:56.203Z | 2026-08-05T15:34:54.119Z | orders 4; KOTs 4; bills 4 | 69e35a5313f865ebe3fca128, 69b7cdfb5ef4d3634c66ce06 | assign branch manually |
| 69e35a5413f865ebe3fca154 | 7 | not stored | available | null | 2026-04-18T10:17:56.515Z | 2026-08-05T15:34:43.708Z | orders 5; KOTs 5; bills 4 | 69e35a5313f865ebe3fca128, 69b7cdfb5ef4d3634c66ce06 | assign branch manually |
| 6a477c66354a6d2e6a36c38a | 10 | not stored | available | null | 2026-07-03T09:09:58.158Z | 2026-08-05T15:30:11.444Z | orders 8; KOTs 5; bills 4 | 69b7cdfb5ef4d3634c66ce06, 69e35a5313f865ebe3fca128 | assign branch manually |
| 6a69d672c084b119b255df12 | 11 | not stored | available | null | 2026-07-29T10:31:14.915Z | 2026-08-05T15:29:52.427Z | orders 1; KOTs 1; bills 1 | 69e35a5313f865ebe3fca128 | assign branch manually |

Table records have no stored name or creator field. All referenced tables have branchId null and status available. Linked evidence is retained in unresolved-ownership-resolution.json; it is not converted into an automatic assignment.

## Unresolved records by collection

### Billing (59)

| Record ID | Classification | Status | Current branch | Table ID | Created | Updated | Evidence | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 6a460b23b1f83fd40a30d033 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-07-02T06:54:27.309Z | 2026-07-02T07:03:26.893Z | none | keep historical compatibility fallback |
| 6a477cf2354a6d2e6a36c49d | completed | paid | null | 6a477c66354a6d2e6a36c38a | 2026-07-03T09:12:18.890Z | 2026-07-06T12:52:43.026Z | none | keep historical compatibility fallback |
| 6a477d23354a6d2e6a36c4cf | completed | paid | null | 69e35a5413f865ebe3fca154 | 2026-07-03T09:13:07.412Z | 2026-07-06T12:52:40.381Z | none | keep historical compatibility fallback |
| 6a4ba33c4bf11a64def1f4af | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-07-06T12:44:44.254Z | 2026-07-06T12:52:37.615Z | none | keep historical compatibility fallback |
| 6a4ba34f4bf11a64def1f512 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-07-06T12:45:03.243Z | 2026-07-06T12:52:35.517Z | none | keep historical compatibility fallback |
| 6a4ba4304bf11a64def1f6fe | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-07-06T12:48:48.902Z | 2026-07-06T12:52:34.011Z | none | keep historical compatibility fallback |
| 6a4ba4604bf11a64def1f82d | completed | paid | null | 69e35a5413f865ebe3fca14b | 2026-07-06T12:49:36.121Z | 2026-07-06T12:52:32.438Z | none | keep historical compatibility fallback |
| 6a4ba4ab4bf11a64def1fa9e | completed | paid | null | 69e35a5413f865ebe3fca14e | 2026-07-06T12:50:51.601Z | 2026-07-06T12:52:30.011Z | none | keep historical compatibility fallback |
| 6a4ba4bd4bf11a64def1fb0b | completed | paid | null | 69e35a5413f865ebe3fca151 | 2026-07-06T12:51:09.045Z | 2026-07-06T12:51:55.453Z | none | keep historical compatibility fallback |
| 6a4ba5f04bf11a64def20565 | completed | paid | null | none | 2026-07-06T12:56:16.328Z | 2026-07-06T12:56:16.328Z | none | keep historical compatibility fallback |
| 6a4bad0d4bf11a64def20c7e | completed | paid | null | none | 2026-07-06T13:26:37.263Z | 2026-07-06T13:26:37.263Z | none | keep historical compatibility fallback |
| 6a4bad5e4bf11a64def20fd3 | completed | paid | null | none | 2026-07-06T13:27:59.070Z | 2026-07-06T13:27:59.070Z | none | keep historical compatibility fallback |
| 6a4baf8d4bf11a64def2164c | completed | paid | null | none | 2026-07-06T13:37:17.052Z | 2026-07-06T13:37:17.052Z | none | keep historical compatibility fallback |
| 6a4baf8f4bf11a64def2166e | completed | paid | null | none | 2026-07-06T13:37:19.951Z | 2026-07-06T13:37:19.951Z | none | keep historical compatibility fallback |
| 6a5e2d67b6c85b83d8e352f3 | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-07-20T14:15:03.397Z | 2026-07-29T16:49:56.801Z | none | keep historical compatibility fallback |
| 6a5e2d82b6c85b83d8e3530d | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-07-20T14:15:30.009Z | 2026-07-29T16:50:13.169Z | none | keep historical compatibility fallback |
| 6a5e2db9b6c85b83d8e35571 | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-07-20T14:16:25.700Z | 2026-07-29T16:50:11.602Z | none | keep historical compatibility fallback |
| 6a5e2f5eb6c85b83d8e35cd9 | completed | paid | null | 69e35a5413f865ebe3fca14b | 2026-07-20T14:23:26.615Z | 2026-07-29T16:50:09.724Z | none | keep historical compatibility fallback |
| 6a5e3360b6c85b83d8e36a6b | completed | paid | null | 69e35a5413f865ebe3fca14e | 2026-07-20T14:40:32.399Z | 2026-07-29T16:50:08.335Z | none | keep historical compatibility fallback |
| 6a5e404bb6c85b83d8e36cdd | completed | paid | null | 69e35a5413f865ebe3fca151 | 2026-07-20T15:35:39.500Z | 2026-07-29T16:50:06.291Z | none | keep historical compatibility fallback |
| 6a69d5e1c084b119b255de04 | completed | paid | null | 69e35a5413f865ebe3fca154 | 2026-07-29T10:28:49.819Z | 2026-07-29T16:50:03.717Z | none | keep historical compatibility fallback |
| 6a69d625c084b119b255de9d | completed | paid | null | 6a477c66354a6d2e6a36c38a | 2026-07-29T10:29:57.938Z | 2026-07-29T16:50:01.578Z | none | keep historical compatibility fallback |
| 6a6a2f63143debb7ef05bd63 | completed | paid | null | none | 2026-07-29T16:50:43.348Z | 2026-07-29T16:50:43.348Z | none | keep historical compatibility fallback |
| 6a6b53716c73f7dd78e5c775 | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:36:49.691Z | 2026-07-30T13:37:38.942Z | none | keep historical compatibility fallback |
| 6a6b538c6c73f7dd78e5c7b1 | completed | paid | null | none | 2026-07-30T13:37:16.083Z | 2026-07-30T13:37:16.083Z | none | keep historical compatibility fallback |
| 6a6b538e6c73f7dd78e5c7bb | completed | paid | null | none | 2026-07-30T13:37:18.537Z | 2026-07-30T13:37:18.537Z | none | keep historical compatibility fallback |
| 6a6b54036c73f7dd78e5ce26 | completed | paid | null | 6a477c66354a6d2e6a36c38a | 2026-07-30T13:39:15.685Z | 2026-08-01T10:56:55.708Z | none | keep historical compatibility fallback |
| 6a6b54b66c73f7dd78e5d95f | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:42:14.167Z | 2026-08-01T10:56:54.304Z | none | keep historical compatibility fallback |
| 6a6b7ec383e2d046012717e6 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-07-30T16:41:39.438Z | 2026-08-01T10:56:52.913Z | none | keep historical compatibility fallback |
| 6a6dafce119092301c667e36 | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-08-01T08:35:26.316Z | 2026-08-01T10:56:51.462Z | none | keep historical compatibility fallback |
| 6a6dbee3e23949defc8f2afb | completed | paid | null | 69e35a5413f865ebe3fca14b | 2026-08-01T09:39:47.184Z | 2026-08-01T10:56:49.906Z | none | keep historical compatibility fallback |
| 6a6dbef4e23949defc8f2b38 | completed | paid | null | 69e35a5413f865ebe3fca14e | 2026-08-01T09:40:04.620Z | 2026-08-01T10:56:47.297Z | none | keep historical compatibility fallback |
| 6a6dd0c56fcde921ad6d1eff | completed | paid | null | none | 2026-08-01T10:56:05.418Z | 2026-08-01T10:56:05.418Z | none | keep historical compatibility fallback |
| 6a6df537d258593f8a5f4eab | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-08-01T13:31:35.318Z | 2026-08-05T15:22:06.002Z | none | keep historical compatibility fallback |
| 6a6df6d9d258593f8a5f524d | completed | paid | null | none | 2026-08-01T13:38:33.220Z | 2026-08-01T13:38:33.220Z | none | keep historical compatibility fallback |
| 6a6dfa7ed1aac66788957ca2 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-08-01T13:54:06.778Z | 2026-08-05T15:22:01.819Z | none | keep historical compatibility fallback |
| 6a6dfadfd1aac66788957df0 | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-08-01T13:55:43.298Z | 2026-08-05T15:21:55.625Z | none | keep historical compatibility fallback |
| 6a6dfb32d1aac66788957e39 | completed | paid | null | 69e35a5413f865ebe3fca14b | 2026-08-01T13:57:06.472Z | 2026-08-05T15:21:50.323Z | none | keep historical compatibility fallback |
| 6a6e1b5c45ef35903b83e227 | completed | paid | null | 69e35a5413f865ebe3fca14e | 2026-08-01T16:14:20.091Z | 2026-08-02T04:36:58.573Z | none | keep historical compatibility fallback |
| 6a6e1ba445ef35903b83e3af | completed | paid | null | none | 2026-08-01T16:15:32.957Z | 2026-08-01T16:15:32.957Z | none | keep historical compatibility fallback |
| 6a73555b37ed464248dd5066 | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-08-05T15:23:07.699Z | 2026-08-05T15:35:24.722Z | none | keep historical compatibility fallback |
| 6a73556d37ed464248dd50b5 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-08-05T15:23:25.632Z | 2026-08-05T15:35:32.159Z | none | keep historical compatibility fallback |
| 6a73558237ed464248dd50ff | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-08-05T15:23:46.771Z | 2026-08-05T15:35:29.136Z | none | keep historical compatibility fallback |
| 6a73559637ed464248dd514b | completed | paid | null | 69e35a5413f865ebe3fca14b | 2026-08-05T15:24:06.690Z | 2026-08-05T15:35:18.326Z | none | keep historical compatibility fallback |
| 6a7355c037ed464248dd51ff | completed | paid | null | 69e35a5413f865ebe3fca14e | 2026-08-05T15:24:48.080Z | 2026-08-05T15:35:13.291Z | none | keep historical compatibility fallback |
| 6a7355d737ed464248dd5240 | completed | paid | null | 69e35a5413f865ebe3fca151 | 2026-08-05T15:25:11.399Z | 2026-08-05T15:34:54.080Z | none | keep historical compatibility fallback |
| 6a7355f437ed464248dd5261 | completed | paid | null | 69e35a5413f865ebe3fca154 | 2026-08-05T15:25:40.552Z | 2026-08-05T15:34:43.669Z | none | keep historical compatibility fallback |
| 6a73563037ed464248dd52ef | completed | paid | null | 6a477c66354a6d2e6a36c38a | 2026-08-05T15:26:40.659Z | 2026-08-05T15:30:11.379Z | none | keep historical compatibility fallback |
| 6a73563437ed464248dd5307 | completed | paid | null | 6a69d672c084b119b255df12 | 2026-08-05T15:26:44.546Z | 2026-08-05T15:29:52.361Z | none | keep historical compatibility fallback |
| 6a73575937ed464248dd54fd | completed | paid | null | none | 2026-08-05T15:31:37.392Z | 2026-08-05T15:31:37.392Z | none | keep historical compatibility fallback |
| 6a7357bd37ed464248dd5553 | completed | paid | null | none | 2026-08-05T15:33:17.329Z | 2026-08-05T15:33:17.329Z | none | keep historical compatibility fallback |
| 6a7357d037ed464248dd5574 | completed | paid | null | none | 2026-08-05T15:33:36.927Z | 2026-08-05T15:33:36.927Z | none | keep historical compatibility fallback |
| 6a7358c972a0a264417e2bd0 | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-08-05T15:37:45.253Z | 2026-08-05T19:35:34.048Z | none | keep historical compatibility fallback |
| 6a73590172a0a264417e2c45 | completed | paid | null | 69e35a5313f865ebe3fca145 | 2026-08-05T15:38:41.042Z | 2026-08-05T19:35:28.118Z | none | keep historical compatibility fallback |
| 6a7415eb61a243dbf35c3e3b | completed | paid | null | none | 2026-08-06T05:04:43.453Z | 2026-08-06T05:04:43.453Z | none | keep historical compatibility fallback |
| 6a74163961a243dbf35c3e67 | completed | paid | null | none | 2026-08-06T05:06:01.087Z | 2026-08-06T05:06:01.087Z | none | keep historical compatibility fallback |
| 6a7416d661a243dbf35c3f60 | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-08-06T05:08:38.501Z | 2026-08-06T06:22:42.045Z | none | keep historical compatibility fallback |
| 6a7416dd61a243dbf35c3f89 | completed | paid | null | 69e35a5413f865ebe3fca148 | 2026-08-06T05:08:45.034Z | 2026-08-06T05:10:42.236Z | none | keep historical compatibility fallback |
| 6a74768564ae6cb504f8bf4f | completed | paid | null | 69e35a5313f865ebe3fca142 | 2026-08-06T11:56:53.079Z | 2026-08-06T11:59:09.661Z | none | keep historical compatibility fallback |

### Table (11)

| Record ID | Classification | Status | Current branch | Table ID | Created | Updated | Evidence | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 69e35a5313f865ebe3fca142 | active | available | null | none | 2026-04-18T10:17:55.930Z | 2026-08-06T11:59:09.696Z | none | assign branch manually |
| 69e35a5313f865ebe3fca145 | active | available | null | none | 2026-04-18T10:17:55.983Z | 2026-08-05T19:35:28.173Z | none | assign branch manually |
| 69e35a5413f865ebe3fca148 | active | available | null | none | 2026-04-18T10:17:56.036Z | 2026-08-06T05:10:42.397Z | none | assign branch manually |
| 69e35a5413f865ebe3fca14b | active | available | null | none | 2026-04-18T10:17:56.088Z | 2026-08-05T15:35:18.364Z | none | assign branch manually |
| 69e35a5413f865ebe3fca14e | active | available | null | none | 2026-04-18T10:17:56.140Z | 2026-08-05T15:35:13.341Z | none | assign branch manually |
| 69e35a5413f865ebe3fca151 | active | available | null | none | 2026-04-18T10:17:56.203Z | 2026-08-05T15:34:54.119Z | none | assign branch manually |
| 69e35a5413f865ebe3fca154 | active | available | null | none | 2026-04-18T10:17:56.515Z | 2026-08-05T15:34:43.708Z | none | assign branch manually |
| 6a477c66354a6d2e6a36c38a | active | available | null | none | 2026-07-03T09:09:58.158Z | 2026-08-05T15:30:11.444Z | none | assign branch manually |
| 6a69d672c084b119b255df12 | active | available | null | none | 2026-07-29T10:31:14.915Z | 2026-08-05T15:29:52.427Z | none | assign branch manually |
| 6a6b53f66c73f7dd78e5ce0f | active | available | null | none | 2026-07-30T13:39:02.033Z | 2026-07-30T13:39:02.033Z | none | assign branch manually |
| 6a732fefb3fe410c4a0cb0ac | active | available | null | none | 2026-08-05T12:43:27.710Z | 2026-08-05T12:43:27.710Z | none | assign branch manually |

### TableOrder (60)

| Record ID | Classification | Status | Current branch | Table ID | Created | Updated | Evidence | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 69e638da7210f11d53170874 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-04-20T14:31:54.532Z | 2026-07-02T06:54:27.389Z | none | keep historical compatibility fallback |
| 69e638de7210f11d53170889 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-04-20T14:31:58.832Z | 2026-07-02T06:54:27.389Z | none | keep historical compatibility fallback |
| 6a3d465630a21cb26adaf386 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-06-25T15:16:38.470Z | 2026-07-06T12:44:44.302Z | none | keep historical compatibility fallback |
| 6a460be4b1f83fd40a30d0de | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-07-02T06:57:40.757Z | 2026-07-06T12:45:03.287Z | none | keep historical compatibility fallback |
| 6a460bf7b1f83fd40a30d175 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-07-02T06:57:59.712Z | 2026-07-06T12:45:03.287Z | none | keep historical compatibility fallback |
| 6a477c72354a6d2e6a36c392 | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-07-03T09:10:10.279Z | 2026-07-03T09:12:18.975Z | none | keep historical compatibility fallback |
| 6a477cf9354a6d2e6a36c4ac | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-07-03T09:12:25.138Z | 2026-07-29T10:29:57.994Z | none | keep historical compatibility fallback |
| 6a4ba3644bf11a64def1f53e | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-07-06T12:45:25.004Z | 2026-07-06T12:48:48.936Z | none | keep historical compatibility fallback |
| 6a4ba3814bf11a64def1f59d | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-07-06T12:45:53.212Z | 2026-07-06T12:48:48.936Z | none | keep historical compatibility fallback |
| 6a4ba45d4bf11a64def1f78b | completed | served | null | 69e35a5413f865ebe3fca14b | 2026-07-06T12:49:33.467Z | 2026-07-06T12:49:36.153Z | none | keep historical compatibility fallback |
| 6a4ba49e4bf11a64def1f997 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-07-06T12:50:38.308Z | 2026-07-06T12:50:51.652Z | none | keep historical compatibility fallback |
| 6a4ba4a84bf11a64def1fa3a | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-07-06T12:50:48.825Z | 2026-07-06T12:50:51.652Z | none | keep historical compatibility fallback |
| 6a4ba4b24bf11a64def1facc | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-07-06T12:50:58.482Z | 2026-07-20T14:15:30.043Z | none | keep historical compatibility fallback |
| 6a4ba4c64bf11a64def1fb21 | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-07-06T12:51:18.766Z | 2026-07-29T10:29:57.994Z | none | keep historical compatibility fallback |
| 6a4ba5aa4bf11a64def2047c | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-07-06T12:55:06.307Z | 2026-07-20T14:15:03.465Z | none | keep historical compatibility fallback |
| 6a5e2db7b6c85b83d8e3552a | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-07-20T14:16:23.249Z | 2026-07-20T14:16:25.734Z | none | keep historical compatibility fallback |
| 6a5e2f5db6c85b83d8e35cae | completed | served | null | 69e35a5413f865ebe3fca14b | 2026-07-20T14:23:25.236Z | 2026-07-20T14:23:26.654Z | none | keep historical compatibility fallback |
| 6a5e335eb6c85b83d8e36a55 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-07-20T14:40:30.469Z | 2026-07-20T14:40:32.456Z | none | keep historical compatibility fallback |
| 6a5e4049b6c85b83d8e36ca4 | completed | served | null | 69e35a5413f865ebe3fca151 | 2026-07-20T15:35:37.866Z | 2026-07-20T15:35:39.548Z | none | keep historical compatibility fallback |
| 6a5e4053b6c85b83d8e36cf3 | completed | served | null | 69e35a5413f865ebe3fca151 | 2026-07-20T15:35:48.000Z | 2026-08-05T15:25:11.464Z | none | keep historical compatibility fallback |
| 6a69d5d9c084b119b255dde7 | completed | served | null | 69e35a5413f865ebe3fca154 | 2026-07-29T10:28:41.226Z | 2026-07-29T10:28:49.883Z | none | keep historical compatibility fallback |
| 6a69d5edc084b119b255de16 | completed | served | null | 69e35a5413f865ebe3fca154 | 2026-07-29T10:29:01.783Z | 2026-08-05T15:25:40.617Z | none | keep historical compatibility fallback |
| 6a69d5f5c084b119b255de29 | completed | served | null | 69e35a5413f865ebe3fca154 | 2026-07-29T10:29:09.680Z | 2026-08-05T15:25:40.617Z | none | keep historical compatibility fallback |
| 6a69d5fac084b119b255de3d | completed | served | null | 69e35a5413f865ebe3fca154 | 2026-07-29T10:29:14.975Z | 2026-08-05T15:25:40.617Z | none | keep historical compatibility fallback |
| 6a69d61dc084b119b255de6e | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-07-29T10:29:49.326Z | 2026-07-29T10:29:57.994Z | none | keep historical compatibility fallback |
| 6a69d64cc084b119b255deb3 | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-07-29T10:30:36.362Z | 2026-07-30T13:39:15.725Z | none | keep historical compatibility fallback |
| 6a6b53636c73f7dd78e5c6f4 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:36:35.081Z | 2026-07-30T13:36:49.742Z | none | keep historical compatibility fallback |
| 6a6b53686c73f7dd78e5c719 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:36:40.535Z | 2026-07-30T13:36:49.742Z | none | keep historical compatibility fallback |
| 6a6b536e6c73f7dd78e5c73c | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:36:46.456Z | 2026-07-30T13:36:49.742Z | none | keep historical compatibility fallback |
| 6a6b540a6c73f7dd78e5ce39 | active | sent_to_kitchen | null | 6a477c66354a6d2e6a36c38a | 2026-07-30T13:39:22.623Z | 2026-07-30T13:39:22.740Z | none | assign branch manually |
| 6a6b54b36c73f7dd78e5d934 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-07-30T13:42:11.110Z | 2026-07-30T13:42:14.257Z | none | keep historical compatibility fallback |
| 6a6b7ebc83e2d046012717b8 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-07-30T16:41:32.933Z | 2026-07-30T16:41:39.479Z | none | keep historical compatibility fallback |
| 6a6d92e40f16e8016cbf86a5 | active | sent_to_kitchen | null | 69e35a5313f865ebe3fca142 | 2026-08-01T06:32:04.491Z | 2026-08-01T06:32:04.879Z | none | assign branch manually |
| 6a6dafcb119092301c667e1d | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-08-01T08:35:23.763Z | 2026-08-01T08:35:26.360Z | none | keep historical compatibility fallback |
| 6a6db004119092301c668287 | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-08-01T08:36:20.708Z | 2026-08-01T13:55:43.334Z | none | keep historical compatibility fallback |
| 6a6dbed9e23949defc8f2adb | completed | served | null | 69e35a5413f865ebe3fca14b | 2026-08-01T09:39:37.915Z | 2026-08-01T09:39:47.242Z | none | keep historical compatibility fallback |
| 6a6dbef0e23949defc8f2b18 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-08-01T09:40:00.609Z | 2026-08-01T09:40:04.660Z | none | keep historical compatibility fallback |
| 6a6df534d258593f8a5f4e91 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-01T13:31:32.592Z | 2026-08-01T13:31:35.361Z | none | keep historical compatibility fallback |
| 6a6df54dd258593f8a5f4ec5 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-01T13:31:57.968Z | 2026-08-05T15:23:07.775Z | none | keep historical compatibility fallback |
| 6a6df555d258593f8a5f4ee1 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-01T13:32:05.595Z | 2026-08-05T15:23:07.775Z | none | keep historical compatibility fallback |
| 6a6df561d258593f8a5f4f09 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-01T13:32:17.410Z | 2026-08-05T15:23:07.775Z | none | keep historical compatibility fallback |
| 6a6dfa7bd1aac66788957c88 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-08-01T13:54:03.836Z | 2026-08-01T13:54:06.820Z | none | keep historical compatibility fallback |
| 6a6dfb28d1aac66788957e18 | completed | served | null | 69e35a5413f865ebe3fca14b | 2026-08-01T13:56:56.889Z | 2026-08-01T13:57:06.506Z | none | keep historical compatibility fallback |
| 6a6e1b5845ef35903b83e1f4 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-08-01T16:14:16.199Z | 2026-08-01T16:14:20.153Z | none | keep historical compatibility fallback |
| 6a6e1b6245ef35903b83e243 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-08-01T16:14:26.232Z | 2026-08-05T15:24:48.146Z | none | keep historical compatibility fallback |
| 6a73556937ed464248dd5082 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-08-05T15:23:21.498Z | 2026-08-05T15:23:25.698Z | none | keep historical compatibility fallback |
| 6a73557f37ed464248dd50da | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-08-05T15:23:43.401Z | 2026-08-05T15:23:46.837Z | none | keep historical compatibility fallback |
| 6a73559337ed464248dd5118 | completed | served | null | 69e35a5413f865ebe3fca14b | 2026-08-05T15:24:03.341Z | 2026-08-05T15:24:06.756Z | none | keep historical compatibility fallback |
| 6a73559d37ed464248dd5161 | active | sent_to_kitchen | null | 69e35a5413f865ebe3fca14b | 2026-08-05T15:24:13.852Z | 2026-08-05T15:24:14.475Z | none | assign branch manually |
| 6a7355b137ed464248dd519e | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-08-05T15:24:33.182Z | 2026-08-05T15:24:48.146Z | none | keep historical compatibility fallback |
| 6a7355b837ed464248dd51c4 | completed | served | null | 69e35a5413f865ebe3fca14e | 2026-08-05T15:24:40.640Z | 2026-08-05T15:24:48.146Z | none | keep historical compatibility fallback |
| 6a7355d337ed464248dd5220 | completed | served | null | 69e35a5413f865ebe3fca151 | 2026-08-05T15:25:07.964Z | 2026-08-05T15:25:11.464Z | none | keep historical compatibility fallback |
| 6a73560937ed464248dd527b | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-08-05T15:26:01.115Z | 2026-08-05T15:26:40.725Z | none | keep historical compatibility fallback |
| 6a73561437ed464248dd529f | completed | served | null | 6a477c66354a6d2e6a36c38a | 2026-08-05T15:26:12.002Z | 2026-08-05T15:26:40.725Z | none | keep historical compatibility fallback |
| 6a73562637ed464248dd52c7 | completed | served | null | 6a69d672c084b119b255df12 | 2026-08-05T15:26:30.422Z | 2026-08-05T15:26:44.612Z | none | keep historical compatibility fallback |
| 6a7358c772a0a264417e2ba4 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-05T15:37:43.127Z | 2026-08-05T15:37:45.291Z | none | keep historical compatibility fallback |
| 6a7358fd72a0a264417e2c19 | completed | served | null | 69e35a5313f865ebe3fca145 | 2026-08-05T15:38:37.931Z | 2026-08-05T15:38:41.080Z | none | keep historical compatibility fallback |
| 6a73590e72a0a264417e2c65 | completed | served | null | 69e35a5413f865ebe3fca148 | 2026-08-05T15:38:54.720Z | 2026-08-06T05:08:45.075Z | none | keep historical compatibility fallback |
| 6a7390e8f0612903b5da3128 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-05T19:37:12.507Z | 2026-08-06T05:08:38.635Z | none | keep historical compatibility fallback |
| 6a74768264ae6cb504f8bf14 | completed | served | null | 69e35a5313f865ebe3fca142 | 2026-08-06T11:56:50.989Z | 2026-08-06T11:56:53.134Z | none | keep historical compatibility fallback |

### TakeAway (17)

| Record ID | Classification | Status | Current branch | Table ID | Created | Updated | Evidence | Recommendation |
|---|---|---|---|---|---|---|---|---|
| 6a4ba5504bf11a64def1ff63 | active | sent_to_kitchen | null | none | 2026-07-06T12:53:36.907Z | 2026-07-06T12:53:37.143Z | none | assign branch manually |
| 6a4ba5e24bf11a64def204bf | active | sent_to_kitchen | null | none | 2026-07-06T12:56:02.124Z | 2026-07-06T12:56:02.278Z | none | assign branch manually |
| 6a4bacdf4bf11a64def20a66 | active | sent_to_kitchen | null | none | 2026-07-06T13:25:51.914Z | 2026-07-06T13:25:52.111Z | none | assign branch manually |
| 6a4bad3b4bf11a64def20e43 | active | sent_to_kitchen | null | none | 2026-07-06T13:27:23.822Z | 2026-07-06T13:27:24.009Z | none | assign branch manually |
| 6a4bad9a4bf11a64def21201 | active | sent_to_kitchen | null | none | 2026-07-06T13:28:58.851Z | 2026-07-06T13:28:59.124Z | none | assign branch manually |
| 6a6a2f5f143debb7ef05bd47 | active | sent_to_kitchen | null | none | 2026-07-29T16:50:39.735Z | 2026-07-29T16:50:39.919Z | none | assign branch manually |
| 6a6b4e386c73f7dd78e5c6ab | active | sent_to_kitchen | null | none | 2026-07-30T13:14:32.113Z | 2026-07-30T13:14:32.315Z | none | assign branch manually |
| 6a6b53896c73f7dd78e5c795 | active | sent_to_kitchen | null | none | 2026-07-30T13:37:13.661Z | 2026-07-30T13:37:13.809Z | none | assign branch manually |
| 6a6dd0c36fcde921ad6d1eda | active | sent_to_kitchen | null | none | 2026-08-01T10:56:03.122Z | 2026-08-01T10:56:03.403Z | none | assign branch manually |
| 6a6df6d6d258593f8a5f5228 | active | sent_to_kitchen | null | none | 2026-08-01T13:38:30.581Z | 2026-08-01T13:38:30.819Z | none | assign branch manually |
| 6a6dfaa3d1aac66788957d3f | active | sent_to_kitchen | null | none | 2026-08-01T13:54:43.661Z | 2026-08-01T13:54:43.904Z | none | assign branch manually |
| 6a6e1b9e45ef35903b83e2f9 | active | sent_to_kitchen | null | none | 2026-08-01T16:15:26.968Z | 2026-08-01T16:15:27.569Z | none | assign branch manually |
| 6a73575037ed464248dd54d7 | active | sent_to_kitchen | null | none | 2026-08-05T15:31:28.899Z | 2026-08-05T15:31:29.596Z | none | assign branch manually |
| 6a7357a837ed464248dd552b | active | sent_to_kitchen | null | none | 2026-08-05T15:32:56.964Z | 2026-08-05T15:32:57.670Z | none | assign branch manually |
| 6a7357ca37ed464248dd555e | active | sent_to_kitchen | null | none | 2026-08-05T15:33:30.366Z | 2026-08-05T15:33:31.054Z | none | assign branch manually |
| 6a7415e861a243dbf35c3e1c | active | sent_to_kitchen | null | none | 2026-08-06T05:04:40.922Z | 2026-08-06T05:04:41.270Z | none | assign branch manually |
| 6a74163561a243dbf35c3e4a | active | sent_to_kitchen | null | none | 2026-08-06T05:05:57.958Z | 2026-08-06T05:05:58.277Z | none | assign branch manually |

## TakeAway manual review

All 17 unresolved TakeAway records are sent_to_kitchen and are therefore likely active. No creator branch metadata or linked KOT/order/billing references were available. Each requires manual branch assignment after operational confirmation.

| Record ID | Status | Created | Updated | Creator | Linked KOT/order/billing references | Likely lifecycle | Recommended manual action |
|---|---|---|---|---|---|---|---|
| 6a4ba5504bf11a64def1ff63 | sent_to_kitchen | 2026-07-06T12:53:36.907Z | 2026-07-06T12:53:37.143Z | 69b813ddd7840638331a924a (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a4ba5e24bf11a64def204bf | sent_to_kitchen | 2026-07-06T12:56:02.124Z | 2026-07-06T12:56:02.278Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a4bacdf4bf11a64def20a66 | sent_to_kitchen | 2026-07-06T13:25:51.914Z | 2026-07-06T13:25:52.111Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a4bad3b4bf11a64def20e43 | sent_to_kitchen | 2026-07-06T13:27:23.822Z | 2026-07-06T13:27:24.009Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a4bad9a4bf11a64def21201 | sent_to_kitchen | 2026-07-06T13:28:58.851Z | 2026-07-06T13:28:59.124Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6a2f5f143debb7ef05bd47 | sent_to_kitchen | 2026-07-29T16:50:39.735Z | 2026-07-29T16:50:39.919Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6b4e386c73f7dd78e5c6ab | sent_to_kitchen | 2026-07-30T13:14:32.113Z | 2026-07-30T13:14:32.315Z | 69b813ddd7840638331a924a (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6b53896c73f7dd78e5c795 | sent_to_kitchen | 2026-07-30T13:37:13.661Z | 2026-07-30T13:37:13.809Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6dd0c36fcde921ad6d1eda | sent_to_kitchen | 2026-08-01T10:56:03.122Z | 2026-08-01T10:56:03.403Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6df6d6d258593f8a5f5228 | sent_to_kitchen | 2026-08-01T13:38:30.581Z | 2026-08-01T13:38:30.819Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6dfaa3d1aac66788957d3f | sent_to_kitchen | 2026-08-01T13:54:43.661Z | 2026-08-01T13:54:43.904Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a6e1b9e45ef35903b83e2f9 | sent_to_kitchen | 2026-08-01T16:15:26.968Z | 2026-08-01T16:15:27.569Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a73575037ed464248dd54d7 | sent_to_kitchen | 2026-08-05T15:31:28.899Z | 2026-08-05T15:31:29.596Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a7357a837ed464248dd552b | sent_to_kitchen | 2026-08-05T15:32:56.964Z | 2026-08-05T15:32:57.670Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a7357ca37ed464248dd555e | sent_to_kitchen | 2026-08-05T15:33:30.366Z | 2026-08-05T15:33:31.054Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a7415e861a243dbf35c3e1c | sent_to_kitchen | 2026-08-06T05:04:40.922Z | 2026-08-06T05:04:41.270Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |
| 6a74163561a243dbf35c3e4a | sent_to_kitchen | 2026-08-06T05:05:57.958Z | 2026-08-06T05:05:58.277Z | 69bc0b4fb3106afed60c1ff9 (branch null) | KOT none; order none; billing none | likely active | assign branch manually |

## Manual resolution and next dry-run

Fill table-branch-map.template.json only with approved branch IDs. Save the completed map as table-branch-map.completed.json. Reconcile the next dry-run before any apply. Do not delete records.

```powershell
npm run ownership:backfill -- --dry-run --table-map=table-branch-map.completed.json --report-file=ownership-backfill-dry-run-after-map.json --checkpoint-file=ownership.checkpoint.after-map.json
```
