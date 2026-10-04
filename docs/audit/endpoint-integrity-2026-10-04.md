# Endpoint data-integrity scan — 2026-10-04

Read-only audit. No source file was modified and no tests were run.

The companion endpoint catalogue from the preceding pass is not included here
and remains to be written up separately.

## Verdicts (10 endpoints)

One question per endpoint: does the handler compute its response from real
database rows, or does it fabricate, hardcode, or fall back to synthetic values?

| # | Endpoint | Real? | Fallback fields | Constant fields | Concern |
|---|---|---|---|---|---|
| 1 | `GET /admin/pilotage/targets/inscriptions` | **YES** | `departments[].inscriptionTarget` (`?? null`, `pilotage.service.ts:680`) — null, not fake 0 | none | None. 3 real queries; unset targets surface as `null` / `mode:'UNSET'`, never as 0. |
| 2 | `GET /admin/pilotage/coverage` | **MOSTLY** | `central`, `unassigned`, `nullEntityType`, and every `departments[].registered/registeredInYear/pendingApproval/pendingReview/complementsRequested` via `?? emptyCounts()` (`:156`, `:164`, `:166`, `:167`, `:174`) | the five `0` literals in `emptyCounts()` (`pilotage-coverage.ts:27-35`) | A department with no companies is indistinguishable in the payload from a real measured 0 — though counts are computed over the full unpaginated `company.findMany`, so zeros do reflect real absence. |
| 3 | `GET /admin/pilotage/campaigns/:id/quotas` | **YES** | `departments[].submissionTarget` (`?? null`, `:680`) | none | None. 4 real queries; 404s on a bad campaign id rather than returning a stub envelope. |
| 4 | `GET /admin/pilotage/campaigns/:id/returns` | **MOSTLY** | `registeredStock` (`?? 0` `:318`, `:390`, `:426`, `:434`); `received/approved/onTime/late` (`?? {received:0,…}` `:340`, `:389`, `:425`, `:433`); `central.quota` (`?? null` `:427`); **`totals.quota` = `(a.quota ?? 0) + (b.quota ?? 0)`** (`pilotage-returns.ts:108`) | zero literals in `emptyMetrics()` (`pilotage-returns.ts:61-74`); the four `0`s in the `BucketCounts` seed (`:340`) | National `totals.quota` treats a region with no quota set as quota 0 → denominator understates, `totals.quotaRate` overstates. `unassigned` is dropped from totals when `received===0` while `central` is always included (`:442-443`), so `totals.registeredStock` != sum of parts. `gap` is clamped at 0, hiding over-performance. |
| 5 | `GET /admin/questionnaires/pilotage/queues` | **YES** | `statusCounts.*` — zero-seeded 4-key object then overwritten by groupBy (`eligibility-engine.service.ts:301-308`) | only the 4 status keys of that seed | 7 real aggregates, no `?? 0`, no try/catch. But `blockingAnomaliesCount` reads `onefopAnomaly`, which is backfilled from legacy `flags` JSON only behind a global `if (totalExisting === 0)` guard (`:825`) — once any anomaly row exists the backfill never runs again, so the count can permanently under-report and look like a real low number. |
| 6 | `GET /admin/questionnaires/quality/summary` | **MOSTLY** | `byRegion[].region` → `'Non assigné'` for null/blank/whitespace (`:458`); `regionMap.get(reg) \|\| 0` accumulator (`:459`) | rule-family whitelist `['COHERENCE','VT_COHERENCE','ARITHMETIC']` (`:374`) drives `coherenceRate`; clamp literals `Math.max(0,…)` / `Math.min(100,…)` (`:432-448`) | All 5 rates correctly return `null` on 0 submissions — honest. But `coherenceRate` depends on a hardcoded family list in which `'ARITHMETIC'` is dead (no writer emits it), so any new family is silently invisible to it; clamping to `100` would mask an inconsistent count relation rather than surface it. Same anomaly-backfill exposure as #5. |
| 7 | `GET /audit/actor-summary` | **MOSTLY** | `coverage.target` / `coverage.current` / `coverage.percent` — zero-filled per reference department in PilotageService (`?? emptyCounts()`, `pilotage.service.ts:174`) then summed | `{ role: 'SUPER_ADMIN' }` scope literal (`actor-summary.service.ts:320`); `STALE_AFTER_DAYS = 7` (`:25`); `'30d'` default (`:169`, `:376`) | Per-admin numbers are real aggregates and absences are `null` not 0. But `coverage.*` is read through a hardcoded national `getCoverage({role:'SUPER_ADMIN'})` that bypasses `territoryWhere` and ignores the `period` filter, so it can disagree with the rest of the row. |
| 8 | `GET /companies/stats` | **YES** | none — no `?? 0`, `\|\| 0`, `\|\| []`, no try/catch in the method | none | No fabrication, but `suspended` (`isActive:false, status not PENDING_APPROVAL`) fully contains `rejected` → double count; `UNDER_REVIEW`/`DRAFT`/`DOCUMENTS_INCOMPLETE` that are still active land in no bucket. Buckets neither sum to nor are disjoint within `total`. `active` also differs from Pilotage's "registered" (which additionally requires `establishmentId`). |
| 9 | `GET /data-management/stats` | **MOSTLY** | none that fabricate counts (`{}` from an empty groupBy reduce is a legitimate empty map) | `generatedAt: new Date()` (server clock, `:629`) | `totals.users` bypasses `territoryWhere` (`:586-588`): a REGIONAL_ADMIN with a blank region gets the unscoped national user count while every other total fails closed to 0 — an internally contradictory payload. Also case-sensitive there while all other counts use `mode:'insensitive'`. Separately, `territoryWhere` emits `regionId`, a column `Declaration` does not have → Prisma validation error (500) for any regional admin with `regionId` set. |
| 10 | `GET /auth/me/notifications/unread-count` | **YES** | none | none | None. Single `userNotification.count({ userId, readAt: null })`; `{count:0}` is a genuine zero and the filter cannot be widened by the caller. |

### Corrections to the brief

- `getCampaignQuotas` is at `pilotage.controller.ts:49`, `getCampaignReturns` at
  `:55` (the brief listed both as `:55`).

### Fact tables

Neither `onefopFactRecruitment` nor `onefopFactSkillNeeds` is read by any of the
10 endpoints. `data-management.service.ts:308-311` explicitly documents them as
permanently empty (no ETL path writes to them) and excludes them from export
sheets.

## Findings ranked by severity

Endpoints returning fabricated zeros when the database is empty, ranked by how
convincingly the zero impersonates a measurement.

1. **#4 `/admin/pilotage/campaigns/:id/returns`** — the worst case, and it
   misleads even when the database is *not* empty. `totals.quota` sums `?? 0`
   over quota-less regions, so a partial sum is presented as the national quota
   and `quotaRate` is computed against it. For non-national scopes with no data,
   `totals = emptyMetrics()` emits an all-zero object that is shape-identical to
   a measured one.
2. **#9 `/data-management/stats`** — not an empty-DB problem but the same class
   of harm: `totals.users` returns a real *national* count next to
   territory-scoped zeros. The zeros are honest; the one non-zero field is the
   fabrication, which is more deceptive than the reverse.
3. **#5 / #6 questionnaire endpoints** — `blockingAnomaliesCount`,
   `warningsCount`, `anomalyRate` and `coherenceRate` can report
   low-but-plausible numbers because the legacy anomaly backfill is gated on a
   global `totalExisting === 0`. This is under-reporting of real data rather
   than an empty-DB zero, and there is no signal in the payload that the
   backfill never ran.
4. **#2 `/admin/pilotage/coverage`** and **#7 `/audit/actor-summary`'s
   `coverage.*`** — both zero-fill per reference department via
   `emptyCounts()`. Arithmetically defensible (a sum over nothing is 0, and the
   underlying query is unpaginated), but the payload cannot distinguish "no
   establishments here" from "measured zero". #7 compounds it by sourcing those
   figures from a hardcoded national scope.

Honest empty states: **#1**, **#3** (`null` + `mode:'UNSET'`), **#8**, **#10**
(true counts of zero rows), and **#6's rate fields** (explicit `null` when
`totalSubmissions === 0`).

Caveat spanning #8 and #9: a REGIONAL_ADMIN with an unassigned region hits
`territoryWhere`'s `NO_ROWS` and receives all-zero counts indistinguishable
from "nothing in my region" — a misconfigured account looks like an empty
territory.

## Deferred to a fix branch

- `/data-management/stats` 500 on `regionId` (investigate `territoryWhere` scope)
- `/admin/pilotage/campaigns/:id/returns` quota math
- `/audit/actor-summary` coverage scope
- `/admin/questionnaires` anomaly backfill gate
- `/companies/stats` bucket overlap
