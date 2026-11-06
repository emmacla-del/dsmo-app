# Admin console audit — part 4: components, design system, API, copy, gaps, questions

[Index](README.md) · [Part 1](admin-console-audit-part-1.md) · [Part 2](admin-console-audit-part-2.md) · [Part 3](admin-console-audit-part-3.md) · Part 4

## 9. Shared components catalog

`components/admin/` holds 45 component files (plus tests). "Where used" is from an import search over `src/**/*.tsx` (tests excluded). Components with no user are marked **unused**.

| Component | File | Where used | Responsibility | Key props | States handled |
|---|---|---|---|---|---|
| `AdminSidebar` | `AdminSidebar.tsx` | `admin/layout` | Rail: brand, role hubs, bell/search, account menu | `role`, `accountName`, `accountRole`, `anomaliesCount`, `onLogout`, `showRailNotifications`, `accountScope` | menu open/closed |
| `AdminPageHeader`, `AdminStatusBadge` | `AdminPageHeader.tsx` | all 19 routes | Breadcrumb, title, subtitle, status badge, back arrow, actions, hub sub-nav or custom tabs | `breadcrumb`, `title`, `subtitle`, `statusBadge{label,variant}`, `backHref`, `beforeTitle`, `actions`, `tabsAction`, `tabs`, `hideTabs` | — |
| `AdminHeaderActions`, `AdminRailActions`, `useActiveCampaign` | `AdminHeaderActions.tsx` | annuaire, campagnes, centre-qualite, cibles, diffusion, dossiers, journal-audit, questionnaires, utilisateurs; rail | Active-campaign pill; rail bell + search link | `showCampaignPill`; `showNotifications` | loading, none |
| `NotificationBell` | `NotificationBell.tsx` | layout (dossier masthead), rail | Unread badge, popover with 5 latest | `placement: "header"\|"rail"` | loading, error, empty, ready |
| `RequireAdminRole` | `RequireAdminRole.tsx` | layout | Route gate; redirects to pilotage | `children` | allowed / `null` |
| `DataState`, `DataStateRow` | `DataState.tsx` | 19 routes + 14 components | The six non-ready states | `state`, `resource`, `title`, `hint`, `error`, `onRetry`, `dense` (+ `colSpan` for row) | loading, empty, error, forbidden, unavailable, notFound |
| `AdminTablePanel` | `AdminTablePanel.tsx` | 14 routes + 5 components | Titled frame for a result set | `title`, `headingId`, `description`, `meta`, `actions`, `toolbar`, `footer`, `busy`, `busyLabel`, `showHeader` | busy |
| `AdminDialog` | `AdminDialog.tsx` | 11 routes + 8 components | Native `<dialog>` modal | `open`, `onClose`, `title`, `eyebrow`, `footer`, `wide`, `dismissible` | open/closed |
| `FilterBar` | `FilterBar.tsx` | journal-audit | Grid of filters | children | — |
| `FilterTableHead`, `FilterTableOptions` | `FilterTableHead.tsx` | centre-qualite, equipe, journal-audit, sectors | Column head with a searchable filter popover | `label`, `filterLabel`, `active`; options `value`, `options`, `onChange`, `onSelect` | empty option list |
| `AdminFilterDisclosure` | `AdminFilterDisclosure.tsx` | etablissements, inscriptions | "Plus de filtres" disclosure with active marker | `label`, `active`, `className` | open/closed |
| `AdminActiveFilterChips` | `AdminActiveFilterChips.tsx` | dossiers, inscriptions, `CampaignNonRespondentsTable` | Removable chips + clear all | `filters[]`, `label`, `clearAllLabel`, `onClearAll`, `removeFilterLabel` | — |
| `AdminLiveResultCount` | `AdminLiveResultCount.tsx` | dossiers, inscriptions | Live region announcing result count | `children`, `className`, `announce` | announce off during placeholder data |
| `ViewSwitch` | `ViewSwitch.tsx` | annuaire, centre-qualite, cibles | In-page view links | `label`, `items[{key,label,href,active}]` | — |
| `RegistrationsHubTabs` | `RegistrationsHubTabs.tsx` | inscriptions, etablissements | Queue / organisations / register links | `activeTab`, `canReviewRegistrations`, `currentQuery` | — |
| `ArchiveActions` | `ArchiveActions.tsx` | dossiers, inscriptions | Archive (reason dialog) / restore | `archived`, `canManage`, `resourceName`, labels, `onArchive`, `onRestore`, `hideTrigger`, `dialogOpen` | — |
| `StatStrip` | `StatStrip.tsx` | centre-qualite, diffusion, etablissements, pilotage, utilisateurs | Row of KPI figures | `label`, `items[{key,value,label,hint}]`, `loading`, `loadingLabel`, `error`, `errorLabel` | loading, error |
| `KpiTile` | `KpiTile.tsx` | **unused** | Single KPI | `value`, `label`, `tone`, `href` | — |
| `CoverageBarChart` | `CoverageBarChart.tsx` | pilotage, `CoveragePanel` | Horizontal bars + table of response or quota rate | `items`, `ariaLabel`, `metric`, `showDistribution`, `nameLabel` | — |
| `CampaignReviewStatusChart` | `CampaignReviewStatusChart.tsx` | pilotage | Stacked review-status bars per territory/type | `items`, `ariaLabel` | — |
| `CampaignActivityTrendChart` | `CampaignActivityTrendChart.tsx` | pilotage | Recharts line chart of returns activity | `campaignId` | loading, error, empty |
| `RegistrationTrendChart` | `RegistrationTrendChart.tsx` | pilotage | Recharts line chart of registrations, granularity switch | — | loading, error, empty |
| `CampaignProgressChart` | `CampaignProgressChart.tsx` | **unused** | Campaign progress | `campaignId`, `registeredStock` | loading, error |
| `StatusDonutChart` | `StatusDonutChart.tsx` | **unused** | Donut | `segments`, `total`, `hrefBase`, `ariaLabel` | — |
| `CoveragePanel` | `CoveragePanel.tsx` | cibles | Registration coverage view | `year`, `semester`, `quarter`, `onPeriodChange` | loading, error, empty |
| `CoveragePeriodSelector` | `CoveragePeriodSelector.tsx` | `CoveragePanel` | Year/semester/quarter selector | `year`, `semester`, `quarter`, `latestAvailableYear`, `onPeriodChange` | — |
| `CoverageTable`, `CoverageEntityTypeTable`, `CoverageTableHelp` | `CoverageTable.tsx` | `CoveragePanel` | Territory and type coverage tables | `data`, `expanded`, `onToggle`, `overdueHref`; type table `rows`, `overdueDays`, `overdueHref` | — |
| `DossiersCoverage` | `DossiersCoverage.tsx` | **unused** | Coverage inside dossiers | `campaignId`, `onCampaignChange`, `regionFilter`, `searchTerm`, `onRegionChange`, `onSearchChange`, `showCampaignControls` | loading, error |
| `CampaignReturnsTable` | `CampaignReturnsTable.tsx` | cibles, `DossiersCoverage` | Returns by region/department | `data`, `expanded`, `onToggle` | — |
| `CampaignNonRespondentsTable` | `CampaignNonRespondentsTable.tsx` | dossiers (follow-up) | Non-respondents, filters, contacts | `data`, `canShowContacts`, `territories` | empty |
| `TargetGrid` | `TargetGrid.tsx` | cibles | Quota editor grid | `regions`, `drafts`, `onDraftChange`, `onClearRegion`, `centralInput`, `onCentralChange`, `showCentral`, `canWrite`, `expanded`, `onToggle`, `hasUnsavedChanges` | read-only |
| `CompaniesDirectory` | `CompaniesDirectory.tsx` | annuaire | Entity directory | — | loading, error, empty |
| `UsersDirectory` | `UsersDirectory.tsx` | annuaire | User directory with approve/reject/role/suspend/delete | `roleScopes`, `defaultRoleScope`, `defaultStatus`, `showRegionFilter`, `assignableRoles`, `agentRoster`, `reassignRoles` | loading, error, empty |
| `PendingStaffRequests` | `PendingStaffRequests.tsx` | utilisateurs | Pending staff sign-ups; approve / reject | `roles` | loading, error, empty |
| `GroupInvitationLinks` | `GroupInvitationLinks.tsx` | utilisateurs | List/create/revoke group links | — | loading, error, empty |
| `InviteAgentDialog` | `InviteAgentDialog.tsx` | utilisateurs | One-person invitation | `open`, `onClose`, `actorRole` | lookup states |
| `RegistrationQueueDatePicker` | `RegistrationQueueDatePicker.tsx` | **unused** | Date filter | `selected`, `onSelect`, `locale` | — |
| `DossierResponseRateKpi` | `DossierResponseRateKpi.tsx` | **unused** | Response-rate KPI | `campaignId`, `campaignLabel`, `value` | — |
| `DossierBarClaim` | `DossierBarClaim.tsx` | dossiers/[id] | Claim status + claim/release in decision bar | `claim`, `userId`, `role`, `readOnly`, `busy`, `saving`, `onChange` | expired, other holder, free |
| `DossierClaimPanel` | `DossierClaimPanel.tsx` | dossiers/[id] | Claim panel (detailed) | `dossierId`, `userId`, `role`, `revision` | loading, error, conflict |
| `DossierAnswerSections`, `PlacedFlagNotice` | `DossierAnswerSections.tsx` | dossiers/[id], `DossierVtSections` | Answers per section, flags placed on cells | `entity`, `sectionId`, `title`, `data`, `quarterCode`, `flags` | — |
| `DossierVtSections` | `DossierVtSections.tsx` | dossiers/[id] | VT answers | `schema`, `data`, `canSeeStaffNames`, `flags`, `tableMarkers` | loading, error |
| `ReviewStatisticalTable` | `ReviewStatisticalTable.tsx` | `DossierAnswerSections` | Read-only statistical table | `field`, `data`, `quarterCode` | — |
| `FindingCompare`, `VtFindingCompare` | `DossierFindingFigures.tsx` | dossiers/[id] | Observed vs expected figures | `ruleCode`, `data` / `figures` | — |
| `ExplainFindingAction`, `ExplainedFindings`, `useExplainedFindings` | `DossierExplainFinding.tsx` | dossiers/[id] | « Expliquer » dialog and list | `anomalyIds`, `revision`, `sentence`, `onSettled` | stale, partial, error |

## 10. Design system facts

### 10.1 Tokens (`app/tokens.css`, actual values)

- **Brand/state colours.** `--cam-primary #00766c`, `--cam-primary-dark #004d40`, `--cam-primary-tint #e6f0ef` (aliased as `--cam-green*`, `--cam-accent`), `--cam-gold #e8a020`, `--cam-gold-dark #b87c14`, `--cam-flag-green #0e5c2b`, `--cam-flag-red #ce1126`; `--cam-danger-bg #fbeceb`, `--cam-danger-border #f2b8b5`, `--cam-success-border #b5d6d2`, `--cam-warning-bg #fdf3dc`, `--cam-warning-border #f0d999`, `--cam-info #1a6896`, `--cam-info-bg #ebf4f9`, `--cam-info-border #b6d7ea`.
- **Surfaces/text.** `--cam-bg #f8fafc`, `--cam-surface #ffffff`, `--cam-surface-subtle #f0f4f8`, `--cam-text #1e293b`, `--cam-text-muted #64748b`, `--cam-border #e2e8f0`, `--cam-border-soft #eef2f6`, `--cam-border-strong #8492a6`, `--cam-field-border #475569`, `--cam-table-head-bg #ffffff`.
- **Spacing.** `--cam-space-1` 4 · `1-5` 6 · `2` 8 · `2-5` 10 · `3` 12 · `4` 16 · `4-5` 20 · `5` 24 · `6` 32 · `7` 48 · `8` 64 · `9` 80 (px).
- **Radii.** `--cam-radius-sm 2px`, `-md 4px`, `-control 8px`, `-lg 12px`, `-full 9999px`; `--cam-field-radius` = control, `--cam-section-radius` = lg.
- **Type scale.** `4xs 0.5625rem` (9), `3xs 0.6875rem` (11), `2xs 0.75rem` (12), `xs 0.8125rem` (13), `sm 0.875rem` (14), `base 0.9375rem` (15), `lg 1.125rem` (18), `xl 1.5rem` (24), `2xl 1.5625rem` (25), `3xl 2rem` (32), `input-ios 16px`; portal sizes `1.0625rem`, `1.25rem`, `1.875rem`, `clamp(2rem, 4.2vw, 2.75rem)`. Weights 400/500/600/700. Line heights display 1.12, tight/heading 1.2, title 1.25, label 1.3, ui 1.4, copy 1.45, base 1.5. Question weight token `--cam-question-weight` = **medium (500)**.
- **Fonts.** `--cam-font-sans: var(--font-inter), "Segoe UI", …`; `--cam-font-mono: ui-monospace, "Cascadia Mono", Consolas, …`.
- **Sizes.** `--cam-form-field-height 40px`, `--cam-side-rail-width 280px`, containers compact 380, form 640, wizard 600, quiz 680, portal 1120; admin main `max-width: 1360px` (per `ui-grammar.md` G2).
- **Breakpoints.** Not tokens; written in media queries (part 1 §3.1). Shell switch at 1024 px.

### 10.2 Classes/components allowed (`docs/standards/ui-grammar.md`, G1–G17)

G1 colour: no hex in TSX, enum → class map. G2 `.cam-admin-page` root, no page width/padding. G3 `AdminPageHeader`, never a hand-built `<h1>`. G4 containers `.cam-admin-section`›`-head`›`.cam-admin-h2`›`-body`; `.cam-pilot-panel`; `.cam-dash-card`. G5 `.cam-button` + `-primary|-secondary|-danger` (+ `-sm`), `.cam-text-button`; one primary per view. G6 `.cam-table-wrapper`›`.cam-table`; `.cam-dash-table`; `.is-num`. G7 `AdminDialog` only. G8 `.cam-field`, `.cam-admin-label`, `.cam-input`/`.cam-select`/`.cam-admin-textarea`, `.cam-admin-filters`. G9 `.cam-admin-notice--success|warn|error|info`, `.cam-admin-notice-close`, `formatApiError`. G10 `DataState`/`DataStateRow`, six distinct states. G11 `.cam-badge` + `-success|-warning|-info|-error|-neutral`. G12 `count`, `percent`, `stamp`, `shortStamp`, `elapsedSince`. G13 font-size tokens only. G14 inline style for layout only, `--cam-space-*`. G15 filters/views/pagination in the URL via `hrefWith`. G16 `.cam-question`/`.cam-answer`/`.cam-hint` (respondent). G17 wizard chrome. shadcn/ui is approved (2026-10-23) with semantic utilities mapped to tokens in `app/shadcn.css`; `AdminPageHeader`, `DataState`, `.cam-admin-page` and `AdminDialog` are kept. Enforced by `npm run check:ui-grammar` (ratchet in `scripts/ui-grammar-baseline.json`) and ESLint `no-restricted-syntax`.

### 10.3 Dark mode

No. No `prefers-color-scheme`, `data-theme` or `.dark` rule exists in `tokens.css`, `admin-console.css`, `globals.css` or `shadcn.css` (grep, 2026-11-02).

### 10.4 Accessibility present

- Drawer focus trap, `inert` background, Escape, focus return (`layout.tsx`); account menu and bell close on Escape with focus return.
- `AdminDialog` is a native `<dialog>` (focus trap, Escape, focus return); `lib/use-dialog-focus.ts` adds a Tab cycle.
- Navigation uses `aria-current="page"`; breadcrumb `nav` labelled; sub-nav `nav` labelled; ViewSwitch and tabs labelled.
- 64 occurrences of `aria-live`, `role="status"` or `role="alert"` across admin routes/components; `AdminLiveResultCount` announces result counts; queue updating line is `role="status" aria-live="polite"`.
- Inscriptions verification uses radio groups with no default (unanswered ≠ No); decision errors repeated inside the modal.
- Row checkboxes and menus have `aria-label`s (`selectRowAria`, `rowActionsAria`).
- `prefers-reduced-motion` handled in 9 CSS blocks.
- Gaps: the rail "search" icon is a link to a list (no search); the notification popover is `role="dialog"` without focus moving into it; table first columns are sticky with no announced scroll region on most tables.

### 10.5 Charts

`recharts ^3.10.1` draws `RegistrationTrendChart` and `CampaignActivityTrendChart` inside `<figure>` with `<figcaption>`, a labelled legend list, and a `role="img"` with an `aria-label` summary (`registrationTrendAria`). `CoverageBarChart` is HTML/CSS bars in a `role="region"` plus a real `<table class="cam-dash-table">` with the same figures. `CampaignReviewStatusChart` uses `role="img"` tracks with an `aria-label` per row and links per row.

## 11. Data and API surface

- **Transport.** `apiFetch<T>(path, options)` (`lib/api-client.ts`): base `API_BASE_URL` = `NEXT_PUBLIC_API_URL`, or `http://localhost:3001/api` in local development when that variable is unset (an error is raised in production when it is missing), headers `Authorization: Bearer <token>`, `X-Locale: fr|en`. Errors throw `ApiError` (`status`, `body`, `message`); `message` is the server's `message` string or array joined, humanised for generic 401/403/404/429/5xx; 401 → full navigation to `/login`; a 403 "company not active" → registration-status page. Pages display errors with `formatApiError` (server message, else `La requête a échoué. | The request failed.`).
- **Caching / refetch.** One `QueryClient` with defaults (no global `staleTime`; TanStack defaults apply: refetch on focus and on mount, 3 retries). Explicit: queues and pilotage queries 120 s polling; unread count 30 s polling; cibles queries `staleTime 60 s`, no refetch on focus; list pages use `keepPreviousData`. Mutations invalidate by key prefix (`["admin","questionnaires"]`, `["admin","pilotage","queues"]`, `["auth","company-registrations"]`, `["campaigns"]`, `NOTIFICATIONS_QUERY_KEY`).
- **Pagination styles.** Offset/limit (`/admin/questionnaires`, `/audit/reports` with `paginate=true` → `{items,total,limit,offset}`); page/pageSize (`/auth/company-registrations`, `/companies`, `/auth/users` → `{items|users|companies, total, page}`); fixed limits without paging (anomaly registry 50, notifications 50, officers 50, actor list 100, export history 20).

| Route | Endpoints (method path) |
|---|---|
| shell | GET `/admin/questionnaires/pilotage/queues`; GET `/auth/me/notifications/unread-count`; GET `/auth/me/notifications?limit=5`; PATCH `/auth/me/notifications/{id}/read`; GET `/campaigns?status=ACTIVE` |
| pilotage | GET `/admin/questionnaires/pilotage/queues`; GET `/auth/company-registrations?page=1&pageSize=1`; GET `/companies/stats`; GET `/companies/registration-trend`; GET `/admin/pilotage/campaigns/active`; GET `/admin/pilotage/campaigns/{id}/returns`; GET `…/returns/activity` |
| equipe | GET `/audit/actor-summary`; POST `/audit/nudge` |
| inscriptions | GET `/auth/company-registrations`; PATCH `/auth/approve-user/{id}`, `/auth/reject-user/{id}`, `/auth/request-complements/{id}`, `/auth/users/{id}/assign`, `/auth/users/{id}/suspend`, `/activate`; `/auth/users/{id}/archive`, `/restore`; GET `/locations/structure` |
| inscriptions/nouvelle | POST `/auth/admin/register-company`; GET `/sectors`; GET `/locations/regions`, `/locations/regions/{id}/departments`, `/locations/departments/{id}/subdivisions`; email availability |
| etablissements | GET `/companies`; GET `/companies/stats`; GET `/data-management/stats` |
| etablissement-detail | GET `/companies?search=…`; GET `/admin/questionnaires?companyId=…&limit=10`; GET `/audit/reports?resourceId=…`; PATCH `/auth/users/{id}/suspend|activate`; DELETE `/auth/users/{id}` |
| annuaire | GET `/companies`; GET `/auth/users`; PATCH `/auth/approve-user`, `/auth/reject-user`, `/auth/users/{id}/role`, `/suspend`, `/activate`, `/territory`; DELETE `/auth/users/{id}` |
| campagnes | GET `/campaigns`, `/campaigns/{id}`; POST `/campaigns`, `/campaigns/{id}/activate|pause|close|archive|extend|remind`; DELETE `/campaigns/{id}` |
| cibles | GET `/campaigns`; GET `/admin/pilotage/campaigns/active`; GET/PUT `/admin/pilotage/campaigns/{id}/quotas`; GET `…/returns`; GET `/admin/pilotage/coverage…`, `/coverage/semester`, `/coverage/quarter` |
| questionnaires | GET `/schemas/onefop.schema.json` (static); GET `/admin/questionnaires?formType=…&limit=0` ×7 |
| dossiers | GET `/admin/questionnaires` (list, counts); GET `/admin/pilotage/campaigns/active`, `/campaigns`, `…/non-respondents`; PATCH `/admin/questionnaires/{id}/assign`, `/reopen-for-correction`; POST `…/bulk-visa`, `…/bulk-reject`, `…/bulk-request-correction`; PATCH `…/{id}/archive`, `/restore`; GET `/admin/questionnaires/export` (the selection CSV is built in the browser, `handleExportSelection`) |
| dossiers/[id] | GET `/admin/questionnaires/{id}`, `/claim-state`, `/diagnostic`, `/review-progress`, `/neighbours`; POST `/review-progress`, `/coherence/recheck`; PATCH `/approve`, `/reject`, `/request-correction`, `/reopen-for-correction`, `/assign`; PATCH `/admin/questionnaires/anomalies/{id}/resolve` |
| centre-qualite | GET `/admin/questionnaires/anomalies/registry`, `/quality/summary`, `/rules`; PATCH `/anomalies/{id}/resolve` |
| diffusion | POST `/data-management/export/submissions/count`; POST `/data-management/export/submissions/spss/sav`, `/spss/csv`, `/excel`, `/spss/manifest`; POST `/data-management/export/vt-roster/{sav,csv,manifest}`; POST `/data-management/export/vt-contact/{sav,csv,manifest}`; GET `/data-management/export/history?limit=20`; GET `/data-management/stats`; GET `/campaigns` |
| sectors | GET `/sectors` |
| utilisateurs | GET `/auth/users` (×4); POST `/auth/admin/create-minefop-user`; PATCH `/auth/users/{id}/territory`; GET `/minefop-services/tree`, `/{code}/positions`, `/positions`, `/positions/by-role`; POST `/auth/admin/staff-invitations`; GET/POST `/auth/admin/staff-invitation-links`; PATCH `…/{id}/revoke`; PATCH approve/reject |
| parametres | GET/PATCH `/system-settings`; GET `/audit/reports?paginate=true&limit=6` |
| journal-audit | GET `/audit/reports?paginate=true&…`; GET `/auth/users?page=1&pageSize=100` |
| notifications | GET `/auth/me/notifications?limit=50`; PATCH `/{id}/read`; PATCH `/read-all` |

Response shapes are the TypeScript interfaces in `lib/api-client.ts` (`AdminQuestionnairesPage`, `AdminDossier`, `DossierClaimState`, `DossierDiagnostic`, `PilotageQueues`, `DataManagementStats`, `ExportHistoryItem`), `lib/user-directory.ts` (`DirectoryUser`, `CompanyRegistrationItem`, `ListUsersResult`), `lib/pilotage-targets.ts` (`CampaignQuotasResponse`, `CampaignReturnsResponse`, `CampaignNonRespondentsResponse`, `CoverageResponse`), `lib/anomaly-registry.ts` (`AnomalyRecord`, `AnomalyRegistryPage`, `QualitySummary`, `ValidationRuleItem`), `lib/audit-log.ts` (`AuditLogEntry`, `AuditLogPage`), `lib/campaigns.ts` (`Campaign`, `CampaignDetail`, `CampaignProgress`), `lib/notifications-inbox.ts` (`UserNotification`), `lib/system-settings.ts` (`SystemSettings`).

## 12. Copy and localization

- **Languages.** French (default) and English (`i18n/config.ts`). Selection: `NEXT_LOCALE` cookie, else the browser's Accept-Language (`preferredLocale`). Switched from the rail account menu (`LanguageLink compact`). The API receives `X-Locale` for bilingual server errors.
- **Where copy lives.** `messages/fr.json` (267 KB) and `en.json` (242 KB), one namespace per page (`adminPilotagePage`, `adminDossiersPage`, …). Some copy is hard-coded in TypeScript: audit labels (`lib/audit-log.ts`, FR + EN maps), verification rows and approval gate messages (`lib/inscriptions.ts`, FR + EN), scope labels (`lib/admin-data-state.ts`), status labels on the register (`STATUS_LABELS`, FR only), notification kinds (FR only), reminder types and campaign status/periodicity labels in `lib/campaigns.ts` (FR only; pages use the message files instead for status), queue type overrides (`dossiers/page.tsx`).

**40 recurring labels (FR | EN)**

| # | FR | EN |
|---|---|---|
| 1 | Tableau de bord | Dashboard |
| 2 | Inscriptions | Registrations |
| 3 | Télédéclarations | Survey submissions |
| 4 | Gestion des campagnes | Campaign management |
| 5 | Données et exports | Data and exports |
| 6 | Administration | Administration |
| 7 | Équipe territoriale | Territorial team |
| 8 | Examen des inscriptions | Registration review |
| 9 | Registre des établissements | Establishment register |
| 10 | Examen des télédéclarations | Submission review |
| 11 | Centre qualité des données | Data quality centre |
| 12 | Quotas et rapports de campagne | Campaign quotas and reports |
| 13 | Journal d'audit | Audit log |
| 14 | À traiter | Needs attention |
| 15 | En attente | Pending |
| 16 | Compléments demandés | Further information requested |
| 17 | Approuvée | Approved |
| 18 | Rejetée | Rejected |
| 19 | Visé | Endorsed |
| 20 | Correction demandée | Correction requested |
| 21 | Remplacé | Replaced |
| 22 | En retard | Late / Overdue |
| 23 | Viser | Endorse |
| 24 | Rejeter | Reject |
| 25 | Demander une correction | Request a correction |
| 26 | Rouvrir pour correction | Reopen for correction |
| 27 | Réclamer | Claim |
| 28 | Libérer | Release |
| 29 | Ouvrir | Open |
| 30 | Archiver | Archive |
| 31 | Restaurer | Restore |
| 32 | Lancer une campagne | Launch a campaign |
| 33 | Activer | Activate |
| 34 | Mettre en pause | Pause |
| 35 | Clôturer la campagne | Close the campaign |
| 36 | Résoudre | Resolve |
| 37 | Annuler | Cancel |
| 38 | Enregistrer | Save |
| 39 | Réessayer | Retry |
| 40 | Chargement… | Loading… |

- **Tone and style observed.** Formal administrative French (« Je certifie sur l'honneur … », « Visa en lot — confirmation officielle »); sentence case in most labels but Title Case in several French headings (`Informations Générales`, `Journal d'Audit Récent`, `Configuration de l'Export`, `Confirmer la Résolution`, `Description de l'Anomalie`); typographic quotes « » and the narrow-space `%` rule in French (`percent()`); explicit statements of absence (`Données non disponibles`, `Non renseigné`, `—`) rather than placeholders; consequences stated in dialogs (irreversible, logged, notified).

## 13. Gaps, inconsistencies and technical debt

**Defects**
1. `AUDITOR` lands on a blank main area: login sends every staff role to `/admin/pilotage`, which `AUDITOR` may not open, and `RequireAdminRole` redirects to that same URL and renders `null` (`app/login/page.tsx`, `components/admin/RequireAdminRole.tsx`, `_routes.ts`). The `nav-profiles.ts` comment that pilotage "has no allowedRoles" is stale.
2. Establishment detail deletes the linked account on one click with no confirmation (`etablissement-detail/page.tsx`, `deleteMutation`), though its hint says "irréversible".
3. VT roster/contact download buttons are shown to `ADMIN_ONEFOP_SUBMISSIONS`, whom the server refuses (`diffusion/page.tsx`; CLAUDE.md §21 2026-10-15/16).
4. Anomaly register shows only the first 50 anomalies, no pager (`centre-qualite/page.tsx`, `REGISTRY_PAGE_SIZE`).
5. Settings identity save has no error display (`parametres/page.tsx`, `identityMutation`).
6. Pilotage shows a hard-coded overdue threshold `7` while the registrations query loads (`overdueDays ?? 7`), contrary to `admin-data-state.ts` rule 1.

**Seen in the screenshots (2026-11-02, `screenshots/admin/`)**
6a. Page-level horizontal overflow, against `admin-layout-spec.md` §7: `/admin/campagnes` at 390 px (page 454 px wide), `/admin/utilisateurs` at 390 px (537 px), `/admin/dossiers` at 820 px (897 px; the header search and `Filtres` button sit outside the viewport, and the queue's `Actions` column is cut off).
6b. From 1024 px the dossier routes draw the rail in dark navy and 205 px wide, with a logo bar on top (`.cam-admin.is-dossier-workflow`, `--cam-console-navy-*`, `admin-console.css`); every other route has the 280 px dark-green rail (compare `dossiers-1280.png` with `campagnes-1280.png`). `ui-grammar.md` says the staff rail "keeps its dark green" and shares `--cam-side-rail-width`.
6c. The submission queue shows `—` in its counts and an empty table body, with no loading text, for about 20 s against the local backend before the rows appear. A reader cannot tell "still loading" from "no data" in that window (G10).

**Accountability gaps (backend, found 2026-11-06 at commit `f9589993`)**
6d. No audit row is written for: campaign transitions (create, activate, pause, extend, close, archive, delete; `src/campaign/` has no audit write), deleting a user (`deleteUser`), or creating an officer directly (`adminCreateMinefopUser`). CLAUDE.md §1 names administrative accountability as a required property.
6e. `AUDIT_ACTIONS` has no entry for `DOSSIER_CLAIM_EXPIRED` or `STAFF_INVITATION_LINK_REVOKED`: the journal shows their raw code and its action filter cannot pick them.

**Page-family and layout deviations (vs `admin-layout-spec.md`)**
7. `/admin/inscriptions` and `/admin/etablissements` both use the hub name `Inscriptions` as page title, no breadcrumb, and their own tab component instead of the header sub-nav.
8. `/admin/dossiers` replaces the hub sub-nav with its own tabs, so `Centre qualité des données` is not reachable from the dossier header (only from the rail).
9. `/admin/dossiers` page title `Déclarations & enquêtes` matches neither its nav label (`Examen des télédéclarations`) nor its hub (`Télédéclarations`); its views are `Dossiers terminés` in the tab and `Dossiers complétés` in the heading.
10. `/admin/questionnaires` and `/admin/sectors` are read-only; the spec describes create/edit dialogs and "scoped create/edit actions".
11. `/admin/etablissement-detail` builds every block on shadcn `Card` (decorative containers; G4, CLAUDE.md §8).
12. `/admin/journal-audit` shows the period filter twice (FilterBar and column head).
13. The rail "search" icon only links to `/admin/dossiers`.
14. Registration campaigns display status `Quota`, not their real status (`registrationStatus`).

**URL state (G15)** not kept in the URL: `/admin/equipe` (period, role, region), `/admin/etablissements` (all filters and page), `/admin/journal-audit` (all filters and page), `/admin/sectors` (category), `/admin/diffusion` (export config — arguably form state).

**Hard-coded values and copy**
15. Dossier overdue threshold fixed at 7 days (`elapsedMoreThanDays(…, 7)`, `En retard >7 j`), while registrations use `SystemSettings.registrationOverdueDays`.
16. French-only labels in TS: register status labels, notification kinds, `Toutes` sentinel in etablissements/diffusion, queue type overrides.
17. Technical code shown to staff: `(WAIVED)` in the derogation option; role codes printed under each role on `/admin/parametres`.
18. Inconsistent anomaly status wording: `Dispensées` (page) vs `Dérogée` (`ANOMALY_STATUS_LABELS`).
19. Review dialog eyebrow says `(assistée)` for every registration.
20. Title Case in several French headings (§12).
21. `cibles` confirm button shows a literal `…` while saving; error colour set inline.
22. Sticky columns use an inline Tailwind shadow with `rgba(15,23,42,0.45)` (G1/G14) in inscriptions and dossiers.

**Dead code / stale comments**
23. Unused components: `KpiTile`, `CampaignProgressChart`, `StatusDonutChart`, `DossiersCoverage`, `RegistrationQueueDatePicker`, `DossierResponseRateKpi` (tests exist for some).
24. `NotificationBell` comment says the badge polls "matching AdminLayout's queue badge" at 30 s; the layout polls every 120 s.
25. `questionnaires` disabled-button branch for roles without access is unreachable (every route role has access).
26. `adminSectorsPage.pageTitle` (`Secteurs d'activité`) is defined but the header uses `Référentiels`.
27. `UserStatus` values `DRAFT`, `UNDER_REVIEW`, `DOCUMENTS_INCOMPLETE` have no console label or transition.

**Contradictions between standards docs and code**
28. `ui-grammar.md` §Shared rules states `--cam-green #1e6b3a`, `--cam-text #000000`, `--cam-bg #ffffff`, `--cam-border #d9d9d9`; `tokens.css` has `#00766c`, `#1e293b`, `#f8fafc`, `#e2e8f0`. The shadcn section of the same file does cite `#00766c`.
29. `ui-grammar.md` G16 says the question is semibold (600); `--cam-question-weight` is medium (500) (memory records the owner moved it to 500 on 2026-10-12).
30. `ui-grammar.md` lists radii 2/4/6/10; tokens are 2/4/8/12.
31. `admin-layout-spec.md` cites `docs/standards/admin-ui-constitution.md`, which does not exist.
32. `ui-grammar.md` names `campagnes/page.tsx` the reference page with "0 colour literals"; it now contains inline SVG icons and `style` objects (count not re-measured).

**Things a designer rebuilding this UI should know**
- Every decision on a dossier needs an **active claim**; the queue's primary button changes with claim and findings state (§5.11). Removing the claim model breaks the server contract.
- Decisions send an **expected revision**; a 409 means someone else changed the file. The UI must keep a "reload and retry" path.
- **Certification checkboxes and 10-character reasons** are deliberate administrative friction, not decoration.
- "Unanswered" must stay distinct from "No" (inscriptions verification radios have no default).
- The dossier workspace has its own masthead and decision bar; it is the one deliberate exception to the standard header.
- Scope is enforced server-side; the UI often shows national-looking filters to territorial roles and relies on the server to narrow them.
- There is no dark mode and no staging backend.

## 14. Open questions

Q1. **Screenshots.** *Update 2026-11-02:* captured for `SUPER_ADMIN` only (see the [index](README.md#screenshots)); the other seven roles are still not captured, for the reason below. Original note: not captured. Playwright is installed (`node_modules/.bin/playwright`), but every admin page needs a signed-in session, and capturing per role needs one staff account per role. The API base is `NEXT_PUBLIC_API_URL` (or `localhost:3001/api` in dev); which backend the local env points at was not checked (`.env` files were not read), and project notes say there is no staging backend. Signing in to a non-local backend is the user's to do. To proceed, a human must either (a) sign in once per role in the built-in browser and let the capture run on that session, or (b) run the backend locally with test accounts for the 8 roles (recorded in a seed/fixture file) so the capture can sign in on `localhost`. Seed data has no establishments, campaigns or submissions (§6), so "realistic seed data" also needs a fixture set.
Q2. Is `CENTRAL_AGENT` meant to open pilotage on the registrations tab (current default) or on submissions?
Q3. Should `AUDITOR` get a landing page of its own (journal) instead of pilotage? (Defect 1.)
Q4. Should the actions in gap 6d be audited? Adding audit rows is a backend change for the owner to decide.
Q5. Should the console label the three `UserStatus` values nothing writes, or should they be dropped? (Dropping is a schema change.)
Q6. Which role label set is canonical for display: `directoryRoleLabel` (compact) or `adminParametresPage.role.*.name` (statutory)?
Q7. Should the dossier overdue threshold follow `registrationOverdueDays` or have its own setting?
Q8. Representative records for establishments, users, campaigns and dossiers: the repository has no seed or fixture data for them. The screenshots show the development database's test records; they are not quoted here, so that no respondent contact is copied into the document.

### NOT DETERMINED items (summary)

Settled 2026-11-06 by reading the code at commit `f9589993`: claim expiry, auto-approval trigger, respondent notification, audit coverage, invitation model and state, setters of the three unused statuses, archive/restore and export methods, the dossier export endpoint, the export-history source, and the component props.

Still open, because they need a human decision or data the repository does not hold:

- `CENTRAL_AGENT` default pilotage tab intent (Q2).
- Canonical role label set (Q6).
- Sample records for the main entities (Q8).
- Per-role screenshots for the seven roles other than `SUPER_ADMIN` (Q1).

### Self-check (2026-11-02)

- Routes: 19 in §2, 19 subsections in §5 (5.1–5.19). ✓
- Statuses in §6 → transitions in §7: UserStatus 7.1, OnefopStatus 7.2, CampaignStatus/Purpose 7.3, AnomalyStatus/resolution types 7.5, group link 7.6, notification 7.7; SubmissionStatus noted as read-only in 7.8. ✓
- Roles in §4 → flows in §8: all eight staff roles covered (§8.8). ✓
