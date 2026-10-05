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
- Reinstate the type check in getDataStats (remove `const where: any`) or type territoryWhere's return against the accepting models — the current signature makes this whole class of bug invisible.

## Correction — 2026-10-04

Scope: endpoint #9, `GET /data-management/stats`, and only the `territoryWhere`
shape claim in it. The original finding above is left as written; everything it
says about `totals.users` bypassing `territoryWhere` stands and is unaffected by
this correction.

The follow-up investigation is a full audit of every `territoryWhere` caller
against the generated Prisma `*WhereInput` types, and it supersedes this
document on the points below. Treat it as the source of truth for the
`territoryWhere` shape analysis; what follows is its summary.

### What the original finding got wrong

The trigger condition as written — "`territoryWhere` emits `regionId`, a column
`Declaration` does not have → Prisma validation error (500) for any regional
admin with `regionId` set" — is inaccurate in its second half.

**There is no `User.regionId` column.** `model User` declares `region`,
`department` and `subdivision` as nullable strings and no `*Id` columns at all;
no migration under `prisma/migrations/` adds one. `territoryFromUser`
(`src/auth/territory.ts:61-69`) therefore reads `user?.regionId ?? null` off an
object that can never carry it, and the `regionId` branch at `territory.ts:108`
is dead on every HTTP path. A regional admin "with `regionId` set" is not a
reachable state.

### The endpoint does NOT 500 today

What a `REGIONAL_ADMIN` actually receives from `territoryWhere` is either
`{ region: { equals, mode: 'insensitive' } }` or `NO_ROWS` = `{ id: { in: [] } }`.
Both are valid against `DeclarationWhereInput`, which accepts `id`, `region` and
`division`. No role that can reach this route produces a shape `Declaration`
rejects.

### The shape mismatch is real, and the break-in path is `department`

`getDataStats` (`src/data-management/data-management.service.ts:572-607`) builds
one `where` from `territoryWhere` and hands the same object to six queries
across three models. `Company` and `OnefopSubmission` declare all six territory
columns; `Declaration` declares only `region` (and names its second tier
`division`, not `department`). So `regionId`, `departmentId` and `department`
are all invalid there. It is the only caller of `territoryWhere` whose target
model is shape-incompatible — every other caller queries `Company` or
`OnefopSubmission`, and `pilotage-scope.ts` never passes the object to Prisma.

Three independent gates keep this latent:

| Gate | Where | Effect |
|---|---|---|
| G1 | `model User` has no `regionId`/`departmentId` | the id branches never fire |
| G2 | `jwt.strategy.ts:155-163` returns only `{id, email, role, region, department, status, isActive}` | `req.user` carries no `*Id` even if G1 were lifted |
| G3 | `@Roles(SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN)` on `data-management.controller.ts:55`, enforced by `roles.guard.ts:36` | `DIVISIONAL_ADMIN` is refused before the handler, so the `{region, department}` branch never reaches `Declaration` |

The realistic break-in path is **G3, via the `department` key, not `regionId`**.
Adding `DIVISIONAL_ADMIN` to that `@Roles` list is an ordinary one-line parity
change — the role is already on `/companies/stats` through `DIRECTORY_ROLES` and
on every `admin-questionnaires` route — and it makes the endpoint a live 500 on
`Unknown argument 'department'`, with `regionId` playing no part. Lifting G1/G2
by resolving staff accounts to canonical territory ids would separately make it
a live 500 on `regionId`; that machinery already exists for `Company`
(`resolveAndValidateTerritory`), and `pilotage-scope.ts` exists specifically to
compensate for its absence on staff accounts.

None of these three gates is documented as load-bearing for this, and
`getDataStats` declares `const where: any`, which erases the mismatch at compile
time. That is the actual defect: not a live 500, but a shape contract held only
by coincidence and invisible to the type checker.

## Correction — 2026-10-04 (finding #7, actor-summary coverage scope)

Re-verified 2026-10-05, in the session that committed the other three audit
fixes (`fix(backend): correct three data-integrity defects from the 2026-10-04
audit`). Finding #7 was queued in "Deferred to a fix branch" as
*`/audit/actor-summary` coverage scope*. **That half of the finding is
misstated: the code was already correct, and no fix was applied.** The second
half — the `period` mismatch — is real and remains open. The distinction
matters, because the queued item named only the scope.

### What the finding got wrong

The row reads: *"`coverage.*` is read through a hardcoded national
`getCoverage({role:'SUPER_ADMIN'})` that bypasses `territoryWhere`"*, and
finding 4 adds that #7 *"compounds it by sourcing those figures from a
hardcoded national scope"*.

The literal is really there — `actor-summary.service.ts:320` does pass
`{ role: 'SUPER_ADMIN' }`. But that is the scope of **one fetch**, not the scope
of the **values reported per row**. `loadCoverage` reads the national coverage
set once per request; `coverageFor(user, coverage)` then indexes it by each
listed admin's own ressort:

- `REGIONAL_ADMIN` → that admin's region row (`inscriptionTarget`,
  `registered`, `rate`)
- `DIVISIONAL_ADMIN` → that admin's department row within its region
- no name match, or no target set → `{target: null, current: null,
  percent: null}`, which the page renders as "—" rather than a false zero

So `coverage.target` / `current` / `percent` are already per-actor. Reading them
as national conflated the fetch with the figure. Three tests in
`actor-summary.service.spec.ts` already pin this behaviour (region match is
case-insensitive, department wins for a divisional admin, unknown ressort gives
nulls), and the intent is documented in the method comment at
`actor-summary.service.ts:311-316`.

Applying the queued "fix" would have scoped the fetch to the caller and changed
nothing about the reported numbers, while breaking the single-read design that
keeps the dashboard in agreement with `/admin/cibles`.

### Nor is the national fetch a disclosure

`loadMonitoredUsers` constrains a `REGIONAL_ADMIN` caller to
`region = <own region>` before any aggregation, so `coverageFor` can only ever
resolve a territory that caller is already entitled to see. The national read is
internal: the caller's own scope is applied to *which admins are listed*, not to
the figures about them.

### Still open: `coverage.*` ignores `period`

The other claim in the row is correct and is **not** fixed.
`loadCoverage` derives its year from the clock — the Douala calendar year — and
passes that to `getCoverage`, so `coverage.*` is always year-to-date while
`field.*` and `processing.*` honour the `period` query parameter (`7d`, `30d`,
`90d`, `12m`). A row viewed at `period=7d` therefore mixes a 7-day field count
with a year-to-date coverage percentage, with nothing in the payload saying so.

That is a presentation-level inconsistency rather than a wrong number — the
coverage figure is a correct year-to-date one — but it is a real finding and
should keep its place in the queue, restated as *"actor-summary coverage ignores
the period filter"* rather than as a scope defect. The zero-fill concern in
finding 4 (a reference department with no establishments is indistinguishable
from a measured zero) also stands; it originates in `PilotageService`, not here.
