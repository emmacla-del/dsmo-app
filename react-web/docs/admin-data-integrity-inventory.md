# Admin data-integrity inventory

Scan date: 2026-10-03. Scope: `react-web/src/app/admin`, `react-web/src/components/admin`,
`react-web/src/lib`, `react-web/src/hooks`, plus the backend endpoints they call (`src/`).

Classification follows the directive's categories:
A = safe technical default, B = UI presentation default, C = administrative factual
default (forbidden), D = mock/demo administrative dataset (forbidden),
E = derived value needing provenance.

---

## 1. Mock/demo administrative datasets reaching production render (D)

| File | Symbol | Current behaviour | Real source |
|---|---|---|---|
| `app/admin/activite/page.tsx` | `DEFAULT_ACTIVITIES` | 7 invented events (SABC, Agent Ndongo, M. Ewane…) rendered unconditionally — no API call backs the feed at all | `GET /audit/reports` (`listAuditLog`) |
| `app/admin/activite/page.tsx` | `SUPERVISION_ALERTS` | 4 invented alerts with company names, regions, ageing text | `GET /admin/questionnaires/anomalies/registry` |
| `app/admin/journal-audit/page.tsx` | `FIGMA_AUDIT_ITEMS` | 12 invented audit entries shown whenever the real audit page is empty | `GET /audit/reports` |
| `app/admin/journal-audit/page.tsx` | `ACTOR_OPTIONS` | actor filter hardcodes "M. Ewane", "DR Littoral", "SABC S.A."… | `GET /auth/users` |
| `app/admin/journal-audit/page.tsx` | `ACTION_TYPE_OPTIONS` | 13 invented action codes the backend never writes | `AUDIT_ACTIONS` in `lib/audit-log.ts` |
| `app/admin/centre-qualite/page.tsx` | `CANONICAL_FALLBACK_ANOMALIES` | 4 invented anomalies substituted when the registry is empty | registry endpoint |
| `app/admin/centre-qualite/page.tsx` | `FIGMA_ANOMALIES_BY_TYPE` | 7 invented aggregate rows, rendered unconditionally | **no endpoint** |
| `app/admin/centre-qualite/page.tsx` | `FIGMA_ANOMALIES_BY_REGION` | 6 invented region rows incl. submission counts and status badges | **no endpoint** |
| `app/admin/centre-qualite/page.tsx` | `FIGMA_RECENT_CONTROLS` | 5 invented control events | registry endpoint (`detectedAt`) |
| `app/admin/centre-qualite/page.tsx` | `FIGMA_ACTIVE_RULES` | 6 invented rules with invented on/off state | **no endpoint** |
| `app/admin/centre-qualite/page.tsx` | `VALIDATION_RULES` | 6 invented rule definitions (codes R1…R6 the backend never emits) | **no endpoint** |
| `app/admin/dossiers/page.tsx` | `FIGMA_DOSSIERS` | 11 invented dossiers substituted whenever the list is empty | `GET /admin/questionnaires` |
| `app/admin/dossiers/[id]/page.tsx` | `FIGMA_DOSSIER_MOCK` | whole SABC dossier substituted on empty/error/404 | `GET /admin/questionnaires/:id` |
| `app/admin/dossiers/[id]/page.tsx` | `FIGMA_DIAGNOSTIC_MOCK` | 2 invented coherence warnings | `GET /admin/questionnaires/:id/diagnostic` |
| `app/admin/etablissements/page.tsx` | `DEFAULT_SAMPLE_ETABLISSEMENTS` | 8 invented establishments incl. real public officials' names | `GET /dsmo/companies` |
| `app/admin/etablissement-detail/page.tsx` | `SABC_DEFAULT_COMPANY` | used as a **spread base**, so a real company inherits SABC's RCCM, address, phone, owner | `GET /dsmo/companies` |
| `app/admin/etablissement-detail/approbation/page.tsx` | `DEFAULT_GIC` | same pattern for a pending-approval file | `GET /dsmo/companies` |
| `app/admin/utilisateurs/page.tsx` | `DEFAULT_AGENTS` | 8 invented agents with emails, territories, workload | `GET /auth/users` |
| `app/admin/parametres/page.tsx` | `INITIAL_RECENT_AUDIT` | 4 invented audit lines | `GET /audit/reports` |
| `app/admin/files-attente/page.tsx` | inline array | 2 invented anomalies substituted when the registry is empty | registry endpoint |
| `app/admin/diffusion/page.tsx` | `history` initial state | 4 invented export records attributed to named officials | **no endpoint** |

## 2. Fabricated export payloads (D, most severe)

| File | Site | Behaviour |
|---|---|---|
| `app/admin/diffusion/page.tsx` | `handleLaunchExport` | real `.sav`/`.csv`/`.xlsx` download errors are swallowed (`.catch(() => null)`) and replaced with an invented blob; the CSV branch hands the user two fabricated establishment records (SOSUCAM, ALUCAM) as an official export |
| `app/admin/diffusion/page.tsx` | `handleDownloadCodebookSps` | invented SPSS syntax substituted when the manifest call fails |
| `app/admin/diffusion/page.tsx` | `handleDownloadVariablesDict` | invented variable dictionary emitted as `.pdf` with plain-text content, no backend call at all |
| `app/admin/diffusion/page.tsx` | `handleDownloadRecodeGuide` | invented CNAE/FAP recode syntax, no backend call |
| `app/admin/etablissements/page.tsx` | `exportCsv` | exports whatever is on screen, including the sample rows |

## 3. Administrative factual defaults (C)

| File | Expression | Fabricated fact |
|---|---|---|
| `activite/page.tsx` | `queues?.blockingAnomaliesCount \|\| 14` + 3 more | alert / dossier / correction / visa counts |
| `activite/page.tsx` | literals | "4 prioritaires à traiter", "32 règles de contrôle", "Il y a 3 minutes", "● Opérationnel" |
| `dossiers/page.tsx` | `page?.total \|\| 12847` | national dossier total; also "Affichage de 1-10" and dead page buttons 1/2/3 |
| `journal-audit/page.tsx` | `auditQuery.data?.total \|\| 2847` | audit event total; "Affichage 1-12" fixed |
| `etablissements/page.tsx` | `?? 1847`, `= 1612`, `= 142`, `= 93` | establishment totals and account-status counts |
| `etablissements/page.tsx` | `creePar: "Auto-inscription"` | creator attributed to every real row |
| `utilisateurs/page.tsx` | `u.region \|\| "Centre"` | **territorial assignment** invented for agents with no region |
| `utilisateurs/page.tsx` | literals `342`, `28`, `12` | agent headcount KPIs |
| `dossiers/[id]/page.tsx` | `\|\| "Jean-Paul Mbarga"` and 14 siblings | respondent, company, address, creation date, tax regime, RCCM, region, department, commune |
| `dossiers/[id]/page.tsx` | literals | "Superviseur: Samuel Eto'o", status badge hardcoded "En Attente", Section 2 figures (1 245 / 120 / 310 / 759), Section 3 and 4 prose, whole 3-step instruction timeline |
| `dossiers/[id]/page.tsx` | `correctionProblem` / `correctionAction` initial state | invented problem statement **sent to the backend** as a real correction request |
| `etablissement-detail/page.tsx` | literals | creation date, branch, phone, address, 3 attached user accounts with last-login times, registration IP, geolocation, verification status, 4-row audit journal, 4-row submission history |
| `etablissement-detail/approbation/page.tsx` | literals | document verification checklist (2 verified / 1 missing), region, registration date, creator |
| `etablissement-detail/approbation/page.tsx` | `company.user?.id \|\| "usr-gic-1"` | approval/rejection targeted at an invented user id |
| `etablissement-detail/approbation/page.tsx` | `comment` initial state | invented rejection reason, sent to the backend |
| `diffusion/page.tsx` | `?? 12847`, `?? 10128`, `?? 2156` + literals | totals, "+14.2% ce mois", "Variables 156", "Sections 6", "~48 MB", 5-row type breakdown |
| `files-attente/page.tsx` | `pendingNationalVisasCount: 38`, `correctionsUnderReviewCount: 7` | queue counts on error |
| `components/admin/AdminHeaderActions.tsx` | `\|\| "Campagne 2026-T1"` | claims an active campaign exists when none does |
| `parametres/page.tsx` | `INITIAL_ROLES` | role names/permissions not matching `ASSIGNABLE_ROLES` |

## 4. Index-derived and clock-derived metrics (E, invalid)

| File | Expression |
|---|---|
| `utilisateurs/page.tsx` | `fiches: 200 + (idx * 37) % 250` |
| `utilisateurs/page.tsx` | `taux: 65 + (idx * 7) % 32` |
| `utilisateurs/page.tsx` | `lastAccess: idx % 2 === 0 ? "Il y a 10 min" : "Hier"` |
| `utilisateurs/page.tsx` | `tags: ["Entreprises", "Coopératives"]` on every row |
| `pilotage/page.tsx` | `fmtStamp(s.submittedAt \|\| s.createdAt \|\| new Date().toISOString())` — invents "now" for an undated record |

## 5. Territorial-scope defects (fail-open)

| File | Expression | Defect |
|---|---|---|
| `pilotage/page.tsx` | `totalSubmissions = queues.totalSubmissionsCount > 0 ? … : stats-derived` | a territorial user whose scope legitimately holds 0 dossiers is shown the **national** figure from the unscoped `/data-management/stats` |
| `pilotage/page.tsx` | `totalInscriptions = stats?.totalCompanies ?? 0` | unscoped national company count presented as the user's pipeline stage (also a wrong field path, so it silently reads 0) |
| `etablissements/page.tsx` | `stats?.totalCompanies ?? companiesQuery.data?.total ?? 1847` | mixes an unscoped national count with a scoped page total |
| `etablissements/page.tsx`, `etablissement-detail/page.tsx`, `…/approbation/page.tsx` | `const canRead = !role \|\| ROLES.includes(role)` | unknown/unloaded role is treated as authorised |
| `components/admin/AdminHeaderActions.tsx` | `scope = … : "National"` | an unassigned REGIONAL/DIVISIONAL account is labelled "National" |
| `pilotage/page.tsx`, `files-attente/page.tsx` | `queuesQuery.data ?? {…zeros}` | an API error renders as "success with zero" |

## 6. Wrong field paths that guarantee the fallback fires

These are why the fabrication was invisible in review: the real branch could never win.

| File | Expression | Reality |
|---|---|---|
| `centre-qualite/page.tsx` | `a.submission.companyName` | registry returns `submission.company.name` |
| `etablissements/page.tsx`, `diffusion/page.tsx`, `pilotage/page.tsx` | `stats?.totalCompanies`, `stats?.totalOnefopSubmissions` | `/data-management/stats` returns `totals.{companies,onefopSubmissions,…}` |
| `utilisateurs/page.tsx` | `listUsers({ roles: ["REGIONAL","DIVISIONAL","INVESTIGATOR"] })` | `INVESTIGATOR` is not in the `UserRole` enum, so `buildUserListWhere` throws `Rôle inconnu` and the request **always 400s** — the agent list could only ever render `DEFAULT_AGENTS` |
| `dossiers/page.tsx` | quality column falls through to "Conforme" | `listForAdmin` *does* include `anomalies`, but the table is never written to (§7.1), so every row asserts conformity the system has not established. The honest reading of an empty anomaly list is "no anomaly recorded", not "conforme". |

## 7. Backend data gaps found while tracing (no UI fix possible)

1. **`OnefopAnomaly` is never written.** `grep -rn "onefopAnomaly.*create" src/` returns nothing.
   `evaluateDossier` reads the stored table, so the diagnostic, the anomaly registry, the
   blocking-anomaly queue counter and the dossier quality columns are all permanently empty.
   The detection engine is not wired to submission.
2. **No per-agent workload or last-login.** `AuthService.listUsers` selects no `lastLoginAt`
   and no submission counts.
3. **No anomaly aggregates.** Nothing serves anomalies grouped by type or by region.
4. **No quality KPIs.** No endpoint computes completeness / coherence / warning / statistical
   eligibility rates. Only `statisticallyReadyCount / totalSubmissionsCount` exists.
5. **No export history.** Repository exports are not recorded as resources; `AUDIT_LIST_EXPORT`
   audit rows cover the dossier-list CSV only.
6. **No validation-rule registry.** Rule definitions and their enabled state are not persisted.
7. **No company submission history endpoint.** `/admin/questionnaires` cannot filter by company.
8. **One account per company.** `Company.user` is singular; a multi-account panel has no source.
9. **No document-verification store** behind the approval checklist.
10. **`/data-management/stats` is unscoped** yet reachable by `REGIONAL`; it must not be used to
    fill any territorial figure.
11. **No company-account status counts.** `/auth/users` excludes `COMPANY` accounts by
    construction (`buildUserListWhere`), and `/dsmo/companies` has no status filter, so
    active / pending / suspended establishment-account totals cannot be computed.
12. **No `createdAt` range filter** on `/auth/users`, so "new registrations this month" is not
    computable server-side.
