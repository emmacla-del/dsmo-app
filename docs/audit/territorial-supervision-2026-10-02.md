# CAM-LEAP — Territorial Supervision, Targets & Operational Performance

**Audit → alignment → gap analysis → implementation**

**Date:** 2026-10-02
**Baseline:** `8105a4de` (`origin/master`, "Merge branch 'feat/register-field-layout'")
**Local `master` HEAD at audit start:** `653192d0` ("fix(register): resolve registration hanging…") — one
commit ahead of `origin/master` and present on no remote. This branch is cut from `origin/master` as
instructed, so that commit is **not** included here.
**Database access:** none, and none permitted. Every finding is from source, migrations, tests and git
history. `prisma validate` was run with a placeholder `DATABASE_URL` only.
**Audit mode:** read-only. No file was created, modified or deleted during the audit phase; implementation
followed afterwards and is listed in §AB.
**Prior work reused:** `docs/audit/plan-conformance-2026-10-02.md` (on branch
`origin/audit/plan-conformance-2026-10-02`, baseline `5371722`) and `docs/design/t3-returns-vs-quotas.md`.
No `audit/delta-2026-10-02` document exists in this repository.

---

## 0. Correction to the task brief

The brief supplied three "known verified facts" to re-verify. Two held. One did not:

> "Axis 2 (returns vs collection quota) is NOT built. Its design is `docs/design/t3-returns-vs-quotas.md`."

**This is stale.** Axis 2 was built in commit `19747aaf2`
("feat(pilotage): implement campaign returns vs quotas endpoint and React dashboard table"), merged to
master in `0a6acb0b6` — after the `5371722` baseline of the previous audit, which is where the
"not built" statement comes from. At `8105a4de` Axis 2 exists **end to end**:

| Layer | Evidence |
|---|---|
| Aggregation | `src/pilotage/pilotage.service.ts:235-464` (`getCampaignReturns`) |
| Metric helpers | `src/pilotage/pilotage-returns.ts` (`buildMetrics`, `addMetrics`, `isReceivedStatus`) |
| Endpoint | `src/pilotage/pilotage.controller.ts:53` — `GET /admin/pilotage/campaigns/:id/returns` |
| Tests | `src/pilotage/pilotage-returns.spec.ts`, `src/pilotage/pilotage.service.spec.ts:642-900` |
| UI view | `react-web/src/app/admin/cibles/page.tsx:45` — `Vue` includes `"retours"`, tab "Suivi des retours" |
| UI table | `react-web/src/components/admin/CampaignReturnsTable.tsx` |

The endpoint path also differs from the design document: the design proposed
`GET /api/admin/pilotage/campaign-returns?campaignId=`; the implementation nests it under the campaign as
`GET /admin/pilotage/campaigns/:id/returns`, consistent with the sibling `campaigns/:id/quotas` routes.
The implementation's path is the better one and no rename is proposed.

Consequently pilot priority (1) was **not** "build Axis 2". It was reduced to two real deltas between
the approved design and the shipped code — the unit of return, and the label — both implemented here (§AB).

The other two supplied facts were confirmed: Phase E.1 is live (`model Establishment`,
`prisma/schema.prisma:343`, with territory FKs), and registration approval (R.1) plus return review both
write audit rows.

---

## A. Current architecture

| Layer | Stack | Location |
|---|---|---|
| Backend | NestJS + Prisma + PostgreSQL | `src/` — 20 domain folders |
| Modern web | Next.js 16 + React 19 + TS | `react-web/` |
| Flutter client | Dart | `lib/` — canonical ONEFOP AST compiler |
| Schema | Prisma | `prisma/schema.prisma` — 2515 lines, 75 models, 48+ migrations |

Supervision-relevant backend modules: `pilotage`, `campaign`, `questionnaires`
(incl. `eligibility-engine`, `admin-questionnaires`), `auth` (incl. `territory`, guards), `territory`,
`report` (incl. `audit`), `locations`, `data-management`.

Verified state at `8105a4de`:

- `prisma validate` — **PASS**
- backend `tsc --noEmit` — **PASS** (exit 0)
- backend `jest src/pilotage` — **PASS**, 6 suites / 67 tests
- backend `jest` (full, default parallel) — **829 passed, 1 failed**, 51 suites. The failure is
  `src/auth/staff-scope.spec.ts:235` ("SUPER_ADMIN_ONEFOP creates ONEFOP field staff…").
- `react-web` `npm test` — **PASS**, 39/39
- `react-web` `next build` — **PASS**
- `react-web` `eslint src/app/admin src/components/admin` — **27 errors / 37 warnings, all pre-existing**
  (incl. 4 errors in `cibles/page.tsx`, 6 in `dossiers/page.tsx`). Not introduced here and not fixed here.

**The parallel `jest` failures are concurrency artifacts, not regressions — see §T-9.** After the changes
in §AB the parallel run reported 4 failures (827 passed, 831 total: `staff-scope` plus three
`data-management` export tests), yet `jest --runInBand` on the same tree passes **831/831**, and each
failing suite passes in isolation (`src/data-management` 188/188, `staff-scope` 33/33). The failing set
varies between parallel runs and includes suites untouched by this work. Treat `--runInBand` as the
authoritative signal for this repository until §T-9 is fixed.

---

## B. Existing administration hierarchy

EXISTING FACT. Region → Department → Subdivision, each a real table with real FKs:

- `Region` (`schema.prisma:51`), `Department` (`:68`), `Subdivision` (`:88`).
- `Company` carries `regionId`/`departmentId`/`subdivisionId` FKs plus denormalised names
  (`:275-278`, `:317-320`), indexed (`:328-329`).
- `Establishment` carries the same three FKs, **non-nullable** (`:355-362`).
- `OnefopSubmission` carries all three as nullable FKs plus names (`:821-824`, `:872-875`).
- Staff territory lives on `User.region` / `User.department` / `User.subdivision` as **strings**
  (`:131-133`) — not FKs. This asymmetry is the root of the scope-resolution complexity in
  `src/pilotage/pilotage-scope.ts` (see §T-1).

Subdivision codes, the Critical blocker in the previous audit, were fixed in `e39354d3b`
("feat(territory): populate subdivision codes for establishment ID generator").

---

## C. Existing roles & permissions

EXISTING FACT. `enum UserRole` (`schema.prisma:1923`): `COMPANY`, `DIVISIONAL`, `REGIONAL`, `CENTRAL`,
`SUPER_ADMIN`, `SUPER_ADMIN_DSMO`, `SUPER_ADMIN_ONEFOP`, `DATA_MANAGER`, `CAMPAIGN_MANAGER`, `ANALYST`,
`AUDITOR`.

**Central administration already exists: `CENTRAL`.** No new role is needed, and none is proposed.

Enforcement spine:

- `JwtAuthGuard` → `RolesGuard` → `ActiveCompanyGuard`, applied at class level on admin controllers.
- `src/auth/territory.ts` — `Territory`, `territoryFromUser`, `territoryWhere`,
  `assertTerritorialAuthority`. `NATIONAL_ROLES = [SUPER_ADMIN, SUPER_ADMIN_ONEFOP, CENTRAL]`.
  Fails **closed**: an unknown role, or a REGIONAL/DIVISIONAL account with no assignment, matches nothing
  (`NO_ROWS = { id: { in: [] } }`) rather than falling through to an unscoped query. This is good posture
  and is the correct foundation to build supervision on.
- `EXPORT_NATIONAL_ROLES` is deliberately kept separate from `NATIONAL_ROLES` so export breadth cannot
  leak into write authority (visa/reject/anomaly resolution).
- Pilotage role sets (`pilotage.controller.ts:10-21`):
  `PILOTAGE_WRITE_ROLES` = CENTRAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP;
  `PILOTAGE_READ_ROLES` = those + REGIONAL + DIVISIONAL.
- Frontend mirrors this in one place: `react-web/src/app/admin/_routes.ts` (role groups + per-route
  `allowedRoles`), enforced by `RequireAdminRole` and `useAdminScreenGuard`. Its own comment is correct
  that this is "UX only: the backend still enforces every endpoint."

---

## D. Existing territorial models

See §B. Additionally:

- `src/territory/territory-resolver.ts` — `resolveAndValidateTerritory` (with `requireSubdivision`) and
  `resolveStaffTerritory`. Only server-resolved ids/names are persisted on registration and resubmission.
- `src/pilotage/pilotage-scope.ts` — `resolveTargetScope` maps a `Territory` onto
  `{national|region|department|none}`, resolving staff **name** strings to region/department ids via a
  sole-match lookup. `none` is the fail-closed outcome.
- `GET /locations` exists (`src/locations/locations.controller.ts`).

---

## E. Existing target/objective mechanisms

EXISTING FACT — and this is the key "do not duplicate" finding. Four normalised target models already
exist (`schema.prisma:2436-2515`), added by migration
`20261001153000_add_territory_targets_and_campaign_quotas`:

| Model | Grain | Axis | Target column |
|---|---|---|---|
| `TerritoryTarget` | `(year, regionId, departmentId?)` | 1 — enrolment | `inscriptionTarget` |
| `CentralInscriptionTarget` | `(year)` unique | 1 — enrolment, "Niveau central" | `inscriptionTarget` |
| `CampaignQuota` | `(campaignId, regionId, departmentId?)` | 2 — collection | `submissionTarget` |
| `CentralCampaignQuota` | `(campaignId)` unique | 2 — collection, central | `submissionTarget` |

These satisfy §5 of the brief almost exactly. The brief's hypothetical `TerritorialTarget` is **already
implemented** under the name `TerritoryTarget`, and it is correctly *not* an intrinsic property of a
territory: the target is keyed by period (`year`) or by `campaignId`, exactly as §5 requires. All four
carry `createdBy`/`updatedBy` FKs to `User` and `createdAt`/`updatedAt`.

Design details worth recording, because they are easy to break:

- `departmentId` is NULL on a region-level row. Uniqueness is **two partial indexes per table** in raw
  SQL, not `@@unique`, because PostgreSQL treats those NULLs as distinct
  (`territory_targets_year_region_department_uidx` + `territory_targets_year_region_level_uidx`;
  same pair for `campaign_quotas`). The schema carries an explicit comment (`:2424-2434`) telling future
  developers **not** to add `@@unique`. Honour it.
- "Niveau central" is deliberately not a Region and not a NULL `regionId`; it has its own two tables.
- Region target/actual = **sum of departments** — `pilotage.service.ts:225-288`, mirrored client-side in
  `react-web/src/lib/pilotage-target-payload.ts`, with `TargetMode` = `UNSET|DEPARTMENT|REGION|MIXED`.
- No `regionalQuotas Json` / `divisionalQuotas Json` anywhere. The brief's warning against opaque JSON is
  already respected.

**PARTIALLY IMPLEMENTED — target history.** The four tables are mutable rows with `updatedAt`/`updatedBy`;
they are **not** temporal. A revision overwrites the previous value. Audit rows *are* written on target
writes (`putInscriptionTargets` / `putCampaignQuotas` audit each changed row), so the change *history* is
reconstructible from `AuditLog`, but there is no first-class "target as at date X" query and no
`status`/`approvedBy`/`approvedAt` revision workflow of the kind §5 contemplates. See §R-1 and §V.

**ARCHITECTURAL GAP — `User.perAgentTarget`.** `schema.prisma:178` declares `perAgentTarget Int?`
(migration `20260930120100_add_user_registration_fields`). It is referenced in exactly two places:
`src/auth/public-user.ts:60`, which lists it among `SECRET_USER_FIELDS` so it is stripped from payloads,
and that file's spec. **Nothing ever writes or reads it.** It is a dormant per-agent target stored as an
intrinsic property of a user — precisely the anti-pattern §5 of the brief warns against, since an agent
target varies by year and campaign. Do not build on it. See §W-2.

---

## F. Existing campaign architecture

EXISTING FACT. `DataCampaign` (`schema.prisma:583`), `CampaignSubmission` (`:622`),
`CampaignReminder` (`:642`), `CampaignFreeze` (`:2364`), plus `SubmissionRound`.

- `src/campaign/campaign.service.ts` + `campaign.controller.ts` (`@Controller('campaigns')`), with
  `campaign-scheduler.service.ts` and `campaign-period.helper.ts`.
- ONEFOP campaigns require `referenceYear`/`referenceQuarter`; immutable after creation; unique per period
  excluding ARCHIVED, enforced both in the service and by a DB CHECK + partial unique index
  (`20261002140000_campaign_reference_period_and_lateness`).
- Lifecycle: create → activate → pause → close → archive, plus `extend` and `delete` (DRAFT only, 409
  listing *all* blockers).
- `CampaignSubmission` is the **expectation roster**: `establishmentId String` non-nullable with
  `@@unique([campaignId, establishmentId])` and a FK to `Establishment`. Its `SubmissionStatus` enum
  (`:2345`) is `PENDING, SUBMITTED, IN_PROGRESS, VALIDATED, LATE, EXEMPT, NOT_STARTED`. Status is synced
  from review decisions by `src/questionnaires/campaign-review-sync.ts`.
- `OnefopSubmission.campaignId` **is** written at submit (`questionnaires.service.ts:1353`), with
  `isLate` and `effectiveDeadlineSnapshot` (`:1354-1355`), the deadline computed as end-of-day
  Africa/Douala with precedence `extendedDeadline ?? deadline ?? round.deadline`.

---

## G. Existing registration workflow (Axis 1)

EXISTING FACT, and strong. `UserStatus` (`:1937`): `PENDING_APPROVAL, ACTIVE, REJECTED, DRAFT,
UNDER_REVIEW, COMPLEMENTS_REQUESTED, DOCUMENTS_INCOMPLETE`.

- Self-registration → `PENDING_APPROVAL`; staff approval required.
- `GET /auth/company-registrations` — server-side territorial filter, intersected with actor territory so
  a filter can only narrow (`auth.service.ts:1064-1113`).
- `PATCH /auth/approve-user/:id`, `reject-user/:id`, `request-complements/:id` — CENTRAL, REGIONAL,
  DIVISIONAL + user-admin roles, each gated by `assertTerritorialAuthority`.
- Establishment ID issued **at approval**, inside the transaction (`auth.service.ts:1262-1268`); Phase E.1
  also mints the principal `-01` establishment (`8cf76f019`).
- `POST /auth/resubmit-registration` — whitelist + `forbidNonWhitelisted`, allowed only from
  `COMPLEMENTS_REQUESTED`, conditional status update first so a race yields 409, territory re-validated,
  audit row with a before/after diff.
- Decision reasons stored: `User.rejectionReason` + `rejectedAt` (`:140-141`), `approvalComment` (`:177`),
  `approvedAt` (`:163`). `rejectionReason` and `approvalComment` are in `SECRET_USER_FIELDS` and
  re-exposed only to the account itself.
- UI: `/admin/inscriptions` (queue), `/admin/etablissements`, `/admin/etablissement-detail/approbation`.
  All live-data.

---

## H. Existing submission workflow (Axis 2)

EXISTING FACT. `OnefopStatus` (`:1988`) has exactly five values: `DRAFT, PENDING_REVIEW, APPROVED,
REJECTED, CORRECTION_REQUESTED`.

Note for anyone reading the design doc: `t3-returns-vs-quotas.md` §2.1 lists `SUBMITTED` and
`UNDER_REVIEW` as submission statuses. **Those do not exist on `OnefopStatus`** — they belong to
`SubmissionStatus` (campaign roster) and `UserStatus` respectively. The shipped
`isReceivedStatus` (`pilotage-returns.ts:47`) therefore correctly implements "submitted and not REJECTED
and not DRAFT" as `PENDING_REVIEW | APPROVED | CORRECTION_REQUESTED`.

Territory is stamped **on the submission** at submit time (`questionnaires.service.ts:1356-1365`), which
is the approved rule: a return stays in the territory it was filed from even if the company later
relocates. This is covered by a dedicated test (`pilotage.service.spec.ts:760-774`, "comp-4 relocation").

---

## I. Existing validation / visa workflow

EXISTING FACT. `src/questionnaires/admin-questionnaires.controller.ts`,
`@Controller('admin/questionnaires')`, class-level `@Roles('CENTRAL','REGIONAL','DIVISIONAL',
'SUPER_ADMIN','SUPER_ADMIN_ONEFOP')`, all three guards:

| Route | Purpose |
|---|---|
| `GET pilotage/queues` | work-queue counts, territory-scoped |
| `GET /` | paginated dossier list (`{items,total}`), territory + status + type + region + period + search |
| `GET pending`, `GET correction-requested` | queue lists |
| `GET :id`, `GET :id/diagnostic` | dossier detail, dossier diagnostic |
| `PATCH :id/approve`, `:id/reject`, `:id/request-correction` | single decisions |
| `POST bulk-visa`, `POST bulk-reject` | bulk decisions |
| `GET anomalies/registry`, `PATCH anomalies/:id/resolve` | quality control |
| `GET export` | export |

`getById` is territory-scoped and reports an out-of-territory row as **404, not 403** — no existence
leak (`questionnaires.service.ts:3168-3173`). `assertCanApprove` refuses approval while blocking
anomalies are open (`eligibility-engine.service.ts:200-208`).

There is **no multi-tier escalation state machine** (regional → central). The "regional review tier" is a
supervisory/oversight tier only (`docs/design/regional-review-tier-scoping.md`, `9335a8a2b`).

---

## J. Existing correction workflow

EXISTING FACT, two distinct ones — do not conflate them:

1. **Registration corrections** — `COMPLEMENTS_REQUESTED` + `approvalComment`, resolved by
   `POST /auth/resubmit-registration`. Reviewer sees the changed-field diff only when the resubmission is
   newer than the latest complements request (`auth.service.ts:1179-1215`).
2. **Return corrections** — `OnefopStatus.CORRECTION_REQUESTED` via
   `PATCH /admin/questionnaires/:id/request-correction`, which requires an explicit `certified` flag.
   A corrected-and-resubmitted return still counts once in Axis 2 (dedup).

---

## K. Existing rejection reasons

**PARTIALLY IMPLEMENTED — stored, never shown.**

Stored: `User.rejectionReason` + `rejectedAt`; `OnefopSubmission.rejectionReason` + `reviewedBy` +
`reviewedAt` (`:808-810`); `OnefopAnomaly.resolutionNote` + `resolutionType` + `resolvedById` +
`resolvedAt`; `Declaration.rejectionReason` (DSMO). Reject routes enforce a minimum reason length
client-side (10 chars) and a certification flag server-side.

Not shown: a repository-wide search finds **no admin screen that renders an existing
`rejectionReason` value**. Every `rejectionReason` hit in `react-web/src/app/admin/` is either a *write*
form (`placeholder="Indiquez le motif précis du rejet…"`) or the hardcoded `null` inside the dossier mock
(`dossiers/[id]/page.tsx:29`). So brief items **K (see rejection reasons)** and **M (see correction
reasons)** were unmet at the UI layer. Partially addressed in §AB; the reviewer's *name* remains
unavailable (see §T-4).

---

## L. Existing anomaly / quality system

EXISTING FACT at the data layer. `OnefopAnomaly` (`:2374`) with `ruleCode`, `ruleFamily`, `severity`
(`AnomalySeverity`), `isBlocking`, `status` (`AnomalyStatus`), `description`, `observedValue`,
`expectedValue`, `deltaValue`, `detectedAt`, `resolvedAt`, `resolvedById`, `resolutionType`,
`resolutionNote`, `evidenceUrl`; indexed on `(status, isBlocking)` and `ruleCode`.

`GET /admin/questionnaires/anomalies/registry` is territory-scoped
(`where.submission = territoryWhere(territory)`) and paginated (default 50), returning items joined to
submission region/department/formType and resolver identity.
`PATCH anomalies/:id/resolve` enforces `assertTerritorialAuthority` and restricts
`LEGAL_DEROGATION` to SUPER_ADMIN / SUPER_ADMIN_ONEFOP / CENTRAL. Resolution writes an audit row
(`ANOMALY_RESOLVED` / `ANOMALY_WAIVED`).

**But see §S-2:** the quality *dashboard* is mostly fabricated.

---

## M. Existing audit system

EXISTING FACT — one audit system, and it must stay the only one. `AuditLog` (`schema.prisma:557`):
`userId` (FK), `action`, `resourceType`, `resourceId`, `details Json?`, `previousValue`, `newValue`,
`timestamp`, `ipAddress`, `userAgent`; indexed on `userId`, `timestamp`, `action`, `declarationId`,
`reportId`.

14 distinct actions are written across 15 `auditLog.create` call sites:

| Family | Actions |
|---|---|
| Registration | `COMPANY_REGISTRATION_APPROVED`, `_REJECTED`, `_COMPLEMENTS_REQUESTED`, `_RESUBMITTED`, `STAFF_REGISTRATION_REJECTED` |
| Return review | `AUDIT_APPROVE`, `AUDIT_REJECT`, `AUDIT_CORRECTION`, `AUDIT_BULK_VISA_GRANTED`, `AUDIT_BULK_REJECT` |
| Quality | `ANOMALY_RESOLVED`, `ANOMALY_WAIVED` |
| Data / admin | `AUDIT_LIST_EXPORT`, `USER_TERRITORY_CHANGED` |

This is a genuinely usable evidence base for operational-activity indicators (§4B of the brief): actor,
action, target and timestamp are all real. Two limits matter:

1. **`AuditLog` has no territory column.** Grouping activity by region/department requires joining
   `resourceId` → `OnefopSubmission` / `User` / `Company` per `resourceType`. `resourceId` is a bare
   `String` with no FK and no per-type index, so a territorial activity aggregate over it is a
   non-trivial query, not a `groupBy`. **ARCHITECTURAL GAP** — see §T-3.
2. **Read access is narrower than supervision needs.** `GET /audit/reports`
   (`src/report/audit.controller.ts:16-28`) is `@Roles(SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR)` and
   applies **no territorial scoping at all** — its filters are `period, actor, action, resourceType,
   resourceId`. So **`CENTRAL` cannot read the audit log**, and REGIONAL/DIVISIONAL cannot either. The
   frontend mirrors this (`_routes.ts:179`, `AUDIT_LOG_ROLES`). This directly blocks brief items
   **Q (auditable history)** and the final step of **O (drill-down → audit history)**. See §Z-1.

---

## N. Existing pilotage UI

`react-web/src/app/admin/` has 17 routes. Supervision-relevant:

| Route | Lines | Data | Verdict |
|---|---|---|---|
| `pilotage/` | 508 | `getPilotageQueues`, `getDataManagementStats`, `listAdminQuestionnaires` | **Real.** Hardcodes the 10 region names (`:11-22`) |
| `cibles/` | 658 | 4 real pilotage endpoints | **Real.** Axis 1 + Axis 2, both axes present |
| `dossiers/` | 1291 | `listAdminQuestionnaires` paginated | **Real** |
| `dossiers/[id]/` | 2006 | `getAdminDossier`, `getDossierDiagnostic` | **Mixed — see §S-1** |
| `files-attente/` | 347 | `getPilotageQueues`, `listAnomaliesRegistry` | **Real** |
| `inscriptions/` | 407 | registration queue | **Real** |
| `journal-audit/` | 561 | `listAuditLog` paginated | **Real**, but SUPER_ADMIN/AUDITOR only |
| `centre-qualite/` | 1152 | anomalies registry + 4 hardcoded blocks | **Mixed — see §S-2** |
| `activite/` | 632 | `getPilotageQueues` + hardcoded feed | **Mostly fabricated — see §S-3** |

Answering §14 of the brief directly, for `admin/pilotage/page.tsx`:

1. **Implemented:** campaign card with real progress, KPI tiles, "À TRAITER" priority queues, recent
   submissions timeline, region table.
2. **Real data:** all of it — `GET /admin/questionnaires/pilotage/queues`,
   `GET /admin/questionnaires?…`, data-management stats.
3. **Mocked:** nothing on this page. The only hardcoded values are the 10 region *names*.
4. **Endpoints:** as above.
5. **Prisma:** `eligibility-engine.service.ts:214-280` — `onefopSubmission.count` ×3,
   `onefopAnomaly.count`, `onefopSubmission.findMany` for approved candidates, and two `groupBy`
   (status, region). Aggregates are computed server-side over the whole territory precisely so the client
   never derives national figures from a paginated list — a rule worth preserving.
6. **Permissions:** class-level `@Roles(CENTRAL, REGIONAL, DIVISIONAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP)`
   + all three guards; territory via `territoryFromUser(req.user)`.
7. **Territorial info already present:** per-region submission `groupBy`, plus territory-scoped counts.
8. **Extend, do not replace.** This page is sound. It is the right landing surface for supervision and
   needs no rewrite.

Design system: `react-web/src/app/tokens.css` (113 `cam-*` tokens) plus `admin-console.css`. Shared
components exist for header (`AdminPageHeader`, `AdminHeaderActions`), KPIs (`KpiTile`), dialogs
(`AdminDialog`), grids (`TargetGrid`, `CoverageTable`, `CampaignReturnsTable`) and guards
(`RequireAdminRole`). **Caveat:** `pilotage/`, `activite/`, `centre-qualite/` and `dossiers/[id]/` use
large amounts of inline hex (`#e5e7eb`, `#1e6b3a`, …) rather than tokens. Not a blocker; noted as drift.

---

## O. Existing API endpoints (supervision-relevant)

| Method & path | Roles | Territory-scoped |
|---|---|---|
| `GET /admin/pilotage/targets/inscriptions?year=` | READ | yes |
| `PUT /admin/pilotage/targets/inscriptions?year=` | WRITE | yes |
| `GET /admin/pilotage/coverage?year=` | READ | yes |
| `GET /admin/pilotage/campaigns/:id/quotas` | READ | yes |
| `PUT /admin/pilotage/campaigns/:id/quotas` | WRITE | yes |
| `GET /admin/pilotage/campaigns/:id/returns` | READ | yes |
| `GET /admin/questionnaires/pilotage/queues` | dossier processors | yes |
| `GET /admin/questionnaires` (+ `pending`, `correction-requested`, `:id`, `:id/diagnostic`) | dossier processors | yes |
| `PATCH /admin/questionnaires/:id/{approve,reject,request-correction}` | dossier processors | yes |
| `POST /admin/questionnaires/{bulk-visa,bulk-reject}` | dossier processors | yes |
| `GET /admin/questionnaires/anomalies/registry` | dossier processors | yes |
| `PATCH /admin/questionnaires/anomalies/:id/resolve` | dossier processors | yes (`assertTerritorialAuthority`) |
| `GET /auth/company-registrations` | + REGIONAL/DIVISIONAL/CENTRAL | yes |
| `PATCH /auth/{approve-user,reject-user,request-complements}/:id` | + REGIONAL/DIVISIONAL/CENTRAL | yes |
| `GET /campaigns`, `/campaigns/:id` | …+ REGIONAL | **no** |
| `GET /campaigns/:id/progress` | …+ REGIONAL | **NO — see §T-2** |
| `GET /campaigns/:id/submissions` | …+ REGIONAL | **NO — see §T-2** |
| `GET /audit/reports` | SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR | **no** (and CENTRAL excluded) |
| `GET /locations` | — | n/a |

`PILOTAGE_READ_ROLES` = CENTRAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP, REGIONAL, DIVISIONAL.
`PILOTAGE_WRITE_ROLES` = CENTRAL, SUPER_ADMIN, SUPER_ADMIN_ONEFOP.

---

## P. Existing performance / aggregation logic

| Capability | Where | Status |
|---|---|---|
| Axis 1 directory stock + target + rate | `pilotage-coverage.ts`, `pilotage.service.ts:109+` | EXISTING |
| Axis 2 returns vs quota, lateness, gap, response rate | `pilotage-returns.ts`, `pilotage.service.ts:235-464` | EXISTING |
| Region = sum of departments (targets and actuals) | `pilotage.service.ts:225-288`, `:400-413` | EXISTING |
| Work-queue counts | `eligibility-engine.service.ts:214-280` | EXISTING |
| Campaign progress roster counts | `campaign.service.ts:456-463`, `_buildProgress` | EXISTING, unscoped |
| Target-mode resolution UNSET/DEPARTMENT/REGION/MIXED | `pilotage-validation.ts` | EXISTING |
| Fail-closed scope resolution | `pilotage-scope.ts` | EXISTING |
| Per-agent / per-unit activity aggregation | — | **MISSING** |
| Timeliness beyond the `isLate` boolean (ageing, overdue, processing time) | — | **MISSING** |
| Anomaly aggregation by type / by territory | — | **MISSING** (see §S-2) |
| Non-declarant list per territory | — | **PARTIAL** (see §R-4) |

`isRegistered` (Axis 1 denominator) = `status === 'ACTIVE' && isActive === true && hasEstablishmentId`
(`pilotage-coverage.ts:54`). `ADMINISTRATION` entities bucket to `central`, not to the department of
their physical seat (`pilotage-coverage.ts:63`) — and as of `19747aaf2` the same rule is applied to
returns (`pilotage.service.ts:364`), which settles the design document's only open question in the
affirmative.

---

## Q. What is already implemented

1. Both axes, kept properly distinct — Axis 1 (`coverage`, annual, directory stock) and Axis 2
   (`campaigns/:id/returns`, per-campaign, declarations). Different endpoints, periods, denominators.
2. Normalised territorial and campaign targets, period-keyed, with partial-unique integrity and
   createdBy/updatedBy. No JSON quota blobs.
3. Central / regional / divisional roles with server-side, fail-closed territorial scoping.
4. Registration workflow with approval, rejection, complements, resubmission, and audit diffs.
5. Return review workflow: pending / validate / reject / request-correction / bulk, blocked by open
   blocking anomalies.
6. Anomaly registry with territorial scoping and audited resolution.
7. One audit system, 14 action types.
8. Work-queue counts and a real pilotage dashboard.
9. Drill-down levels national → region → department (Axis 1 and Axis 2 tables) and queue → list → dossier.

## R. What is partially implemented

- **R-1 Target history.** Rows are mutable; history only reconstructible from `AuditLog`. No revision
  status / approvedBy / approvedAt, no as-at query. (§E)
- **R-2 Rejection & correction reasons.** Stored everywhere, surfaced nowhere. (§K)
- **R-3 Drill-down.** National → region → department → dossier works. **Responsible unit / user** level
  has no data source (`User.assigneeId` is dormant), and **audit history** is unreachable for CENTRAL.
- **R-4 Non-declarant monitoring.** The data exists — `CampaignSubmission` rows with status `PENDING` /
  `NOT_STARTED` for a campaign are exactly the expected-but-not-received set, and the roster is keyed on
  `establishmentId` with a FK. There is no territorial non-declarant endpoint or screen, and
  `getCampaignSubmissions` is unscoped.
- **R-5 Timeliness.** `isLate` + `effectiveDeadlineSnapshot` exist per return and are surfaced as
  on-time/late columns. No ageing of pending dossiers, no processing-time measure, no overdue queue.
- **R-6 Follow-up activity.** `CampaignReminder` records campaign-level aggregate sends
  (`recipientCount`, `failedCount`, `reminderType`) with no actor and no per-establishment row.
  `User.lastReminderAt` is dormant.
- **R-7 Design-token adherence** in the four supervision pages (§N).

## S. What is missing

- **S-1 Honest dossier drill-down.** `dossiers/[id]/page.tsx:139-141` did
  `dossierQuery.data || FIGMA_DOSSIER_MOCK` and `diagnosticQuery.data || FIGMA_DIAGNOSTIC_MOCK`, with
  `retry: false`. **Any** failure — 404, 403, out-of-territory, network — rendered a fabricated
  "SABC S.A. (Brasseries du Cameroun)" dossier with two invented anomalies, including a fake 56-post
  headcount discrepancy, as if live. The route `id` also defaulted to `"ENT-2026-04521"`. Worse, the
  "Historique d'instruction de la Fiche" panel (`:1282-1360`) was **100% hardcoded** — invented actors
  ("Samuel Eto'o", "M. Ewane (Superviseur National)") and invented timestamps — not even a fallback.
  That panel *is* the audit-history step of the §12 drill-down. **Fixed in §AB.**
- **S-2 Quality dashboard aggregates.** `centre-qualite/page.tsx` renders four hardcoded blocks
  unconditionally: `FIGMA_ANOMALIES_BY_TYPE` (`:86`→`:532`), `FIGMA_ANOMALIES_BY_REGION` (`:96`→`:583`),
  `FIGMA_RECENT_CONTROLS` (`:156`→`:652`), `FIGMA_ACTIVE_RULES` (`:164`→`:723`). "Anomalies par région" is
  exactly the territorial quality indicator the brief asks for (item N) and it is invented. **MOCK — not
  fixed in this run** (see §AB "deliberately out of scope"); needs a backend aggregate (§X-2).
- **S-3 Operational activity feed.** `activite/page.tsx` ("Supervision → Activité & alertes") filters and
  renders `DEFAULT_ACTIVITIES` (`:12`→`:160`) — 4+ invented events with invented actors, times and
  regions — **unconditionally, not as a fallback**. The page does fetch real queue counts alongside, which
  makes the fabricated feed more convincing, not less. This is brief item F ("monitor operational
  activities") and it is fiction. **MOCK — not fixed in this run**; it needs either audit-log access for
  CENTRAL (§Z-1, approval) or a submission-event feed (§X-3).
- **S-4 Operational activity indicators per agent/unit** (brief §4B). No aggregation exists, and
  `AuditLog` cannot be grouped territorially without a join (§T-3).
- **S-5 Field verification activities.** No model, no events. Must not be counted or displayed.
- **S-6 Correction-objective targets.** Only enrolment and submission targets exist.
- **S-7 Explainable performance index** (brief §4). Nothing exists — which is the correct starting point,
  since §4 forbids an opaque score. Proposed in §V.
- **S-8 Export of supervision views** (SPSS/Excel for returns-vs-quota). `diffusion/page.tsx:366` also
  fabricates SPSS `.sav` content client-side (`mockContent`), which is a separate data-integrity defect.

## T. Architectural gaps

- **T-1 Staff territory is strings, data territory is FKs.** `User.region`/`department` are names;
  everything else uses ids. `resolveTargetScope` bridges this with a case-insensitive **sole-match**
  lookup, and returns `none` (fail-closed) on ambiguity. Safe today, but a duplicated or renamed
  department name silently strips a delegate's scope. Any new supervision query must go through
  `territoryWhere` / `resolveTargetScope` and must never re-implement name matching.
- **T-2 Campaign progress leaks nationally to REGIONAL.** `GET /campaigns/:id/progress` and
  `GET /campaigns/:id/submissions` are granted to `REGIONAL` with **no territorial scoping**:
  `getCampaignProgress(campaignId)` (`campaign.service.ts:456`) takes no territory, and
  `getCampaignSubmissions` declares `filters: { status?, region? }` but **applies only `status`** —
  `filters.region` is accepted and silently ignored (`:465-473`). A regional delegate can read national
  campaign progress and the full national roster. This contradicts CLAUDE.md §14. `DIVISIONAL` is not
  granted these routes at all, so the divisional supervision view cannot use them either.
  **Security defect on an existing route — REQUIRES APPROVAL to change (§Z-2).**
- **T-3 `AuditLog` is not territorially queryable.** No region/department column; `resourceId` is an
  unindexed bare string with no FK and polymorphic meaning per `resourceType`. Territorial or per-unit
  activity aggregation needs either a join-per-type query or denormalised columns. (§W-3)
- **T-4 Reviewer identity is unresolvable for display.** `OnefopSubmission.reviewedBy` is a plain
  `String` user id with **no relation** (the `user` relation is on `submittedBy`), and `getById` does not
  include it. So a truthful dossier timeline can show *when* a decision was taken but not *by whom*
  without a schema relation or a service-side lookup. (§W-4)
- **T-5 Axis-2 unit vs Axis-1 denominator.** After the §AB change, `received` counts distinct
  **establishments** while `registeredStock` (the `responseRate` denominator) counts **companies**. These
  agree exactly while Phase E.1's invariant holds (one principal establishment per company) and Phase E
  secondary sites stay paused. They would diverge the moment secondary sites ship. Documented in code;
  realigning the denominator is a statistical-definition change and belongs to unpausing Phase E.
- **T-6 `User.perAgentTarget`** — dormant per-agent target on a user row (§E).
- **T-7 `User.assigneeId`, `User.lastReminderAt`** — dormant; the "responsible unit" drill-down level and
  follow-up tracking have no live data source.
- **T-8 Hardcoded region lists.** 10 non-test `react-web` files hardcode the 10 regions despite
  `GET /locations` existing (e.g. `admin/pilotage/page.tsx:11`, `admin/activite/page.tsx`,
  `admin/dossiers/page.tsx`, `admin/etablissements/page.tsx`). Carried over from the prior audit; still
  true.
- **T-9 The backend test suite is not reliable under parallelism.** `jest --runInBand` passes 831/831,
  but the default parallel run fails a varying subset — observed: `src/auth/staff-scope.spec.ts:235`, and
  three `src/data-management` streaming-export tests. Every one of them passes in isolation. The cause is
  shared mock state or worker timing, not any individual assertion. This matters beyond tidiness: it
  makes the suite unable to tell a real regression from noise, so a genuine break in supervision
  aggregation could land unnoticed. Pre-existing; worth fixing before CI gates on it.
- **T-10 Lint debt.** 27 eslint errors in `src/app/admin` + `src/components/admin`, pre-existing.

## U. Duplication risks

If the next implementer is not careful, these are the things that will get built twice:

1. **A new `TerritorialTarget` model.** Already exists as `TerritoryTarget`. Extend it; do not add a
   parallel table.
2. **`regionalQuotas Json` / `divisionalQuotas Json` on `DataCampaign`.** `CampaignQuota` +
   `CentralCampaignQuota` already do this relationally.
3. **A second returns-vs-quota endpoint.** `GET /admin/pilotage/campaigns/:id/returns` exists. The design
   doc's `GET /pilotage/campaign-returns?campaignId=` must **not** be added alongside it.
4. **A second supervision dashboard.** `/admin/pilotage` + `/admin/cibles` already carry it. The brief's
   capability list maps onto those two pages plus `/admin/files-attente` and `/admin/dossiers`.
5. **A second audit system.** `AuditLog` is the only one. Any new "activity" model must reference it or
   derive from it, never shadow it.
6. **A second territory-scoping helper.** `territoryWhere` / `assertTerritorialAuthority` /
   `resolveTargetScope` exist. See T-1.
7. **Building on `perAgentTarget`.** It is the wrong shape (§E) and dormant; superseding it is cheaper
   than wiring it.
8. **A `coverage` rename.** The brief's §7 terminology concern is a **labelling** problem. The API field
   is `rate` and the route is `/coverage`; renaming either would break the Flutter client and bookmarks
   for no statistical gain. UI labels were corrected instead (§AB).

## V. Proposed integration architecture

PROPOSED. Smallest shape that satisfies the brief, reusing everything above.

1. **Keep the two axes separate and keep both existing endpoints.** Axis 1 = `/coverage` (annual
   enrolment), Axis 2 = `/campaigns/:id/returns` (per-campaign collection). Do not merge.
2. **Targets: extend, don't add.** If a revision workflow is required, add `status`, `approvedBy`,
   `approvedAt`, `basis` to the four existing target tables, and add a `TerritoryTargetRevision` /
   `CampaignQuotaRevision` append-only history table **only if** "target as at date X" becomes a real
   requirement. Otherwise rely on `AuditLog`. **REQUIRES APPROVAL.**
3. **Activity: derive, don't score.** Introduce no `performanceScore` column. Add one read-only
   aggregation service, `SupervisionActivityService`, that derives activity counts **from `AuditLog`**
   grouped by actor, action family and period, and resolves territory by joining `resourceId` per
   `resourceType`. To make that affordable, add denormalised `regionId`/`departmentId` (nullable) to
   `AuditLog`, written at the existing 15 call sites. **REQUIRES APPROVAL** (schema + migration).
4. **Performance presentation: four explicit, separately-sourced figures**, never one opaque index:
   - *Objective achievement* — Axis 1 `rate`, Axis 2 `quotaRate`. Already computed.
   - *Operational activity* — counts from `AuditLog` per §V-3.
   - *Quality* — anomaly rate, rejection rate, correction rate, unresolved blocking anomalies, from
     `OnefopAnomaly` + status `groupBy`.
   - *Timeliness* — `isLate` share, plus pending-dossier ageing from `submissionDate`/`reviewedAt`.
   Any composite index must carry its formula and weights in configuration and display them next to the
   number. No ranking or leaderboard of named public servants — present territorial units, not people.
5. **Non-declarants: reuse the roster.** Add a territory-scoped
   `GET /admin/pilotage/campaigns/:id/non-declarants` over `CampaignSubmission` where status ∈
   {`PENDING`, `NOT_STARTED`}, joined to `Establishment` for territory. No new model.
6. **Drill-down: complete the existing chain, don't rebuild it.**
   `/admin/pilotage` → `/admin/cibles?vue=retours` (region → department) → `/admin/dossiers?region=&status=`
   → `/admin/dossiers/[id]` → audit history. Only the last hop needs new access (§Z-1).
7. **Regional and divisional views: same pages, same endpoints.** Every pilotage endpoint is already
   territory-scoped and fails closed, so a REGIONAL user on `/admin/cibles?vue=retours` already sees only
   their region summed from their departments. No separate regional or divisional dashboard should be
   built. Fix T-2 instead.
8. **UI: extend `/admin/cibles` and `/admin/pilotage`.** Reuse `TargetGrid`, `CoverageTable`,
   `CampaignReturnsTable`, `KpiTile`, `AdminPageHeader`, `AdminDialog`, and `tokens.css`. Dense semantic
   tables, no new chart library, no decorative cards.

## W. Database changes required

**None were made in this run.** All of the following are PROPOSED / REQUIRES APPROVAL:

- **W-1** `AuditLog.regionId` / `departmentId` nullable + indexes, for territorial activity aggregation
  (§V-3, §T-3).
- **W-2** Decide `User.perAgentTarget`: drop it, or supersede it with a period-keyed agent-target row.
  Recommendation: **drop**, since nothing reads it and its shape contradicts §5 of the brief.
- **W-3** `OnefopSubmission.reviewedBy` → a real relation to `User`, so a dossier timeline can name the
  reviewer (§T-4).
- **W-4** Optional revision/approval columns on the four target tables (§V-2).
- **W-5** Optional `assigneeId` activation for the responsible-unit drill-down level (§T-7).

Constraint to preserve in any migration touching targets: **do not add `@@unique` to `TerritoryTarget`
or `CampaignQuota`.** Uniqueness is two partial indexes in raw SQL per table; Prisma cannot express the
`WHERE` clause and would emit a different, weaker constraint. The schema comment at `:2424-2434` says so.

## X. API changes required

- **X-1** (done, §AB) No signature change. `getCampaignReturns` dedup unit changed from company to
  establishment; response shape untouched.
- **X-2** PROPOSED `GET /admin/questionnaires/anomalies/summary` — territory-scoped `groupBy` of
  `OnefopAnomaly` by `ruleCode`/`ruleFamily`/`severity` and by region/department, to replace §S-2's
  fabricated blocks. Additive, reuses existing roles and `territoryWhere`.
- **X-3** PROPOSED `GET /admin/pilotage/activity` — territory-scoped operational activity from
  `AuditLog`, to replace §S-3's fabricated feed. Depends on §Z-1 and ideally §W-1.
- **X-4** PROPOSED `GET /admin/pilotage/campaigns/:id/non-declarants` (§V-5).
- **X-5** **REQUIRES APPROVAL** — scope `GET /campaigns/:id/progress` and `:id/submissions` by territory
  and honour the already-declared-but-ignored `region` filter (§T-2). This changes what existing REGIONAL
  users see, which is why it needs a decision rather than a quiet fix.
- **X-6** **REQUIRES APPROVAL** — territorially-scoped audit read for CENTRAL/REGIONAL/DIVISIONAL (§Z-1).

## Y. React Web changes required

- **Y-1** (done, §AB) Axis 2 label → "Taux d'atteinte de l'objectif".
- **Y-2** (done, §AB) Axis 1 labels → objective-achievement wording; no API or URL-param rename.
- **Y-3** (done, §AB) `/admin/dossiers/[id]`: fabricated dossier/diagnostic fallback removed; real
  loading / not-found / forbidden states; instruction history derived from real submission fields;
  rejection reason surfaced.
- **Y-4** PROPOSED Replace §S-2 blocks with X-2 data.
- **Y-5** PROPOSED Replace §S-3 feed with X-3 data, or remove it and state the gap in the UI.
- **Y-6** PROPOSED Non-declarant tab on `/admin/cibles` backed by X-4.
- **Y-7** PROPOSED Replace the 10 hardcoded region lists with `GET /locations` (§T-8).
- **Y-8** PROPOSED Remove the fabricated SPSS payload in `diffusion/page.tsx:366` (§S-8).
- **Y-9** PROPOSED Migrate the four supervision pages' inline hex to `tokens.css`.

## Z. Security / permission changes required

- **Z-1 REQUIRES APPROVAL — audit-log visibility.** CENTRAL is central administration yet cannot read
  `GET /audit/reports` (SUPER_ADMIN, SUPER_ADMIN_ONEFOP, AUDITOR only), which blocks brief items O and Q.
  Granting it is **not** a one-line `@Roles` edit: the route has **no territorial scoping**, so adding
  REGIONAL/DIVISIONAL without scoping would hand a divisional delegate the national audit trail. The
  change must be: add territorial scoping *first* (joining `resourceId` per `resourceType`, or using
  §W-1), then widen roles. Recommend CENTRAL national, REGIONAL/DIVISIONAL scoped.
- **Z-2 REQUIRES APPROVAL — §T-2 campaign progress leak.** Scope both routes and apply the ignored
  `region` filter. Recommend treating this as urgent; it is a live geographic-isolation defect.
- **Z-3** No change to `ActiveCompanyGuard`, `JwtStrategy`, `assertTerritorialAuthority` or the
  completeness spec is needed or proposed. `src/auth/active-company.completeness.spec.ts` pins the exact
  route→statuses exemption map; any new route must either carry `ActiveCompanyGuard` or be added there
  deliberately.
- **Z-4** JWT-in-browser-storage remains a known accepted risk (CLAUDE.md §15). Out of scope.

## AA. Migration risks

No migration is introduced by this run, so there is nothing to roll back at the database level.

For the proposed migrations:

- **Partial-index trap.** Any `TerritoryTarget` / `CampaignQuota` migration that adds `@@unique` will
  silently replace two partial indexes with one weaker constraint and permit duplicate region-level rows.
- **Prior process defect, still relevant.** The previous audit found migration
  `20261002140000_campaign_reference_period_and_lateness` was **edited the day after it was created**
  (checksum drift). Any environment that applied the earlier version will fail `migrate deploy`. Resolve
  before adding migrations on top.
- **`AuditLog` denormalisation (§W-1)** must backfill or accept NULL territory on historical rows;
  activity aggregates must then state their coverage window rather than silently under-count.
- **Dropping `perAgentTarget` (§W-2)** is safe only because nothing reads it — re-verify at the time.
- **`npm ci` fails in both packages** (lockfile drift, per the prior audit). Fix before CI relies on it.

## AB. Implementation plan and what was actually done

### Done in this run — no approval required

Branch `feat/territorial-supervision`, cut from `origin/master` (`8105a4de`), small commits.

1. **Axis 2 unit of return → distinct establishment.** `getCampaignReturns` deduplicated by `companyId`;
   the approved decision (and `t3-returns-vs-quotas.md` §3.2 / footnote 1) is **distinct
   `establishmentId`**, now that Phase E.1 is live and `OnefopSubmission.establishmentId` is a
   non-nullable FK to `Establishment`. Changed the dedup key; numerically a no-op while every company has
   exactly one principal establishment, and correct once secondary sites ship. Mixed-unit caveat vs
   `responseRate` recorded in code and at §T-5. Tests extended.
2. **Axis 2 label.** "Taux de quota" → "Taux d'atteinte de l'objectif" (brief §7).
3. **Axis 1 labels.** Tab, page title, subtitle and rate column reworded from "couverture" to
   objective-achievement wording. **No API, field or URL-parameter rename** — `/coverage`, `rate` and
   `?vue=couverture` are unchanged.
4. **Drill-down made honest** (`/admin/dossiers/[id]`): fabricated dossier and diagnostic fallbacks
   removed; real loading / not-found / error states; hardcoded instruction history replaced with a
   timeline derived from real submission fields; stored rejection reason surfaced (brief items K/M).
   Also fixed the correction modal, which showed a fixed sample finding for every dossier and pre-filled
   the instruction actually sent to the declarant to match it — an unedited correction request told an
   employer to fix a discrepancy never detected on their return.
5. **Drill-down hop completed** (brief item O, counts → list → dossier): `/admin/dossiers` now accepts
   `?region=` on the same contract as its existing `?status=`, and each region row's "Reçus" figure in
   the returns table links to the dossiers behind it. Region level only, because the dossier list filters
   by region and not by department. The filter is server-applied either way, so the link grants no extra
   visibility.
6. **This report.**

Verification of the delivered work: backend `jest --runInBand` 831/831 (including one new test pinning
the per-establishment unit), backend `tsc` clean, `prisma validate` clean, `react-web` `tsc` clean,
`next build` passing, `react-web` 39/39, and admin lint counts unchanged from baseline (one pre-existing
warning removed). No migration, no schema change, no role change, no API signature change.

### Deliberately out of scope for this run

`centre-qualite` (§S-2) and `activite` (§S-3) fabricated data: both need backend capability that does not
exist (X-2) or a permission decision (Z-1), and both sit outside the stated pilot priority order. They are
the **top remaining data-integrity defects** and should be the next piece of work. Agent
activity/performance indicators were audited and proposed only, as instructed.

### Remaining sequence (after approvals)

| Phase | Work | Gate |
|---|---|---|
| 1 | Z-2 scope campaign progress/submissions | **approval** |
| 2 | X-2 anomaly summary endpoint + Y-4 | none |
| 3 | Z-1 audit scoping then role widening | **approval** |
| 4 | X-3 activity endpoint + Y-5 | depends on 3 |
| 5 | W-1 `AuditLog` territory columns | **approval** |
| 6 | X-4 non-declarants + Y-6 | none |
| 7 | Performance panel (four explicit figures, §V-4) | **approval** (statistical definitions) |
| 8 | W-2 drop `perAgentTarget`; W-3 reviewer relation | **approval** |
| 9 | Y-7/Y-8/Y-9 cleanups; T-9/T-10 debt | none |

---

## Gap matrix

Status is exactly one of EXISTING / PARTIAL / MISSING / GAP.

| Capability | Existing | Partial | Missing | Gap | Recommended action |
|---|---|---|---|---|---|
| Central target management | ✔ `TerritoryTarget`+3 siblings, PUT/GET, CENTRAL in write roles | | | | Reuse. Do not add a parallel model |
| Annual enrolment targets | ✔ `TerritoryTarget` + `CentralInscriptionTarget`, `/targets/inscriptions` | | | | Reuse |
| Campaign collection targets | ✔ `CampaignQuota` + `CentralCampaignQuota`, `/campaigns/:id/quotas` | | | | Reuse |
| Regional targets | ✔ region row or sum of departments, `TargetMode` | | | | Reuse |
| Divisional targets | ✔ department rows | | | | Reuse |
| Target history | | ✔ `AuditLog` only; rows mutable | | no as-at query, no revision status | §V-2 — approval |
| Axis 1 objective achievement | ✔ `/coverage` `rate` | | | labelled "couverture" | **Relabelled (done)** |
| Axis 2 objective achievement | ✔ `/campaigns/:id/returns` `quotaRate` | | | unit was company; label "Taux de quota" | **Both fixed (done)** |
| Regional performance | | ✔ achievement + queues, territory-scoped | | no activity/quality/timeliness panel | §V-4 — approval |
| Divisional performance | | ✔ same | | same, plus DIVISIONAL lacks campaign routes (T-2) | §V-4, Z-2 |
| Account pending queue | ✔ `/auth/company-registrations`, `/admin/inscriptions` | | | | Reuse |
| Account validation | ✔ `approve-user`, audited, territory-asserted | | | | Reuse |
| Account rejection | ✔ `reject-user` + `rejectionReason`/`rejectedAt` | | | | Reuse |
| Correction workflow | ✔ both registration and return paths | | | | Reuse |
| Submission pending queue | ✔ `pilotage/queues`, `pending`, `/admin/dossiers` | | | | Reuse |
| Submission validation | ✔ approve + bulk-visa, anomaly-blocked | | | | Reuse |
| Submission rejection | ✔ reject + bulk-reject, certified | | | | Reuse |
| Rejection reasons | | ✔ stored, were never displayed | | | **Dossier display added (done)**; reviewer name needs W-3 |
| Correction reasons | | ✔ stored, were never displayed | | | As above |
| Anomaly monitoring | ✔ registry, territory-scoped, audited resolution | | | dashboard aggregates fabricated (S-2) | X-2 + Y-4 |
| Quality indicators | | ✔ raw anomaly data | | no aggregation; fabricated UI | X-2 + Y-4 |
| Non-declarant monitoring | | ✔ `CampaignSubmission` roster exists | | no endpoint/screen; roster unscoped | X-4 + Y-6 |
| Activity tracking | | ✔ `AuditLog`, 14 actions | ✔ feed fabricated (S-3); no aggregation | not territorially queryable (T-3) | X-3, W-1 — approval |
| Timeliness | | ✔ `isLate` + deadline snapshot | ✔ no ageing / processing time / overdue queue | | §V-4 |
| Auditability | ✔ single `AuditLog` | | | CENTRAL cannot read it; route unscoped (Z-1) | scope first, then widen — approval |
| Drill-down | ✔ national→region→department→dossier | ✔ responsible-unit level missing | ✔ audit-history step | `assigneeId` dormant (T-7) | **Dossier step fixed (done)**; rest Z-1, W-5 |
| Role-based territorial visibility | ✔ fail-closed `territoryWhere` on every pilotage/questionnaire route | | | `/campaigns/:id/progress` + `:id/submissions` leak nationally to REGIONAL (T-2) | **Z-2 — approval, urgent** |
| Field verification activities | | | ✔ no model, no events | | do not display; propose only (S-5) |
| Performance index | | | ✔ none | | §V-4, must be explainable + configurable — approval |

---

## Decisions requiring human approval

1. **Z-2 / X-5 — campaign progress territorial leak.** Scope `GET /campaigns/:id/progress` and
   `GET /campaigns/:id/submissions`, honour the ignored `region` filter, and decide whether DIVISIONAL
   gains read access. Changes what existing REGIONAL users see. *Recommended: approve, urgently.*
2. **Z-1 / X-6 — audit-log visibility.** Add territorial scoping to `/audit/reports`, then widen roles
   (CENTRAL national; REGIONAL/DIVISIONAL scoped). Required for brief items O and Q.
3. **W-1 — `AuditLog.regionId`/`departmentId`** + migration + backfill decision.
4. **W-2 — `User.perAgentTarget`:** drop, or supersede with a period-keyed model.
5. **W-3 — `OnefopSubmission.reviewedBy` → `User` relation**, so decisions can name their author.
6. **W-4 / V-2 — target revision workflow** (`status`, `approvedBy`, `approvedAt`, history table).
7. **V-4 — the performance model itself**: which four figures, which formulas, and whether a composite
   index exists at all. A statistical-definition decision, not an engineering one.
8. **T-5 — Axis-2 `responseRate` denominator** once Phase E secondary sites unpause.
9. **S-2 / S-3 — fabricated supervision data**: approve replacement with real aggregates (preferred), or
   approve removing the blocks until the backend exists. Leaving them as-is keeps invented numbers on
   screen labelled as national statistics.
