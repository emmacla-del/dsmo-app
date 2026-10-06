# FE-BE contract audit — admin app — 2026-10-05

Read-only survey. No source file was modified, no tests were run, no commits.
This is the only file written.

Supersedes the contract portion of `fe-be-contract-2026-10-04.md` for the
admin surface. That document stays as history; findings carried from it are
cited as `[10-04 #n]`.

## Scope and method

**Frontend.** Every API call reached from an admin page
(`react-web/src/app/admin/**`) or an admin component
(`react-web/src/components/admin/*`), traced through to the helper that issues
it, wherever that helper lives (`src/lib/*.ts`, `src/hooks/*`). Calls reached
only from non-admin routes (respondent wizard, `/home/*` respondent pages,
login/register/reset flows) are out of scope. They are listed, not put in the
matrix.

Three `components/admin/*` are mounted only under `/home/*` staff pages
(`CampaignManagement` → `/home/communication`, `CompaniesDirectory` and
`UsersDirectory` → `/home/annuaire`). They are admin components, so they are
**in scope**.

**Backend.** Every route on every controller the admin app reaches (11
controllers, 114 routes), not only `/admin/*`. BE-only analysis runs against
all 114.

**Flutter (`lib/`) was not inspected.** A BE-only route may still have a
Flutter caller. The (a)/(b)/(c) classification in Category 3 is therefore
provisional for any route marked *Flutter?*.

**Verification level.** Each matched row is marked:
- **RV** — re-verified in this session against current source.
- **C** — carried from `[10-04]` after confirming the call site still exists. The field-level claim was not re-traced.

**Return types.** Most NestJS handlers here have no declared return type; the
type is inferred from the service method. "inferred" below means exactly that.
Named types are given where they exist.

**Fact recorded (per user, 2026-10-05).** Migrations
`20261008120000_campaign_quota_scope_kind` and
`20261009120000_campaign_published_at` are applied in production (confirmed by
`npx prisma migrate status`), and the production backend runs against both.
The ADMINISTRATION-cohort read/write path in `CampaignQuota` is therefore live.

---

## Summary counts

| Category | Count | Notes |
|---|---|---|
| **1 — Matched** (admin FE call ↔ live BE route) | **61 endpoints** | 28 shape-clean, 33 carry at least one Category-4 row |
| **2 — FE-only** | **0** | No admin call hits a missing, renamed or retired route |
| **3 — BE-only** (no react-web caller at all) | **40 routes** | incl. 3 intentionally retired (410) and 1 not-yet-built (`coverage/semester`) |
| **4 — Shape drift** | **29 rows** | 1 HIGH, 2 MED, 4 LOW-latent, 22 LOW |
| Out of scope (BE route called only by non-admin react-web) | 13 routes | Listed in §3b |
| *Role-gate drift (outside the four categories)* | *4 rows* | FE lets a role reach a call the BE `@Roles` rejects. See §5 |

114 BE routes = 61 matched + 40 BE-only + 13 non-admin-only.

**BLOCKERs: none.** No admin button or query 404s, and no FE caller of a 410
route remains.

---

## Step 1 recap — prior audits

| Doc | Status |
|---|---|
| `admin-integrity-2026-10-03.md` | Historical baseline. Superseded by its v2. |
| `admin-integrity-2026-10-05.md` (v2) | Status roll-up. **Partly stale itself:** A-01 is listed "MITIGATED", but `5c1cc363` removed the Render fallback outright. C7/A-07 say the 30s poll "no longer fires for rejected roles", but `layout.tsx:41` still polls every 30s and AUDITOR is still rejected (R1 below). It predates 4a–6a. Not edited, because this task may write only one file. |
| `fe-be-contract-2026-10-04.md` | #1, #2, #17, #22 fixed (`15ef138b`); #3 fixed (`6f67c1d5`). All `/onefop/*`, `/auth/login`, `register-company` and `/home/declarations` rows fall outside the admin scope now. Pilotage and campaign rows were re-verified here. |
| `endpoint-integrity-2026-10-04.md` | Data-integrity, not contract. #4, #5/#6, #8 fixed (`30d98fd2`); #9 typing fixed (`815a50e3`); #1/#2 routes retired. #7 (actor-summary coverage ignores `period`) is still open. It is not a contract issue, so it is not repeated here. |

---

## Admin page inventory

21 files under `react-web/src/app/admin/`. Every page is either covered by the
matrix or has no API call of its own.

| File | API calls | Covered |
|---|---|---|
| `_routes.ts` | none (nav config) | static |
| `error.tsx` | none | static |
| `layout.tsx` | queues poll; `/auth/me` via `auth-store` | ✓ |
| `pilotage/page.tsx` | queues, stats, recent questionnaires, quality summary, registrations count, active campaign | ✓ |
| `dossiers/page.tsx` | list, queues, bulk-visa, bulk-reject, export (raw `fetch`) | ✓ |
| `dossiers/[id]/page.tsx` | detail, diagnostic, approve, reject, request-correction | ✓ |
| `cibles/page.tsx` | campaigns list, quotas GET/PUT, coverage/annual, returns | ✓ |
| `campagnes/page.tsx` | campaigns list/detail/create + 6 lifecycle mutations | ✓ |
| `questionnaires/page.tsx` | per-type questionnaire totals; static schema asset | ✓ |
| `centre-qualite/page.tsx` | registry, quality summary, rules, resolve | ✓ |
| `diffusion/page.tsx` | stats, campaigns, export history, per-type totals, manifest, 3 binary exports; static schema asset | ✓ |
| `etablissements/page.tsx` | companies, companies/stats, data-management/stats | ✓ |
| `etablissement-detail/page.tsx` | companies (search-and-find), questionnaires, audit log, suspend/activate/delete user | ✓ |
| `etablissement-detail/approbation/page.tsx` | companies, documents, verify, approve/reject/complements | ✓ |
| `inscriptions/page.tsx` | company-registrations, approve/reject/complements | ✓ |
| `inscriptions/nouvelle/page.tsx` | admin/register-company; territory structure | ✓ |
| `journal-audit/page.tsx` | audit reports, users (actor filter) | ✓ |
| `notifications/page.tsx` | notifications list, mark read | ✓ |
| `parametres/page.tsx` | system-settings GET/PATCH, audit, campaigns | ✓ |
| `sectors/page.tsx` | `/sectors` | ✓ |
| `utilisateurs/page.tsx` | users ×4 queries, create-minefop-user, territory | ✓ |
| `equipe/page.tsx` | actor-summary, nudge; territory structure | ✓ |

Pages deleted since 10-04 (`08618fba`): `activite`, `files-attente`. References
to them in `[10-04]` (e.g. #8's second call site) are stale.

Static assets fetched but not backend calls: `/schemas/onefop.schema.json`
(`use-onefop-schema.ts:7`, used by `questionnaires` and `diffusion`).

---

## Category 1 — MATCHED

Trigger: **A** = automatic (query on mount / poll); **U** = user-triggered.
Roles are the BE `@Roles` gate. `ADM4` = `SUPER_ADMIN, ADMIN_ONEFOP,
REGIONAL_ADMIN, DIVISIONAL_ADMIN`. `UA` = `USER_ADMIN_ROLES` =
`SUPER_ADMIN, ADMIN_ONEFOP`. `UA+T` = UA + `REGIONAL_ADMIN, DIVISIONAL_ADMIN`.
`NAT3` = `SUPER_ADMIN, ADMIN_ONEFOP, REGIONAL_ADMIN`.

### 1a. `/admin/pilotage/*` (focus)

| FE helper | FE path | FE type | Trigger (page:line) | BE controller:line | Service | R/W | Roles | Shape | V |
|---|---|---|---|---|---|---|---|---|---|
| `pilotage-targets.ts:195` | `GET /admin/pilotage/coverage/annual?year=` | `CoverageResponse` | A — `cibles/page.tsx:381` | `pilotage.controller.ts:105` | `pilotage.getCoverage` (inferred) | R | PILOTAGE_READ (ADM4) | **OK.** All keys agree, incl. `companyCount` (`497173e1`) and `period{year,quarter,semester,campaignIds}` (`744cbd97`; declared, not rendered) | RV |
| `pilotage-targets.ts:201` | `GET /admin/pilotage/campaigns/:id/quotas` | `CampaignQuotasResponse` | A — `cibles/page.tsx:192` | `pilotage.controller.ts:120` | `pilotage.getCampaignQuotas` (inferred) | R | ADM4 | OK; D10 (LOW) | RV |
| `pilotage-targets.ts:207` | `PUT /admin/pilotage/campaigns/:id/quotas` | body `TargetPutBody` → `CampaignQuotasResponse` | U — `cibles/page.tsx:233` | `pilotage.controller.ts:132` | `pilotage.putCampaignQuotas` | W | PILOTAGE_WRITE (`SUPER_ADMIN, ADMIN_ONEFOP`) | **OK.** FE sends `[field]` = `submissionTarget` only (`cibles/page.tsx:489`); `central:{submissionTarget}` or `null` is parsed by `parseCentral` (`pilotage-validation.ts:142`) into the ADMINISTRATION row. Response = re-read of GET. D10 | RV |
| `pilotage-targets.ts:214` | `GET /admin/pilotage/campaigns/:id/returns` | `CampaignReturnsResponse` | A — `cibles/page.tsx:571` | `pilotage.controller.ts:126` | `pilotage.getCampaignReturns` → `CampaignReturnsResponse` (`pilotage-returns.ts:41`) | R | ADM4 | FE and BE interfaces are field-identical; D8, D9 | RV |

### 1b. `/admin/questionnaires/*`

Controller `admin-questionnaires.controller.ts`, class roles ADM4. Returns inferred.

| FE helper | FE path | FE type | Trigger | BE line | Service | R/W | Shape | V |
|---|---|---|---|---|---|---|---|---|
| `api-client.ts:608` | `GET …/pilotage/queues` | `PilotageQueues` | A — `layout.tsx:37` (poll 30s), `AdminPageHeader.tsx:88`, `pilotage/page.tsx:328` (poll 120s), `dossiers/page.tsx:207` | :79 | `eligibilityEngine.getPilotageQueues` → `PilotageQueues` | R | OK. All 8 keys emitted (`eligibility-engine.service.ts:318-326`) after `65391732` | RV |
| `api-client.ts:619` | `GET /admin/questionnaires` | `AdminQuestionnairesPage` (`items:any[]`) | A — `dossiers/page.tsx:185`, `pilotage/page.tsx:341`, `questionnaires/page.tsx:51`, `diffusion/page.tsx:262`, `etablissement-detail/page.tsx:143` | :139 | `service.listForAdmin` | R | D2, D3 | RV (pilotage), C |
| `api-client.ts:665` | `GET /admin/questionnaires/:id` | `AdminDossier` | A — `dossiers/[id]/page.tsx:93` | :250 | `service.getById` | R | **D1 (HIGH)** | RV |
| `api-client.ts:669` | `GET …/:id/diagnostic` | `DossierDiagnostic` | A — `dossiers/[id]/page.tsx:99` | :245 | `eligibilityEngine.evaluateDossier` | R | D5 | C |
| `api-client.ts:673` | `PATCH …/:id/approve` | `unknown` | U — `dossiers/[id]/page.tsx:213` | :255 | `service.approve` | W | OK | C |
| `api-client.ts:679` | `PATCH …/:id/reject` | `unknown`; body `{reason,certified}` | U — `:194` | :260 | `service.reject` | W | OK | C |
| `api-client.ts:686` | `PATCH …/:id/request-correction` | `unknown`; body `{comments,certified}` | U — `:155` | :273 | `service.requestCorrection` | W | OK | C |
| `api-client.ts:693` | `POST …/bulk-visa` | inline literal | U — `dossiers/page.tsx:214` | :88 | `eligibilityEngine.executeBulkVisa` | W | OK | C |
| `api-client.ts:707` | `POST …/bulk-reject` | inline literal | U — `dossiers/page.tsx:226` | :96 | `eligibilityEngine.executeBulkReject` | W | OK | C |
| raw `fetch` `dossiers/page.tsx:388` | `GET …/export?format=` | Blob | U — export button | :203 | `service.streamDossiersExport` | R | OK (blob; error path reads `body.message`) | RV |
| `anomaly-registry.ts:77` | `GET …/anomalies/registry` | `AnomalyRegistryPage` | A — `centre-qualite/page.tsx:69` | :104 | `eligibilityEngine.listAnomalies` | R | D6 | C |
| `anomaly-registry.ts:88` | `PATCH …/anomalies/:id/resolve` | `AnomalyRecord` | U — `centre-qualite/page.tsx:121` | :125 | `eligibilityEngine.resolveAnomaly` | W | D4 | RV (caller) |
| `anomaly-registry.ts:136` | `GET …/quality/summary[?campaignId]` | `QualitySummary` | A — `centre-qualite/page.tsx:81`, `pilotage/page.tsx:349` (poll 120s) | :59 | `eligibilityEngine.getQualitySummary` | R | OK | C |
| `anomaly-registry.ts:151` | `GET …/rules` | `ValidationRuleItem[]` | A — `centre-qualite/page.tsx:89` | :71 | `eligibilityEngine.getValidationRules` | R | D7 | C |

### 1c. `/campaigns`

Controller `campaign.controller.ts`. Reads: NAT3. Writes: `SUPER_ADMIN, ADMIN_ONEFOP`.

| FE helper | FE path | FE type | Trigger | BE line | Service | R/W | Shape | V |
|---|---|---|---|---|---|---|---|---|
| `campaigns.ts:92` | `GET /campaigns[?status]` | `Campaign[]` | A — `campagnes/page.tsx:121`, `cibles/page.tsx:430,508`, `diffusion/page.tsx:182`, `parametres/page.tsx:139`, `AdminHeaderActions.tsx:21` (every admin header), `CampaignManagement.tsx:77` | :23 | `campaignService.listCampaigns` → `toCampaignWire` | R | Dual-emits `periodicity` + legacy `type`; FE reads `periodicity` first (`822fbcf3`). D17 | RV |
| `campaigns.ts:97` | `GET /campaigns/:id` | `CampaignDetail` | A — `campagnes/page.tsx:652` (dialog) | :52 | `getCampaign` → `toCampaignWire` | R | D17 | RV |
| `campaigns.ts:132` | `POST /campaigns` | `Campaign`; body sends `periodicity` + `type` | U — `campagnes/page.tsx:755` | :17 | `createCampaign` | W | Enums agree (`QUARTERLY/SEMESTER/ANNUAL`, `COLLECTION/REGISTRATION`). D18 | RV |
| `campaigns.ts:139` | `POST /campaigns/:id/activate` | `Campaign` | U — `campagnes/page.tsx:139`, `CampaignManagement.tsx:85` | :70 | `activateCampaign` | W | D16 | RV |
| `campaigns.ts:143` | `POST …/pause` | `Campaign` | U — `:140`, `CampaignManagement.tsx:91` | :76 | `pauseCampaign` | W | D16 | RV |
| `campaigns.ts:147` | `POST …/close` | `Campaign` | U — `:141`, `CampaignManagement.tsx:97` | :82 | `closeCampaign` | W | D16 | RV |
| `campaigns.ts:169` | `POST …/archive` | `Campaign` | U — `:142` | :88 | `archiveCampaign` | W | D16 | RV |
| `campaigns.ts:151` | `POST …/extend` | `Campaign`; body `{newDeadline}` | U — `CampaignManagement.tsx:103` | :94 | `extendDeadline` | W | **D15 (MED)** | C |
| `campaigns.ts:158` | `POST …/remind` | untyped | U — `campagnes/page.tsx:144`, `CampaignManagement.tsx:107` | :112 | `sendReminders` | W | OK (untyped) | C |
| `campaigns.ts:165` | `DELETE /campaigns/:id` | untyped | U — `:143`, `CampaignManagement.tsx:111` | :64 | `deleteCampaign` | W | OK | C |

### 1d. `/auth/*` (admin-reached)

| FE helper | FE path | FE type | Trigger | BE line (`auth.controller.ts`) | Service (`authService.*`) | R/W | Roles | Shape | V |
|---|---|---|---|---|---|---|---|---|---|
| `api-client.ts:248` via `auth-store.ts:69,143` | `GET /auth/me` | `User` | A — session boot on every admin page | :61 | `getMe` | R | any JWT | D29 | C |
| `user-directory.ts:59` | `GET /auth/users` | `ListUsersResult` | A — `utilisateurs/page.tsx:101,114,120,129`, `journal-audit/page.tsx:130`, `UsersDirectory.tsx:104` | :367 | `listUsers` | R | UA | D20 | C |
| `user-directory.ts:78` | `PATCH /auth/approve-user/:id` | untyped | U — `inscriptions/page.tsx:146`, `approbation/page.tsx:123`, `UsersDirectory.tsx:132` | :274 | `approveUser` | W | UA+T | D21 | RV |
| `user-directory.ts:85` | `PATCH /auth/reject-user/:id` | untyped | U — `inscriptions/page.tsx:152`, `approbation/page.tsx:123`, `UsersDirectory.tsx:133` | :290 | `rejectUser` | W | UA+T | OK. All three callers now gate on a non-empty reason (`approbation:148`, `UsersDirectory:575`) | RV |
| `user-directory.ts:92` | `PATCH /auth/request-complements/:id` | untyped | U — `inscriptions:157`, `approbation:123` | :297 | `requestComplements` | W | UA+T | OK | C |
| `user-directory.ts:116` | `GET /auth/users/:id/documents` | `UserDocumentsResult` | A — `approbation/page.tsx:99` | :310 | `getUserDocuments` | R | UA+T | OK | C |
| `user-directory.ts:120` | `PATCH /auth/users/:id/documents/:kind/verify` | `RegistrationDocumentItem` | U — `approbation/page.tsx:105` | :317 | `verifyUserDocument` | W | UA+T | D13 | RV (caller) |
| `user-directory.ts:165` | `GET /auth/company-registrations` | `CompanyRegistrationsResult` | A — `inscriptions/page.tsx:116`, `pilotage/page.tsx:363` (KPI tile, poll 120s, gated APPROVAL_ROLES) | :329 | `listCompanyRegistrations` | R | UA+T | OK. `counts.{pending,complements,approved,rejected}` agree (`auth.service.ts:1779`). Fixes KPI tile (`8c74457e`). D22 | RV |
| `user-directory.ts:221` | `PATCH /auth/users/:id/role` | untyped | U — `UsersDirectory.tsx:137` | :409 | `updateUserRole` | W | UA | OK | C |
| `user-directory.ts:228` | `PATCH /auth/users/:id/suspend` | untyped | U — `etablissement-detail:163`, `UsersDirectory:141` | :442 | `setUserActive` | W | UA | OK | C |
| `user-directory.ts:232` | `PATCH /auth/users/:id/activate` | untyped | U — `etablissement-detail:172`, `UsersDirectory:141` | :449 | `setUserActive` | W | UA | OK | C |
| `user-directory.ts:236` | `DELETE /auth/users/:id` | `{message}` | U — `etablissement-detail:181`, `UsersDirectory:145` | :456 | `deleteUser` | W | UA | OK | C |
| `user-directory.ts:246` | `PATCH /auth/users/:id/territory` | `DirectoryUser` | U — `utilisateurs:612`, `UsersDirectory:146` | :422 | `updateUserTerritory` | W | `SUPER_ADMIN, ADMIN_ONEFOP` | D12 | C |
| `user-directory.ts:272` | `POST /auth/admin/create-minefop-user` | `{user,temporaryPassword}` | U — `utilisateurs/page.tsx:504` | :171 | `adminCreateMinefopUser` | W | `SUPER_ADMIN, ADMIN_ONEFOP` | D19 | C |
| `inscriptions.ts:99` | `POST /auth/admin/register-company` | `AssistedRegistrationResult` | U — `inscriptions/nouvelle/page.tsx:99` | :205 | `adminRegisterCompany` (`AssistedRegistrationDto`) | W | ADM4 | **D28 (MED)** | RV |

### 1e. Notifications, audit, companies, data-management, settings, reference data

| FE helper | FE path | FE type | Trigger | BE controller:line | Service | R/W | Roles | Shape | V |
|---|---|---|---|---|---|---|---|---|---|
| `notifications-inbox.ts:28` | `GET /auth/me/notifications` | `UserNotification[]` | A — `notifications/page.tsx:36`, `NotificationBell.tsx:56` | `notifications.controller.ts:32` | `notifications.listForUser` | R | any JWT | OK (`userId` extra, LOW) | C |
| `notifications-inbox.ts:36` | `GET …/unread-count` | `{count}` | A — `NotificationBell.tsx:49` (poll 30s, every admin header) | :44 | `unreadCount` | R | any JWT | OK | C |
| `notifications-inbox.ts:40` | `PATCH …/:id/read` | `UserNotification` | U — `notifications/page.tsx:42`, `NotificationBell.tsx:63` | :49 | `markRead` | W | any JWT | D14 | RV (caller) |
| `audit-log.ts:39` | `GET /audit/reports?paginate=true` | `AuditLogPage` | A — `journal-audit:109`, `parametres:118`, `etablissement-detail:129` | `audit.controller.ts:31` | `reportService.getAuditLog` | R | `SUPER_ADMIN, ADMIN_ONEFOP, AUDITOR` | D23 | C |
| `actor-summary.ts:66` | `GET /audit/actor-summary` | `ActorSummaryResponse` | A — `equipe/page.tsx:64` | `audit.controller.ts:60` | `actorSummaryService.getActorSummary` | R | NAT3 | OK (`744cbd97` changed a doc comment only) | C |
| `actor-summary.ts:90` | `POST /audit/nudge` | `{id}` | U — `equipe/page.tsx:75` | :75 | `actorSummaryService.nudge` | W | NAT3 | OK | C |
| `companies-directory.ts:66` | `GET /companies/stats` | `CompanyStats` | A — `etablissements/page.tsx:140` | `companies.controller.ts:29` | `dsmoService.getCompanyStats` | R | ADM4 | OK (buckets now disjoint, `30d98fd2`) | C |
| `companies-directory.ts:70` | `GET /companies` | `ListCompaniesResult` | A — `etablissements:151`, `etablissement-detail:102`, `approbation:77`, `CompaniesDirectory.tsx:106` | :36 | `dsmoService.listCompanies` | R | ADM4 | D24 | C |
| `api-client.ts:814` | `GET /data-management/stats` | `DataManagementStats` | A — `pilotage/page.tsx:335` (poll 120s), `etablissements:135`, `diffusion:174` | `data-management.controller.ts:55` | `getDataStats` | R | NAT3 | D25; see R2 | C |
| `api-client.ts:831` | `GET …/export/history?limit=` | `ExportHistoryItem[]` | A — `diffusion/page.tsx:229` | :89 | `getExportHistory` | R | NAT3 | OK | C |
| `api-client.ts:721` | `POST …/export/submissions/spss/manifest` | `{sps}` | U — `diffusion/page.tsx:366` | :116 | `buildSpssManifest` | R | NAT3 | OK | C |
| `api-client.ts:785` | `POST …/spss/csv` | Blob | U — `diffusion` export | :129 | `logExport` + stream | R | NAT3 | OK (binary clean, `[10-04]`) | C |
| `api-client.ts:789` | `POST …/spss/sav` | Blob | U | :143 | `logExport` + stream | R | NAT3 | OK | C |
| `api-client.ts:793` | `POST …/submissions/excel` | Blob | U | :103 | `logExport` + stream | R | NAT3 | OK | C |
| `system-settings.ts:36` | `GET /system-settings` | `SystemSettings` | A — `parametres/page.tsx:108` | `system-settings.controller.ts:15` | `getSettings` | R | `SUPER_ADMIN` | D27 | C |
| `system-settings.ts:40` | `PATCH /system-settings` | `SystemSettings` | U — `parametres/page.tsx:175` | :20 | `updateSettings` | W | `SUPER_ADMIN` | D27 | C |
| `api-client.ts:330` | `GET /locations/structure` | `LocationRegion[]` | A — `useTerritoryStructure.ts:42` (dossiers, diffusion, etablissements, inscriptions, utilisateurs, equipe, pilotage, UsersDirectory) | `locations.controller.ts:37` | `getFullStructure` | R | any JWT | D26 | C |
| `api-client.ts:305` | `GET /sectors` | `Sector[]` | A — `sectors/page.tsx:18` | `sectors.controller.ts:19` | `getAllSectors` | R | public | D26 | C |

---

## Category 2 — FE-ONLY

**0 rows.**

- Every admin call resolves to a live route with a matching verb (61/61).
- No admin caller of a retired route remains. A search of `react-web/src` for
  `targets/inscriptions`, `pilotage/coverage` (other than `coverage/annual`),
  `getCoverage`, `getInscriptionTargets` and `putInscriptionTargets` returns
  nothing. The two lib helpers were removed in `3576887b`, and `getCoverage`
  was renamed to `getAnnualCoverage` in `1d1647ea`.
- No comment or unused admin helper names a dead path.

Type-level leftovers of the retired inscription target are listed as D10
(Category 4, LOW). They are not paths.

---

## Category 3 — BE-ONLY

### 3a. No react-web caller at all (40)

Classification: **(a)** FE feature not built · **(b)** dead backend surface ·
**(c)** internal / other-client endpoint · **(r)** intentionally retired.
*Flutter?* means a Flutter caller is plausible but was not checked (out of
scope), so the class is provisional.

| BE controller:line | Path | Method | R/W | `@Roles` | Class | Note |
|---|---|---|---|---|---|---|
| `pilotage.controller.ts:52` | `/admin/pilotage/targets/inscriptions` | GET | R | ADM4 | (r) | 410 since 4b (`3576887b`) |
| `pilotage.controller.ts:112` | `/admin/pilotage/targets/inscriptions` | PUT | W | `SUPER_ADMIN, ADMIN_ONEFOP` | (r) | 410 since 4b |
| `pilotage.controller.ts:70` | `/admin/pilotage/coverage` | GET | R | ADM4 | (r) | 410 since 4c (`1d1647ea`) |
| `pilotage.controller.ts:86` | `/admin/pilotage/coverage/semester` | GET | R | ADM4 | (a) | Added in 4a; Cibles has no semester view yet |
| `admin-questionnaires.controller.ts:181` | `/admin/questionnaires/pending` | GET | R | ADM4 | (b) | Superseded by `?status=PENDING_REVIEW` |
| `admin-questionnaires.controller.ts:190` | `/admin/questionnaires/correction-requested` | GET | R | ADM4 | (b) | Superseded by `?status=CORRECTION_REQUESTED` |
| `campaign.controller.ts:36` | `/campaigns/active/current` | GET | R | none (JWT) | (c) *Flutter?* | Company-side; react-web respondent pages do not call it |
| `campaign.controller.ts:43` | `/campaigns/conflicts` | GET | R | `SUPER_ADMIN, ADMIN_ONEFOP` | (a) | Pre-create conflict check; create dialog skips it |
| `campaign.controller.ts:58` | `/campaigns/:id` | PUT | W | `SUPER_ADMIN, ADMIN_ONEFOP` | (a) | No edit-campaign UI |
| `campaign.controller.ts:100` | `/campaigns/:id/progress` | GET | R | NAT3 | (b) | Embedded in `GET /campaigns` |
| `campaign.controller.ts:106` | `/campaigns/:id/submissions` | GET | R | NAT3 | (a) | No per-campaign submission list |
| `data-management.controller.ts:16` | `/data-management/regions` | GET | R | NAT3 | (b) | FE uses `/locations/structure` |
| `data-management.controller.ts:22` | `/data-management/sectors` | GET | R | NAT3 | (b) | FE uses public `/sectors` |
| `data-management.controller.ts:28` | `/data-management/regions/:id` | PATCH | W | `SUPER_ADMIN, ADMIN_ONEFOP` | (a)/(b) | No nomenclature editor |
| `data-management.controller.ts:34` | `/data-management/regions/:id` | DELETE | W | same | (a)/(b) | Destructive write with no UI |
| `data-management.controller.ts:40` | `/data-management/sectors/:id` | PATCH | W | same | (a)/(b) | — |
| `data-management.controller.ts:49` | `/data-management/sectors/:id` | DELETE | W | same | (a)/(b) | Destructive write with no UI |
| `data-management.controller.ts:62` | `/data-management/export/submissions` | GET | R | NAT3 | (b) *Flutter?* | JSON export; react-web uses the binary routes |
| `data-management.controller.ts:68` | `/data-management/export/submissions` | POST | R | NAT3 | (b) *Flutter?* | same |
| `data-management.controller.ts:96` | `…/export/submissions/excel` | GET | R | NAT3 | (b) *Flutter?* | GET twin of the POST the FE uses |
| `data-management.controller.ts:110` | `…/spss/manifest` | GET | R | NAT3 | (b) *Flutter?* | GET twin |
| `data-management.controller.ts:122` | `…/spss/csv` | GET | R | NAT3 | (b) *Flutter?* | GET twin |
| `data-management.controller.ts:136` | `…/spss/sav` | GET | R | NAT3 | (b) *Flutter?* | GET twin |
| `auth.controller.ts:38` | `/auth/health` | GET | R | public | (c) | Health probe |
| `auth.controller.ts:69` | `/auth/register` | POST | W | public | (b) *Flutter?* | react-web registers via `register-company` |
| `auth.controller.ts:262` | `/auth/pending-minefop` | GET | R | `SUPER_ADMIN` | (b) | Staff approval now goes through `/auth/users` |
| `auth.controller.ts:402` | `/auth/users/search` | GET | R | UA | (a) | v2 §1 C2 names it as the right source for the auditor actor filter (R3) |
| `auth.controller.ts:465` | `/auth/users/:id/two-factor` | PATCH | W | `SUPER_ADMIN` | (a) | No admin 2FA toggle in `utilisateurs` |
| `auth.controller.ts:474` | `/auth/admin/reset-password` | POST | W | `SUPER_ADMIN` | (c) *Flutter?* | `api-client.ts:282` comment attributes it to Flutter |
| `auth.controller.ts:481` | `/auth/change-password` | PATCH | W | any JWT | (a) | No self-service password change |
| `auth.controller.ts:495` | `/auth/me` | DELETE | W | any JWT | (a) *Flutter?* | Self-deactivation; no UI |
| `auth.controller.ts:502` | `/auth/preferences` | PATCH | W | any JWT | (a) *Flutter?* | — |
| `auth.controller.ts:518` | `/auth/two-factor` | PATCH | W | any JWT | (a) | No self-service 2FA toggle |
| `auth.controller.ts:532` | `/auth/forgot-password` | POST | W | public | (b) | `api-client.ts:257-262` documents it as dead client-side |
| `auth.controller.ts:587` | `/auth/attestation` | GET | R | any JWT | (a) *Flutter?* | `[10-04 #39]` calls it the real attestation URL; nothing reads it |
| `auth.controller.ts:593` | `/auth/resend-verification` | POST | W | any JWT | (b) | Helper exists (`api-client.ts:297`) but has zero callers |
| `locations.controller.ts:43` | `/locations/regions/:id` | GET | R | any JWT | (b) | — |
| `locations.controller.ts:49` | `/locations/departments/:id` | GET | R | any JWT | (b) | — |
| `sectors.controller.ts:25` | `/sectors/:id` | GET | R | public | (b) | — |
| `sectors.controller.ts:31` | `/sectors/category/:category` | GET | R | public | (b) | — |

### 3b. Called only by non-admin react-web (out of scope, 13)

`POST /auth/login`, `POST /auth/2fa/verify` (both via `auth-store`, login page),
`POST /auth/register-company`, `POST /auth/resubmit-registration`
(`/home/inscription-en-attente`), `GET /auth/check-email`,
`POST /auth/reset-password`, `POST /auth/reset/questions`,
`POST /auth/reset/verify`, `POST /auth/verify-email`,
`POST /auth/identifier/find`, `GET /locations/regions`,
`GET /locations/regions/:regionId/departments`,
`GET /locations/departments/:departmentId/subdivisions`.

Their open `[10-04]` findings (#9–12, #34–36, #39–40, #43–47) belong to the
respondent/auth surface and are not re-audited here.

### 3c. Controllers not reached by the admin app

`analytics`, `bilan`, `onefop-analytics`, `dsmo`, `minefop-services`, `onefop`,
`questionnaires` (respondent), `report`, `distribution`. Not enumerated.

---

## Category 4 — SHAPE DRIFT

Ranked by user impact. "Rendered" means the FE actually displays the field.

| # | Endpoint | FE type file:line | BE source file:line | What differs | Rendered? | Impact | V |
|---|---|---|---|---|---|---|---|
| **D1** | `GET /admin/questionnaires/:id` | `dossiers/[id]/page.tsx:1083, 1110, 1137` (reads `detail.address`, `detail.creationDate`, `detail.taxRegime`) | `questionnaires.service.ts` `getById`; no entity-detail model has these columns `[10-04 #5-7]` | 3 phantom fields, never sent | **Yes**: always "—" on the dossier review screen | **HIGH** | RV (call sites) |
| D15 | `POST /campaigns/:id/extend` | `campaigns.ts` `canExtend` allows `DRAFT`/`PAUSED` | `campaign.service.ts` `extendDeadline` writes `status:'ACTIVE'`; `newDeadline` unvalidated `[10-04 #19-20]` | Behavioural: extending a DRAFT/PAUSED campaign silently activates it | Status badge changes | **MED** | C |
| D28 | `POST /auth/admin/register-company` | `inscriptions.ts:51` `socialCapital?: number`; sent as `Number(...)` at `nouvelle/page.tsx:176` | `register-company.dto.ts:48` `@IsInt() @Min(0)` (inherited by `AssistedRegistrationDto`); column is `Float?` | A decimal value is a 400 the FE type doesn't predict | Form error on submit | **MED** | RV |
| D12 | `PATCH /auth/users/:id/territory` | `user-directory.ts:246` annotated `DirectoryUser` | `toPublicUser` (`[10-04 #13]`) | 4 phantom optionals (`lastLoginAt`, `submissionsCount`, `perAgentTarget`, `createdByName`) | No (callers invalidate) | LOW-latent | C |
| D13 | `PATCH /auth/users/:id/documents/:kind/verify` | `user-directory.ts:120` → `RegistrationDocumentItem` | raw row (`[10-04 #14-16, 50-51]`) | `label` phantom; `uploadedAt` nullable; `verifiedBy` is a UUID, not a name; `state` free text | No (`approbation:110` invalidates) | LOW-latent | RV (caller) |
| D4 | `PATCH …/anomalies/:id/resolve` | `anomaly-registry.ts:88` → `AnomalyRecord` | bare `update()` with no `include` (`[10-04 #8]`) | `submission`, `resolvedBy` missing | No (`centre-qualite:121` invalidates); the `files-attente` caller is deleted | LOW-latent | RV |
| D14 | `PATCH /auth/me/notifications/:id/read` | `notifications-inbox.ts:40` → `UserNotification` | already-read branch returns `{id,readAt}` (`[10-04 #18, 52]`) | 6 required fields absent on one branch | No (callers fire only when `!readAt`, then invalidate) | LOW-latent | RV (caller) |
| D10 | `GET`/`PUT …/campaigns/:id/quotas` | `pilotage-targets.ts:11,16,24,91,98` | `labelTargets(…,'submissionTarget')` (`pilotage.service.ts:1000`); `parseTargetBody(…,'submissionTarget')` | After 4b, `TargetField`'s `"inscriptionTarget"` arm, `TargetRegionRow/TargetDepartmentRow.inscriptionTarget?`, `TargetPutEntry.inscriptionTarget?` and `TargetPutBody.central.inscriptionTarget?` have no producer or consumer. `storedRegionEntries` (`pilotage-target-payload.ts:314-323`) still fills both keys, but only for comparison, never for sending | No | LOW | RV |
| D8 | `GET …/campaigns/:id/returns` | `pilotage-targets.ts:50` `campaign.endDate` | `DataCampaign.endDate`, never written (`[10-04 #21]`) | Always `null`; the real deadline (`deadline`/`extendedDeadline`) is not exposed | No | LOW | RV |
| D9 | same | `pilotage-targets.ts:85` `totals: ReturnMetrics`; `:63` `onTimeRate` | region/department scope returns a row (`pilotage.service.ts:568-575`) | `totals` widened with extra keys; `onTimeRate` not rendered (`[10-04 #56-57]`) | No | LOW | RV |
| D2 | `GET /admin/questionnaires` (dashboard recent) | `pilotage/page.tsx:201, 204` | BE sends `status`, `submissionDate` | `adminStatus`, `submittedAt` phantom; fallbacks at `:250, :259` land on correct keys | Yes, via fallback | LOW | RV |
| D3 | same | `api-client.ts:613` `items: any[]` | full rows + relations | Untyped | — | LOW | C |
| D5 | `GET …/:id/diagnostic` | `api-client.ts` `DossierDiagnostic` | `eligibility-engine.service.ts` `evaluateDossier` (`[10-04 #28-29]`) | `submissionId` carries the row id; anomaly arrays `any[]` | No | LOW | C |
| D6 | `GET …/anomalies/registry` | `anomaly-registry.ts:28, 36-37, 80` | Prisma enum/columns (`[10-04 #30-32]`) | `INFO` severity unreachable; over-nullable; `status` query unvalidated → 500 | No | LOW | C |
| D7 | `GET …/rules` | `anomaly-registry.ts:145` | untyped literal (`[10-04 #33]`) | FE union narrower than BE `string` | No | LOW | C |
| D16 | `POST /campaigns/:id/{activate,pause,close,archive}` | `campaigns.ts:139-170` → `Campaign` | raw `DataCampaign` rows, not passed through `toCampaignWire` (`campaign.service.ts:387, 396, 405, 421`) | No legacy `type` alias, no `progress`; nullable on activate (`[10-04 #66-67]`) | No (all callers discard and invalidate) | LOW | RV |
| D17 | `GET /campaigns`, `GET /campaigns/:id` | `campaigns.ts:25-60, 80` | `listCampaigns`/`getCampaign` (`[10-04 #63-65, 71-72]`) | Extra keys absorbed by the index signature; `collectionType` optional but always present; detail has no `progress` (dialog reads it from the list row) | No | LOW | RV |
| D18 | `POST /campaigns` (request) | `campaigns.ts:100-113` | `@Body() data: any` (`[10-04 #68-69]`) | `targetRegions/Departments/EntityTypes` declared but not sent by the create dialog, so targeting defaults to all; no DTO | — | LOW | C |
| D19 | `POST /auth/admin/create-minefop-user` | `user-directory.ts:272` | `toPublicUser` (`[10-04 #41-42]`) | Same 4 phantom optionals as D12; `serviceCode`/`positionType` accepted but undeclared FE-side | No | LOW | C |
| D20 | `GET /auth/users` | `user-directory.ts` `ListUsersResult` | `auth.service.ts` `listUsers` (`[10-04 #48]`) | `_count` extra | No | LOW | C |
| D21 | `PATCH /auth/approve-user/:id` (request) | `user-directory.ts:78-83` | strictly `true` required for ADMINISTRATION (`[10-04 #55]`) | FE sends `false` unless opted in; the `UsersDirectory` path for ADMINISTRATION is unreachable | — | LOW | RV |
| D22 | `GET /auth/company-registrations` | `inscriptions/page.tsx` 7-value label map | `OnefopEntityType` has 8 (incl. deprecated) (`[10-04 #54]`) | A legacy row shows the raw enum name | Rarely | LOW | C |
| D23 | `GET /audit/reports` | `audit-log.ts:14, 19, 22-27` | NOT NULL columns; bare array when `paginate≠true` (`[10-04 #59-62]`) | Over-nullable; envelope drift on an unreachable branch | No | LOW | C |
| D24 | `GET /companies` | `companies-directory.ts:21-48` | non-null Prisma fields; `status` unvalidated (`[10-04 #81-83]`) | Over-nullable; enum widened | No | LOW | C |
| D25 | `GET /data-management/stats` | `api-client.ts:798-812` | nested `totals` only (`[10-04 #84-86]`) | Flat-shape and union fallbacks unreachable | No | LOW | C |
| D26 | `GET /locations/structure`, `GET /sectors` | `user-types.ts:94-104`, `api-client.ts` `Sector` | `[10-04 #87-88]` | `code`, `createdAt`, `updatedAt` extra | No | LOW | C |
| D27 | `GET`/`PATCH /system-settings` | `system-settings.ts:9-24` | `system-settings.service.ts` (`[10-04 #89-90]`) | FE declares a subset (deliberately); PATCH FE-required vs BE-optional | No | LOW | C |
| D29 | `GET /auth/me` | `user-types.ts` `User` | `public-user.ts:9-43` (`[10-04 #37-38]`) | Extra fields incl. the known lockout-field exposure (tracked as a security item) | No | LOW | C |
| — | `GET …/coverage/annual` | `CoverageTable.tsx:88` renders `central.inscriptionTarget` under "Cible" | `pilotage.service.ts:217` sums the ADMINISTRATION `submissionTarget` rows | **Not drift; shapes agree.** Semantic note: the central "Cible" is now a submission quota set against a registration count. Plan §12 deliberately keeps the `inscriptionTarget` name. See open question 3 | Yes | — | RV |

---

## Step 4 — focus calls

**Every `/admin/pilotage/*` call from react-web.** There are four, all in
`pilotage-targets.ts`, all reached only from `cibles/page.tsx`:

| Call | Live? | Shape |
|---|---|---|
| `getAnnualCoverage` → `GET coverage/annual?year=` | ✓ `pilotage.controller.ts:105` | Matches `CoverageResponse` field for field, incl. `companyCount` and `period` |
| `getCampaignQuotas` → `GET campaigns/:id/quotas` | ✓ `:120` | Matches; `central` now reads the ADMINISTRATION `CampaignQuota` row (`1a7a003f`). Response shape unchanged, as the commit claimed |
| `putCampaignQuotas` → `PUT campaigns/:id/quotas` | ✓ `:132` | Body keys agree with `parseTargetBody`/`parseCentral` for `field = submissionTarget`. Write roles equal FE `canWritePilotageTargets` (`NATIONAL_ROLES`) |
| `getCampaignReturns` → `GET campaigns/:id/returns` | ✓ `:126` | FE and BE interfaces identical |

The FE pre-filters the campaign picker to `collectionType === "ONEFOP"`
(`cibles/page.tsx:438-441`), so `requireOnefopCampaign` cannot 400 on a
picker selection. A hand-typed `?campagne=` id for a DSMO campaign still can.
That is the intended error path.

`pilotage/page.tsx` (the dashboard) makes **no** `/admin/pilotage/*` call. Its
regional table reads `queues.regionCounts`.

**Cibles page after 5a/5b/5c.** Three tabs (`quotas`, `couverture`,
`retours`). No orphaned call remains: `TargetsPanel`'s `kind` discriminant, the
`year` prop, the `readCentral` inscription arm and the inscriptions query key
were all removed in `3576887b`. `readCentral` now reads only `submissionTarget`
(`cibles/page.tsx:631`). `?vue=inscriptions` normalizes to `?vue=quotas`
client-side (`:87`), and nothing in react-web links to it. The only residue is
type-level (D10).

**Callers of retired routes.** `GET`/`PUT /admin/pilotage/targets/inscriptions`
and `GET /admin/pilotage/coverage` (year-scoped) have **zero FE callers**. No
BLOCKER.

---

## Role-gate drift (outside the four categories)

These are not path or shape mismatches. The FE lets a role reach a call that
the BE `@Roles` rejects, so the user gets a 403 instead of data. Path and shape
both match, so the four-category scheme would hide them. They are recorded here
rather than dropped.

| # | Role | FE call site | BE gate | Effect | Severity |
|---|---|---|---|---|---|
| **R2** | `DIVISIONAL_ADMIN` | `pilotage/page.tsx:335` `getDataManagementStats`, ungated, polls every 120s. Dashboard has no `allowedRoles` (`_routes.ts:64`) | `data-management.controller.ts:55` NAT3, no DIVISIONAL | 403 on every poll; the **"Inscriptions" KPI tile (`:413-421`) is permanently "—"** for every divisional admin. Also on `etablissements/page.tsx:135` (masked there by the `/companies/stats` fallback) | **HIGH** (rendered, primary surface) |
| R1 | `AUDITOR` | `layout.tsx:37-41` queues poll every **30s** (gated only on `ADMIN_ROLES`, which includes AUDITOR); `AdminPageHeader.tsx:88` (ungated); `pilotage/page.tsx:328, 335, 341, 349` (4 queries every 120s; the dashboard is AUDITOR's fallback route); `dossiers/page.tsx:185, 207` (`ADMIN_ROLES`) | `admin-questionnaires.controller.ts` class ADM4 and `/data-management/stats` NAT3: no AUDITOR | A continuous background 403 stream; dashboard and dossiers render error/absent states. v2 §1 C7 claims this is superseded. **It is not.** | LATENT (AUDITOR not urgent for the pilot, decision 2026-10-05) |
| R3 | `AUDITOR` | `journal-audit/page.tsx:130` `listUsers` (actor filter) | `/auth/users` UA | 403; actor filter is empty (`[10-03 R-02]`, still open) | MED, conditional on AUDITOR |
| R4 | `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN` | Sidebar "Annuaire" (`_routes.ts:100`, `DIRECTORY_ROLES`) → `/home/annuaire` (guard `USER_ADMIN_ROLES`); `etablissement-detail` route `DIRECTORY_ROLES` vs page `canRead = NATIONAL_ROLES` (`:79`) | — (FE-internal) | Link shown, page refuses. No 403 reaches the BE | LOW (FE-internal; noted for completeness) |

---

## Fix before pilot

All items closed as of 2026-10-06.

1. ~~D1 — dossier detail shows three permanent "—" fields.~~ **Fixed in
   `e4bc79e1`.** Address reads the questionnaire's declared locality;
   founding year reads the questionnaire value with a fallback to the
   registered year; the tax-regime row now shows the AST legal-status
   field. No layout change.
2. ~~R2 — divisional admin's pipeline "Inscriptions" stage 403s on every
   poll.~~ **Fixed in `8cf266d9`.** The stage is now gated on
   `DATA_STATS_ROLES`, matching the BE route's role set. A role that
   cannot read a source is hidden, not shown as "—".

## Defer

| Item | Reason |
|---|---|
| D15 campaign extend silently activates DRAFT/PAUSED | Behavioural; reachable only by `SUPER_ADMIN` from `/home/communication`. Promote it if that page is used in the pilot |
| D28 `socialCapital` decimal → 400 | User-triggered, but XAF capital is entered as whole francs in practice; the error message surfaces |
| D12, D13, D4, D14 | Latent: every caller discards the mutation response and invalidates; nothing renders the drifting fields |
| D10 vestigial `inscriptionTarget` type arms | Type hygiene after 4b; no runtime effect |
| D8, D9 returns `endDate` / `totals` / `onTimeRate` | Not rendered |
| D2, D3, D5, D6, D7 questionnaires-surface LOWs | Fallbacks work or fields unrendered |
| D16–D21 campaign / user-admin LOWs | Responses discarded; request-side gaps no caller exercises |
| D22–D27, D29 | Over-nullable, extra-field or enum-width only |
| R1, R3 | AUDITOR is not urgent for the pilot (decision 2026-10-05). Revisit both together when the role is activated; v2 already names `/auth/users/search` as the intended source for R3 |
| R4 | FE-internal nav/guard mismatch; no BE contract involved |
| BE-only (a) items: `coverage/semester`, `campaigns/conflicts`, `PUT /campaigns/:id`, `campaigns/:id/submissions`, `users/search`, 2FA/password self-service | Features not built; no user-facing break |
| BE-only (b) items: `questionnaires/pending`, `correction-requested`, `/campaigns/:id/progress`, `/data-management/regions\|sectors` reads, GET export twins, `/auth/register`, `pending-minefop`, `forgot-password`, `resend-verification`, `/locations/*/:id`, `/sectors/:id\|category` | Dead surface; removal needs a Flutter check first |
| BE-only destructive writes with no UI: `DELETE /data-management/regions/:id`, `DELETE /data-management/sectors/:id`, `DELETE /auth/me` | No FE exposure. Flag for the security agent rather than the contract track |

---

## Open questions

1. ~~Will AUDITOR accounts exist during the pilot?~~ **Answered 2026-10-05:**
   AUDITOR is not urgent. R1 and R3 stay LATENT and are deferred until the
   role is activated.
2. **Do role-gate findings belong in this audit?** R1–R4 do not fit the four
   requested categories. They are recorded in a separate section. Should they
   move to the admin-integrity roll-up or a security-agent review instead?
3. **Central "Cible" on Couverture.** The national `central.inscriptionTarget`
   is now the sum of ADMINISTRATION *submission* quotas, rendered as the target
   for a *registration* count (`CoverageTable.tsx:88`). The shapes agree and the
   naming is a recorded plan decision (§12). Has the ONEFOP domain owner
   confirmed the statistical meaning of the resulting rate?
4. **Flutter callers.** About ten BE-only routes are marked *Flutter?*. Is a
   Flutter-side caller sweep wanted before any of the (b) "dead surface" items
   are treated as removable?
5. **v2 roll-up staleness.** `admin-integrity-2026-10-05.md` misstates A-01 and
   C7/A-07 (see Step 1 recap). It was not edited, under this task's
   one-file constraint. Should it get a correction note in a separate change?
