# TERRITORIAL AUTHORIZATION & AUDIT HARDENING REPORT

**Date:** 2026-10-03
**Branch:** `feat/territorial-supervision` @ `ace4cc85` (preserved; not rebased, not merged, `master` untouched)
**Mode:** read-only audit. No application code, Prisma schema, migration or test was modified.
**Database access:** none, and none permitted. `prisma validate` ran with a placeholder `DATABASE_URL`.
**Predecessor:** `docs/audit/territorial-supervision-2026-10-02.md` (same branch). This report deepens
its T-2, Z-1, Z-2, S-1, S-2, S-3 and R-2 findings into an implementable design.

### Working-tree notice — [EXISTING FACT]

The working tree contains **uncommitted third-party work in progress** that is not mine and that I left
completely untouched: the 331→360 arrondissements change (`prisma/seed.ts`,
`scripts/populate-subdivision-codes.ts`, `react-web/src/components/onefop/vt-cameroon-admin-data.ts`,
`lib/screens/onefop/wizard/vt_cameroon_admin_data.dart`, `test/vt_wizard_ux_ameliorations_test.dart`,
plus untracked `src/territory/cameroon-hierarchy-360.ts`,
`src/territory/arrondissements-reference.spec.ts`, `docs/reference/arrondissements-mapping.csv` and
migration `20261003120000_replace_arrondissements_to_360`). Nothing was reset, stashed, cleaned,
reverted or discarded.

All verification in §15 therefore ran against a tree containing that work. Its own new suite
(`arrondissements-reference.spec.ts`, 6 tests) passes. My committed files are byte-identical to `HEAD`
(`git diff HEAD` empty for them).

---

## 1. Current authorization architecture — [EXISTING FACT]

Three guards, applied in order at class level on admin controllers:

| Guard | File | Role |
|---|---|---|
| `JwtAuthGuard` | `src/auth/jwt-auth.guard.ts` | authenticates; `jwt.strategy.ts` reloads the account per request and refuses `purpose`-claim tokens |
| `RolesGuard` | `src/auth/roles.guard.ts` | maintenance-mode gate (SUPER_ADMIN exempt), then `requiredRoles.some(r => user.role === r)` |
| `ActiveCompanyGuard` | `src/auth/active-company.guard.ts` | company account status; `@AllowInactiveCompany` exemptions pinned by `active-company.completeness.spec.ts` |

**`RolesGuard` decides *whether* a role may call a route. It does not and cannot decide *which rows*
that call returns.** Row-level territorial scope is entirely the service layer's job, applied per query.
There is no interceptor, no Prisma middleware and no global row-level filter. Consequently **every
service method that forgets to apply scope leaks nationally, silently, with no guard error.** That is the
root cause of every finding in §3.

Role source: `User.role` (`enum UserRole`, 11 values), carried on the JWT and re-read per request.
Central administration is `CENTRAL` — [EXISTING FACT], no new role is needed anywhere in this report.

## 2. Territorial scope architecture — [EXISTING FACT]

### 2.1 Where a user's territory comes from

`User.region` / `User.department` / `User.subdivision` are **`String?` name columns**
(`prisma/schema.prisma:131-133`) — *not* foreign keys. Every data table uses FK ids
(`Company`, `Establishment`, `OnefopSubmission` all carry `regionId`/`departmentId`/`subdivisionId`).
A live JWT user therefore has **no `regionId`**, only a name. `territoryFromUser` (`src/auth/territory.ts:55`)
carries both shapes (`region`, `department`, `regionId`, `departmentId`) so callers can use whichever is
populated. Migrations `20260929180000` / `20260929181000` make a region mandatory at DB level for
DIVISIONAL and REGIONAL accounts.

### 2.2 The two enforcement primitives

**`territoryWhere(territory)`** (`territory.ts:79` → `territoryWhereWithRoles:92`) returns a Prisma
`where` fragment:

| Actor | Returns |
|---|---|
| `undefined` / `null` (internal call, no actor) | `{}` — unrestricted |
| `SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`, `CENTRAL` | `{}` — national |
| `REGIONAL` with `regionId` | `{ regionId }` |
| `REGIONAL` with name only | `{ region: { equals, mode: 'insensitive' } }` |
| `REGIONAL` with neither | `NO_ROWS` = `{ id: { in: [] } }` |
| `DIVISIONAL` with `departmentId` | `{ departmentId }` |
| `DIVISIONAL` with names | `{ region: …, department: … }` (both, because department names repeat across regions) |
| `DIVISIONAL` with neither | `NO_ROWS` |
| any other role | `NO_ROWS` |

**It fails closed.** An unknown role or an unassigned delegate matches nothing rather than falling
through to an unscoped query. `territoryWhereForExport` is a deliberately separate variant
(`EXPORT_NATIONAL_ROLES`) so export breadth cannot leak into write authority.

**`assertTerritorialAuthority(actor, target)`** (`territory.ts:119`) throws `ForbiddenException` for
write paths. Used by registration approval, anomaly resolution and staff scope.

`resolveTargetScope` (`src/pilotage/pilotage-scope.ts:19`) bridges §2.1's asymmetry for the target
tables by resolving a name to an id via a **sole-match** lookup, returning `none` on ambiguity.

### 2.3 The structural limitation that drives this report — [EXISTING FACT]

`territoryWhere` returns keys named `regionId` / `departmentId` / `region` / `department`. It can be
applied **directly** only to a table that carries those columns. Of the tables in scope:

| Table | Carries territory columns? | Scopable directly? |
|---|---|---|
| `OnefopSubmission` | yes (`regionId`, `departmentId`, `region`, `department`) | **yes** |
| `Company` | yes | **yes** |
| `Establishment` | yes, and **non-nullable** (`schema.prisma:355-362`) | **yes** |
| `CampaignSubmission` | **no** — only `campaignId`, `companyId?`, `establishmentId` | no — must nest |
| `AuditLog` | **no** — only `userId`, `resourceType`, `resourceId` | no — see §4 |

## 3. Campaign endpoint audit

Controller: `src/campaign/campaign.controller.ts`, `@Controller('campaigns')`,
`@UseGuards(JwtAuthGuard, RolesGuard, ActiveCompanyGuard)`.

**Role grants — [EXISTING FACT]:** the four read routes below grant
`SUPER_ADMIN, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP, CENTRAL, REGIONAL`. **`DIVISIONAL` is granted none
of them**, so a divisional supervision view has no campaign data at all today.

I found **four** leaks, not the two the predecessor report named.

### 3.1 `GET /campaigns/:id/progress`

- **CURRENT BEHAVIOR** — [EXISTING FACT]: returns national roster counts to any permitted role,
  including REGIONAL. No territory is passed or applied.
- **EXPECTED BEHAVIOR**: CENTRAL national; REGIONAL its region; DIVISIONAL its department.
- **EXACT CODE PATH**: `campaign.controller.ts:99-103` `getProgress(@Param('id') id)` — note it does not
  even take `@Req()` → `campaign.service.ts:456` `getCampaignProgress(campaignId)` →
  `prisma.campaignSubmission.groupBy({ by: ['status'], where: { campaignId } })` → `_buildProgress`
  (`:731`), which computes `total`, `submitted`, `notStarted`, `inProgress`, `completionRate` and
  `byStatus`.
- **REQUIRED CHANGE** — [PROPOSED]: accept `@Req()`, pass `territoryFromUser(req.user)`, and add
  `establishment: territoryWhere(territory)` to the `groupBy` `where`. See §9.1 for why nesting works.

### 3.2 `GET /campaigns/:id/submissions`

- **CURRENT BEHAVIOR** — [EXISTING FACT]: returns the **full national roster** of `CampaignSubmission`
  rows (no `take`), each joined to campaign name/code.
- **EXPECTED BEHAVIOR**: as above, plus the caller's optional `region` narrowing honoured.
- **EXACT CODE PATH**: `campaign.controller.ts:105-109` →
  `campaign.service.ts:465` `getCampaignSubmissions(campaignId, filters: { status?: string; region?: string })`
  → `const where: any = { campaignId }; if (filters.status) where.status = filters.status;` →
  `findMany({ where, include: { campaign: {...} }, orderBy: { submittedAt: 'desc' } })`.
- **The `region` parameter** — [EXISTING FACT]: it is **declared in the signature's filter type and never
  read**. The controller does not even accept a `region` query param, so no caller can set it today; it
  is dead in two places at once.
- **REQUIRED CHANGE** — [PROPOSED]: **do not remove or rename it.** Promote it to the established
  "filter can only narrow" pattern already used by `listCompanyRegistrations`
  (`auth.service.ts:1064-1113`): enforced scope comes from the actor, the caller's `region` is
  intersected with it, and a `region` outside the actor's scope narrows to nothing rather than widening.
  Wire the controller's `@Query('region')` through at the same time.

### 3.3 `GET /campaigns/:id` — newly found

- **CURRENT BEHAVIOR** — [EXISTING FACT]: `getCampaign(id)` applies **no territory and no
  `targetRegions` check**, and `include`s `submissions: { take: 20, orderBy: { submittedAt: 'desc' } }`
  — twenty national roster rows. A REGIONAL user can also fetch a campaign that does not target their
  region at all, which `GET /campaigns` would have hidden from them (§3.4).
- **EXPECTED BEHAVIOR**: scope the embedded `submissions`; decide whether a non-targeted campaign's
  metadata is readable (see §14.3).
- **EXACT CODE PATH**: `campaign.controller.ts:51-55` → `campaign.service.ts:209-221`.
- **REQUIRED CHANGE** — [PROPOSED]: scope the nested `submissions` include with
  `where: { establishment: territoryWhere(territory) }`.

### 3.4 `GET /campaigns` — newly found

- **CURRENT BEHAVIOR** — [EXISTING FACT]: campaign **rows** are filtered for REGIONAL by
  `targetRegions` (`campaign.service.ts:156-164`: `isEmpty` OR `has user.region`). That is campaign
  *targeting*, not data scope — it decides which campaigns are visible, not which submissions count.
  The per-campaign figures attached to each row are national:
  - `_count: { select: { submissions: true } }` (`:169`) — unscoped;
  - `progress` from `campaignSubmission.groupBy({ by: ['campaignId','status'], where: { campaignId: { in: campaignIds } } })`
    (`:190-194`) — unscoped, then mapped onto every campaign (`:197-206`).
- **IMPACT**: a REGIONAL delegate's campaign list shows **national** `total`, `submitted`, `notStarted`
  and `completionRate` per campaign. This is the most visible of the four, because
  `/admin/pilotage`'s campaign card renders `campaign.progress.total` and `progress.submitted`
  (`react-web/src/app/admin/pilotage/page.tsx:106-110`) directly as the campaign attainment rate.
- **EXACT CODE PATH**: `campaign.controller.ts:23-30` → `campaign.service.ts:151-207`.
- **REQUIRED CHANGE** — [PROPOSED]: scope both the `_count` and the `groupBy` with
  `establishment: territoryWhere(territory)`. Keep the `targetRegions` row filter unchanged — it answers
  a different question and its "empty means all regions" comment records a real past bug.

### 3.5 Does campaign access change territorial scope? — [EXISTING FACT]

**No.** `targetRegions` / `targetDepartments` on `DataCampaign` (`schema.prisma:600-602`) express which
territories a campaign *addresses*. They are not an authorization grant and must not be used as one: a
campaign targeting all regions (`targetRegions: []`) would otherwise widen every delegate to national.
Scope must continue to come from the actor, intersected with the campaign's targeting at most as a
display filter.

### 3.6 Legitimate exceptions — [EXISTING FACT] / [ASSUMPTION]

- `SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`, `CENTRAL` are national by design (`NATIONAL_ROLES`). [EXISTING FACT]
- `SUPER_ADMIN_DSMO` is granted these campaign routes but is **not** in `NATIONAL_ROLES`, so under
  `territoryWhere` it would resolve to `NO_ROWS` and see nothing. [EXISTING FACT] — this is a real
  behaviour decision, see §14.2.
- `DATA_MANAGER` / `ANALYST` are national for exports only (`EXPORT_NATIONAL_ROLES`) and are not granted
  these routes. [EXISTING FACT]
- [ASSUMPTION] Campaign *write* routes (create/activate/pause/close/archive/extend/remind) are national
  administrative acts and need no territorial scoping; they are already restricted to
  CENTRAL + super-admins and exclude REGIONAL. I did not change that view, but it is worth confirming.

## 4. Audit endpoint audit

### 4.1 Current state — [EXISTING FACT]

`GET /audit/reports` — `src/report/audit.controller.ts:16-47`.

- **Roles:** `@Roles(SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR)`. **CENTRAL is excluded**, as are
  REGIONAL and DIVISIONAL. The frontend mirrors this (`react-web/src/app/admin/_routes.ts:179`,
  `AUDIT_LOG_ROLES`; `journal-audit/page.tsx:23`).
- **Territorial scope:** **none at all.** `buildAuditLogWhere`
  (`src/report/audit-log-filter.ts:62-80`) builds only `timestamp`, `action`, `resourceType`,
  `resourceId` (contains) and `actor` (name/email contains) — no territory dimension exists.
  `getAuditLog` (`report.service.ts:607`) and `getAuditLogPage` (`:621`) pass that `where` straight
  through; the page and its `total` share one `where` so paging is consistent.
- **`audit-log-filter.spec.ts:43`** explicitly pins the current contract: *"selects every row when no
  filter is set."* Adding scope changes that asserted contract deliberately.

### 4.2 Available fields — [EXISTING FACT]

`AuditLog` (`schema.prisma:557-581`): `id`, `userId` (FK → `User`), `declarationId?`, `action`,
`resourceType`, `resourceId`, `details Json?`, `previousValue String?`, `newValue String?`, `timestamp`,
`createdAt`, `reportId?`, `ipAddress?`, `userAgent?`. Indexed on `userId`, `declarationId`, `timestamp`,
`action`, `reportId`.

| Requested field | Present? | Detail |
|---|---|---|
| Actor identity | **yes** | `userId` FK; both read methods `include` user `id/email/firstName/lastName/role` |
| Timestamps | **yes** | `timestamp` (indexed, sort key) + `createdAt` |
| Entity affected | **partial** | `resourceType` + `resourceId` — a **bare string, no FK, polymorphic, and not always a real id** (§4.4) |
| Old / new values | **partial** | `previousValue` / `newValue` are `String?` scalars — fine for a target number, not for a row diff; registration diffs go in `details` instead |
| Reason fields | **partial** | not a column; carried inside `details` (e.g. `details.comments` for `AUDIT_CORRECTION`, `details.reason` for `AUDIT_BULK_REJECT`) |
| Campaign association | **no** | no `campaignId` column; present only inside `details` for target/quota writes |
| Region association | **no** | no column |
| Department association | **no** | no column |

### 4.3 Action inventory — [EXISTING FACT]

**22 distinct actions**, not the 14 the predecessor report counted (it missed the eight pilotage
target/quota actions, `PilotageAuditAction` at `src/pilotage/pilotage.service.ts:49-58`).

### 4.4 Territorial resolvability — the decisive finding

For each action family, can a row's territory be derived today?

| Family | `resourceType` | `resourceId` | Territory derivable? | Route |
|---|---|---|---|---|
| `COMPANY_REGISTRATION_APPROVED` / `_REJECTED` / `_COMPLEMENTS_REQUESTED`, `STAFF_REGISTRATION_REJECTED` | `User` | real user id | **yes** | join `User` → `Company.regionId/departmentId` |
| `COMPANY_REGISTRATION_RESUBMITTED` | `User` | **`actorId`**, i.e. the actor, not a separate resource | yes (actor *is* the company user) | same join |
| `USER_TERRITORY_CHANGED` | `User` | real user id | **yes, but moving** | the row records the territory change itself — see §8.5 |
| `AUDIT_APPROVE` / `AUDIT_REJECT` / `AUDIT_CORRECTION` | `OnefopSubmission` | real submission id | **yes** | join `OnefopSubmission.regionId/departmentId` |
| `ANOMALY_RESOLVED` / `ANOMALY_WAIVED` | `OnefopAnomaly` | real anomaly id | **yes** | join `OnefopAnomaly.submission` |
| `AUDIT_BULK_VISA_GRANTED` / `AUDIT_BULK_REJECT` | `OnefopSubmission` | **`BULK_<Date.now()>`** — synthetic | **NO** | nothing to join (`eligibility-engine.service.ts:463`, `:593`) |
| `AUDIT_LIST_EXPORT` | `OnefopSubmission` | **`EXPORT_<Date.now()>`** — synthetic | **NO** | nothing to join (`questionnaires.service.ts:3482`) |
| 4 territorial target/quota actions | `TerritoryTarget` / `CampaignQuota` | real row id | **yes, two ways** | join the row, or read `details.regionId` / `details.departmentId` (`pilotage.service.ts:598`) |
| 4 central target/quota actions | `Central*` | real row id | **N/A by design** | central is not a region |

**Three consequences — [EXISTING FACT]:**

1. **Join-based territorial scoping is impossible for bulk and export rows.** Their `resourceId` is a
   timestamp sentinel. A fail-closed scoped query would make every bulk visa, bulk reject and every data
   export **invisible** to REGIONAL and DIVISIONAL — and exports are the highest-sensitivity action in
   the system. A fail-open one would leak them nationally. Neither may be chosen silently.
2. **A bulk row has no single territory.** `details.approvedIds` / `details.rejectedIds` list the
   affected submissions, which may span several departments and regions. "Is this row in scope?" has no
   single answer, and a scoped view must decide whether to show the row when *any* of its submissions is
   in scope, and whether to redact the out-of-scope ids inside `details`.
3. **`details` is a `Json?` column.** Territory held only inside it cannot be filtered, counted or
   paginated correctly by Prisma. `getAuditLogPage` depends on `where` for both `findMany` and `count`;
   post-filtering in JS would break `total` and therefore paging.

### 4.5 Required change — [PROPOSED], gated

**Do not add `CENTRAL` to `@Roles` alone.** That is the one change that is both trivial and wrong: it
would hand a national audit trail to a role whose scope is national (acceptable) via a route with no
scoping at all, and would set the precedent for adding REGIONAL/DIVISIONAL the same way (not
acceptable). The order must be: **scope first, widen second.**

Two-stage design:

- **Stage A — scope the route.** Add an actor-derived territorial predicate to `buildAuditLogWhere`,
  built from the join-resolvable families in §4.4, and give the unresolvable families (bulk, export) an
  explicit, documented disposition (§14.4).
- **Stage B — widen roles** once Stage A exists: `CENTRAL` national; `REGIONAL` region-scoped;
  `DIVISIONAL` department-scoped; `SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`, `AUDITOR` **unchanged and
  unscoped** — their existing privileges are not weakened by anything in this report.

Stage A is only clean once `AuditLog` carries territory (§12.1). Without it, Stage A is a
polymorphic multi-join whose cost grows with the table and which still cannot resolve two families.

## 5. Dossier drill-down audit

Routes reachable from `/admin/pilotage` and `/admin/dossiers`:

| Route | Backend | Territorially scoped? |
|---|---|---|
| `/admin/pilotage` | `GET /admin/questionnaires/pilotage/queues` | **yes** — `territoryWhere` on every count (`eligibility-engine.service.ts:216`) |
| `/admin/dossiers` | `GET /admin/questionnaires?…` | **yes** — `buildAdminListWhere(filters, territory)`, server-side, drafts excluded, `total` matches the filtered query |
| `/admin/dossiers/[id]` | `GET /admin/questionnaires/:id` | **yes** — `getById` uses `findFirst({ where: { id, ...territoryWhere(territory) } })` and reports an out-of-territory row as **404, not 403** (no existence leak), `questionnaires.service.ts:3168-3173` |
| `/admin/dossiers/[id]` diagnostic | `GET /admin/questionnaires/:id/diagnostic` | **yes** — `evaluateDossier(id, territoryFromUser(req.user))` |
| review actions | `PATCH :id/{approve,reject,request-correction}` | **yes** — all take territory |
| `/admin/files-attente` | queues + `anomalies/registry` | **yes** — `where.submission = territoryWhere(territory)` |
| `/admin/centre-qualite` | `anomalies/registry` | **yes** for the registry; the dashboard blocks are fabricated (§6) |
| `/admin/etablissement-detail` | company directory | see §6.3 |

**The dossier drill-down's authorization is sound** — [EXISTING FACT]. The 404-not-403 choice is
correct and should be preserved. Its problem is not authorization; it is **trustworthiness** (§6).

## 6. Fabricated-data findings

A repository-wide sweep of `react-web/src/app/admin/` and `src/components/admin/`. **Twelve pages**
contain fabricated administrative facts. Three distinct patterns, in increasing severity:

- **(a) Unconditional** — fabricated content is always rendered.
- **(b) Fallback on empty-or-failed** — real API result replaced by fiction when empty or on error. The
  most dangerous, because it fires exactly when the truth is "nothing" or "forbidden".
- **(c) Injected into real records** — real rows from the API decorated with invented fields. The worst,
  because the surrounding record is genuine and so the invention inherits its credibility.

### 6.1 Pattern (c) — invented performance figures attached to real, named civil servants

`react-web/src/app/admin/utilisateurs/page.tsx:175-194` — [EXISTING FACT]

Real users from the API are mapped, and each is given:

```
fiches:     200 + (idx * 37) % 250     // invented dossier throughput
taux:       65  + (idx * 7)  % 32      // invented completion / performance rate
lastAccess: idx % 2 === 0 ? "Il y a 10 min" : "Hier"
region:     u.region || "Centre"       // invented territorial assignment
tags:       ["Entreprises", "Coopératives"]
```

`fiches` and `taux` are **derived from the array index** — they are not approximations, they are
arithmetic on list position, displayed next to a real person's real name and email. Any supervisor
reading this screen to assess an agent is reading fiction. This is simultaneously:

- the "opaque employee score" the brief forbids, with no derivation at all;
- a fabricated territorial assignment (`|| "Centre"`), which misattributes a real agent to a real region
  and therefore intersects §3;
- the fallback pattern too — when `summaryQuery` has no data the whole list becomes `DEFAULT_AGENTS`
  (`:34`), eight invented agents with hardcoded `taux` of 91, 86, 94, 72, 65, 79, 88, 83.

**This is the single most serious fabricated-data finding in the admin console.**

### 6.2 Pattern (b) — fiction on empty or failed results

| File | Line | Trigger | Fabricated content |
|---|---|---|---|
| `centre-qualite/page.tsx` | `222` | `rawItems.length > 0 ? rawItems : CANONICAL_FALLBACK_ANOMALIES` | **an empty anomaly registry — i.e. good news — renders as fabricated anomalies** on real-looking dossiers (`ENT-2026-04521`, `ADM-2026-01043`, `COP-2026-00214`) |
| `dossiers/page.tsx` | `387` | no page data | `FIGMA_DOSSIERS` (`:36`) — 5 invented dossiers incl. "SABC S.A." / "Jean-Paul Mbarga" |
| `dossiers/page.tsx` | `389` | `page?.total \|\| 12847` | **a fabricated national total of 12 847 dossiers** whenever the real total is 0 or absent |
| `journal-audit/page.tsx` | `257` | no audit data | `FIGMA_AUDIT_ITEMS` (`:38`) — **fabricated audit-trail entries**, actor "M. Ewane", on a legally significant screen |
| `utilisateurs/page.tsx` | `194` | no user data | `DEFAULT_AGENTS` |
| `etablissements/page.tsx` | `231` | no company data | `DEFAULT_SAMPLE_ETABLISSEMENTS` (`:77`) |

`journal-audit` deserves emphasis: it is the audit screen. Fabricated rows there are fabricated evidence.

### 6.3 Pattern (a) + (c) — `/admin/etablissement-detail`

`react-web/src/app/admin/etablissement-detail/page.tsx` — [EXISTING FACT]. The worst-structured case:

- `SABC_DEFAULT_COMPANY` (`:19`) is **spread as the base** of the rendered company (`:91`
  `{ ...SABC_DEFAULT_COMPANY, ...real }`), so **any field the API omits silently displays SABC's
  value** — a real employer's record showing another entity's data.
- Three **hardcoded user accounts** rendered unconditionally (`:372-464`): "Jean-Paul Mbarga",
  "Samuel Eto'o", "Marie Ndongo" — fabricated facts about who may access an employer's account.
- A fabricated approver: "Admin Central (M. Ewane)" / "M. Ewane (Admin)" at `:508`, `:546`, `:556`.
- `id || SABC_DEFAULT_COMPANY.registrationNumber` (`:97`) and `|| "SABC S.A."` in the breadcrumb and
  title (`:119-120`, `:188`, `:266`, `:578`).

### 6.4 Residual fabrications in `/admin/dossiers/[id]` — my earlier fix was incomplete

[EXISTING FACT] My commit `a421a845` removed the mock fallbacks, the hardcoded instruction history and
the fabricated correction pre-fill from this page. It **did not catch three literals**:

| Line | Content |
|---|---|
| `406` | `Soumis le {date} — Superviseur: Samuel Eto&apos;o (Région {region})` — **unconditional fabricated supervisor**, rendered beside a real submission date and region |
| `720` | `dossier.respondent?.respondentName \|\| "Jean-Paul Mbarga"` |
| `813` | `String(detail.companyName \|\| "SABC S.A. (Brasseries du Cameroun)")` |

Line 406 is the same class of defect as the instruction history I replaced, in the same file, and I
missed it. Stated plainly rather than filed quietly.

### 6.5 Remaining inventory

| File | Finding |
|---|---|
| `activite/page.tsx:12→160` | `DEFAULT_ACTIVITIES` — the entire "Activité & alertes" operational feed, **unconditional**, invented actors/times/regions |
| `centre-qualite/page.tsx` | `FIGMA_ANOMALIES_BY_TYPE` (`:86→532`), `FIGMA_ANOMALIES_BY_REGION` (`:96→583`), `FIGMA_RECENT_CONTROLS` (`:156→652`), `FIGMA_ACTIVE_RULES` (`:164→723`) — all unconditional; "Anomalies par région" is a fabricated territorial quality indicator |
| `parametres/page.tsx:54→630` | `INITIAL_RECENT_AUDIT` — unconditional fabricated audit extract |
| `diffusion/page.tsx:366` | `mockContent` — a fabricated SPSS `.sav` payload built client-side and offered as an official export |
| `components/admin/SendNotificationForm.tsx:41-42` | self-documented fake recipient estimate (hardcoded 12 or 148) |
| `etablissement-detail/approbation/page.tsx` | SABC literals |

### 6.6 Clean — [EXISTING FACT]

`/admin/pilotage` and `/admin/files-attente` contain **no** fabricated data: no numeric fallback, no
index-derived metric, no mock dataset. `/admin/pilotage`'s regional table honestly renders "—" for
columns it has no data for. These two are the model the others should follow.

### 6.7 Required change — [PROPOSED]

Per the brief: replace fabrication with real data where the backend supports it, and otherwise an
explicit empty state ("Aucun historique d'audit disponible.", "Aucune anomalie vérifiée enregistrée.").
Never a fictional record. §9.3 sequences this; §11 lists the files.

## 7. Correction workflow audit

Traced: anomaly → finding → correction request → instruction → declarant → resubmission → validation.

### 7.1 What the database actually stores — [EXISTING FACT]

| Link | Stored? | Evidence |
|---|---|---|
| anomaly → submission | **yes** | `OnefopAnomaly.submissionId` FK, `onDelete: Cascade`; `ruleCode`, `ruleFamily`, `severity`, `isBlocking`, `observedValue`, `expectedValue`, `deltaValue` |
| blocking anomaly blocks approval | **yes** | `assertCanApprove` refuses while blocking anomalies are OPEN (`eligibility-engine.service.ts:200-208`) |
| anomaly → correction request | **NO** | `requestCorrection(id, comments, …)` takes free text. No `anomalyId`, no join table, no array. The cited findings are not recorded. |
| correction instruction → stored | **yes, but shared** | `questionnaires.service.ts:3310` writes the instruction into **`OnefopSubmission.rejectionReason`** — the same column a rejection uses |
| correction request → audit | **yes** | `AUDIT_CORRECTION` with `details: { comments, previousStatus, certified }` |
| instruction → declarant | **yes** | status → `CORRECTION_REQUESTED`; `syncCampaignSubmissionOnReview(… 'IN_PROGRESS')` |
| resubmission → previous submission | **NO** | a corrected return lands as a **new `OnefopSubmission` row**; there is no `previousSubmissionId`. Only `(establishmentId, quarterCode)` + timestamps connect them |
| validation/rejection of the new row | **yes** | normal review path, audited |

### 7.2 The two broken links — [EXISTING FACT]

1. **finding → instruction.** Nothing records which anomalies a correction request was based on. The
   instruction is prose in a column shared with rejection motives. Asked "which verified finding caused
   this correction?", the database cannot answer — only `AuditLog.details.comments` preserves the prose.
   This is why the UI could not derive the instruction from real findings, and why it had a sample
   finding hardcoded instead (§6.4). My fix derives the *displayed* problem from
   `diag.blockingAnomalies` + `diag.warningAnomalies` at render time, which is correct and truthful, but
   that association is **not persisted** — reopen the dossier later and the link is gone.
2. **submission N → submission N+1.** The live-uniqueness partial index deliberately excludes
   `REJECTED` and `CORRECTION_REQUESTED` (`onefop_submissions_establishment_quarter_live_uidx`, migration
   `20261002180000:130-132`) precisely so a corrected return can land as a new row
   (`questionnaires.service.ts:1355-1366` documents this). But nothing links the two rows, so the
   correction history of an establishment for a quarter must be reconstructed by sorting on
   `(establishmentId, quarterCode, createdAt)` and inferring.

Consequence: **"corrections resolved" is not currently a measurable indicator**, because no stored
relation connects a resolved correction to the request that caused it. The predecessor report's §V-4
activity model depends on closing link 2.

### 7.3 A concrete defect found while tracing — [DECISION REQUIRED]

`questionnaires.service.ts:1369-1376`, the submit-time duplicate pre-check:

```
where: { companyId: resolvedCompanyId, quarterCode: …, status: { in: ['PENDING_REVIEW','APPROVED'] }, … }
```

It keys on **`companyId`**, while the DB partial unique index it is documented as guarding now keys on
**`establishmentId`** (changed by Phase E.1, migration `20261002180000`). For a multi-site company the
pre-check would wrongly reject the **second establishment's** return for the same quarter with
`ConflictException`, even though the index permits it.

Masked today by Phase E.1's one-principal-establishment-per-company invariant; it becomes a live
submission-blocking bug the moment secondary sites ship. Same Phase E.1 residue as the Axis-2 dedup
mismatch already fixed in `pilotage.service.ts`, in a different file. **Aligning it changes when a
submission is accepted, i.e. submission workflow behaviour — [DECISION REQUIRED] per Task 6.**

## 8. Security risks

Ranked by exploitability × impact. All are [EXISTING FACT].

| # | Risk | Severity | Notes |
|---|---|---|---|
| 8.1 | REGIONAL reads the **full national campaign roster** via `GET /campaigns/:id/submissions` | **High** | No scoping whatsoever; whole table for a campaign, no `take`. Needs only a valid REGIONAL token. |
| 8.2 | REGIONAL reads **national campaign progress** via `:id/progress` and via `GET /campaigns`' embedded `progress`/`_count` | **High** | Breaches CLAUDE.md §14. Surfaces on `/admin/pilotage`'s campaign card, so it is being read today, not hypothetically. |
| 8.3 | REGIONAL reads **20 national roster rows + non-targeted campaign metadata** via `GET /campaigns/:id` | Medium | §3.3 |
| 8.4 | **Audit trail unreadable by CENTRAL**, and unscoped for everyone who can read it | Medium | Not a leak to the wrong role today (its three roles are legitimately national), but it blocks supervisory accountability and makes any naive widening a leak. |
| 8.5 | `USER_TERRITORY_CHANGED` under future territorial audit scoping | Medium (design trap) | If audit rows are scoped by the subject's **current** territory, reassigning an agent out of a region makes the reassignment row vanish from that region's view — the one row a regional supervisor most needs. Scope such rows by **both** previous and new territory. |
| 8.6 | Bulk/export audit rows have **no resolvable territory** | Medium (design trap) | §4.4. Fail-closed hides exports; fail-open leaks them. |
| 8.7 | Fabricated performance figures on **real named agents** | **High (integrity, not confidentiality)** | §6.1. A supervisory decision taken on this data is taken on fiction. |
| 8.8 | Fabricated **audit entries** on `/admin/journal-audit` and `/admin/parametres` | High (integrity) | Fabricated evidence on the screens that exist to provide evidence. |
| 8.9 | Fabricated anomalies when the registry is **empty** | Medium (integrity) | §6.2. Inverts the meaning of a clean result. |
| 8.10 | `region: u.region \|\| "Centre"` | Low–Medium | Fabricated territorial attribution of a real agent. |

**Not a risk — verified sound:** dossier list/detail/diagnostic and review actions are all territorially
scoped; `getById` returns 404 (not 403) out of territory; anomaly resolution calls
`assertTerritorialAuthority`; `territoryWhere` fails closed on unknown/unassigned roles;
`LEGAL_DEROGATION` is restricted to CENTRAL + super-admins.

## 9. Proposed minimal changes

### 9.1 Campaign territorial scoping — [PROPOSED]

`CampaignSubmission` has no territory columns, but `Establishment` does, **non-nullable**
(`schema.prisma:355-362`), and `CampaignSubmission.establishmentId` is a non-nullable FK to it. So every
roster row has exactly one establishment with exactly one region and department — **no orphan row can
escape the filter**.

`territoryWhere`'s output keys (`regionId` / `departmentId` / `region` / `department`) match
`Establishment`'s columns exactly, so it nests verbatim:

```ts
// src/campaign/campaign-scope.ts  [PROPOSED]
export function campaignRosterWhere(territory?: Territory | null) {
  return { establishment: territoryWhere(territory) };
}
```

All three cases behave correctly: national → `{ establishment: {} }` (no-op);
region/department → the nested predicate; unassigned → `{ establishment: { id: { in: [] } } }` (matches
nothing, fails closed). **No new helper logic, no new semantics, no migration.**

Apply to: `getCampaignProgress` (`groupBy` where), `getCampaignSubmissions` (`findMany` where),
`getCampaign` (nested `submissions` include), `listCampaigns` (`_count` + the `groupBy`). Thread
`territoryFromUser(req.user)` from all four controller methods (two of which do not currently take
`@Req()`). Grant `DIVISIONAL` read access so the divisional view has data (§14.1).

For `getCampaignSubmissions`' `region` parameter: keep it, intersect it with enforced scope, and wire
`@Query('region')` through — the narrowing-only pattern of `listCompanyRegistrations`.

### 9.2 Audit scoping — [PROPOSED], gated on §12.1

Stage A then Stage B per §4.5. Recommended shape once `AuditLog` carries `regionId`/`departmentId`:
extend `AuditLogFilters` with an actor-derived scope and add one predicate in `buildAuditLogWhere`, so
the page and its `total` keep sharing one `where`. Update `audit-log-filter.spec.ts:43`'s pinned
contract deliberately, with the scope argument made explicit in the test name.

### 9.3 Fabricated data — [PROPOSED]

In severity order, independent of the above:

1. `utilisateurs` — delete `fiches`, `taux`, `lastAccess`, `tags`; stop defaulting `region` to "Centre";
   drop `DEFAULT_AGENTS`. No replacement metric until §V-4 of the predecessor report is approved.
2. `journal-audit` + `parametres` — remove fabricated audit rows; explicit empty state.
3. `centre-qualite` — remove `CANONICAL_FALLBACK_ANOMALIES` and the four `FIGMA_*` blocks; replace with
   the proposed `anomalies/summary` aggregate (predecessor X-2) or an explicit empty state.
4. `dossiers/[id]` — the three residuals at `406`, `720`, `813`.
5. `dossiers` list — `FIGMA_DOSSIERS` and `|| 12847`.
6. `etablissement-detail` — stop spreading `SABC_DEFAULT_COMPANY`; remove the three hardcoded users and
   the fabricated approver.
7. `etablissements`, `activite`, `diffusion`, `SendNotificationForm`.

Items 1, 2, 4, 5 and the `SABC_DEFAULT_COMPANY` spread need **no backend work** — they are deletions
plus honest empty states, and can proceed as soon as this report is approved.

## 10. Tests required

**Existing coverage — [EXISTING FACT]:**

| Area | Coverage |
|---|---|
| `territoryWhere`, `assertTerritorialAuthority`, export variant, `territoryFromUser` | **good** — `src/auth/territory.spec.ts`, 25 tests |
| `resolveTargetScope` fail-closed | good — `pilotage-scope.spec.ts` |
| Pilotage reads scoped by region/department/national | good — `pilotage.service.spec.ts`, `pilotage.controller.spec.ts` (68 tests) |
| Dossier list scoping | present — `admin-questionnaires.controller.spec.ts:115` asserts `buildAdminListWhere(filters, territory)` |
| Registration approval territorial authority | good — `auth.registration-approval.spec.ts`, `staff-scope.spec.ts` |
| Audit **filters** | present — `audit-log-filter.spec.ts`; pins *unscoped* as the contract |
| **`getCampaignProgress`** | **none — zero tests** |
| **`getCampaignSubmissions`** | **none — zero tests** |
| **Audit territorial scope** | none (does not exist) |
| **Correction → finding association** | none (does not exist) |
| **Absence of fabricated fallbacks** | none |

`campaign.service.spec.ts` covers only reference-period validation, immutability and delete gating —
**no territorial test at all.** The leaks in §3 are untested in both directions, which is why they
survived.

**Tests to add — [PROPOSED]**, mapped to the brief's twelve:

| # | Test | Where |
|---|---|---|
| 1 | CENTRAL gets national progress/roster | `campaign.service.spec.ts` |
| 2 | REGIONAL gets only its region's rows and counts | `campaign.service.spec.ts` |
| 3 | REGIONAL cannot retrieve another region (rows absent, `total` consistent) | `campaign.service.spec.ts` |
| 4 | DIVISIONAL gets only its department | `campaign.service.spec.ts` |
| 5 | DIVISIONAL cannot retrieve another department | `campaign.service.spec.ts` |
| 6 | `?region=` outside the actor's scope **narrows to nothing, never widens**; `?status=` cannot bypass scope | `campaign.service.spec.ts` |
| 6b | unassigned REGIONAL/DIVISIONAL and unknown role → `NO_ROWS`, not national | `campaign.service.spec.ts` |
| 6c | `targetRegions: []` ("all regions") does **not** widen a delegate's row scope | `campaign.service.spec.ts` |
| 7 | audit rows outside scope absent, and `total` equals the scoped count | new `report/audit-scope.spec.ts` |
| 7b | bulk/export rows follow the §14.4 ruling exactly | same |
| 7c | `USER_TERRITORY_CHANGED` visible to both previous and new territory (§8.5) | same |
| 7d | SUPER_ADMIN / SUPER_ADMIN_ONEFOP / AUDITOR remain unscoped | same |
| 8 | dossier detail/diagnostic scoped | extend `admin-questionnaires.controller.spec.ts` |
| 9 | out-of-territory dossier → **404, not 403** (pin the no-existence-leak choice) | same |
| 10 | no fabricated dossier returned on empty/error | react unit test |
| 11 | no fabricated audit history rendered on empty | react unit test |
| 12 | correction instruction corresponds to real findings; none → explicit empty state, never invented | react unit test |

Tests 10–12 need a react-side component test; `react-web` currently runs plain
`node --test` units (`scripts/run-unit-tests.mjs`, 39 tests) with **no component-rendering harness**, so
these either need a small harness or must be expressed as pure-function tests over the data-shaping
helpers. [DECISION REQUIRED] — §14.6.

## 11. Files that would change — [PROPOSED]

**Backend**

| File | Change |
|---|---|
| `src/campaign/campaign.controller.ts` | thread `@Req()` / `territoryFromUser` into 4 read methods; add `@Query('region')`; add `DIVISIONAL` to read `@Roles` |
| `src/campaign/campaign.service.ts` | scope `listCampaigns` (`_count` + `groupBy`), `getCampaign` (nested include), `getCampaignProgress`, `getCampaignSubmissions`; honour `region` as narrowing |
| `src/campaign/campaign-scope.ts` | **new** — `campaignRosterWhere` |
| `src/campaign/campaign.service.spec.ts` | tests 1–6c |
| `src/report/audit-log-filter.ts` | territorial predicate in `buildAuditLogWhere`; extend `AuditLogFilters` |
| `src/report/audit.controller.ts` | pass actor territory; Stage B role widening |
| `src/report/report.service.ts` | pass scope into both read methods |
| `src/report/audit-log-filter.spec.ts` | update the pinned "every row" contract |
| `src/report/audit-scope.spec.ts` | **new** — tests 7–7d |
| `src/questionnaires/admin-questionnaires.controller.spec.ts` | tests 8–9 |
| `src/questionnaires/questionnaires.service.ts` | §7.3 pre-check alignment — **only if approved** |

**Frontend** (§9.3): `utilisateurs/page.tsx`, `journal-audit/page.tsx`, `parametres/page.tsx`,
`centre-qualite/page.tsx`, `dossiers/page.tsx`, `dossiers/[id]/page.tsx`,
`etablissement-detail/page.tsx`, `etablissement-detail/approbation/page.tsx`, `etablissements/page.tsx`,
`activite/page.tsx`, `diffusion/page.tsx`, `components/admin/SendNotificationForm.tsx`,
and `_routes.ts` if audit roles widen.

## 12. Migration requirements

### 12.1 `AuditLog` territory columns — [PROPOSED], requires approval

Add nullable `regionId` / `departmentId` (+ indexes), written at the 15 existing `auditLog.create` call
sites. This is what makes §9.2 Stage A a single indexed predicate instead of a polymorphic multi-join,
and it is the **only** way bulk and export rows become scopable at all (§4.4).

- Historical rows get NULL. Any scoped view must then state its coverage window rather than silently
  under-reporting. [DECISION REQUIRED] — §14.4 covers how NULL-territory rows are treated.
- A backfill is possible for join-resolvable families and impossible for bulk/export.

### 12.2 Correction chain — [PROPOSED], requires approval

To close §7.2: `OnefopSubmission.previousSubmissionId` (self-relation, nullable) and a
`CorrectionRequestAnomaly` join table (or an `anomalyIds` array) linking a correction request to the
findings it cites. Without these, "corrections resolved" stays unmeasurable.

### 12.3 Nothing else

§9.1 and §9.3 need **no migration**. The campaign fix is query-level only.

**Constraint to preserve in any migration here:** do not add `@@unique` to `TerritoryTarget` or
`CampaignQuota` — uniqueness is two partial raw-SQL indexes per table (`schema.prisma:2424-2434`).
Also unresolved from the predecessor audit: migration `20261002140000` was edited after being applied
(checksum drift), and `npm ci` fails in both packages.

## 13. Risks

| Risk | Assessment |
|---|---|
| **Scoping campaign reads changes what REGIONAL users see today** | Certain, and the point. Their figures will *drop* from national to regional. Anyone who has been reading `/admin/pilotage`'s campaign card as a national number will see it change. Needs an operational heads-up, not just a deploy. |
| `SUPER_ADMIN_DSMO` silently loses campaign visibility | Real: it is granted the routes but is not in `NATIONAL_ROLES`, so `territoryWhere` yields `NO_ROWS`. Must be ruled on (§14.2) or it breaks on deploy. |
| Audit scoping could hide evidence | The central risk of §9.2. Fail-closed on unresolvable rows hides bulk visas and exports; that is worse than showing them nationally to CENTRAL. Hence the explicit §14.4 ruling. |
| `territoryWhere` name-matching fragility | A duplicated or renamed department name silently strips a delegate's scope (`resolveTargetScope` returns `none`). Pre-existing; the in-flight 360-arrondissements work touches territory names and may interact. Worth coordinating. |
| Removing fabricated data makes screens look empty | Expected and correct. An honest empty state is the deliverable, not a regression. |
| Deleting `taux`/`fiches` may be read as losing a feature | It is not a feature; it is `idx`-derived arithmetic. Flagged so it is not mistaken for a capability removal. |
| React tests 10–12 need a harness that does not exist | §14.6. |
| Interaction with uncommitted 360-arrondissements work | My changes would touch `campaign.*`, `report/*` and admin pages; that work touches seeds, territory reference data and a migration. Minimal file overlap, but both touch territory semantics. Sequence deliberately. |

## 14. Decisions requiring approval

1. **[DECISION REQUIRED] Grant `DIVISIONAL` read access to the campaign routes?** It has none today, so
   a divisional operational view cannot show campaign data. Recommended: yes, department-scoped.
2. **[DECISION REQUIRED] `SUPER_ADMIN_DSMO` on campaign reads.** It is permitted the routes but is not a
   national role, so scoping gives it nothing. Options: add to `NATIONAL_ROLES` for campaign reads
   (widens a DSMO super-admin over ONEFOP data), keep unscoped by explicit exception, or remove from
   these `@Roles`. Recommended: explicit exception for reads, documented, mirroring
   `EXPORT_NATIONAL_ROLES`' precedent of a separate list.
3. **[DECISION REQUIRED] Should a REGIONAL user see a campaign that does not target their region?**
   `GET /campaigns` hides it; `GET /campaigns/:id` does not. Pick one and make both agree.
   Recommended: metadata readable, roster scoped — but it must be a decision, not an accident.
4. **[DECISION REQUIRED] Disposition of audit rows with no resolvable territory** (bulk visa, bulk
   reject, list export, and NULL-territory historical rows). Options: (a) visible to national roles
   only; (b) visible to a territorial reader when **any** referenced submission is in scope, with
   out-of-scope ids redacted from `details`; (c) hidden from territorial readers. Recommended: (a) for
   historical NULLs plus (b) for bulk rows going forward, once §12.1 lands. **Never silently (c)** — it
   hides exports from the people supervising them.
5. **[DECISION REQUIRED] §12.1 `AuditLog` territory columns** — migration + backfill policy.
6. **[DECISION REQUIRED] React component-test harness** for tests 10–12, or express them as pure
   data-shaping tests instead.
7. **[DECISION REQUIRED] §7.3 submit-time duplicate pre-check** keyed on `companyId` vs the index's
   `establishmentId`. Aligning it changes when a submission is accepted — submission workflow
   behaviour, so Task 6 requires a ruling. Recommended: align, since the DB constraint is already the
   establishment-level one.
8. **[DECISION REQUIRED] §12.2 correction-chain relations** (`previousSubmissionId`, correction↔anomaly
   link). Needed before "corrections resolved" can be an indicator.
9. **[DECISION REQUIRED] §9.3 item 1** — deleting the agent `taux` / `fiches` / `lastAccess` figures
   outright, with no replacement until a real activity model is approved.
10. **[DECISION REQUIRED] Removal of the other fabricated blocks** where no backend aggregate exists yet
    (`activite`, `centre-qualite`): explicit empty state now, or leave until the aggregate ships?
    Recommended: empty state now — fabricated national statistics are worse than a blank panel.

**No semantic change is proposed.** ONEFOP semantics, campaign meaning, the target model, statistical
definitions and approved workflow states are untouched by §9.1–§9.3. The only item that touches workflow
semantics is §7.3, raised as item 7 above rather than acted on.

## 15. Verification run for this audit

Read-only audit, so these establish the pre-change baseline. Commands run at `ace4cc85` **with the
third-party uncommitted work present** (see the working-tree notice).

| Check | Result |
|---|---|
| `prisma validate` | **PASS** — "The schema at prisma\schema.prisma is valid" |
| backend `tsc --noEmit` | **PASS** (exit 0) |
| backend `jest --runInBand` | **PASS — 837/837, 52 suites** |
| backend `jest` (parallel) | **PASS — 837/837, 52 suites** |
| `react-web` `tsc --noEmit` | **PASS** (exit 0) |
| `react-web` `npm test` | **PASS — 39/39** |
| `react-web` `next build` | **PASS** — compiled successfully |
| `react-web` `eslint src/app/admin src/components/admin` | 27 errors / 37 warnings — **identical to the recorded baseline**, no regression |

Classification per Task 7:

- **Genuine failures:** none.
- **New regressions:** none.
- **Baseline failures:** none in this run.
- **Known concurrency failures:** none reproduced this time. Two earlier parallel runs on this branch
  failed a varying subset (`src/auth/staff-scope.spec.ts:235`; three `src/data-management` streaming
  export tests), each passing in isolation and serially. **This run's parallel pass confirms the flake
  is intermittent, not deterministic** — so the predecessor report's T-9 stands, but as "intermittently
  unreliable under parallelism", not "these specific tests fail". `--runInBand` remains the
  authoritative signal.
- The suite grew from 51 suites / 831 tests to 52 / 837: the extra suite and 6 tests are the
  third-party `src/territory/arrondissements-reference.spec.ts`, which passes.

---

## STOP

No implementation has been performed. Awaiting review and explicit approval of §9, and rulings on the
ten items in §14.

Recommended approval order, since the items are largely independent:

1. §9.1 campaign scoping + tests 1–6c — the live isolation leak, no migration, decisions 1–3.
2. §9.3 items 1, 2, 4, 5 and the `SABC_DEFAULT_COMPANY` spread — deletions only, no backend work,
   decision 9.
3. §12.1, then §9.2 Stage A, then Stage B — decisions 4, 5.
4. §9.3 items 3, 6, 7 — decision 10.
5. §7.3 and §12.2 — decisions 7, 8.
