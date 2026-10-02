# CAM-LEAP — Plan Conformance Audit (ONEFOP)

**Date:** 2026-10-02
**Scope:** ONEFOP only. DSMO frozen (noted only where it touches ONEFOP).
**Mode:** Read-only. No application code, migration, seed or script was modified.
**Baseline commit:** `5371722` (Merge PR #28, `feat/registration-approval`)
**Database access:** none (not required, not permitted). All findings are from source, migrations and git history.

---

## 1. Summary

The **authorization and registration spine (G.1 + R.1) is in good shape** and is the
strongest part of the codebase: the guard, the JWT gate, the approval/rejection/
resubmission flows and their test coverage match the written plan closely, with an
unusually strong completeness spec that pins the exact exemption map. Campaign
lifecycle (0.3) and targets/quotas (T.1/T.2) are likewise substantially implemented.

Against that, **the platform cannot currently complete its primary pilot workflow.**
Nothing in the repository ever populates `subdivisions.code`, and establishment-ID
issuance derives from it — so on any environment built from this repo, *every* company
approval fails with "Code d'arrondissement introuvable", the backfill script skips every
row, and `registered` in pilotage coverage stays 0. That is a hard pilot blocker
(Critical, §4.1).

**Phase E (per-establishment returns) is entirely unimplemented** — no `Establishment`
model, enum, table, service, reconciliation engine or UI. **T.3 (returns vs quotas) is
also entirely unimplemented** — no endpoint, no `retours` view. Both are design docs
only. Separately, the Phase E migration plan as written would silently break existing
code, because `establishmentId` is today a *company-code string* that several queries
join against `Company.establishmentId` (§4.6).

Two process defects compound this: an **already-applied migration was edited a day
after creation** (checksum drift, §4.2) and **`npm ci` fails in both packages** because
the lockfiles are out of sync (§4.5).

Build and test health is otherwise good: backend typecheck clean, 797 tests passing,
Prisma schema valid, `next build` clean, and **no committed credentials anywhere in the
repo or its 64-commit history**.

**Readiness verdict: not pilot-ready.** One Critical data-provisioning blocker and one
High migration-integrity defect must clear first; both are small fixes. Phase E and T.3
are feature-scale work, not fixes.

---

## 2. Command results (raw)

Environment: `JWT_SECRET=test-only-secret`,
`DATABASE_URL=DIRECT_URL=postgresql://u:p@127.0.0.1:5432/x` (parse only, never connected).

### 2.1 `npm ci` — FAILED in both packages

```
$ npm ci                      # repo root
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json or npm-shrinkwrap.json are in sync. Please update
npm error your lock file with `npm install` before continuing.
npm error Missing: @emnapi/core@1.11.3 from lock file
npm error Missing: @emnapi/runtime@1.11.3 from lock file
EXIT=1

$ cd react-web && npm ci
npm error code EUSAGE
npm error Missing: @emnapi/core@1.10.0 from lock file
npm error Missing: @emnapi/runtime@1.10.0 from lock file
EXIT=1
```

**Fallback used so the rest of the audit could run:** `npm install --no-save
--ignore-scripts` in both packages (exit 0 both), then `npm rebuild bcrypt`.
`--no-save` was chosen deliberately so the repo's lockfiles were **not** modified;
`git status` was verified clean afterwards.

> Note on honesty of results: the first `jest` run reported 5 failed suites, but that
> was an artifact of `--ignore-scripts` leaving bcrypt's native binding unbuilt — not a
> repo defect. After `npm rebuild bcrypt` the suite is green. Only the corrected run is
> reported as the result below.

### 2.2 `prisma validate` / `generate` — PASS

```
$ npx prisma validate
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
PRISMA_VALIDATE_EXIT=0

$ npx prisma generate
✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 2.56s
PRISMA_GENERATE_EXIT=0
```

### 2.3 Backend `tsc --noEmit` — PASS

```
$ npx tsc --noEmit -p tsconfig.json
TSC_BACKEND_EXIT=0        # no diagnostics
```

### 2.4 Backend `jest` (full) — PASS

```
$ npx jest --ci
Test Suites: 1 skipped, 47 passed, 47 of 48 total
Tests:       2 skipped, 797 passed, 799 total
Snapshots:   0 total
Time:        37.364 s
JEST_EXIT=0
```

Non-fatal noise observed during the run (all expected/handled paths):
`[QuestionnairesService] No ONEFOP SubmissionRound found for quarterCode "2026-T3"`,
`[EmailService] RESEND_API_KEY is not set`, and
`[OnefopShadowValidatorService] [shadow] ctd submission test-submission: 36 discrepancies`.
A recurring `ts-jest` warning (`TS151002`, hybrid module kind without
`isolatedModules: true`) is emitted once per suite.

### 2.5 react-web `tsc --noEmit` — FAILS standalone, PASSES after `next build`

```
$ npx tsc --noEmit            # before any build
src/app/layout.tsx(30,56): error TS2304: Cannot find name 'LayoutProps'.
TSC_WEB_EXIT=2

$ npx next build && npx tsc --noEmit
TSC_WEB_AFTER_BUILD_EXIT=0
```

Not a code defect: `LayoutProps` is a Next.js 16 generated global, emitted into
`.next/types/routes.d.ts:87` by the build. It is an ordering dependency — see §4.16.

### 2.6 react-web `next build` — PASS

```
$ npx next build
WEB_BUILD_EXIT=0
```

Routes compiled (all dynamic, `ƒ`): `/admin/etablissement-detail/approbation`,
`/admin/etablissements`, `/admin/files-attente`, `/admin/inscriptions`,
`/admin/journal-audit`, `/admin/parametres`, `/admin/pilotage`, `/admin/questionnaires`,
`/admin/sectors`, `/admin/utilisateurs`, `/forgot-password`, `/home`, `/home/[slug]`,
`/home/annuaire`, `/home/communication`, `/home/declarations`,
`/home/declarations-dsmo`, `/home/declarations/new`, `/home/inscription-en-attente`,
`/home/notifications`, `/login`, `/onefop/preview`, `/register`, `/reset-password`,
`/verify-email`.

### 2.7 Flutter

Flutter SDK not installed in this container and not installable under the audit's
network constraints. Dart was reviewed **by reading only** (`lib/`), as the brief allows.
No `flutter analyze` / `flutter test` result is claimed.

---

## 3. Conformance matrix

Status key: **IMPLEMENTED** / **PARTIAL** / **MISSING** / **DEVIATES**.

### 3.1 Territory

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| T-1 | Validated region→department→subdivision with FKs on company writes | IMPLEMENTED | `src/territory/territory-resolver.ts:46`; `src/auth/auth.service.ts:593,603`; `src/auth/auth.service.ts:999,1009` | `resolveAndValidateTerritory(..., {requireSubdivision:true})` on register-company and resubmission; only server-resolved names/ids persisted |
| T-2 | Same on DSMO writes | IMPLEMENTED | `src/dsmo/dsmo.service.ts:201,211,262,272` | DSMO frozen; listed for completeness |
| T-3 | Staff writes territory-validated | IMPLEMENTED | `src/territory/territory-resolver.ts` (`resolveStaffTerritory`), imported `src/auth/auth.service.ts:23`; migrations `20260929180000_require_region_for_divisional_users`, `20260929181000_require_region_for_regional_users` | DB-level region requirement for DIVISIONAL/REGIONAL |
| T-4 | Returns take territory from company/establishment | PARTIAL | `src/questionnaires/questionnaires.service.ts:1356-1365` | Territory stamped on the submission from company at submit time — correct per T.3 §3.1. "or establishment" is moot: no establishment entity exists |
| T-5 | Subdivision mandatory in React registration | IMPLEMENTED | `requireSubdivision:true` enforced server-side (`auth.service.ts:603`) | Server-side enforcement verified; client-side verified only as present, not exercised |
| T-6 | Subdivision mandatory in Flutter registration | PARTIAL | Server-side enforced as above; Dart reviewed by reading only | Not runtime-verified (no Flutter SDK) |
| T-7 | Subdivision codes: how generated | **MISSING** | `prisma/seed.ts:746-748` creates subdivisions with `{name, departmentId}` only — **no `code`**; no migration or script ever sets it | **Critical — §4.1** |
| T-8 | Subdivision codes: where used (establishment IDs) | DEVIATES | `src/auth/auth.service.ts:1261` `subdivision.code.slice(-2)`; `src/common/utils/establishment-id.generator.ts:60` `padStart(2,'0').slice(0,2)` | Last 2 digits only → 331 subdivisions into 100 slots; segment is not uniquely decodable (§4.11) |
| T-9 | No hardcoded region lists instead of `/locations` | **DEVIATES** | `/locations` exists (`src/locations/locations.controller.ts:8-38`) yet 10 non-test react-web files hardcode the 10 regions — e.g. `react-web/src/app/admin/dossiers/page.tsx:619`, `admin/pilotage/page.tsx:19`, `admin/etablissements/page.tsx:23`, `admin/diffusion/page.tsx:74`, `admin/activite/page.tsx:363`, `admin/utilisateurs/page.tsx:104`, `components/onefop/vt-cameroon-admin-data.ts:19` | §4.9 |

### 3.2 M.1 Migrations

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| M-1 | Migration folder consistent with `schema.prisma` | IMPLEMENTED | 48 migrations + `migration_lock.toml`; `prisma validate` exit 0 | Raw-SQL partial indexes/CHECKs intentionally not mirrored in the DSL |
| M-2 | No edited applied migrations | **DEVIATES** | `prisma/migrations/20261002140000_campaign_reference_period_and_lateness/migration.sql` created in `2762414` (2026-10-01), **edited** in `80e098a` (2026-10-02) | **High — §4.2** |
| M-3 | Every migration's assumptions match code | PARTIAL | `20261002140000` adds CHECK `data_campaigns_onefop_reference_period_check` + partial unique index excluding ARCHIVED; code mirrors both (`campaign.service.ts:90-105,224-226`) | But `schema.prisma:550-551` shows `Int?` with no note that a DB CHECK makes them required for ONEFOP — §4.21 |

### 3.3 T.1 / T.2 Targets & Quotas

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| Q-1 | `TerritoryTarget` / `CampaignQuota` / `CentralCampaignQuota` tables | IMPLEMENTED | `prisma/schema.prisma:2387, 2410, 2450`; also `CentralInscriptionTarget:2434`; migration `20261001153000_add_territory_targets_and_campaign_quotas` | |
| Q-2 | PUT/GET targets & quotas | IMPLEMENTED | `src/pilotage/pilotage.controller.ts:29,41` (targets), `:47,53` (quotas) | |
| Q-3 | Roles on those routes | IMPLEMENTED | `pilotage.controller.ts:30,36,42,48,54`; `PILOTAGE_WRITE_ROLES` = CENTRAL/SUPER_ADMIN/SUPER_ADMIN_ONEFOP (`:10-14`); `PILOTAGE_READ_ROLES` adds REGIONAL/DIVISIONAL (`:16-20`) | Matches T.3 §5.2 intent |
| Q-4 | Targets entered by department, region = sum of departments | IMPLEMENTED | `react-web/src/lib/pilotage-target-payload.ts`; `src/pilotage/pilotage.service.ts:225-288` | |
| Q-5 | `GET /pilotage/coverage`: registered = ACTIVE + isActive + establishmentId | IMPLEMENTED | `src/pilotage/pilotage-coverage.ts:54` `row.status==='ACTIVE' && row.isActive===true && hasEstablishmentId(row.establishmentId)` | Exactly the spec. **But** see §4.1: with no subdivision codes no ID is ever issued, so this reads 0 |
| Q-6 | `Company` region/department indexes | IMPLEMENTED | `prisma/schema.prisma:328-329`; migration `20261002120000_add_company_territory_indexes` | |
| Q-7 | `/admin/cibles`: targets, coverage, quotas | IMPLEMENTED | `react-web/src/app/admin/cibles/page.tsx:43-47,144,153,154` | 3 views present |
| Q-8 | Region clear | IMPLEMENTED | `cibles/page.tsx:16,278` (`clearRegionDraft`) | |
| Q-9 | Save disabled while unsaved | DEVIATES (minor) | `cibles/page.tsx:208` computes `unsavedChanges`, passed as `hasUnsavedChanges` (`:332`); save button `:345` is `disabled={mutation.isPending}` only | Dirty state drives a navigation guard, not the button |
| Q-10 | "Niveau central" row | IMPLEMENTED | `react-web/src/components/admin/TargetGrid.tsx:78`; `CoverageTable.tsx:86`; `pilotage-target-payload.ts:228` | For targets/coverage. The T.3 *returns* variant does not exist |
| Q-11 | Pilotage metrics: pending registrations | IMPLEMENTED | `pilotage-coverage.ts:20-30`; `pilotage.service.ts:180` (`pendingApproval`); `auth.service.ts:1341` | |
| Q-12 | Pilotage metrics: agents, data quality | **MISSING** | No `agents` / `dataQuality` metric in `src/pilotage/pilotage.service.ts` | §4.12 |

### 3.4 0.3 Campaigns

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| C-1 | `referenceYear`/`referenceQuarter` required for ONEFOP | IMPLEMENTED | `campaign.service.ts:41-67` (`validateReferencePeriod`); DB CHECK in `20261002140000/migration.sql` | Prisma field is `Int?`; the CHECK is what makes it required |
| C-2 | Immutable after creation | IMPLEMENTED | `campaign.service.ts:223-226` — `BadRequestException` if either key is present on update | |
| C-3 | Unique per period excluding ARCHIVED | IMPLEMENTED | `campaign.service.ts:85-105` (`assertNoPeriodDuplicate`, `status: {not:'ARCHIVED'}`); partial unique index `data_campaigns_onefop_reference_period_key` | Both app- and DB-level |
| C-4 | Name/code derived from reference period | IMPLEMENTED | `campaign.service.ts:118-120`, `:228-229` ("name is intentionally not editable here") | |
| C-5 | `OnefopSubmission.isLate` + `effectiveDeadlineSnapshot` | IMPLEMENTED | `prisma/schema.prisma:784-785`; written at `questionnaires.service.ts:1354-1355`; computed `:1297-1303` | |
| C-6 | Deadline = end of day Africa/Douala | IMPLEMENTED | `questionnaires.service.ts:1299` `computeDoualaEndOfDay(...)`; precedence `extendedDeadline ?? deadline ?? round.deadline` (`:1297`) | |
| C-7 | Campaign linking on submit | IMPLEMENTED | `questionnaires.service.ts:1248-1304` resolves via `SubmissionRound(quarterCode, ONEFOP)`; written `:1353` | Never fails submission; warns and leaves null on miss/ambiguity |
| C-8 | `CampaignSubmission` status sync | IMPLEMENTED | `src/questionnaires/campaign-review-sync.ts:1-20` (full status map), called `questionnaires.service.ts:1461-1472` | Best-effort, keyed `(campaignId, companyId)` |
| C-9 | Campaign form/list/detail show reference period | IMPLEMENTED | `campaign.service.ts` create/update/list carry `referenceYear`/`referenceQuarter` | |
| C-10 | Delete: only DRAFT, 409 with all blockers, archive path | IMPLEMENTED | `campaign.service.ts:282` `deleteCampaign`; `:304-308` non-DRAFT → 409; `:310-333` collects **all** blockers (campaign submissions, ONEFOP submissions, DSMO declarations, territorial quotas, central quota, freezes) then throws one 409; `:404` `archiveCampaign` | Archive is a separate path, not merged into delete |

### 3.5 G.1 Access Control

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| G-1 | `ActiveCompanyGuard` + `@AllowInactiveCompany({statuses?})` | IMPLEMENTED | `src/auth/active-company.guard.ts:1-59`; `src/auth/allow-inactive-company.decorator.ts` | |
| G-2 | `isActive=false` always denied | IMPLEMENTED | `active-company.guard.ts:23-28` — before the decorator is consulted | |
| G-3 | Allow-list ACTIVE | IMPLEMENTED | `active-company.guard.ts:50-57` | Deliberately does **not** check `establishmentId` (`:49`) |
| G-4 | `JwtStrategy`: staff non-ACTIVE → 401 | IMPLEMENTED | `src/auth/jwt.strategy.ts:50-52` | |
| G-5 | COMPANY authenticates at any status | IMPLEMENTED | `jwt.strategy.ts:47-52` (role-conditional gate) | Plus account reloaded per request (`:39-45`) and `purpose`-claim tokens refused (`:27-29`) |
| G-6 | Login (`validateUser`) strict | IMPLEMENTED | `auth.service.ts:129-149` — PENDING_APPROVAL (staff), REJECTED, `!isActive` each rejected **after** the password check | |
| G-7 | Completeness spec: every `JwtAuthGuard` route has guard or marker | IMPLEMENTED | `src/auth/active-company.completeness.spec.ts:89-102` (`offendingRoutes` must be `[]`) | |
| G-8 | Asserts exact route→statuses map | IMPLEMENTED | `active-company.completeness.spec.ts:109-150` — pins 8 exemptions incl. `AuthController.resubmitRegistration: ['COMPLEMENTS_REQUESTED']`, `getMe: ANY_STATUS` | Strong control: widening requires a deliberate edit |
| G-9 | Negative fixtures | IMPLEMENTED | `active-company.completeness.spec.ts:152-204` — fixture with/without guard and with marker | |
| G-10 | `minefop-services` mutating routes = SUPER_ADMIN + SUPER_ADMIN_ONEFOP only | IMPLEMENTED | `src/minefop-services/minefop-services.controller.ts:174,185,196,209,257` and the trailing `@Delete(':code')` | All 6 mutating routes covered; GETs intentionally broader |
| G-11 | Any route a COMPANY can reach that it shouldn't | IMPLEMENTED (none found) | Class-aware sweep of all 18 controllers: only `auth.controller.ts` (public/self-service) and `questionnaires.controller.ts:65` lack `@Roles`; the latter is `@Controller('onefop')` guarded by `JwtAuthGuard, RolesGuard, ActiveCompanyGuard` (`:57-58`) and is a company's own PDF preview | Admin controllers carry class-level `@Roles` (`admin-questionnaires.controller.ts:49`, `system-settings.controller.ts:11`) |
| G-12 | Any mutating route without `@Roles` | PARTIAL (by design) | 23 raw hits; all resolve to public auth routes (`login`, `register`, `forgot-password`, `verify-email`, …), self-service (`@Delete('me')`, `@Patch('preferences')`), or class-level-`@Roles` admin controllers | No genuine gap |

### 3.6 R.1 Registration Approval

| # | Item | Status | Evidence | Note |
|---|---|---|---|---|
| R-1 | Self-registration requires staff approval | IMPLEMENTED | `auth.service.ts:1228-1232`; status starts PENDING_APPROVAL | |
| R-2 | Pending company logs in to status screen only | IMPLEMENTED | `jwt.strategy.ts:47-52` + `active-company.guard.ts:50-57`; React `app/home/layout.tsx:68-69`; Flutter `lib/main.dart:149` | |
| R-3 | Establishment ID issued at approval, not registration | IMPLEMENTED | `auth.service.ts:1262-1268` inside the approval transaction | |
| R-4 | CENTRAL + SUPER_ADMIN_ONEFOP approve nationally; REGIONAL/DIVISIONAL scoped | IMPLEMENTED | `assertTerritorialAuthority(...)` `auth.service.ts:1227`; `src/auth/territory.ts` (+ `territory.spec.ts`) | |
| R-5 | CENTRAL cannot approve STAFF | IMPLEMENTED | Role split in `auth.service.ts` approval paths; covered by `auth.registration-approval.spec.ts`, `staff-scope.spec.ts` | |
| R-6 | Region filter server-side, can only narrow | IMPLEMENTED | `auth.service.ts:1064-1113` (`listCompanyRegistrations`), scope intersected with actor territory | |
| R-7 | `approvalComment` only via `/auth/me` | IMPLEMENTED | `auth/public-user.ts:59` lists it in `SECRET_USER_FIELDS`; re-added for self only at `auth.service.ts:236` | |
| R-8 | Decision emails HTML-escape reviewer text | IMPLEMENTED | `src/dsmo/notification.service.ts:14-21` (`escapeEmailHtml`), applied `:543`, `:561` | |
| R-9 | Approval succeeds even if SMTP fails | IMPLEMENTED | `auth.service.ts:1289-1294` — email and attestation run post-COMMIT and swallow their own errors | |
| R-10 | Correction form → `resubmit-registration` whitelist + forbidNonWhitelisted | IMPLEMENTED | `auth.controller.ts:265` `ValidationPipe({whitelist:true, forbidNonWhitelisted:true, ...})` | Comment `:263-264` states this is what keeps `establishmentId` unreachable |
| R-11 | Only from COMPLEMENTS_REQUESTED | IMPLEMENTED | `auth.controller.ts:262` `@AllowInactiveCompany({statuses:[COMPLEMENTS_REQUESTED]})`; `auth.service.ts:952-954` | |
| R-12 | Conditional status update first (409 on race) | IMPLEMENTED | `auth.service.ts:964-972` — `updateMany` gated on `status:'COMPLEMENTS_REQUESTED'`, `count===0` → `ConflictException` before any Company write | Textbook |
| R-13 | Territory re-validated, names derived server-side | IMPLEMENTED | `auth.service.ts:997-1017` — resolves whole chain, records only resolved values | |
| R-14 | `taxNumber` unique excluding self | IMPLEMENTED | `auth.service.ts:1021-1029` (`id: {not: company.id}`) + P2002 backstop `:1035-1037` | |
| R-15 | `establishmentId` unwritable | IMPLEMENTED | Absent from `ResubmitRegistrationDto` (`src/auth/dto/resubmit-registration.dto.ts:12`) + forbidNonWhitelisted | |
| R-16 | Audit row with before/after | IMPLEMENTED | `auth.service.ts:977-983` builds `changes` diff; written `:1042-1050` as `COMPANY_REGISTRATION_RESUBMITTED` | |
| R-17 | Reviewer sees changed fields only if newer than latest complements request | IMPLEMENTED | `auth.service.ts:1179-1215` — `!resubmitted \|\| (requested && requested >= resubmitted.at)` → `null` | Exactly the rule |
| R-18 | ADMINISTRATION approval needs explicit server-side confirmation flag | IMPLEMENTED | `auth.service.ts:1240-1244` — strict `!== true`, checked **before** the transaction | |
| R-19 | REJECTED login: fixed message, no reason | IMPLEMENTED | `src/common/registration-messages.ts:17-18`; thrown `auth.service.ts:141-142` after password check; asserted `auth.registration-approval.spec.ts:273` | Text matches the specified string exactly |
| R-20 | Rejection email keeps reason + same contact line (shared constant) | IMPLEMENTED | `registration-messages.ts:8-9` `REGISTRATION_CONTACT_SENTENCE`; used `notification.service.ts:553` and in the login message | Single source of truth |
| R-21 | Rejected = isActive false = signed out | IMPLEMENTED | `auth.service.ts:221-225` (`getMe` throws 401 for REJECTED/`!isActive`) | Drives the client sign-out |
| R-22 | REJECTED branch removed from status screens | IMPLEMENTED | No `REJECTED` in `react-web/src/app/home/inscription-en-attente/page.tsx` or Flutter pending screens | |
| R-23 | Registration `rejectionReason` removed from public payloads & client models | IMPLEMENTED | `auth/public-user.ts:61-66`; `react-web/src/lib/user-types.ts:51-56`; `lib/models/user.dart:57` | DSMO declaration `rejectionReason` correctly untouched (`react-web/src/lib/declarations.ts:52`) |
| R-24 | 403 COMPANY_NOT_ACTIVE → status screen, no-op if already there | IMPLEMENTED | `react-web/src/lib/api-client.ts:103,115,169`; `app/home/layout.tsx:68` guards `pathname !== "/home/inscription-en-attente"` | |
| R-25 | From `/auth/me` → sign out | IMPLEMENTED | Flutter `lib/data/api_client.dart:43` `onCompanyNotActive({required bool fromAuthMe})` | |
| R-26 | Active-quarter query disabled for pending users (no redirect loop) | IMPLEMENTED | `react-web/src/app/home/layout.tsx:53` `enabled: authState === "authed" && !awaitingApproval` | |
| R-27 | Flutter detects it before the generic 403 message | IMPLEMENTED | `lib/data/api_client.dart:21-29` — `statusCode===403` + `code===kCompanyNotActive` checked ahead of `_handleError`'s generic string (`:23`) | |
| R-28 | 401 behaviour unchanged | IMPLEMENTED | `api-client.ts` 401 path untouched; `jwt.strategy.ts` unchanged semantics | |
| R-29 | Unique index on `Company.establishmentId` | IMPLEMENTED | `prisma/schema.prisma:312` `@unique`; migration `20261002160000_unique_company_establishment_id` | Nullable, so repeated NULLs are fine pre-approval |
| R-30 | Backfill script: dry-run default, `--apply`, audited | IMPLEMENTED | `scripts/backfill-company-establishment-ids.ts:29-39` (dry-run default), `:69` `--apply`, `:249` same generator as approval, `:261` audit row, single transaction | |
| R-31 | Does the backfill also create the principal establishment? | **MISSING** | No `Establishment` model exists; script only sets `Company.establishmentId` | Phase E prerequisite — §4.3 |

### 3.7 Phase E — Per-Establishment Returns

Compared against `docs/design/phase-e-establishments.md`.

| # | Item (doc ref) | Status | Evidence |
|---|---|---|---|
| E-1 | `establishments` table, `EstablishmentStatus` enum (§3.2, L60-98) | **MISSING** | No `model Establishment` / `enum EstablishmentStatus` in `prisma/schema.prisma` (model index L11-2450); no `establishments` table in any of the 48 migrations |
| E-2 | Principal `-01` per company, partial unique index (§3.3.3, L108-114) | **MISSING** | No `establishments_company_principal_uidx` anywhere in `prisma/migrations/` |
| E-3 | Site codes `-02`, `-03`… + generator (§2.2 L33-38; §E.2a L211) | **MISSING** | No suffix logic. `EstablishmentIdGenerator.isValid` (`establishment-id.generator.ts:69`) matches exactly 10 chars and would **reject** `EN26000100-01` |
| E-4 | Approval creates the principal establishment (§E.1 L204) | **MISSING** | `auth.service.ts:1253-1284` writes only `Company.establishmentId` |
| E-5 | Backfill / other company-creation paths create it too | **MISSING** | `scripts/backfill-company-establishment-ids.ts` — company column only |
| E-6 | Unique live return per establishment+quarter (§3.3.4, L115-121) | **MISSING** | Live-uniqueness pre-check is keyed on **companyId**: `questionnaires.service.ts:1326-1333`; backing index is `onefop_submissions_company_quarter_live_uidx` (documented `schema.prisma:735-752`, migration `20260909100000`) |
| E-7 | Submit/draft/review/receipt/PDF show establishment CODE not UUID | N/A (blocked by E-1) | Today `OnefopSubmission.establishmentId` already holds the company **code** string (`questionnaires.service.ts:537,1351`), so nothing displays a UUID — but there is no site code to show |
| E-8 | Drafts keyed correctly | **MISSING** | `SubmissionDraft` is keyed `@@unique([establishmentId, quarterCode])` (`schema.prisma:730`) where `establishmentId` is the **company code** — one draft per company per quarter, not per site |
| E-9 | Reconciliation engine (§4, L125-159) | **MISSING** | No reconciliation service; no `CTRL_TOTAL_PERMANENT` / `CTRL_VT_PERM_TRAINERS` anywhere; no `MISSING_ESTABLISHMENT_RETURNS` or `RECONCILIATION_HEADCOUNT_DISCREPANCY` anomaly codes (`OnefopAnomaly` exists at `schema.prisma:2325`) |
| E-10 | React + Flutter multi-site flows (§E.2b L216-220, §E.2c L222-226) | **MISSING** | No site selector, no "Mes Établissements" / "Établissements secondaires" tab. Note `/admin/etablissements` and `/admin/etablissement-detail/approbation` **do** exist but are R.1 company-registration screens — "établissement" there means the company, not a Phase E site |
| E-11 | Admin views for sites | **MISSING** | As above |
| E-12 | Establishment territory FKs to regions/departments/subdivisions (§3.2 L77-82) | **MISSING** (suspected gap confirmed) | No `Establishment` model, so no FKs. Company-level FKs do exist (`schema.prisma:275-278, 317-320`) and are validated on write (T-1) |
| E-13 | ADMINISTRATION = central-only / single-site (§1.2 L16-22) | PARTIAL | `src/pilotage/pilotage-coverage.ts:63` `if (row.entityType === 'ADMINISTRATION') return {kind:'central'}`; "Niveau central" rows exist for targets/coverage. The explicit *single-site* restriction cannot exist without E-1 |
| E-14 | `CampaignSubmission` adjusted for establishments (§5.1 L165-168) | PARTIAL | `CampaignSubmission.establishmentId String?` + `@@unique([campaignId, establishmentId])` (`schema.prisma:582,588`) already exist — but as a **string**, no FK. Nullable + unique means multiple NULL rows are permitted (§4.20) |
| E-15 | Mid-campaign site approval rule (§5.2 L170-176) | **MISSING** | `campaign.service.ts:752-792` initialises campaign submissions from `company.findMany` only |
| E-16 | Exports / pilotage adjusted for establishments (§6.2 L189-193) | **MISSING** | No `siteCode` in exports; `src/data-management/` emits company-level identifiers only |
| E-17 | Legacy-client fallback & multi-site 400 (§6.1 L182-187) | **MISSING** | `src/dto/onefop-submission.dto.ts:23,41` accepts `establishmentId` "for backward compatibility"; no multi-site rejection path |

### 3.8 T.3 — Returns vs Quotas

Compared against `docs/design/t3-returns-vs-quotas.md`. **Overall: MISSING** (design only).

| # | Decision (doc ref) | Status | Evidence |
|---|---|---|---|
| X-1 | `GET /api/admin/pilotage/campaign-returns` (§5.2 L160) | **MISSING** | No such route in `src/pilotage/pilotage.controller.ts` (routes listed at Q-2); no `campaign-returns` / `CampaignReturns` symbol in `src/` or `react-web/src/` |
| X-2 | `retours` view in `/admin/cibles` (§6.1 L231) | **MISSING** | `react-web/src/app/admin/cibles/page.tsx:43` — `type Vue = "inscriptions" \| "couverture" \| "quotas"`; no `"retours"` |
| X-3 | ADMINISTRATION counts against central quota only (§4, §8.5) | PARTIAL | Bucketing rule exists for *directory stock* (`pilotage-coverage.ts:63`); not applied to returns because returns aggregation does not exist |
| X-4 | Received = submitted and not REJECTED; APPROVED separate (§3.3, §8.3) | **MISSING** | No implementation |
| X-5 | Distinct company (later establishment) per campaign (§3.2, §8.2) | **MISSING** | No implementation. The Phase E switch this item references is itself unimplemented (E-1) |
| X-6 | Territory recorded on the submission (§3.1, §8.1) | IMPLEMENTED (precondition) | `questionnaires.service.ts:1356-1365` stamps `region/department/subdivision` + FK ids at submit; `schema.prisma:766-775` |
| X-7 | Region = sum of departments (§3.7) | IMPLEMENTED for targets/quotas only | `pilotage.service.ts:225-288`; not for returns |
| X-8 | Response rate = received / registered active (§3.6) | **MISSING** | Denominator exists (`pilotage-coverage.ts:54`); numerator does not |
| X-9 | Unlinked (`campaignId` null) returns not counted (§7, §8.4) | **MISSING** | No aggregation to exclude from. `campaignId` **is** now written (`questionnaires.service.ts:1353`), so the premise has moved on — §4.14 |

### 3.9 Regional Review Tier

| # | Item | Status | Evidence |
|---|---|---|---|
| RR-1 | Regional review tier implemented? | PARTIAL | Territorial scoping of reviewer queues exists: `src/questionnaires/questionnaires.service.ts:447` ("to REGIONAL/DIVISIONAL reviewer queues"); `admin-questionnaires.controller.ts:49` grants CENTRAL/REGIONAL/DIVISIONAL/SUPER_ADMIN/SUPER_ADMIN_ONEFOP; scoping covered by `admin-questionnaires.controller.spec.ts:115` and `src/pilotage/pilotage-scope.spec.ts` |
| RR-2 | Workflow / permissions | PARTIAL | Review actions (`:id/approve`, `:id/reject`, `:id/request-correction`, `bulk-visa`, `bulk-reject`) exist under class-level `@Roles`; there is **no distinct multi-tier escalation** (regional → central) state machine |
| RR-3 | Territorial scoping on return review | IMPLEMENTED | Scoped by the submission's recorded territory, consistent with T.3 §3.1. Phase E §6.2's "site's territory" variant is N/A |

### 3.10 Pilot Prep / Backlog

| # | Item | Status | Evidence |
|---|---|---|---|
| P-1 | Official 360 arrondissements (seed currently 331?) | **CONFIRMED 331** | `prisma/seed.ts` — 58 department blocks, **331** subdivision names (counted); 29 short of 360 |
| P-2 | Sign-out bug in admin app | **CONFIRMED** | `react-web/src/app/admin/layout.tsx:47` binds `logout` and **never uses it** — ESLint: `'logout' is assigned a value but never used`. Only `app/admin/sectors/page.tsx:49` has a working control. §4.8 |
| P-3 | `Company.isTestAccount` + exclusions — confirm not half-built | **CONFIRMED NOT STARTED** | No `isTestAccount` in `prisma/schema.prisma`, `src/`, `react-web/src/` or `lib/`. Clean |
| P-4 | `docs/design/test-accounts.md` | **ABSENT** | `docs/design/` contains only `phase-e-establishments.md`, `r1-completion-spec.md`, `t3-returns-vs-quotas.md` |
| P-5 | D.1 partial unique index for diploma rows with null `cspCategory` | **MISSING** | `20261002000000_align_live_db_drift/migration.sql:9-10` creates a **plain** unique index; NULLs are distinct in Postgres so duplicates are not prevented. §4.7 |
| P-6 | PP S1 vs S4 coherence rule | **MISSING** | No S1/S4 rule in `react-web/src/lib/onefop-coherence.ts`. PP is also excluded from `checkRecruitmentScope` by design (`:202-207`, documented rationale), though it does get the S22Q03 check (`:313-345`) |
| P-7 | "Non renseignée" row | PARTIAL (Flutter only) | `lib/core/focus/renderers/category_mini_grids.dart:1140`; `mobile_card_table.dart:749,755`. No React or backend equivalent |
| P-8 | Pilotage metrics (pending registrations / agents / data quality) | PARTIAL | Pending registrations yes (Q-11); agents and data quality **missing** (Q-12) |
| P-9 | Secrets: repo + git history | **CLEAN** | §4 preamble below |

### 3.11 Secrets scan (detail)

Scanned all 64 commits (`git log --all -p`) plus the working tree for connection
strings with embedded credentials, Supabase service-role keys, `eyJ…` JWTs, `re_…`
Resend keys, `AKIA…` AWS keys, and `.env` files.

- **Tracked files:** only `.env.example` and `src/auth/jwt-secret.ts`.
- `.env.example` — placeholders only (`your-project.supabase.co`,
  `your-service-role-key`, `your-16-char-app-password`, `re_your_api_key_here`).
- `src/auth/jwt-secret.ts:11-19` — **good posture**: throws at startup if `JWT_SECRET`
  is unset rather than falling back to a literal. The previously hardcoded fallback is
  described in the comment as removed.
- `.gitignore:47-60` covers `.env`, `.env.local`, `.env.*`, `secrets.json`, `**/secrets/`.
- **One pattern hit, benign:** `NOTIFICATION_API_REFERENCE.md:191` contains
  `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` — the public base64 of
  `{"alg":"HS256","typ":"JWT"}`, truncated, with no payload or signature. Not a secret.

**Result: no committed credentials found.**

---

## 4. Defects

### Critical

#### 4.1 `subdivisions.code` is never populated — every company approval fails

**Where:** `prisma/seed.ts:746-748` · `src/auth/auth.service.ts:1258-1261` ·
`scripts/backfill-company-establishment-ids.ts:174-178` ·
`src/common/utils/establishment-id.generator.ts:34,60`

**What's wrong:** `Subdivision.code` is nullable (`prisma/schema.prisma:89`) and
**nothing in the repository ever sets it**. The seed creates subdivisions with
`data: { name: sub, departmentId: dept.id }` only. No migration contains an
`UPDATE "subdivisions" SET "code"`, and no script populates it.

Establishment-ID issuance depends on it:

```ts
// src/auth/auth.service.ts:1258-1261
if (!subdivision?.code?.trim()) {
  throw new BadRequestException("Code d'arrondissement introuvable pour cet établissement.");
}
const subdivisionCode = subdivision.code.slice(-2);
```

**Impact — three failures from one cause:**
1. **R.1 approval is impossible.** Every `approveCompanyRegistration` call throws
   `400 "Code d'arrondissement introuvable pour cet établissement."` No company can be
   approved, so no company can ever file a return.
2. **The backfill script is a no-op.** It skips every row with
   `reason: "subdivision … has no code"` and states "the script will not guess a code".
3. **Pilotage coverage reads zero.** `registered` requires a non-null
   `establishmentId` (`pilotage-coverage.ts:54`), so directory stock, `rate`, and every
   T.1/T.2 denominator stay 0 — silently, with no error.

The guard is correct (it fails loudly rather than minting a bad ID); the missing data
is the defect. The comment at `active-company.guard.ts:49` ("29 active companies have
none until R.1's backfill") suggests live rows are already in this state.

**Suggested fix:** add a migration (or seed step) that assigns official arrondissement
codes to all 331 seeded subdivisions — ideally as part of the 360-arrondissement work
(§4.10), since both touch the same reference data. Pair it with a startup or CI
assertion that no `Subdivision` has a null/blank `code`. Decide the code scheme first:
see §4.11, because a 2-digit segment cannot identify 360 subdivisions.

---

### High

#### 4.2 An already-applied migration was edited after creation (checksum drift)

**Where:** `prisma/migrations/20261002140000_campaign_reference_period_and_lateness/migration.sql`

**What's wrong:** created in `2762414` (2026-10-01), then **modified** in `80e098a`
(2026-10-02). The edit narrowed a backfill:

```sql
-UPDATE "data_campaigns" SET "referenceYear"=2026, "referenceQuarter"=3 WHERE "code" LIKE '%T3%';
+UPDATE "data_campaigns" SET "referenceYear"=2026, "referenceQuarter"=3
+WHERE "code" LIKE '%T3%' AND "collectionType" = 'ONEFOP';
```

It is the only migration in the repo touched by more than one commit.

**Impact:** Prisma stores a checksum per applied migration. On any environment that
applied the 2026-10-01 version, `prisma migrate deploy` now **fails** with a modified-
migration error and refuses to continue — blocking all later migrations
(`20261002160000_unique_company_establishment_id` among them). On environments that
applied the old version, DSMO campaigns matching `%T3%` were given ONEFOP reference
periods and the corrective `WHERE` never runs. Fresh environments are fine, which is
how this can pass unnoticed locally.

**Suggested fix:** do not edit it further. Add a **new** forward migration that
reverses the over-broad backfill (`SET referenceYear = NULL, referenceQuarter = NULL
WHERE collectionType <> 'ONEFOP'`), and, for environments already blocked, resolve the
checksum with `prisma migrate resolve` per Prisma's documented procedure. Treat applied
migrations as immutable from here.

#### 4.3 Phase E is entirely unimplemented

**Where:** `prisma/schema.prisma` (no `Establishment` model / `EstablishmentStatus`
enum) · all 48 directories in `prisma/migrations/` (no `establishments` table) ·
`src/` (no establishment service or reconciliation engine) · `react-web/src/`, `lib/`
(no site selector or management screens)

**What's wrong:** every item of `docs/design/phase-e-establishments.md` §3–§6 and the
whole §7 roadmap (E.1 through E.2d) is absent. See matrix §3.7 for the 17-item
breakdown.

**Impact:** multi-site organisations cannot file per-site returns; there is no
reconciliation, so the doc's "zero double-counting invariant" (§4.4, L158-159) is
unenforced; and the T.3 `DISTINCT establishmentId` switch (§3.2 L86-88) has nothing to
switch to. For the pilot specifically, the consequence is that a multi-site company
files **one** return covering all its sites, and the aggregate is attributed to its
headquarters' territory.

**Suggested fix:** this is feature work, not a patch. See the companion review
`docs/design/phase-e-review.md` for schema options, reconciliation policy options and
a pilot-vs-Phase-E recommendation.

#### 4.4 T.3 is entirely unimplemented

**Where:** `src/pilotage/pilotage.controller.ts` (no `campaign-returns` route) ·
`react-web/src/app/admin/cibles/page.tsx:43` (no `"retours"` view)

**What's wrong:** none of `docs/design/t3-returns-vs-quotas.md` §5–§6 exists. Matrix
§3.8 has the 9-item breakdown.

**Impact:** there is no way to compare received returns against configured quotas — the
stated purpose of T.1/T.2's quota tables. Quotas can be entered but never measured
against. During a pilot this is the main operational dashboard, and it is missing.

**Suggested fix:** T.3 is well-specified and its preconditions are already met
(`campaignId`, `isLate`, `effectiveDeadlineSnapshot` and submission territory are all
written today). It can be built at the company-grain now, exactly as the doc's
Phase B/C rule says (§8.2), and switched to establishment-grain when Phase E lands.
Of the two gaps this is the better-value one to close before pilot.

#### 4.5 `npm ci` fails in both packages — clean installs and CI are broken

**Where:** `package-lock.json`, `react-web/package-lock.json`

**What's wrong:** both lockfiles are out of sync with their `package.json`
(`@emnapi/core`, `@emnapi/runtime` missing — transitive optional deps). Full output in
§2.1.

**Impact:** any environment that installs with `npm ci` — CI, Docker builds, a fresh
clone following the documented path — fails before it starts. This audit had to fall
back to `npm install --no-save`.

**Suggested fix:** run `npm install` in both packages and commit the refreshed
lockfiles. Add `npm ci` to CI so drift fails fast next time.

#### 4.6 Phase E's migration plan collides with the current meaning of `establishmentId`

**Where:** `docs/design/phase-e-establishments.md:166, 205` vs
`src/campaign/campaign.service.ts:476-489, 544-559, 592, 764-789` ·
`src/questionnaires/questionnaires.service.ts:537, 1351` ·
`src/auth/auth.service.ts:89` · `prisma/schema.prisma:718, 730`

**What's wrong:** today `establishmentId` on `OnefopSubmission`, `CampaignSubmission`
and `SubmissionDraft` holds the **company code string** (`EN26000100`), copied from
`Company.establishmentId` at `questionnaires.service.ts:537`. Several queries rely on
that, joining the column straight back to `Company.establishmentId`:

```ts
// src/campaign/campaign.service.ts:481-485
where: { establishmentId: { in: establishmentIds } },
select: { establishmentId: true, name: true, region: true, department: true },
...
const companyMap = new Map(companies.map(c => [c.establishmentId, c]));
```

Phase E §E.1 (L205) says to "populate `OnefopSubmission.establishmentId` … with the new
establishment IDs" — i.e. overwrite those codes with `Establishment.id` UUIDs. The doc
flags the type change for `CampaignSubmission` (L166) but **not** for `OnefopSubmission`,
and nowhere notes that the column is currently a join key.

**Impact:** executed as written, the migration would silently break every lookup above
— `companyMap.get(...)` returns `undefined`, so campaign submission lists and reminder
targeting lose their company name, region and department with no error raised. It would
also destroy the only record of which company code a historical return was filed under.
Related: `EstablishmentIdGenerator.isValid` (`establishment-id.generator.ts:69`) matches
exactly 10 characters and would **reject** every Phase E site code (`EN26000100-01`);
and `auth.service.ts:89` lets a company log in with its establishment ID, which becomes
ambiguous once site codes exist.

**Suggested fix:** do not repurpose the column. Add a distinct FK (e.g.
`establishmentRefId`) alongside it and migrate readers deliberately, or rename the
existing column to `companyCode` first so the collision is visible. Either way, update
the design doc before implementing — this is the single most consequential correction
the doc needs. Options are laid out in `docs/design/phase-e-review.md` §4.

---

### Medium

#### 4.7 D.1: diploma uniqueness does not constrain NULL `cspCategory` — double-count risk

**Where:** `prisma/migrations/20261002000000_align_live_db_drift/migration.sql:9-10` ·
`prisma/schema.prisma:1549,1557` · `src/questionnaires/questionnaires.service.ts:1377`

**What's wrong:** the index is a plain unique index over
`("submissionId","cspCategory","diploma","gender","ageBand")`. `cspCategory` and
`ageBand` are both nullable, and Postgres treats NULLs as distinct in a unique index —
so rows with a NULL `cspCategory` never collide. The planned partial unique index for
that case was never created. Writes rely on the index:

```ts
diplomaData: { createMany: { data: diplomaRows, skipDuplicates: true } }
```

**Impact:** `skipDuplicates` cannot skip what the index does not consider equal, so a
payload carrying the same `(diploma, gender, ageBand)` twice with no CSP inserts two
rows. That double-counts a statistical variable — and the NULL-`cspCategory` case is
exactly the "Non renseignée" row (P-7), the most likely one to repeat.

**Suggested fix:** add a partial unique index covering the NULL-`cspCategory` rows
(`… WHERE "cspCategory" IS NULL`), or use `NULLS NOT DISTINCT` (PG15+), and
de-duplicate `diplomaRows` in the service before `createMany` rather than relying on
the index alone.

#### 4.8 Admin app has no working sign-out

**Where:** `react-web/src/app/admin/layout.tsx:47`

**What's wrong:** the admin shell binds the action and never renders a control:

```ts
const logout = useAuthStore((s) => s.logout);   // never referenced again
```

Confirmed by ESLint: `47:9 warning 'logout' is assigned a value but never used`. The
only working sign-out in the admin area is on one sub-page,
`app/admin/sectors/page.tsx:49`. The store implementation itself is fine
(`react-web/src/lib/auth-store.ts:136-139`).

**Impact:** staff on a shared workstation cannot sign out from the admin shell — a real
concern given the territorial access model treats geography as a security boundary.
Confirms the backlog item.

**Suggested fix:** render a sign-out control in the admin shell header/drawer wired to
the bound `logout`.

#### 4.9 Region lists hardcoded in 10 react-web files despite `/locations`

**Where:** `react-web/src/app/admin/dossiers/page.tsx:619` ·
`admin/pilotage/page.tsx:19` · `admin/etablissements/page.tsx:23` ·
`admin/diffusion/page.tsx:74` · `admin/activite/page.tsx:363` ·
`admin/utilisateurs/page.tsx:104` · `admin/journal-audit/page.tsx` ·
`admin/centre-qualite/page.tsx` · `components/modern-jobs/geography/CameroonGeographySelector.tsx` ·
`components/onefop/vt-cameroon-admin-data.ts:19` (a full hardcoded admin dataset) ·
plus `lib/notifications.ts`

**What's wrong:** `/locations` serves regions, departments and subdivisions
(`src/locations/locations.controller.ts:8-38`), but these screens embed the 10 region
names literally, e.g. `["Adamaoua","Centre","Est","Extrême-Nord","Littoral","Nord",
"Nord-Ouest","Ouest","Sud","Sud-Ouest"]`.

**Impact:** the canonical territory table and the UI can diverge. The pending
360-arrondissement correction (§4.10) will not propagate to any of these screens, and
`vt-cameroon-admin-data.ts` duplicates the hierarchy a second time.

**Suggested fix:** replace with a shared hook over `/locations` (cached once per
session). Treat `vt-cameroon-admin-data.ts` as the priority, since it duplicates the
whole hierarchy rather than just the region names.

#### 4.10 Seed carries 331 subdivisions, not the official 360

**Where:** `prisma/seed.ts` (58 department blocks, 331 subdivision names)

**What's wrong:** 29 arrondissements short of the official 360. Department count (58) is
correct.

**Impact:** companies in the 29 missing arrondissements cannot select their real
territory; territorial aggregation and quota denominators are incomplete.

**Suggested fix:** complete the reference data to 360 together with the code assignment
in §4.1 — one reference-data change, not two.

#### 4.11 The subdivision segment of an establishment ID cannot identify a subdivision

**Where:** `src/auth/auth.service.ts:1261` ·
`src/common/utils/establishment-id.generator.ts:60,69,88` ·
`docs/design/phase-e-establishments.md:30`

**What's wrong:** the ID format is documented as
`{Prefix:2}{Year:2}{Serial:4}{SubdivCode:2}`, as though the last pair identifies the
arrondissement. It cannot: the code is truncated twice — `subdivision.code.slice(-2)`
then `padStart(2,'0').slice(0,2)` — leaving 100 possible values for 331 (target 360)
subdivisions.

**Impact:** `EstablishmentIdGenerator.parse()` returns a `subdivisionCode` that maps to
many subdivisions, so an establishment ID is not decodable back to a territory. Any
future consumer that trusts the documented format will be wrong. Note this is a
*traceability* limitation, not an ID-collision bug: uniqueness comes from the serial,
which is advisory-lock serialised (`:43`) and backed by a unique constraint.

**Suggested fix:** decide explicitly whether the segment is meaningful. If yes, widen it
(3 digits) and assign official codes (§4.1) — a format change affecting printed
attestations, so it needs human sign-off. If no, document it as an opaque suffix and
stop describing it as `SubdivCode` in the design doc.

#### 4.12 Pilotage is missing the agents and data-quality metrics

**Where:** `src/pilotage/pilotage.service.ts`

**What's wrong:** pending registrations are covered (`:180`, plus
`auth.service.ts:1341`), but there is no `agents` metric and no data-quality metric.

**Impact:** two of the three planned pilotage indicators are unavailable.

**Suggested fix:** scope them against the Observatory/LMIS split before building —
"data quality" in particular needs a definition (anomaly counts? coherence-flag rates?)
and belongs to the ONEFOP domain owner.

#### 4.13 No PP S1-vs-S4 coherence rule

**Where:** `react-web/src/lib/onefop-coherence.ts`

**What's wrong:** no rule relates `PP_S1Q15` to the S4 tables. Separately, PP is
excluded from `checkRecruitmentScope` (`:202-207`) — that exclusion is deliberate and
documented, so it is not itself a defect; PP does receive the S22Q03 diploma check
(`:313-345`).

**Impact:** a PROJECT_PROGRAM return can report a headcount inconsistent with its S4
breakdown with no advisory flag.

**Suggested fix:** specify the rule with the ONEFOP domain owner, then add it as an
**advisory** flag — coherence checks must stay non-blocking per the engineering
constitution §7.

#### 4.14 Stale schema comment contradicts the code it documents

**Where:** `prisma/schema.prisma:780-783` vs
`src/questionnaires/questionnaires.service.ts:1353`

**What's wrong:** the schema says of `campaignId`: *"Nullable: pre-existing rows and
submissions filed outside a campaign have none. **Nothing writes it yet.**"* It is
written — `campaign: resolvedCampaignId ? { connect: { id: resolvedCampaignId } } : undefined`.

**Impact:** misleading for anyone planning T.3, whose §7 edge-case table and §8.4 rule
are both premised on unlinked legacy rows. The real situation is better than documented:
new submissions **are** linked whenever a round resolves.

**Suggested fix:** update the comment to say writes began with the campaign-linking
change and that NULL now means "no resolvable round at submit time".

#### 4.15 "Non renseignée" row exists only in Flutter

**Where:** `lib/core/focus/renderers/category_mini_grids.dart:1140` ·
`lib/core/focus/renderers/mobile_card_table.dart:749,755`; no React or backend
equivalent

**Impact:** the two clients present the unspecified-category row differently — a parity
gap that matters because React is the stated migration target, and it interacts with
§4.7 (the NULL-`cspCategory` rows are exactly these).

**Suggested fix:** implement the same row in the React statistical table, and settle
§4.7 at the same time.

---

### Low

#### 4.16 `tsc --noEmit` in react-web requires a prior `next build`

`src/app/layout.tsx:30` uses `LayoutProps<"/">`, a Next.js 16 generated global emitted
to `.next/types/routes.d.ts:87`. Standalone typecheck fails with TS2304; after
`next build` it is clean (§2.5). **Fix:** run `next typegen` (or `next build`) before
`tsc` in CI, so a genuine type error is distinguishable from a missing-typegen error.

#### 4.17 Debug `console.log` on the submission path

`src/questionnaires/questionnaires.service.ts:557` logs resolved ids
(`console.log('establishmentId (resolved):', ...)`) on every submission. **Fix:** use
the Nest logger at debug level, or remove.

#### 4.18 `docs/design/test-accounts.md` is referenced but absent

The test-account design is cited as deferred, but `docs/design/` has only three files.
The feature is correctly not half-built (P-3). **Fix:** add the doc or drop the
reference, so "deferred" is distinguishable from "lost".

#### 4.19 `POST onefop/preview` accepts an unvalidated body

`src/questionnaires/questionnaires.controller.ts:65-76` — `@Body() body: any` with
`whitelist: false, forbidNonWhitelisted: false`, feeding the Puppeteer PDF renderer.
Authentication and `ActiveCompanyGuard` apply (`:58`), so this is not an access gap.
**Fix:** bound the payload size and shape before it reaches the renderer.

#### 4.20 `CampaignSubmission.establishmentId` is nullable under a unique constraint

`prisma/schema.prisma:582,588` — `@@unique([campaignId, establishmentId])` over a
nullable column permits unlimited NULL rows per campaign. `campaign-review-sync.ts`
already works around the consequence, noting that `companyId: null` "would match
establishment-keyed rows of the campaign". **Fix:** resolve as part of Phase E's
`CampaignSubmission` change (E-14), not before.

#### 4.21 DB-enforced campaign invariants are undocumented in the schema

The CHECK constraints and the ARCHIVED-excluding partial unique index from
`20261002140000` are invisible in `schema.prisma:550-551` (plain `Int?`). The repo has
a good precedent for recording exactly this — the detailed note at
`schema.prisma:735-752` for the submission duplicate guard. **Fix:** add an equivalent
comment above `referenceYear`/`referenceQuarter`.

#### 4.22 One email path interpolates company-supplied text into HTML unescaped

`src/dsmo/notification.service.ts:262` — the bulk campaign reminder uses
`this.generateEmailHtml(company.name, message)` with no `escapeEmailHtml`, while the
decision emails do escape (`:543`, `:561`). `company.name` is self-registered input.
**Impact:** HTML injection into outbound reminder emails (not stored XSS in the app).
**Fix:** wrap both arguments in `escapeEmailHtml`, as the decision emails do.

---

## 5. Remaining work to pilot, in recommended order

Sizes are rough engineering estimates, not commitments.

| # | Work | Size | Why this order |
|---|---|---|---|
| 1 | **Populate `subdivisions.code` + complete 360 arrondissements** (§4.1, §4.10) | S–M | Nothing else matters until approval works. One reference-data change clears a Critical and a Medium. Decide the code width first (§4.11) |
| 2 | **Unblock migrations** (§4.2) | S | A forward corrective migration + `migrate resolve`. Until this clears, no schema change can deploy |
| 3 | **Fix the lockfiles** (§4.5) | S | `npm install` in both packages; add `npm ci` to CI. Unblocks reproducible builds |
| 4 | **Admin sign-out** (§4.8) | S | One control; security-relevant; confirmed defect |
| 5 | **D.1 diploma NULL uniqueness + de-dup** (§4.7) | S | Statistical-integrity risk, cheap to fix, and it is silent when it goes wrong |
| 6 | **Decide pilot grain: single-establishment now, or Phase E first** | — | A decision, not code. See `docs/design/phase-e-review.md` §7. Everything below depends on it |
| 7 | **T.3 at company grain** (§4.4) | M | Preconditions already met; gives the pilot its operational dashboard. Designed to switch to establishment grain later (T.3 §8.2) |
| 8 | **Correct the Phase E design doc** (§4.6) | S | Must precede any Phase E implementation, or the migration silently breaks campaign lookups |
| 9 | **Region lists → `/locations`** (§4.9) | M | Do after item 1, so the corrected reference data actually propagates |
| 10 | **Phase E implementation** (§4.3) | L | Schema + migration + reconciliation + both clients + exports/pilotage. Needs human approval: schema change, questionnaire semantics, export format |
| 11 | **Pilotage agents / data-quality metrics** (§4.12) | M | Needs definitions from the ONEFOP domain owner first |
| 12 | **PP S1-vs-S4 coherence rule** (§4.13) | S–M | Advisory only; needs domain specification |
| 13 | **React "Non renseignée" parity** (§4.15) | S | Pair with item 5 |
| 14 | **Low-severity cleanups** (§4.16–§4.22) | S | Opportunistic; §4.22 (email escaping) is the one worth not deferring |

### Items requiring explicit human approval before implementation

Per the engineering constitution §21: the Phase E schema and migration (item 10), any
change to the establishment-ID format (§4.11, printed on attestations), the export
format changes Phase E implies, and any change to statistical definitions behind the
new coherence rule (item 12) and the data-quality metric (item 11).

---

## 6. Where the design docs contradict themselves or the code

1. **`establishmentId` repurposing is unflagged** — Phase E L205 vs
   `campaign.service.ts:481-489`. The doc notes the string→FK change for
   `CampaignSubmission` (L166) but not for `OnefopSubmission`, and never mentions the
   column is currently a join key onto `Company.establishmentId`. §4.6 — the most
   consequential doc correction needed.
2. **`SubdivCode` is not a subdivision code** — Phase E L30 vs
   `auth.service.ts:1261` + `establishment-id.generator.ts:60`. Double truncation
   leaves 100 values for 331+ subdivisions. §4.11.
3. **Site codes fail the project's own validator** — Phase E L36-37 specifies
   `EN26000100-01`; `establishment-id.generator.ts:69` matches exactly 10 characters
   and rejects it. The doc does not mention updating `isValid`.
4. **T.3 says nothing writes `campaignId`; the code does** — T.3 §2.1 L48 ("populated
   via Phase 0.3 / B1") is now satisfied, while `schema.prisma:782` still says
   "Nothing writes it yet". The doc is right and the schema comment is stale. §4.14.
5. **T.3's own ADMINISTRATION rule is marked unresolved** — §4.3 L143 and §8.5 L292
   label it "proposed … recorded below for confirmation". It is a design decision still
   open, not an implementation gap; the matrix records it as PARTIAL (X-3) for that
   reason.
6. **T.3 cites a line number that does not match** — §2.2 L66 attributes coverage to
   `pilotage.service.ts:109`; the coverage logic is in
   `src/pilotage/pilotage-coverage.ts` (`classifyBucket` at `:61`, `registered` at
   `:54`), with `pilotage.service.ts:180` consuming it. Minor, but the doc also carries
   an absolute `file:///c:/Users/win/dsmo_app/...` path at §4 L132 that will not resolve
   for anyone else.
7. **Phase E assumes a merge that has not happened** — §7 L199 makes implementation
   conditional on `feat/targets` being merged to master. Targets/quotas code is present
   at this commit (`20261001153000_add_territory_targets_and_campaign_quotas`), so the
   prerequisite appears met, but the doc's branch-state framing is stale.
8. **`docs/design/test-accounts.md` is referenced but does not exist** — §4.18.
