# READ-ONLY END-TO-END AUDIT REPORT: REACT WEB ADMIN APP
**Date:** 2026-10-03  
**Target File:** `docs/audit/admin-integrity-2026-10-03.md`  
**Execution Mode:** READ-ONLY static code audit (no migrations, no database queries, no commits, no edits to application source code)  
**Database Host:** `aws-0-eu-west-1.pooler.supabase.com` (Supabase reference `jwarzixaajlectgttstv`, verified via `.env` without connection)

---

## 1. Scope

### 1.1 In-Scope Components
* **Application Root:** `react-web/` (`c:\Users\win\dsmo_app\react-web`)
* **Framework:** Next.js 16.3.5 (App Router, React 19.2.8, TypeScript 5, Tailwind CSS v4, `@tanstack/react-query` v5.102.8, `zustand` v5.0.15, `next-intl` v4.14.4)
* **Client Pages & Routes:** 19 admin routes under `react-web/src/app/admin/` (`activite`, `campagnes`, `centre-qualite`, `cibles`, `diffusion`, `dossiers`, `dossiers/[id]`, `etablissement-detail`, `etablissement-detail/approbation`, `etablissements`, `files-attente`, `inscriptions`, `journal-audit`, `parametres`, `pilotage`, `questionnaires`, `sectors`, `utilisateurs`, `layout.tsx`, `error.tsx`, `_routes.ts`) plus linked directory views in `react-web/src/app/home/annuaire`.
* **Client Components:** All administration widgets in `react-web/src/components/admin/` (15 components).
* **Client Libraries, Stores, Hooks & Types:** `react-web/src/lib/` (API clients, state resolvers, registries, DTO interfaces), `react-web/src/hooks/useTerritoryStructure.ts`.
* **Backend Target Handlers (Comparison Scope):**
  - NestJS controllers and services under `src/` (`campaign/`, `questionnaires/`, `dsmo/`, `auth/`, `data-management/`, `pilotage/`, `report/`, `sectors/`, `system-settings/`, `locations/`).
  - Prisma schema (`prisma/schema.prisma`) and migrations for entities touched by the admin UI (`OnefopSubmission`, `OnefopAnomaly`, `Company`, `Establishment`, `User`, `DataCampaign`, `CampaignSubmission`, `CampaignQuota`, `TerritoryTarget`, `AuditLog`, `SystemSettings`, `Region`, `Department`, `Subdivision`).

### 1.2 Out-of-Scope Confirmation
* **Mobile / Surveyor Application:** Flutter codebase (`lib/`, `pubspec.yaml`, android/ios/linux/macos/windows runners).
* **Public Questionnaire / ONEFOP Respondent Submission Form:** Non-admin public respondent wizard.
* **Backend Services Unrelated to Admin:** Internal notification engines, background crons, non-admin NestJS modules.
* **Database Writes / Migrations:** Zero modifications, zero connections, zero seed executions.
* **Territory Subdivision Count:** The 360 subdivision count (established in migrations `20261003120000`, `20261004120000`, `20261004130000` and documented in `docs/reference/arrondissements-pending.md`) is intentional administrative policy and is not flagged as drift.

---

## 2. Category Definitions

* **Category A (Hardcoded Values):** Static values embedded in client source code that should instead be governed by environment variables, runtime configurations, backend metadata endpoints, or relational database records. Includes secrets/tokens, origin URLs/hosts, UUIDs, environment literals, business quotas/thresholds, hardcoded role literals, hardcoded route paths, hardcoded query keys, hardcoded pagination/timeout constants, storage keys, hardcoded UI copy bypassing i18n, and client-side fabricated fallbacks.
* **Category B (Admin App ↔ Backend Misalignment):** Disconnects between what the React client expects/sends and what the backend API and database actually provide. Includes route name and method mismatches, orphan calls, orphan handlers, request/response property naming mismatches (camelCase vs snake_case, object vs array), type incompatibilities, enum drift, client vs server authorization enforcement gaps, and unscoped queries.

---

## 3. Executive Summary

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| **Category A: Hardcoded Values** | 1 | 6 | 21 | 18 | 46 |
| **Category B: Contract & Auth Mismatches** | 5 | 8 | 12 | 7 | 32 |
| **Total Findings** | **6** | **14** | **33** | **25** | **78** |

### Top 5 Highest-Risk Findings
1. **Background 403 Loop on Polling Queue for `SUPER_ADMIN_DSMO` (`react-web/src/app/admin/layout.tsx:52` vs `src/questionnaires/admin-questionnaires.controller.ts:49`):** `AdminLayout` polls `getPilotageQueues` every 30 seconds for all admin users, but the backend controller class-level `@Roles` omits `SUPER_ADMIN_DSMO`, triggering an unhandled 403 error storm every 30 seconds for DSMO super-admins.
2. **Actor Filter Crash in Audit Log for `AUDITOR` & `SUPER_ADMIN_DSMO` (`react-web/src/app/admin/journal-audit/page.tsx:133` vs `src/auth/auth.controller.ts:293`):** `journal-audit` permits `AUDITOR` and `SUPER_ADMIN_DSMO`, but immediately fires `listUsers()` (`GET /auth/users`), which is strictly restricted to `USER_ADMIN_ROLES` (`SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`). Every auditor visiting the journal encounters a 403 on the user filter query.
3. **Hardcoded Render Production Origin Fallback (`react-web/src/lib/api-client.ts:21`):** `API_BASE_URL` embeds `https://dsmo-app-2.onrender.com/api` as a hardcoded static string fallback. If `NEXT_PUBLIC_API_URL` is omitted in any build, client traffic silently diverts to a hardcoded external Render instance instead of failing closed.
4. **Silent Single-Record Lookup Failure in Establishment Detail & Approval (`react-web/src/app/admin/etablissement-detail/page.tsx:95` & `approbation/page.tsx:64`):** There is no `GET /dsmo/companies/:id` backend route. The frontend attempts to look up an establishment by issuing `listCompanies({ search: id, pageSize: 20 })` and doing a `.find()` on page 1. If an establishment is not within the top 20 search hits, the UI displays "Établissement introuvable".
5. **Unauthorized Entity Type `ASFOP` in Filters (`react-web/src/app/admin/etablissements/page.tsx:34` vs `prisma/schema.prisma:1979`):** The establishment directory offers `ASFOP` as an entity type filter, which does not exist in the Prisma `OnefopEntityType` enum or database schema; selecting it results in guaranteed empty queries.

---

## 4. Category A: Hardcoded Values (React Admin App)

| # | Severity | File:Line | Value | Category | Suggested Home | Notes |
|---|---|---|---|---|---|---|
| A-01 | **Critical** | `react-web/src/lib/api-client.ts:21` | `"https://dsmo-app-2.onrender.com/api"` | URLs/Hosts | Environment variable (`NEXT_PUBLIC_API_URL`) | Hardcoded production/staging Render host fallback. If env is missing, traffic silently routes to external Render host. |
| A-02 | **High** | `react-web/src/lib/api-client.ts:20` | `"http://localhost:3001/api"` | URLs/Hosts | Environment variable (`NEXT_PUBLIC_API_URL`) | Hardcoded local backend origin fallback. |
| A-03 | **High** | `react-web/src/lib/api-client.ts:25` | `"camleap.access_token"` | Storage Key | Central constants file | Raw localStorage/sessionStorage key literal. |
| A-04 | **High** | `react-web/src/lib/api-client.ts:26` | `"camleap.cached_user"` | Storage Key | Central constants file | Raw localStorage cache key literal. |
| A-05 | **High** | `react-web/src/app/admin/dossiers/[id]/page.tsx:147` | `"7 jours ouvrables"` | Business Rule | System settings DB / Config | Hardcoded default correction delay passed into persisted comment payload. |
| A-06 | **High** | `react-web/src/components/admin/AdminHeaderActions.tsx:61` | `/(PREMIER\|DEUXIEME\|TROISIEME\|QUATRIEME)\s+TRIMESTRE\s+(\d{4})/i` | Business Rule | Backend metadata parser | Magic regex parsing quarter names from campaign strings on client. |
| A-07 | **Medium** | `react-web/src/app/admin/layout.tsx:55` | `30000` | Timeout | Config constant | Hardcoded 30-second refetch interval for pilotage queues query. |
| A-08 | **Medium** | `react-web/src/app/admin/activite/page.tsx:41` | `25` | Pagination | Config constant | Hardcoded `EVENT_PAGE_SIZE = 25`. |
| A-09 | **Medium** | `react-web/src/app/admin/activite/page.tsx:42` | `20` | Pagination | Config constant | Hardcoded `ALERT_PAGE_SIZE = 20`. |
| A-10 | **Medium** | `react-web/src/app/admin/dossiers/page.tsx:58` | `10` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 10`. |
| A-11 | **Medium** | `react-web/src/app/admin/etablissements/page.tsx:27` | `8` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 8`. |
| A-12 | **Medium** | `react-web/src/app/admin/inscriptions/page.tsx:21` | `8` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 8`. |
| A-13 | **Medium** | `react-web/src/app/admin/journal-audit/page.tsx:26` | `12` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 12`. |
| A-14 | **Medium** | `react-web/src/app/admin/centre-qualite/page.tsx:35` | `50` | Pagination | Config constant | Hardcoded `REGISTRY_PAGE_SIZE = 50`. |
| A-15 | **Medium** | `react-web/src/app/admin/utilisateurs/page.tsx:23` | `50` | Pagination | Config constant | Hardcoded `AGENTS_PAGE_SIZE = 50`. |
| A-16 | **Medium** | `react-web/src/app/admin/parametres/page.tsx:33` | `6` | Pagination | Config constant | Hardcoded `RECENT_AUDIT_LIMIT = 6`. |
| A-17 | **Medium** | `react-web/src/components/admin/CompaniesDirectory.tsx:16` | `20` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 20`. |
| A-18 | **Medium** | `react-web/src/components/admin/UsersDirectory.tsx:26` | `20` | Pagination | Config constant | Hardcoded `PAGE_SIZE = 20`. |
| A-19 | **Medium** | `react-web/src/lib/pilotage-targets.ts:4` | `2000` | Business Rule | System settings / DB | Hardcoded `YEAR_MIN = 2000`. |
| A-20 | **Medium** | `react-web/src/lib/pilotage-targets.ts:5` | `2100` | Business Rule | System settings / DB | Hardcoded `YEAR_MAX = 2100`. |
| A-21 | **Medium** | `react-web/src/lib/pilotage-targets.ts:7` | `2_147_483_647` | Business Rule | DB constant | Hardcoded `TARGET_MAX = 2147483647` (Postgres INT4 cap). |
| A-22 | **Medium** | `react-web/src/lib/pilotage-targets.ts:178` | `60 * 60 * 1000` | Date/Timezone | System settings | Hardcoded UTC+1 offset for Africa/Douala instead of Intl / luxon timezone resolution. |
| A-23 | **Medium** | `react-web/src/lib/system-settings.ts:28` | `[{ value: "CM", label: "Cameroun" }]` | Business Rule | Database table | Hardcoded static country options array. |
| A-24 | **Medium** | `react-web/src/lib/system-settings.ts:34` | `[{ value: "Africa/Douala", label: "Africa/Douala (GMT+1)" }]` | Business Rule | Database table | Hardcoded static timezone options array. |
| A-25 | **Medium** | `react-web/src/app/admin/dossiers/page.tsx:70` | `300` | Timeout | Config constant | Hardcoded debounce delay `SEARCH_DEBOUNCE_MS = 300`. |
| A-26 | **Medium** | `react-web/src/app/admin/etablissements/page.tsx:108` | `300` | Timeout | Config constant | Hardcoded debounce delay `300ms`. |
| A-27 | **Medium** | `react-web/src/app/admin/journal-audit/page.tsx:98` | `300` | Timeout | Config constant | Hardcoded debounce delay `300ms`. |
| A-28 | **Low** | `react-web/src/app/admin/layout.tsx:25-28` | `PAGE_TITLES` map | React Routing | `_routes.ts` | Hardcoded page titles and subtitles map inside layout. |
| A-29 | **Low** | `react-web/src/app/admin/error.tsx:89` | `"/admin/pilotage"` | Route Path | `_routes.ts` | Hardcoded navigation link string literal. |
| A-30 | **Low** | `react-web/src/app/admin/activite/page.tsx:227-229` | `"/admin/pilotage"`, `"/admin/dossiers"`, `"/admin/activite"` | Route Path | `_routes.ts` | Hardcoded navigation tab route links. |
| A-31 | **Low** | `react-web/src/app/admin/centre-qualite/page.tsx:180-230` | `"/admin/centre-qualite"`, `"/admin/files-attente?tab=anomalies"` | Route Path | `_routes.ts` | Hardcoded tab route links. |
| A-32 | **Low** | `react-web/src/app/admin/dossiers/page.tsx:380-415` | `"/admin/pilotage"`, `"/admin/dossiers"`, `"/admin/activite"` | Route Path | `_routes.ts` | Hardcoded subnav route links. |
| A-33 | **Low** | `react-web/src/app/admin/dossiers/[id]/page.tsx:268, 493` | `"/admin/dossiers"`, `"/admin/pilotage"` | Route Path | `_routes.ts` | Hardcoded back link and subnav route links. |
| A-34 | **Low** | `react-web/src/app/admin/etablissement-detail/page.tsx:187, 239` | `"/admin/etablissements"`, `"/admin/inscriptions"` | Route Path | `_routes.ts` | Hardcoded navigation route strings. |
| A-35 | **Low** | `react-web/src/app/admin/etablissement-detail/approbation/page.tsx:143` | `"/admin/etablissements"` | Route Path | `_routes.ts` | Hardcoded navigation route string. |
| A-36 | **Low** | `react-web/src/app/admin/etablissements/page.tsx:249, 264` | `"/admin/inscriptions"`, `"/admin/etablissements"` | Route Path | `_routes.ts` | Hardcoded navigation route strings. |
| A-37 | **Low** | `react-web/src/app/admin/files-attente/page.tsx:270, 288` | `"/admin/dossiers?status=PENDING_REVIEW"`, `"/admin/dossiers?status=CORRECTION_REQUESTED"` | Route Path | `_routes.ts` | Hardcoded action button links. |
| A-38 | **Low** | `react-web/src/app/admin/inscriptions/page.tsx:202-203` | `"/admin/inscriptions"`, `"/admin/etablissements"` | Route Path | `_routes.ts` | Hardcoded tab links. |
| A-39 | **Low** | `react-web/src/app/admin/journal-audit/page.tsx:223, 234` | `"/admin/utilisateurs"`, `"/admin/parametres"` | Route Path | `_routes.ts` | Hardcoded navigation tab links. |
| A-40 | **Low** | `react-web/src/app/admin/parametres/page.tsx:250-256` | `"/admin/utilisateurs"`, `"/admin/journal-audit"` | Route Path | `_routes.ts` | Hardcoded tab links. |
| A-41 | **Low** | `react-web/src/app/admin/pilotage/page.tsx:67-70, 439-516` | `"/admin/campagnes"`, `"/admin/cibles"`, `"/admin/dossiers"`, `"/admin/inscriptions"` | Route Path | `_routes.ts` | Hardcoded quick links and tab links. |
| A-42 | **Low** | `react-web/src/app/admin/utilisateurs/page.tsx:211-239` | `"/admin/utilisateurs"`, `"/admin/journal-audit"`, `"/admin/parametres"` | Route Path | `_routes.ts` | Hardcoded tab links. |
| A-43 | **Low** | `react-web/src/components/admin/AdminHeaderActions.tsx:77-213` | `"/admin/campagnes"`, `"/admin/cibles"`, `"/admin/activite"`, `"/admin/dossiers"` | Route Path | `_routes.ts` | Hardcoded header pill links. |
| A-44 | **Low** | `react-web/src/components/admin/RequireAdminRole.tsx:22` | `"/admin/pilotage"` | Route Path | `_routes.ts` | Hardcoded redirection path on unauthorized access. |
| A-45 | **Low** | `react-web/src/app/admin/activite/page.tsx:44-89` | `#ffffff`, `#e5e7eb`, `#374151`, `#1e6b3a`, `#d1d5db`, `#6b7280` | Inline Styles | Tailwind / Theme Tokens | Hardcoded raw hex color literals in CSS objects. |
| A-46 | **Low** | `react-web/src/app/admin/activite/page.tsx:232-233` (and 14 sibling pages) | Raw French UI strings (titles, headers, placeholders) | i18n | `messages/fr.json` & `en.json` | Component bypasses `next-intl` `useTranslations()`. |

---

## 5. Category B: Admin App ↔ Backend Contract Map

| Endpoint / RPC / Table | Method | FE Caller (file:line) | BE Handler / Table | Request Shape | Response Shape | Status | Notes |
|---|---|---|---|---|---|---|---|
| `/auth/me` | `GET` | `react-web/src/lib/api-client.ts:231` | `src/auth/auth.controller.ts:106` | Headers: Bearer JWT | `User` object | **OK** | Used for user hydration and role resolution. |
| `/auth/login` | `POST` | `react-web/src/lib/api-client.ts:217` | `src/auth/auth.controller.ts:44` | `{ email, password }` | `{ access_token, user }` or 2FA challenge | **OK** | Public auth endpoint. |
| `/auth/users` | `GET` | `react-web/src/lib/user-directory.ts:65`<br>`journal-audit/page.tsx:133`<br>`utilisateurs/page.tsx:85` | `src/auth/auth.controller.ts:291` | Query: `search, role, roles, region, status, isActive, page, pageSize` | `{ users: DirectoryUser[], total, page, pageSize }` | **DRIFT** | Backend `@Roles(...USER_ADMIN_ROLES)` allows only `SUPER_ADMIN` and `SUPER_ADMIN_ONEFOP`. `journal-audit` permits `AUDITOR` and `SUPER_ADMIN_DSMO`, who get 403 when loading user filter. |
| `/auth/users/:id/documents` | `GET` | `react-web/src/lib/user-directory.ts:110` | `src/auth/auth.controller.ts:234` | Param: `id` | `{ userId, companyName, items: RegistrationDocumentItem[] }` | **OK** | Document checklist endpoint. |
| `/auth/users/:id/documents/:kind/verify` | `PATCH` | `react-web/src/lib/user-directory.ts:114` | `src/auth/auth.controller.ts:241` | Body: `{ state: "VERIFIED" \| "PENDING" \| "REJECTED" }` | `RegistrationDocumentItem` | **OK** | Document verification action. |
| `/auth/company-registrations` | `GET` | `react-web/src/lib/user-directory.ts:174` | `src/auth/auth.controller.ts:253` | Query: `entityType, region, from, to, search, status, page, pageSize` | `{ items, total, page, pageSize, counts }` | **DRIFT** | Backend `@Roles` omits `SUPER_ADMIN_DSMO`. |
| `/auth/approve-user/:id` | `PATCH` | `react-web/src/lib/user-directory.ts:72` | `src/auth/auth.controller.ts:192` | Body: `{ centralStructureConfirmed: boolean }` | `{ user }` | **OK** | User approval action. |
| `/auth/reject-user/:id` | `PATCH` | `react-web/src/lib/user-directory.ts:79` | `src/auth/auth.controller.ts:206` | Body: `{ reason?: string }` | `{ user }` | **OK** | User rejection action. |
| `/auth/request-complements/:id` | `PATCH` | `react-web/src/lib/user-directory.ts:86` | `src/auth/auth.controller.ts:218` | Body: `{ message: string }` | `{ user }` | **OK** | Complements request action. |
| `/auth/users/:id/territory` | `PATCH` | `react-web/src/lib/user-directory.ts:236` | `src/auth/auth.controller.ts:326` | Body: `{ role, region, department }` | `DirectoryUser` | **OK** | Territorial reassignment action. |
| `/auth/admin/create-minefop-user` | `POST` | `react-web/src/lib/user-directory.ts:262` | `src/auth/auth.controller.ts:356` | Body: `CreateMinefopUserBody` | `{ user, temporaryPassword }` | **OK** | Staff creation action. |
| `/campaigns` | `GET` | `react-web/src/lib/campaigns.ts:68`<br>`AdminHeaderActions.tsx:25` | `src/campaign/campaign.controller.ts:23` | Query: `status, type` | `Campaign[]` | **DRIFT** | Backend `@Roles` omits `CAMPAIGN_MANAGER`, `DATA_MANAGER`, and `ANALYST`, but FE `_routes.ts:61` gives them access to `/admin/campagnes`. |
| `/campaigns` | `POST` | `react-web/src/lib/campaigns.ts:88` | `src/campaign/campaign.controller.ts:17` | Body: campaign parameters | `Campaign` | **OK** | Gated to central/super admins. |
| `/campaigns/:id` | `GET` | `react-web/src/lib/campaigns.ts:72` | `src/campaign/campaign.controller.ts:51` | Param: `id` | `CampaignDetail` | **OK** | Campaign detail read. |
| `/campaigns/:id/activate` | `POST` | `react-web/src/lib/campaigns.ts:95` | `src/campaign/campaign.controller.ts:69` | Param: `id` | `Campaign` | **OK** | Campaign activation. |
| `/campaigns/:id/pause` | `POST` | `react-web/src/lib/campaigns.ts:99` | `src/campaign/campaign.controller.ts:75` | Param: `id` | `Campaign` | **OK** | Campaign pause. |
| `/campaigns/:id/close` | `POST` | `react-web/src/lib/campaigns.ts:103` | `src/campaign/campaign.controller.ts:81` | Param: `id` | `Campaign` | **OK** | Campaign close. |
| `/campaigns/:id/extend` | `POST` | `react-web/src/lib/campaigns.ts:107` | `src/campaign/campaign.controller.ts:93` | Body: `{ newDeadline: string }` | `Campaign` | **OK** | Campaign deadline extension. |
| `/campaigns/:id/remind` | `POST` | `react-web/src/lib/campaigns.ts:114` | `src/campaign/campaign.controller.ts:111` | Body: `{ type: string }` | Notification summary | **OK** | Manual reminder broadcast. |
| `/campaigns/:id/archive` | `POST` | `react-web/src/lib/campaigns.ts:125` | `src/campaign/campaign.controller.ts:87` | Param: `id` | `Campaign` | **OK** | Campaign archiving. |
| `/campaigns/:id` | `DELETE` | `react-web/src/lib/campaigns.ts:121` | `src/campaign/campaign.controller.ts:63` | Param: `id` | Delete result | **OK** | Delete draft campaign. |
| `/campaigns/conflicts` | `GET` | *(None)* | `src/campaign/campaign.controller.ts:42` | Query: `collectionType, excludeId` | Campaign conflict | **ORPHAN_HANDLER** | Backend endpoint checks campaign conflicts before creation; FE never calls it. |
| `/campaigns/:id/progress` | `GET` | *(None)* | `src/campaign/campaign.controller.ts:99` | Param: `id` | Progress summary | **ORPHAN_HANDLER** | Handled via embed on `GET /campaigns`; standalone route has no FE caller. |
| `/campaigns/:id/submissions` | `GET` | *(None)* | `src/campaign/campaign.controller.ts:105` | Param: `id` | Submissions list | **ORPHAN_HANDLER** | Backend returns campaign submissions; FE never calls this endpoint. |
| `/dsmo/company` | `GET` | `react-web/src/lib/api-client.ts:405` | `src/dsmo/dsmo.controller.ts:28` | Headers: Bearer JWT | `CompanyProfile` | **OK** | Respondent profile read. |
| `/dsmo/companies` | `GET` | `react-web/src/lib/companies-directory.ts:82` | `src/dsmo/dsmo.controller.ts:52` | Query: `search, status, region, page, pageSize` | `{ companies, total, page, pageSize }` | **OK** | Establishment list query. |
| `/dsmo/companies/stats` | `GET` | `react-web/src/lib/companies-directory.ts:65` | `src/dsmo/dsmo.controller.ts:45` | Headers: Bearer JWT | `CompanyStats` | **OK** | Establishment status counts. |
| `/dsmo/companies/:id` | `GET` | `etablissement-detail/page.tsx:95`<br>`approbation/page.tsx:64` | *(Missing)* | Param: `id` | Single `Company` | **ORPHAN_CALL / ARCHITECTURAL GAP** | FE falls back to `GET /dsmo/companies?search=<id>` with `.find()` over page 1 because single-lookup endpoint does not exist. |
| `/dsmo/notifications/send` | `POST` | `react-web/src/lib/notifications.ts:29` | `src/dsmo/dsmo.controller.ts:145` | Body: `{ subject, message, filters }` | `SendNotificationResult` | **OK** | Notification dispatch. |
| `/dsmo/declarations/:id/pdf/:copy` | `GET` | `react-web/src/lib/api-client.ts:543` | `src/dsmo/dsmo.controller.ts:208` | Params: `id, copy` | 302 Redirect to PDF URL | **OK** | FE constructs URL to view DSMO declaration PDF. |
| `/admin/questionnaires` | `GET` | `react-web/src/lib/api-client.ts:619`<br>`dossiers/page.tsx:127` | `src/questionnaires/admin-questionnaires.controller.ts:139` | Query: `status, formType, period, region, search, companyId, limit, offset` | `{ items: OnefopSubmission[], total }` | **DRIFT** | Backend `@Roles` omits `SUPER_ADMIN_DSMO`, but FE routing allows `SUPER_ADMIN_DSMO` to access `/admin/dossiers`. |
| `/admin/questionnaires/pilotage/queues` | `GET` | `react-web/src/lib/api-client.ts:592`<br>`layout.tsx:53`<br>`activite/page.tsx:146` | `src/questionnaires/admin-questionnaires.controller.ts:79` | Headers: Bearer JWT | `PilotageQueues` | **DRIFT** | Class-level `@Roles` omits `SUPER_ADMIN_DSMO`. AdminLayout polls this every 30s, causing continuous 403 errors for DSMO admins. |
| `/admin/questionnaires/quality/summary` | `GET` | `react-web/src/lib/anomaly-registry.ts:144` | `src/questionnaires/admin-questionnaires.controller.ts:59` | Query: `campaignId` | `QualitySummary` | **OK** | Quality summary aggregates. |
| `/admin/questionnaires/rules` | `GET` | `react-web/src/lib/anomaly-registry.ts:153` | `src/questionnaires/admin-questionnaires.controller.ts:71` | Headers: Bearer JWT | `ValidationRuleItem[]` | **OK** | Validation rules list. |
| `/admin/questionnaires/bulk-visa` | `POST` | `react-web/src/lib/api-client.ts:684` | `src/questionnaires/admin-questionnaires.controller.ts:88` | Body: `BulkVisaDto` | Batch visa result | **OK** | Bulk visa execution. |
| `/admin/questionnaires/bulk-reject` | `POST` | `react-web/src/lib/api-client.ts:698` | `src/questionnaires/admin-questionnaires.controller.ts:96` | Body: `BulkRejectDto` | Batch reject result | **OK** | Bulk reject execution. |
| `/admin/questionnaires/anomalies/registry` | `GET` | `react-web/src/lib/anomaly-registry.ts:83` | `src/questionnaires/admin-questionnaires.controller.ts:104` | Query: `submissionId, status, isBlocking, limit, offset` | `{ total, items: AnomalyRecord[] }` | **OK** | Registry endpoint (DB table currently holds 0 rows due to backend write gap). |
| `/admin/questionnaires/anomalies/:id/resolve` | `PATCH` | `react-web/src/lib/anomaly-registry.ts:90` | `src/questionnaires/admin-questionnaires.controller.ts:125` | Body: `ResolveAnomalyDto` | `AnomalyRecord` | **OK** | Anomaly resolution action. |
| `/admin/questionnaires/:id` | `GET` | `react-web/src/lib/api-client.ts:649` | `src/questionnaires/admin-questionnaires.controller.ts:250` | Param: `id` | `AdminDossier` | **OK** | Detailed dossier representation. |
| `/admin/questionnaires/:id/diagnostic` | `GET` | `react-web/src/lib/api-client.ts:653` | `src/questionnaires/admin-questionnaires.controller.ts:245` | Param: `id` | `DossierDiagnostic` | **OK** | 3-axis dossier diagnostic. |
| `/admin/questionnaires/:id/approve` | `PATCH` | `react-web/src/lib/api-client.ts:657` | `src/questionnaires/admin-questionnaires.controller.ts:255` | Param: `id` | Updated submission | **OK** | Individual approval. |
| `/admin/questionnaires/:id/reject` | `PATCH` | `react-web/src/lib/api-client.ts:663` | `src/questionnaires/admin-questionnaires.controller.ts:260` | Body: `{ reason, certified }` | Updated submission | **OK** | Individual rejection. |
| `/admin/questionnaires/:id/request-correction` | `PATCH` | `react-web/src/lib/api-client.ts:670` | `src/questionnaires/admin-questionnaires.controller.ts:273` | Body: `{ comments, certified }` | Updated submission | **OK** | Correction request. |
| `/admin/questionnaires/export` | `GET` | `react-web/src/app/admin/dossiers/page.tsx:210` | `src/questionnaires/admin-questionnaires.controller.ts:203` | Query: `format, status, region, search, formType, period` | Streamed CSV / XLSX | **OK** | Export streamed directly. |
| `/admin/questionnaires/pending` | `GET` | *(None)* | `src/questionnaires/admin-questionnaires.controller.ts:181` | Query: `limit, offset` | `OnefopSubmission[]` | **ORPHAN_HANDLER** | Replaced by `GET /admin/questionnaires?status=PENDING_REVIEW`. |
| `/admin/questionnaires/correction-requested` | `GET` | *(None)* | `src/questionnaires/admin-questionnaires.controller.ts:190` | Query: `limit, offset` | `OnefopSubmission[]` | **ORPHAN_HANDLER** | Replaced by `GET /admin/questionnaires?status=CORRECTION_REQUESTED`. |
| `/audit/reports` | `GET` | `react-web/src/lib/audit-log.ts:46` | `src/report/audit.controller.ts:26` | Query: `paginate, limit, offset, period, actor, action, resourceType, resourceId` | `{ items, total, limit, offset }` | **OK** | Audit log query. |
| `/data-management/stats` | `GET` | `react-web/src/lib/api-client.ts:816` | `src/data-management/data-management.controller.ts:55` | Headers: Bearer JWT | `{ totals: {...}, declarationsByStatus, onefopByStatus, companiesByRegion }` | **OK** | System stats query. |
| `/data-management/export/history` | `GET` | `react-web/src/lib/api-client.ts:833` | `src/data-management/data-management.controller.ts:89` | Query: `limit` | `ExportHistoryItem[]` | **OK** | Export history from `AuditLog`. |
| `/data-management/export/submissions/spss/manifest` | `POST` | `react-web/src/lib/api-client.ts:723` | `src/data-management/data-management.controller.ts:116` | Body: filters | `{ sps: string }` | **OK** | SPSS syntax generator. |
| `/data-management/export/submissions/spss/csv` | `POST` | `react-web/src/lib/api-client.ts:787` | `src/data-management/data-management.controller.ts:129` | Body: filters | Binary stream (CSV) | **OK** | SPSS CSV export stream. |
| `/data-management/export/submissions/spss/sav` | `POST` | `react-web/src/lib/api-client.ts:791` | `src/data-management/data-management.controller.ts:143` | Body: filters | Binary stream (SAV) | **OK** | SPSS SAV binary export stream. |
| `/data-management/export/submissions/excel` | `POST` | `react-web/src/lib/api-client.ts:795` | `src/data-management/data-management.controller.ts:103` | Body: filters | Binary stream (XLSX) | **OK** | Excel workbook stream. |
| `/data-management/regions` | `GET` | *(None)* | `src/data-management/data-management.controller.ts:16` | Headers: Bearer JWT | `Region[]` | **ORPHAN_HANDLER** | FE uses `/locations/structure`. |
| `/data-management/sectors` | `GET` | *(None)* | `src/data-management/data-management.controller.ts:22` | Headers: Bearer JWT | `Sector[]` | **ORPHAN_HANDLER** | FE uses public `/sectors` endpoint instead of guarded data-management endpoint. |
| `/sectors` | `GET` | `react-web/src/lib/api-client.ts:288` | `src/sectors/sectors.controller.ts:8` | None (public) | `Sector[]` | **OK** | Public sectors reference list. |
| `/locations/structure` | `GET` | `react-web/src/lib/api-client.ts:313` | `src/locations/locations.controller.ts:30` | Headers: Bearer JWT | `LocationRegion[]` | **OK** | Full administrative hierarchy tree. |
| `/system-settings` | `GET` | `react-web/src/lib/system-settings.ts:37` | `src/system-settings/system-settings.controller.ts:15` | Headers: Bearer JWT | `SystemSettings` | **DRIFT** | Backend `@Roles('SUPER_ADMIN')` permits ONLY `SUPER_ADMIN`. FE `_routes.ts:97` allows `SUPER_ADMIN_DSMO` and `SUPER_ADMIN_ONEFOP`, who receive 403 errors. |
| `/system-settings` | `PATCH` | `react-web/src/lib/system-settings.ts:41` | `src/system-settings/system-settings.controller.ts:20` | Body: `ObservatoryIdentityUpdate` | `SystemSettings` | **DRIFT** | Same as above: only `SUPER_ADMIN` can mutate settings. |
| `/admin/pilotage/targets/inscriptions` | `GET` | `react-web/src/lib/pilotage-targets.ts:205` | `src/pilotage/pilotage.controller.ts:29` | Query: `year` | `InscriptionTargetsResponse` | **OK** | Inscription targets read. |
| `/admin/pilotage/targets/inscriptions` | `PUT` | `react-web/src/lib/pilotage-targets.ts:211` | `src/pilotage/pilotage.controller.ts:41` | Query: `year`, Body: `TargetPutBody` | `InscriptionTargetsResponse` | **OK** | Inscription targets write. |
| `/admin/pilotage/coverage` | `GET` | `react-web/src/lib/pilotage-targets.ts:218` | `src/pilotage/pilotage.controller.ts:35` | Query: `year` | `CoverageResponse` | **OK** | Coverage statistics. |
| `/admin/pilotage/campaigns/:id/quotas` | `GET` | `react-web/src/lib/pilotage-targets.ts:224` | `src/pilotage/pilotage.controller.ts:47` | Param: `id` | `CampaignQuotasResponse` | **OK** | Campaign quotas read. |
| `/admin/pilotage/campaigns/:id/quotas` | `PUT` | `react-web/src/lib/pilotage-targets.ts:230` | `src/pilotage/pilotage.controller.ts:59` | Param: `id`, Body: `TargetPutBody` | `CampaignQuotasResponse` | **OK** | Campaign quotas write. |
| `/admin/pilotage/campaigns/:id/returns` | `GET` | `react-web/src/lib/pilotage-targets.ts:237` | `src/pilotage/pilotage.controller.ts:53` | Param: `id` | `CampaignReturnsResponse` | **OK** | Campaign return metrics. |

---

## 6. Field Name & Type Mismatches

| # | Severity | FE Field / Structure | BE Field / Structure | Type (FE → BE) | Files | Fix Hint |
|---|---|---|---|---|---|---|
| F-01 | **High** | `DataManagementStats.totalCompanies`<br>`DataManagementStats.totalOnefopSubmissions` | `DataManagementStats.totals.companies`<br>`DataManagementStats.totals.onefopSubmissions` | Top-level property vs nested `totals.*` object | `react-web/src/lib/api-client.ts:799-808`<br>`src/data-management/data-management.service.ts:611` | Align `api-client.ts` type definition to match `{ totals: { companies, onefopSubmissions, ... } }`. Remove dead top-level property declarations. |
| F-02 | **High** | `EtablissementDetail.id` (URL param `?id=`) | `Company.id` (UUID) or `Establishment.id` or `Company.establishmentId` or `Company.registrationNumber` | Ambiguous string identifier | `react-web/src/app/admin/etablissement-detail/page.tsx:76`<br>`src/dsmo/dsmo.service.ts:168` | Client uses `id` URL search param to search `listCompanies({ search: id })`. When `id` is a UUID, `search` filters by ILIKE across name, taxNumber, establishmentId, registrationNumber. Introduce explicit `GET /dsmo/companies/:id`. |
| F-03 | **Medium** | `OnefopAnomaly.submission.companyName` | `OnefopAnomaly.submission.company.name` | Flat property vs nested object | `react-web/src/lib/anomaly-registry.ts:38`<br>`src/questionnaires/eligibility-engine.service.ts:344` | Fixed in `anomaly-registry.ts` via `AnomalySubmissionRef.company.name`, but legacy components reading `a.submission.companyName` will evaluate to undefined. |
| F-04 | **Medium** | `DossierItem.companyName` | `OnefopSubmission.company.name` / `OnefopSubmission.enterpriseDetail.companyName` | Flat field vs polymorphic detail relation | `react-web/src/app/admin/dossiers/page.tsx:37`<br>`src/questionnaires/questionnaires.service.ts:285` | `QuestionnairesService.listForAdmin` includes `company: { select: { name: true } }` and individual entity details (`enterpriseDetail`, `cooperativeDetail`). Client maps `companyName` defensively across multiple properties. |
| F-05 | **Medium** | `OnefopCtdDetail.name` | Column does not exist on `OnefopCtdDetail` | Missing model field | `react-web/src/app/admin/dossiers/page.tsx:139`<br>`prisma/schema.prisma:985` | CTD entity details do not have a `name` column in the database; search cannot match CTD names. |
| F-06 | **Medium** | `User.isActive` vs `User.status` ("SUSPENDED") | `User.isActive === false` | Status string vs boolean flag | `react-web/src/app/admin/etablissements/page.tsx:160`<br>`prisma/schema.prisma:1937` | In the database, "Suspended" is represented by `isActive: false`, not `UserStatus.SUSPENDED`. Client status filter `selectedStatus === "SUSPENDED"` cannot be pushed server-side. |
| F-07 | **Low** | `OnefopSubmission.quarterCode` default `"2025-T1"` | Stored database column default | String literal | `prisma/schema.prisma:825`<br>`react-web/src/components/admin/AdminHeaderActions.tsx:64` | Schema hardcodes default quarter to `"2025-T1"` while application operates in 2026. |

---

## 7. Enum & Business Rule Drift

| # | Severity | Enum / Rule | FE Values | BE Values | Files | Notes |
|---|---|---|---|---|---|---|
| E-01 | **High** | `OnefopEntityType` | Includes `"ASFOP"` in addition to 7 standard types | `ENTREPRISE`, `COOPERATIVE`, `CTD`, `ONG`, `ADMINISTRATION`, `PROJECT_PROGRAM`, `VOCATIONAL_TRAINING` | `react-web/src/app/admin/etablissements/page.tsx:34`<br>`prisma/schema.prisma:1979` | `ASFOP` is offered as an establishment filter option in `etablissements/page.tsx`, but does not exist in Prisma `OnefopEntityType` enum or database records. |
| E-02 | **High** | `UserStatus` | `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `REJECTED` | `PENDING_APPROVAL`, `ACTIVE`, `REJECTED`, `DRAFT`, `UNDER_REVIEW`, `COMPLEMENTS_REQUESTED`, `DOCUMENTS_INCOMPLETE` | `react-web/src/app/admin/etablissements/page.tsx:42`<br>`prisma/schema.prisma:1937` | Frontend conflates `isActive: false` into status `"SUSPENDED"` and omits intermediate review states (`COMPLEMENTS_REQUESTED`, `UNDER_REVIEW`, `DOCUMENTS_INCOMPLETE`). |
| E-03 | **Medium** | `CAMPAIGN_MANAGERS` | `SUPER_ADMIN_ROLES`, `CENTRAL`, `CAMPAIGN_MANAGER`, `REGIONAL`, `DATA_MANAGER`, `ANALYST` | `SUPER_ADMIN`, `SUPER_ADMIN_DSMO`, `SUPER_ADMIN_ONEFOP`, `CENTRAL`, `REGIONAL` | `react-web/src/app/admin/_routes.ts:61`<br>`src/campaign/campaign.controller.ts:24` | FE route permissions allow `DATA_MANAGER` and `ANALYST` into campaign management hub, but backend controller explicitly excludes them. |
| E-04 | **Medium** | `DIRECTORY_ROLES` | `react-web/src/app/admin/_routes.ts:86` includes 7 roles; `etablissements/page.tsx:26` includes only 3 | Backend `GET /dsmo/companies` allows 6 roles (`SUPER_ADMIN*`, `CENTRAL`, `REGIONAL`, `DIVISIONAL`) | `react-web/src/app/admin/_routes.ts:86`<br>`react-web/src/app/admin/etablissements/page.tsx:26`<br>`src/dsmo/dsmo.controller.ts:53` | Disagreement between sidebar navigation rules (`_routes.ts`), page-level gate (`etablissements/page.tsx`), and backend controller `@Roles`. |
| E-05 | **Medium** | `OnefopStatus` Quality Assumption | Anomaly absence evaluated as "Conforme" | Empty anomaly table (`onefop_anomalies` has 0 rows) | `react-web/src/app/admin/dossiers/page.tsx:103`<br>`src/questionnaires/eligibility-engine.service.ts:313` | Dossier list displays dossiers as ready / compliant because the anomaly table has not been written to by the submission pipeline. |

---

## 8. Auth, RLS, and Role Drift

| # | Severity | Location | FE Assumption | BE Reality | Risk |
|---|---|---|---|---|---|
| R-01 | **Critical** | `react-web/src/app/admin/layout.tsx:52` vs `src/questionnaires/admin-questionnaires.controller.ts:49` | `queuesQuery` (`GET /admin/questionnaires/pilotage/queues`) runs every 30s for all authenticated console users (`ADMIN_ROLES`, including `SUPER_ADMIN_DSMO`). | Controller class-level `@Roles` allows only `CENTRAL`, `REGIONAL`, `DIVISIONAL`, `SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`. | **High Risk:** Every 30 seconds, any active session of a `SUPER_ADMIN_DSMO` fires an unhandled 403 Forbidden request in the background. |
| R-02 | **High** | `react-web/src/app/admin/journal-audit/page.tsx:133` vs `src/auth/auth.controller.ts:293` | `actorsQuery` (`GET /auth/users?page=1&pageSize=100`) runs on page load for all roles allowed on `/admin/journal-audit` (`ALLOWED_ROLES` includes `AUDITOR` and `SUPER_ADMIN_DSMO`). | `GET /auth/users` is restricted to `USER_ADMIN_ROLES` (`SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`). | **High Risk:** When an `AUDITOR` or `SUPER_ADMIN_DSMO` views the audit log, the actor dropdown query fails with HTTP 403. |
| R-03 | **High** | `react-web/src/app/admin/parametres/page.tsx:31` vs `src/system-settings/system-settings.controller.ts:11` | `/admin/parametres` allows `SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`, `SUPER_ADMIN_DSMO`. | Controller has `@Roles('SUPER_ADMIN')` only. | **High Risk:** `SUPER_ADMIN_ONEFOP` and `SUPER_ADMIN_DSMO` can open the settings page via sidebar, but every read and write to `/system-settings` fails with 403 Forbidden. |
| R-04 | **High** | `react-web/src/app/admin/campagnes/page.tsx:32` vs `src/campaign/campaign.controller.ts:24` | `ALLOWED_ROLES` includes `CAMPAIGN_MANAGER`. | Backend `@Roles` on `GET /campaigns` lists only `SUPER_ADMIN*`, `CENTRAL`, `REGIONAL`. | **High Risk:** A user with role `CAMPAIGN_MANAGER` is permitted by FE router and page guard to open `/admin/campagnes`, but the data fetch immediately returns 403. |
| R-05 | **High** | `react-web/src/app/admin/etablissements/page.tsx:26` vs `src/dsmo/dsmo.controller.ts:53` | Page gate restricts access to `SUPER_ADMIN`, `SUPER_ADMIN_DSMO`, `SUPER_ADMIN_ONEFOP`. | Backend `GET /dsmo/companies` explicitly authorizes `CENTRAL`, `REGIONAL`, and `DIVISIONAL`. | **Medium Risk:** Regional and divisional officers are blocked by the frontend page from accessing the establishment list, even though the backend service implements territory-scoped filtering for them. |
| R-06 | **Medium** | `react-web/src/app/admin/_routes.ts:230` vs `react-web/src/app/admin/etablissement-detail/page.tsx:79` | `getAllowedRoles` matches only `hub.subRoutes`. `/admin/etablissement-detail` is not a subRoute. `RequireAdminRole` falls through to unrestricted (`allowed = true`). | Page internally enforces `DIRECTORY_ROLES` (`SUPER_ADMIN*`). | **Medium Risk:** Sub-routes missing from `hub.subRoutes` bypass layout-level route guard and rely solely on inner component guards. |

---

## 9. Orphans

### 9.1 ORPHAN_CALL (Frontend Calls with No Backend Handler)
1. **`GET /dsmo/companies/:id` (Virtual Orphan):** Referenced in `react-web/src/app/admin/etablissement-detail/page.tsx:95` and `approbation/page.tsx:64`. The frontend requires single-establishment lookups by ID, but because no `:id` route exists on `DsmoController`, it issues paginated search queries and scans the first page.

### 9.2 ORPHAN_HANDLER (Backend Endpoints with No Admin Frontend Caller)
1. **`GET /campaigns/conflicts` (`src/campaign/campaign.controller.ts:42`):** Preflight check for overlapping campaign collection modules; unused by the campaign creation dialog.
2. **`GET /campaigns/:id/progress` (`src/campaign/campaign.controller.ts:99`):** Submissions progress endpoint; frontend uses the embedded `progress` object returned by `GET /campaigns`.
3. **`GET /campaigns/:id/submissions` (`src/campaign/campaign.controller.ts:105`):** Returns campaign submission rows; no admin view calls this endpoint.
4. **`PUT /campaigns/:id` (`src/campaign/campaign.controller.ts:57`):** General campaign metadata update; frontend provides deadline extension and lifecycle action routes, but no general update UI.
5. **`GET /admin/questionnaires/pending` (`src/questionnaires/admin-questionnaires.controller.ts:181`):** Legacy pending review query; superseded by `GET /admin/questionnaires?status=PENDING_REVIEW`.
6. **`GET /admin/questionnaires/correction-requested` (`src/questionnaires/admin-questionnaires.controller.ts:190`):** Legacy correction requested query; superseded by `GET /admin/questionnaires?status=CORRECTION_REQUESTED`.
7. **`GET /data-management/regions` (`src/data-management/data-management.controller.ts:16`):** Redundant region query; frontend queries `/locations/structure` or `/locations/regions`.
8. **`GET /data-management/sectors` (`src/data-management/data-management.controller.ts:22`):** Guarded sectors query; frontend queries public `GET /sectors`.
9. **`PATCH /data-management/sectors/:id` & `DELETE /data-management/sectors/:id` (`src/data-management/data-management.controller.ts:40, 49`):** Sector nomenclature editing routes; admin UI has no sector mutation interface.
10. **`PATCH /data-management/regions/:id` & `DELETE /data-management/regions/:id` (`src/data-management/data-management.controller.ts:28, 34`):** Region editing routes; admin UI has no region mutation interface.

### 9.3 Backend Storage / Data Gap
1. **`OnefopAnomaly` Table Write Gap (`prisma/schema.prisma:2374`):** As identified in `admin-data-integrity-inventory.md §7.1`, no submission ingestion path in `src/` executes `this.prisma.onefopAnomaly.create()`. The anomaly table remains empty, causing anomaly registries and blocking-anomaly queue counters to return 0 records.

---

## 10. Duplicated Constants & Drift Risk

| Constant | Defined In (Files) | Values Differ? | Canonical Source Suggestion |
|---|---|---|---|
| **Form Types / Entity Types** | `react-web/src/app/admin/diffusion/page.tsx:36`<br>`react-web/src/app/admin/dossiers/page.tsx:61`<br>`react-web/src/app/admin/etablissements/page.tsx:29`<br>`react-web/src/app/admin/inscriptions/page.tsx:23`<br>`react-web/src/app/admin/questionnaires/page.tsx:24`<br>`react-web/src/lib/companies-directory.ts:86` | **Yes:** `etablissements/page.tsx` includes `"ASFOP"` which is absent from all other lists and the DB enum. | Single enum export in `react-web/src/lib/user-types.ts` derived from Prisma `OnefopEntityType`. |
| **Directory Staff Roles** | `react-web/src/app/admin/_routes.ts:86`<br>`react-web/src/app/admin/etablissements/page.tsx:26`<br>`react-web/src/app/admin/etablissement-detail/page.tsx:32`<br>`react-web/src/lib/user-directory.ts:273` | **Yes:** `_routes.ts` includes 7 roles; `etablissements/page.tsx` defines a local constant of only 3 roles; `user-directory.ts` defines 10 assignable roles. | Single role configuration object exported from `_routes.ts` and shared across pages. |
| **National Scope Roles** | `react-web/src/lib/admin-data-state.ts:54`<br>`react-web/src/app/admin/dossiers/page.tsx:50`<br>`react-web/src/app/admin/files-attente/page.tsx:23` | **Yes:** `admin-data-state.ts` includes 8 roles (`SUPER_ADMIN*`, `CENTRAL`, `DATA_MANAGER`, `CAMPAIGN_MANAGER`, `ANALYST`, `AUDITOR`); `dossiers/page.tsx` and `files-attente/page.tsx` include only 4 (`SUPER_ADMIN*`, `CENTRAL`). | Consolidate onto `NATIONAL_ROLES` in `admin-data-state.ts`. |
| **Audit Periods** | `react-web/src/lib/audit-log.ts:50`<br>`react-web/src/app/admin/journal-audit/page.tsx:50`<br>`react-web/src/app/admin/activite/page.tsx:291` | Minor: `activite` and `journal-audit` add `"all"` option inline. | Export canonical `AUDIT_PERIOD_OPTIONS` from `lib/audit-log.ts`. |
| **Region Names** | `react-web/src/lib/territory.ts:13` (`REGION_NAME_EN`)<br>`hooks/useTerritoryStructure.ts` | No differences found; both derive from `LocationRegion` hierarchy. | `lib/territory.ts`. |

---

## 11. Cross-Reference Against Existing Integrity Inventory

Cross-referencing against `react-web/docs/admin-data-integrity-inventory.md` (audit date 2026-10-03):

### 11.1 Previously Reported Issues — Now Resolved
* **§1 & §3 Mock & Demo Administrative Datasets in UI:**
  - `activite/page.tsx` (`DEFAULT_ACTIVITIES`, `SUPERVISION_ALERTS`): **Resolved.** Replaced with real queries to `listAuditLog` and `listAnomalyRegistry`.
  - `journal-audit/page.tsx` (`FIGMA_AUDIT_ITEMS`, `ACTOR_OPTIONS` with hardcoded names): **Resolved.** Replaced with `listAuditLog` and `actorsQuery` calling `listUsers()`.
  - `centre-qualite/page.tsx` (`CANONICAL_FALLBACK_ANOMALIES`, `FIGMA_ANOMALIES_*`): **Resolved.** Hardcoded sample arrays eliminated; replaced with `resolveDataState`.
  - `dossiers/page.tsx` (`FIGMA_DOSSIERS`, fallback total `|| 12847`): **Resolved.** Dead sample rows eliminated; paginated backend count used.
  - `dossiers/[id]/page.tsx` (`FIGMA_DOSSIER_MOCK`, `FIGMA_DIAGNOSTIC_MOCK`, pre-filled correction text): **Resolved.** Fallback mock dossier removed; fields default to empty state.
  - `etablissements/page.tsx` (`DEFAULT_SAMPLE_ETABLISSEMENTS`, fallback total `?? 1847`): **Resolved.** Replaced with `companiesQuery` and empty state handling.
  - `etablissement-detail/page.tsx` (`SABC_DEFAULT_COMPANY` spread base): **Resolved.** Replaced with strict data-state resolution.
  - `utilisateurs/page.tsx` (`DEFAULT_AGENTS`, formulaic metrics): **Resolved.** Formulaic calculations removed; hooked to `listUsers`.
* **§2 Fabricated Export Payloads:**
  - `diffusion/page.tsx` (synthesized CSV with SOSUCAM/ALUCAM rows, fabricated SPSS syntax, fake variable dictionary PDF, fake recode guide): **Resolved.** Replaced with real stream download calls (`downloadSpssSavBlob`, `downloadSpssCsvBlob`, `downloadExcelWorkbookBlob`, `getSpssManifest`). Unavailable documents display explicit unavailable state.
* **§6 Wrong Field Paths:**
  - `centre-qualite/page.tsx` (`a.submission.companyName`): **Resolved.** Corrected to `submission.company.name`.
  - `diffusion/page.tsx`, `pilotage/page.tsx` (`stats?.totalOnefopSubmissions`): **Resolved.** Updated to check `stats?.totals?.onefopSubmissions`.
  - `utilisateurs/page.tsx` (`roles: ["INVESTIGATOR"]`): **Resolved.** Corrected to `FIELD_ROLES = ["REGIONAL", "DIVISIONAL", "CENTRAL"]`.

### 11.2 Previously Reported Issues — Still Open (Backend Data Gaps)
* **`OnefopAnomaly` Persistence Gap (§7.1):** Remains open. Backend ingestion pipeline does not execute `onefopAnomaly.create()`.
* **Per-Agent Workload & Login Metrics (§7.2):** Remains open. `AuthService.listUsers` does not aggregate submission counts or workload metrics.
* **Absence of Dedicated `GET /dsmo/companies/:id` (§7.8):** Remains open. Detail pages still rely on search queries.

### 11.3 Newly Discovered Findings in this Audit
* **Background Polling 403 Storm (R-01):** `AdminLayout` continuously polls `GET /admin/questionnaires/pilotage/queues`, which rejects `SUPER_ADMIN_DSMO` with 403 Forbidden every 30 seconds.
* **Audit Log Actor Filter 403 Error (R-02):** `journal-audit/page.tsx` allows `AUDITOR` and `SUPER_ADMIN_DSMO`, but calls `GET /auth/users`, which is locked to `USER_ADMIN_ROLES`.
* **Settings Access 403 Error (R-03):** `parametres/page.tsx` allows `SUPER_ADMIN_DSMO` and `SUPER_ADMIN_ONEFOP`, but `SystemSettingsController` allows only `SUPER_ADMIN`.
* **Campaign Manager Role Gating Gap (R-04):** `_routes.ts` and `campagnes/page.tsx` allow `CAMPAIGN_MANAGER`, but `campaign.controller.ts` excludes this role from `GET /campaigns`.
* **Regional/Divisional Block on Establishment Directory (R-05):** `etablissements/page.tsx` defines a local `DIRECTORY_ROLES` that blocks `REGIONAL` and `DIVISIONAL` users, despite backend support.
* **Invalid Filter Value `"ASFOP"` (E-01):** `etablissements/page.tsx` offers an invalid entity type not present in the Prisma schema.

---

## 12. Open Questions Requiring Human Decision

1. **Authorization Scope for `SUPER_ADMIN_DSMO`:**
   - *Question:* Should `SUPER_ADMIN_DSMO` have access to ONEFOP questionnaire queues (`GET /admin/questionnaires/pilotage/queues`) and dossier lists (`GET /admin/questionnaires`)?
   - *Context:* Currently, `AdminLayout` polls `pilotage/queues` for all admin roles, but backend `AdminQuestionnairesController` excludes `SUPER_ADMIN_DSMO`, causing recurring 403 errors.
2. **Actor Directory Scope for Auditors:**
   - *Question:* Should users with the `AUDITOR` role be allowed to list users (`GET /auth/users`) in order to populate the actor filter dropdown in `/admin/journal-audit`?
   - *Context:* Currently, auditors can access the audit log page, but the actor filter query fails with 403 Forbidden because `GET /auth/users` is restricted to `USER_ADMIN_ROLES` (`SUPER_ADMIN`, `SUPER_ADMIN_ONEFOP`).
3. **Role Permissions for `CAMPAIGN_MANAGER`:**
   - *Question:* Should the `CAMPAIGN_MANAGER` role be added to `@Roles` on `GET /campaigns` in `src/campaign/campaign.controller.ts`?
   - *Context:* The frontend routing and page guards explicitly permit `CAMPAIGN_MANAGER` to manage campaigns, but the backend rejects campaign list requests from this role with 403 Forbidden.
4. **Establishment Directory Scope for Regional / Divisional Officers:**
   - *Question:* Should `REGIONAL` and `DIVISIONAL` officers have access to `/admin/etablissements`?
   - *Context:* The backend `GET /dsmo/companies` endpoint already supports territory scoping for these roles, but `react-web/src/app/admin/etablissements/page.tsx` hardcodes a local role check restricting the page to super-admins only.
5. **Entity Type `"ASFOP"` Definition:**
   - *Question:* Should `"ASFOP"` be removed from the establishment filter in `etablissements/page.tsx`, or should it be mapped to `VOCATIONAL_TRAINING` / added to `OnefopEntityType` in Prisma?
   - *Context:* `"ASFOP"` appears in UI filters but is not a valid enum value in the database schema.
6. **Dedicated Establishment Lookup Endpoint:**
   - *Question:* Should a dedicated `GET /dsmo/companies/:id` endpoint be added to `DsmoController`?
   - *Context:* Current detail and approval screens fetch establishments by executing search queries against `listCompanies`, which fails if the record is not in the first 20 results.

---

## 13. Appendix: Files Read

| File Path | Line Count | Purpose / Coverage Area |
|---|---|---|
| `react-web/package.json` | 36 | Dependencies, scripts, Next.js / React version verification |
| `react-web/tsconfig.json` | 34 | TypeScript compiler configuration |
| `react-web/next.config.ts` | 10 | Next.js and next-intl plugin configuration |
| `.env.example` | 29 | Environment variable definitions |
| `docs/reference/arrondissements-pending.md` | 46 | Reference for 360/389 territory subdivisions policy |
| `docs/audit/territorial-authorization-audit-hardening-2026-10-03.md` | 724 | Preceding territorial authorization audit report |
| `react-web/docs/admin-data-integrity-inventory.md` | 128 | Baseline admin data integrity inventory |
| `react-web/src/app/admin/_routes.ts` | 308 | Central admin navigation, hubs, and role mapping |
| `react-web/src/app/admin/layout.tsx` | 173 | Admin console layout, guard wrapper, queue polling |
| `react-web/src/app/admin/error.tsx` | 111 | Admin error boundary |
| `react-web/src/app/admin/activite/page.tsx` | 583 | Activity feed, audit events, priority alerts |
| `react-web/src/app/admin/campagnes/page.tsx` | 931 | Campaign management, lifecycle actions, reminders |
| `react-web/src/app/admin/centre-qualite/page.tsx` | 911 | Quality control hub, anomaly registry, validation rules |
| `react-web/src/app/admin/cibles/page.tsx` | 658 | Pilotage targets, coverage table, campaign quotas |
| `react-web/src/app/admin/diffusion/page.tsx` | 1141 | Data exports (SPSS SAV/CSV, Excel), export history |
| `react-web/src/app/admin/dossiers/page.tsx` | 1264 | Paginated dossier review list, batch actions |
| `react-web/src/app/admin/dossiers/[id]/page.tsx` | 2128 | Detailed dossier view, 3-axis diagnostic, review modals |
| `react-web/src/app/admin/etablissement-detail/page.tsx` | 735 | Establishment detail screen, user account overview |
| `react-web/src/app/admin/etablissement-detail/approbation/page.tsx` | 425 | Establishment registration approval and document check |
| `react-web/src/app/admin/etablissements/page.tsx` | 753 | Establishment directory table and filters |
| `react-web/src/app/admin/files-attente/page.tsx` | 368 | Priority queues (blocking anomalies, visas, corrections) |
| `react-web/src/app/admin/inscriptions/page.tsx` | 408 | Pending registration requests, diff comparison |
| `react-web/src/app/admin/journal-audit/page.tsx` | 509 | Audit log viewer, filters by actor, action, resource |
| `react-web/src/app/admin/parametres/page.tsx` | 693 | System settings, observatory identity, roles overview |
| `react-web/src/app/admin/pilotage/page.tsx` | 552 | Executive pilotage dashboard, queues, regional progress |
| `react-web/src/app/admin/questionnaires/page.tsx` | 252 | Approved ONEFOP questionnaires models and counts |
| `react-web/src/app/admin/sectors/page.tsx` | 128 | Sector nomenclature reference table |
| `react-web/src/app/admin/utilisateurs/page.tsx` | 696 | ONEFOP staff directory, account creation, reassignment |
| `react-web/src/components/admin/AdminDialog.tsx` | 56 | Shared modal dialog component |
| `react-web/src/components/admin/AdminHeaderActions.tsx` | 262 | Header bar actions, active campaign pill, scope label |
| `react-web/src/components/admin/AdminPageHeader.tsx` | 308 | Standardized admin page header and breadcrumbs |
| `react-web/src/components/admin/AdminSidebar.tsx` | 366 | Navigation sidebar rendering hubs and badges |
| `react-web/src/components/admin/CampaignManagement.tsx` | 332 | Campaign management sub-component |
| `react-web/src/components/admin/CampaignReturnsTable.tsx` | 150 | Campaign returns tracking table |
| `react-web/src/components/admin/CompaniesDirectory.tsx` | 365 | Shared establishment directory table component |
| `react-web/src/components/admin/CoverageTable.tsx` | 167 | Territory coverage breakdown table |
| `react-web/src/components/admin/DataState.tsx` | 121 | Data state display component (empty, error, loading) |
| `react-web/src/components/admin/DeclarationsList.tsx` | 254 | Shared declaration list component |
| `react-web/src/components/admin/KpiTile.tsx` | 41 | KPI metric tile component |
| `react-web/src/components/admin/RequireAdminRole.tsx` | 26 | Client-side route role protection component |
| `react-web/src/components/admin/SendNotificationForm.tsx` | 292 | Targeted notification dispatch form |
| `react-web/src/components/admin/TargetGrid.tsx` | 309 | Target entry grid component |
| `react-web/src/components/admin/UsersDirectory.tsx` | 717 | Staff user directory roster component |
| `react-web/src/lib/api-client.ts` | 834 | Central API client, fetch wrapper, token storage |
| `react-web/src/lib/admin-data-state.ts` | 287 | Data integrity helpers, scope resolution, formatting |
| `react-web/src/lib/anomaly-registry.ts` | 161 | Anomaly registry client methods and types |
| `react-web/src/lib/auth-store.ts` | 150 | Zustand client authentication store |
| `react-web/src/lib/campaigns.ts` | 182 | Campaign API methods, status mappings, helpers |
| `react-web/src/lib/companies-directory.ts` | 130 | Company directory API methods and labels |
| `react-web/src/lib/declarations.ts` | 94 | DSMO declaration client types and helpers |
| `react-web/src/lib/notifications.ts` | 44 | Notification dispatch API methods and status list |
| `react-web/src/lib/pilotage-target-payload.ts` | 364 | Target payload builder and draft state manager |
| `react-web/src/lib/pilotage-targets.ts` | 240 | Pilotage targets and quotas API client methods |
| `react-web/src/lib/role-navigation.ts` | 144 | Role-based navigation routing mappings |
| `react-web/src/lib/system-settings.ts` | 42 | System settings API methods and options |
| `react-web/src/lib/territory.ts` | 167 | Territory tree search, normalization, validation |
| `react-web/src/lib/use-admin-screen-guard.ts` | 39 | Screen guard hook for role enforcement |
| `react-web/src/lib/user-directory.ts` | 346 | User management and registration review API methods |
| `react-web/src/lib/user-types.ts` | 126 | Core user and territory type definitions |
| `react-web/src/hooks/useTerritoryStructure.ts` | 99 | Hook caching Cameroon location hierarchy |
| `src/auth/auth.controller.ts` | 511 | Backend auth controller endpoints |
| `src/auth/staff-scope.ts` | 80 | Backend staff scope authorization helper |
| `src/campaign/campaign.controller.ts` | 116 | Backend campaign controller endpoints |
| `src/data-management/data-management.controller.ts` | 149 | Backend data management and export controller |
| `src/data-management/data-management.service.ts` | 1891 | Backend export data generation and history service |
| `src/dsmo/dsmo.controller.ts` | 218 | Backend DSMO controller endpoints |
| `src/locations/locations.controller.ts` | 43 | Backend locations hierarchy controller |
| `src/pilotage/pilotage.controller.ts` | 64 | Backend pilotage targets controller |
| `src/questionnaires/admin-questionnaires.controller.ts` | 282 | Backend admin questionnaires and eligibility controller |
| `src/questionnaires/eligibility-engine.service.ts` | 963 | Backend eligibility engine and queue aggregation service |
| `src/report/audit.controller.ts` | 50 | Backend audit log controller |
| `src/sectors/sectors.controller.ts` | 25 | Backend sectors reference controller |
| `src/system-settings/system-settings.controller.ts` | 24 | Backend system settings controller |
| `prisma/schema.prisma` | 2515 | Canonical Prisma database schema |
