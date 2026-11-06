# Admin console audit — part 1: overview, routes, shell, roles

[Index](README.md) · Part 1 · [Part 2](admin-console-audit-part-2.md) · [Part 3](admin-console-audit-part-3.md) · [Part 4](admin-console-audit-part-4.md)

## 1. Overview

**What it is for.** The admin console (`/admin/**`) is the staff side of CAMLEAP, the Cameroon labour-market information system run for ONEFOP/MINEFOP. Staff use it to: approve or refuse establishment registrations (`app/admin/inscriptions/page.tsx`); review, endorse ("viser"), reject or return ONEFOP survey submissions ("télédéclarations", "dossiers") (`app/admin/dossiers/**`); run collection and registration campaigns and set their quotas (`app/admin/campagnes`, `app/admin/cibles`); resolve data-quality anomalies (`app/admin/centre-qualite`); export statistical datasets (`app/admin/diffusion`); and manage staff accounts, settings and the audit journal (`app/admin/utilisateurs`, `parametres`, `journal-audit`).

**Who uses it.** Every role except `COMPANY` may load the console (`ADMIN_ROLES`, `lib/roles.ts`). Eight staff roles exist: `SUPER_ADMIN`, `ADMIN_ONEFOP`, `ADMIN_ONEFOP_REGISTRATIONS`, `ADMIN_ONEFOP_SUBMISSIONS`, `REGIONAL_ADMIN`, `DIVISIONAL_ADMIN`, `AUDITOR`, `CENTRAL_AGENT` (§4). Respondents (`COMPANY`) are sent elsewhere (`app/login/page.tsx`: staff → `/admin/pilotage`, companies → `/home` or `/home/inscription-en-attente`).

**UI tech stack** (`react-web/package.json`, read 2026-11-02):

| Concern | Implementation |
|---|---|
| Framework / routing | Next.js `16.3.5` App Router, React `19.2.8`. Every admin page is a client component (`"use client"`). There is no `app/admin/page.tsx`; `/admin` itself has no page. |
| Data fetching | `@tanstack/react-query ^5.102.8`, one `new QueryClient()` with library defaults (`app/query-provider.tsx`), all calls through `apiFetch` (`lib/api-client.ts`). |
| Client state | `zustand ^5.0.15` for auth (`lib/auth-store.ts`); local `useState`; URL query string for most list filters (`lib/admin-url.ts`, `hrefWith`). |
| i18n | `next-intl ^4.14.4`, locales `fr` (default) and `en`, cookie `NEXT_LOCALE` (`i18n/config.ts`, `i18n/request.ts`). |
| Styling | Hand-written CSS classes `cam-*` in `app/admin-console.css` (10 343 lines) and `app/globals.css`, tokens in `app/tokens.css`; Tailwind v4 + shadcn/ui components in `components/ui/**` mapped onto the tokens by `app/shadcn.css` (approved 2026-10-23, `docs/standards/ui-grammar.md` §shadcn/ui). |
| Icons | `lucide-react ^1.61.0` plus a few inline SVGs. |
| Charts | `recharts ^3.10.1` for two line charts; the bar/status charts are hand-built HTML/CSS (§10). |

## 2. Route inventory

19 page routes found under `app/admin/**` (`find src/app/admin -name page.tsx`). The 19 routes named in the brief are exactly these; no extra page route exists. Non-page files: `layout.tsx`, `error.tsx`, `_routes.ts`, `inscriptions/loading.tsx`, `inscriptions/nouvelle/loading.tsx`, and four `dossiers/*.test.tsx`.

"Hub" is the rail entry the route belongs to (`app/admin/_routes.ts`, `ADMIN_HUBS[].matchPrefixes`). Status: **implemented** = every visible control calls a real endpoint; **partial** = implemented, with a visible region that is a declared placeholder or a control the role cannot use.

| # | Route | File | Family | Hub | Purpose | Status |
|---|---|---|---|---|---|---|
| 1 | `/admin/pilotage` | `app/admin/pilotage/page.tsx` | overview | Tableau de bord | Work to process, register status, campaign coverage and trends. | implemented |
| 2 | `/admin/equipe` | `app/admin/equipe/page.tsx` | overview / directory | Équipe territoriale | Activity of regional/divisional admins; send a reminder ("Relancer"). | implemented |
| 3 | `/admin/inscriptions` | `app/admin/inscriptions/page.tsx` | queue | Inscriptions | Registration queue and registered-organisation list; approve / reject / request complements. | implemented |
| 4 | `/admin/inscriptions/nouvelle` | `app/admin/inscriptions/nouvelle/page.tsx` | form | Inscriptions (hidden entry) | Register an establishment on a respondent's behalf. | implemented |
| 5 | `/admin/etablissements` | `app/admin/etablissements/page.tsx` | queue / directory | Inscriptions | Establishment register with KPIs, filters, CSV export of the page. | implemented |
| 6 | `/admin/etablissement-detail` | `app/admin/etablissement-detail/page.tsx` | detail | Inscriptions (hidden entry) | One establishment, its declarations, linked account, audit; suspend/delete account. | partial (sign-in history and registration metadata are declared "unavailable" states) |
| 7 | `/admin/annuaire` | `app/admin/annuaire/page.tsx` | directory | Administration | Entities directory; users directory for `SUPER_ADMIN`. | implemented |
| 8 | `/admin/campagnes` | `app/admin/campagnes/page.tsx` | queue / management | Gestion des campagnes | Create, activate, pause, extend, remind, close, archive, delete campaigns. | implemented |
| 9 | `/admin/cibles` | `app/admin/cibles/page.tsx` | config + monitoring | Gestion des campagnes | Campaign quotas editor, returns by territory, registration coverage. | implemented |
| 10 | `/admin/questionnaires` | `app/admin/questionnaires/page.tsx` | config / list | Gestion des campagnes | The seven questionnaires, section counts from the schema, file counts, preview. | implemented (read-only) |
| 11 | `/admin/dossiers` | `app/admin/dossiers/page.tsx` | queue | Télédéclarations | Review queue, completed files, follow-up of non-respondents; claim, bulk decisions, export. | implemented |
| 12 | `/admin/dossiers/[id]` | `app/admin/dossiers/[id]/page.tsx` | detail / workspace | Télédéclarations | Review one submission: checks, answers, notes/history; endorse / reject / correct / reopen. | implemented |
| 13 | `/admin/centre-qualite` | `app/admin/centre-qualite/page.tsx` | overview + queue | Télédéclarations | Quality indicators, anomaly register (first 50), validation rules; resolve an anomaly. | partial (register shows only the first 50 rows, no pager) |
| 14 | `/admin/diffusion` | `app/admin/diffusion/page.tsx` | form / config | Données et exports | Configure and download `.sav` / `.csv` / `.xlsx` exports, restricted VT files, codebook, export history. | implemented |
| 15 | `/admin/sectors` | `app/admin/sectors/page.tsx` | config / reference | Données et exports | Read-only list of business sectors with a category filter. | implemented (read-only) |
| 16 | `/admin/utilisateurs` | `app/admin/utilisateurs/page.tsx` | directory + config | Administration | ONEFOP officers: add, invite, group links, pending requests, reassign territory. | implemented |
| 17 | `/admin/parametres` | `app/admin/parametres/page.tsx` | config | Administration | Observatory identity, overdue threshold, role reference card, recent audit. | implemented |
| 18 | `/admin/journal-audit` | `app/admin/journal-audit/page.tsx` | queue (audit list) | Administration | Filterable, paginated audit log. | implemented |
| 19 | `/admin/notifications` | `app/admin/notifications/page.tsx` | queue (inbox) | Administration (hidden entry) | The caller's own notifications; mark read / mark all read. | implemented |

Redirect-only views (no page of their own): `/admin/inscriptions?vue=coverage` → `/admin/cibles?vue=couverture…` (`inscriptions/page.tsx`, `useEffect` calling `coverageHref`); `/admin/cibles?vue=relances` → `/admin/dossiers?vue=followup` (`cibles/page.tsx`); `/admin/dossiers?vue=coverage` renders `null` (`dossiers/page.tsx` line ~1454).

## 3. Shell and navigation

### 3.1 Layout files and breakpoints

- `app/admin/layout.tsx` (`AdminLayout`) wraps every admin route. It renders, in order: `AdminSidebar` (rail), a click-to-close backdrop, and `.cam-admin-body` containing `.cam-admin-topbar` (menu button, plus an institutional masthead on `/admin/dossiers*`) and `<main className="cam-admin-main">`, whose child is `<RequireAdminRole>{children}</RequireAdminRole>` keyed by pathname (`cam-admin-route-transition`).
- Breakpoint: `DRAWER_QUERY = "(max-width: 1023px)"` (`layout.tsx`). From 1024 px the rail is a permanent column; below, it is an off-canvas drawer.
- Drawer behaviour (`layout.tsx`): menu button toggles `menuOpen` (`aria-expanded`, `aria-controls="cam-admin-rail"`, labels `Ouvrir le menu | Open menu` / `Fermer le menu | Close menu`); closes on route change, on `Escape`, on backdrop click, and when the window widens past the breakpoint; while open, `.cam-admin-body` gets `inert`, focus moves to the first rail link, and Tab is trapped in the rail; on close, focus returns to the menu button if it was stranded.
- Other breakpoints in `admin-console.css` (counted `@media` occurrences): `max-width: 639px` (15), `800px` (10), `767px` (5), `1023px` (4), `1199px` (4), `1399px` (3), `min-width: 1024px` (5), `1200px` (2), plus 9 `prefers-reduced-motion` blocks.
- `/admin/dossiers*` is special: the layout adds `is-dossier-workflow`, renders the CAMLEAP logo (`/images/camleap-logo.svg`), the text `◉ CAMLEAP`, the subtitle `Observatoire National | National Observatory`, the scope chip and a `NotificationBell` in the top bar, and tells the rail not to show its own bell (`showRailNotifications={!isDossierWorkflow}`).

### 3.2 Hubs as rendered

The rail shows the hubs of the signed-in role's **nav profile** (`lib/nav-profiles.ts`, `NAV_PROFILES`), in profile order; each hub links to the first sub-route the role may open (`navHubsFor`). A hub with no openable sub-route is dropped. Labels come from `adminNav.hubs.*`; icons from `HUB_ICONS` in `components/admin/AdminSidebar.tsx`.

| Hub key | Label FR \| EN | Icon (lucide) | Sub-routes in `ADMIN_HUBS` order (label FR \| EN → href) |
|---|---|---|---|
| `supervision` | Tableau de bord \| Dashboard | `LayoutDashboard` | Tableau de bord \| Dashboard → `/admin/pilotage` |
| `equipe` | Équipe territoriale \| Territorial team | `Users` | Équipe territoriale → `/admin/equipe` |
| `inscriptions` | Inscriptions \| Registrations | `UsersRound` | Examen des inscriptions \| Registration review → `/admin/inscriptions`; Registre des établissements \| Establishment register → `/admin/etablissements`; *(hidden)* Nouvelle inscription → `/admin/inscriptions/nouvelle`; *(hidden)* Détail établissement → `/admin/etablissement-detail` |
| `teledeclarations` | Télédéclarations \| Survey submissions | `ShieldCheck` | Examen des télédéclarations \| Submission review → `/admin/dossiers` (badge `pending`); Centre qualité des données \| Data quality centre → `/admin/centre-qualite` |
| `collecte` | Gestion des campagnes \| Campaign management | `FileText` | Campagnes \| Campaigns → `/admin/campagnes`; Quotas et rapports de campagne \| Campaign quotas and reports → `/admin/cibles`; Formulaires d’enquête \| Survey forms → `/admin/questionnaires` |
| `donnees` | Données et exports \| Data and exports | `Database` | Exports de données \| Data exports → `/admin/diffusion`; Référentiels \| Reference data → `/admin/sectors` |
| `administration` | Administration \| Administration | `Settings` | Utilisateurs & rôles \| Users & roles → `/admin/utilisateurs`; Annuaire \| Directory → `/admin/annuaire?tab=users`; Journal d'audit \| Audit log → `/admin/journal-audit`; Paramètres \| Settings → `/admin/parametres`; *(hidden)* Notifications → `/admin/notifications` |

Hub order per role (`NAV_PROFILES`):

| Role | Hubs, in rail order |
|---|---|
| `SUPER_ADMIN` | supervision, inscriptions, teledeclarations, collecte, equipe, donnees, administration |
| `ADMIN_ONEFOP` | same as `SUPER_ADMIN` (administration shows only Utilisateurs & rôles and Annuaire) |
| `ADMIN_ONEFOP_REGISTRATIONS` | supervision, inscriptions, collecte (collecte resolves to `/admin/cibles` only) |
| `ADMIN_ONEFOP_SUBMISSIONS` | supervision, teledeclarations, collecte, donnees |
| `REGIONAL_ADMIN` | supervision, inscriptions, teledeclarations, collecte, equipe |
| `DIVISIONAL_ADMIN` | supervision, inscriptions, teledeclarations, collecte (resolves to `/admin/cibles`; questionnaires also openable) |
| `AUDITOR` | administration (resolves to `/admin/journal-audit`) |
| `CENTRAL_AGENT` | supervision, inscriptions (resolves to `/admin/etablissements`), teledeclarations |
| `COMPANY` | none (never reaches the shell) |

**Badges.** The only rail badge is on `teledeclarations` (`badgeKey: "anomalies"`): `blockingAnomaliesCount` from `GET /admin/questionnaires/pilotage/queues` (`getPilotageQueues`), queried in `layout.tsx` with `refetchInterval: 120000`, enabled only for `PILOTAGE_READ_ROLES`. Shown when > 0, capped `99+`, `aria-label` `"{count} élément(s)" | "{count} item(s)"` (`adminSidebar.badgeAriaLabel`).

### 3.3 Sub-navigation inside hubs

- Default: `AdminPageHeader` renders `AdminSubNav` from the active hub's non-hidden sub-routes allowed to the role, only when there are 2+ (`components/admin/AdminPageHeader.tsx`). It is a `<nav aria-label="Sous-navigation | Sub-navigation">` of links with `aria-current="page"`. Badges: `pending` = `pendingNationalVisasCount`, `anomalies` = `blockingAnomaliesCount` (same queues query, `staleTime: 30000`).
- Pages that replace it:
  - `/admin/inscriptions` and `/admin/etablissements` pass `hideTabs` and render `RegistrationsHubTabs` instead: `File d'inscriptions | Registration queue`, `Organisations enregistrées | Registered organisations` (both only for `APPROVAL_ROLES`), `Registre des établissements | Establishment register`.
  - `/admin/dossiers` passes custom `tabs`: `File d'instruction | Review queue` (badge = count of `PENDING_REVIEW`), `Dossiers terminés | Completed records`, `Relances | Follow-up`. The hub's own sibling `Centre qualité des données` is therefore not in the header there.
  - `/admin/annuaire`, `/admin/cibles`, `/admin/centre-qualite` add an in-page `ViewSwitch` (§5).
  - `/admin/notifications`, `/admin/etablissement-detail`, `/admin/dossiers/[id]`, `/admin/inscriptions/nouvelle` hide tabs (`hideTabs`, or `backHref` without `tabs`).

### 3.4 Rail footer, scope indicator, notification bell

`AdminSidebar` (`components/admin/AdminSidebar.tsx`), top to bottom:

1. Brand: `CAMLEAP` and `Observatoire National | National Observatory`.
2. Hub links (above).
3. `AdminRailActions` (`components/admin/AdminHeaderActions.tsx`): `NotificationBell placement="rail"` (omitted on dossier routes) and a search icon link to `/admin/dossiers` (`aria-label` `Recherche | Search`, title `Rechercher | Search`). The "search" control does not search; it only opens the dossier list.
4. Account trigger: initials avatar, display name (`firstName lastName`, else email, else `Compte agent | Officer account`), role label (`directoryRoleLabel`). It toggles a menu (`id="cam-admin-account-menu"`, closes on outside pointer or Escape) containing:
   - `Compte et paramètres | Account & Settings` → `/admin/parametres`, only for `SETTINGS_ROLES` (`SUPER_ADMIN`);
   - the scope block: `Ressort territorial | Territory` + chip `Ressort : {scope} | Territory: {scope}`;
   - `Langue | Language` with `LanguageLink compact`;
   - `Se déconnecter | Sign out` → `logout({ intentional: true })` then `/login`.

Scope label (`computeUserScopeLabel`, `lib/admin-data-state.ts`): `DIVISIONAL_ADMIN` → `Département {d}`, else `Région {r}`, else `Départemental (non assigné)`; `REGIONAL_ADMIN` → `Région {r}` or `Régional (non assigné)`; national and registration-national roles → `National`; otherwise department, region or `Non renseigné`. English equivalents are inline in that function.

`NotificationBell` (`components/admin/NotificationBell.tsx`): button `aria-label` `Notifications (# non lue[s]) | Notifications (# unread)`; unread count polled every 30 s (`GET /auth/me/notifications/unread-count`); badge hidden at 0, capped `99+`. Clicking opens a `role="dialog"` popover (portalled and `position: fixed` in rail placement) listing the 5 latest (`GET /auth/me/notifications?limit=5`, fetched only while open), each subject a button that marks read (`PATCH …/{id}/read`) and follows `linkHref`; footer link `Voir tout | View all` → `/admin/notifications`. States: loading `Chargement… | Loading…`, error `Impossible de charger les notifications.`, empty `Aucune notification trouvée.`. Closes on Escape (focus back to bell) or outside click.

Header campaign pill (`AdminHeaderActions`, shown on 9 pages, §9): for `CAMPAIGN_ROLES`, a link to `/admin/campagnes` showing the first `ACTIVE` campaign (`GET /campaigns?status=ACTIVE`), formatted as `Campagne du 4e trimestre 2026 | Campaign for Q4 2026` when the code names a quarter, else the name truncated to 22 characters; `Aucune campagne active | No active campaign` otherwise.

### 3.5 Auth flow and shell states

- Console gate: `useAdminScreenGuard(ADMIN_ROLES)` (`lib/use-admin-screen-guard.ts`) in `layout.tsx`.
  - `status === "loading"` or not authenticated: full-viewport centred `Chargement… | Loading…` (`common.loading`).
  - `status === "unauthenticated"`: `router.replace("/login")`.
  - Authenticated with a role outside `ADMIN_ROLES` (i.e. `COMPANY`): full-viewport `Accès restreint | Restricted access`, `Cette console d'administration est réservée aux agents et auditeurs accrédités du MINEFOP.`, link `← Retour au portail | ← Back to the portal` → `/home`.
- Route gate: `RequireAdminRole` (`components/admin/RequireAdminRole.tsx`) reads `getAllowedRoles(pathname)` (longest matching sub-route href in `_routes.ts`). Not allowed → renders `null` and `router.replace("/admin/pilotage")`. Most pages also call `useAdminScreenGuard(<their roles>)` and render a `DataState` `forbidden` inside the page frame.
- Login redirect: every staff role is sent to `/admin/pilotage` (`app/login/page.tsx`).
- **Defect:** `AUDITOR` is not allowed on `/admin/pilotage`, so `RequireAdminRole` renders `null` and redirects to the same URL. An auditor signs in to a rail with one hub and an empty main area. The same happens to any role sent to `/admin/pilotage` by the error boundary's `Retour à la vue d’ensemble` link (`app/admin/error.tsx`).
- Error boundary `app/admin/error.tsx`: `Une erreur est survenue lors du chargement`, the error message or the fallback `Le module d'administration n'a pas pu s'initialiser correctement…`, buttons `Réessayer / Actualiser | Retry / Reload` (reset + full reload) and `Retour à la vue d’ensemble | Back to overview` → `/admin/pilotage`, and `Code diagnostic : {digest}` when present.
- Session errors: `apiFetch` on HTTP 401 performs a full navigation to `/login` (`lib/api-client.ts`, `LOGIN_PATH`); a 403 whose body says the company is not active sends to the registration-status page. Token: bearer token from the auth store (`getToken`), stored in browser storage (CLAUDE.md §15 records this as a known concern).

## 4. Roles, scope and permissions

### 4.1 Roles

Source: Prisma `enum UserRole` (`prisma/schema.prisma`) mirrored in `lib/roles.ts` (`ALL_ROLES`). Compact labels from `directoryRoleLabel` (`lib/user-directory.ts`); long statutory names and descriptions from `adminParametresPage.role.<ROLE>.name/description` (shown on `/admin/parametres`, not reproduced here: NOT DETERMINED which label set is canonical).

| Role | Console | Scope (front end) | Read-only? |
|---|---|---|---|
| `SUPER_ADMIN` | yes | national (`NATIONAL_ROLES`) | no |
| `ADMIN_ONEFOP` | yes | national | no |
| `ADMIN_ONEFOP_REGISTRATIONS` | yes | national for registrations only (`REGISTRATION_NATIONAL_ROLES`), not in `NATIONAL_ROLES` | no |
| `ADMIN_ONEFOP_SUBMISSIONS` | yes | national | no |
| `REGIONAL_ADMIN` | yes | own region (`TERRITORIAL_ROLES`) | no |
| `DIVISIONAL_ADMIN` | yes | own department | no |
| `AUDITOR` | yes (journal only) | not territorial; reads the platform-wide audit log | yes (by definition, `APPROVAL_ROLES` comment) |
| `CENTRAL_AGENT` | yes | national read (`NATIONAL_READ_ROLES`) | yes (`READ_ONLY_ROLES`, `isReadOnlyRole`) |
| `COMPANY` | no | — | — |

Role groups used for gating (`lib/roles.ts`): `ADMIN_ROLES`, `DIRECTORY_ROLES`, `DIRECTORY_READ_ROLES`, `REGISTRATION_ROLES`, `APPROVAL_ROLES`, `SURVEY_ROLES`, `SURVEY_READ_ROLES`, `USER_ARCHIVE_ROLES`, `USER_LIFECYCLE_ROLES`, `DOSSIER_ARCHIVE_ROLES`, `CAMPAIGN_ROLES`, `PILOTAGE_READ_ROLES`, `SETTINGS_ROLES`, `USER_ADMIN_ROLES`, `AUDIT_ROLES`, `MONITORING_ROLES`, `DATA_STATS_ROLES`, `NATIONAL_ROLES`, `REGISTRATION_NATIONAL_ROLES`, `NATIONAL_READ_ROLES`, `TERRITORIAL_ROLES`. Plus `ANOMALY_DEROGATION_ROLES` (`lib/anomaly-registry.ts`) and `REOPEN_ROLES` (`lib/dossier-axes.ts`).

### 4.2 Route visibility (role × route)

Abbreviations: SA `SUPER_ADMIN`, AO `ADMIN_ONEFOP`, AR `ADMIN_ONEFOP_REGISTRATIONS`, AS `ADMIN_ONEFOP_SUBMISSIONS`, RA `REGIONAL_ADMIN`, DA `DIVISIONAL_ADMIN`, AU `AUDITOR`, CA `CENTRAL_AGENT`. ✓ = `RequireAdminRole` lets the role in (from `_routes.ts`); ✓* = reachable by URL but not in the role's rail.

| Route (gate group) | SA | AO | AR | AS | RA | DA | AU | CA |
|---|---|---|---|---|---|---|---|---|
| pilotage (`PILOTAGE_READ` ∪ `DIRECTORY_READ`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| equipe (`MONITORING`) | ✓ | ✓ | — | — | ✓ | — | — | — |
| inscriptions (`APPROVAL`) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| inscriptions/nouvelle (`DIRECTORY`) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — |
| etablissements (`DIRECTORY_READ`) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| etablissement-detail (`DIRECTORY_READ`) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| annuaire (`USER_ADMIN`) | ✓ | ✓ | — | — | — | — | — | — |
| campagnes (`CAMPAIGN`) | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| cibles (`SURVEY` ∪ `REGISTRATION`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| questionnaires (`SURVEY`) | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | — |
| dossiers, dossiers/[id] (`SURVEY_READ`) | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ |
| centre-qualite (`SURVEY_READ`) | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ |
| diffusion (`NATIONAL`) | ✓ | ✓ | — | ✓ | — | — | — | — |
| sectors (`NATIONAL`) | ✓ | ✓ | — | ✓ | — | — | — | — |
| utilisateurs (`USER_ADMIN`) | ✓ | ✓ | — | — | — | — | — | — |
| parametres (`SETTINGS`) | ✓ | — | — | — | — | — | — | — |
| journal-audit (`AUDIT`) | ✓ | — | — | — | — | — | ✓ | — |
| notifications (`ALL_ROLES`) | ✓* | ✓* | ✓* | ✓* | ✓* | ✓* | ✓* | ✓* |

### 4.3 Key actions (role × action), as the front end gates them

The server is authoritative; this table is what the UI shows or enables.

| Action | Where | Front-end gate | Roles |
|---|---|---|---|
| Approve / reject / request complements (registration) | inscriptions review dialog | `canReadQueue` = `APPROVAL_ROLES` | SA AO AR RA DA |
| Claim / release a registration | inscriptions queue | `APPROVAL_ROLES`, own or unassigned | SA AO AR RA DA |
| Register on a company's behalf | inscriptions/nouvelle; buttons on inscriptions (queue view) and etablissements | `DIRECTORY_ROLES`; etablissements hides for `isReadOnlyRole` | SA AO AR RA DA |
| Archive / restore registration | inscriptions (organisations) | `USER_ARCHIVE_ROLES` | SA AO AR RA DA |
| Suspend / activate registered account | inscriptions (organisations) | `USER_LIFECYCLE_ROLES` | SA AO RA DA |
| Suspend / reactivate / delete linked account | etablissement-detail | `SETTINGS_ROLES` | SA |
| Export registrations CSV | inscriptions | none beyond route | SA AO AR RA DA |
| Export register page CSV | etablissements | `!isReadOnlyRole` | SA AO AR RA DA |
| Create / activate / pause / extend / remind / close / archive / delete campaign | campagnes | `canMutate` = `NATIONAL_ROLES` | SA AO AS (RA sees them disabled) |
| Edit quotas | cibles (quotas) | `canWritePilotageTargets` = `NATIONAL_ROLES` | SA AO AS |
| Edit central (ADMINISTRATION) quota | cibles | `showCentral` = `NATIONAL_ROLES` | SA AO AS |
| Claim / release a dossier | dossiers, dossiers/[id] | `SURVEY_ROLES`, status `PENDING_REVIEW`/`CORRECTION_REQUESTED`, unarchived, own or free | SA AO AS RA DA |
| Endorse / reject / request correction (single) | dossiers/[id] | `SURVEY_ROLES` **and** active own claim; status rules §7 | SA AO AS RA DA |
| Bulk endorse / reject / correction / claim | dossiers (submissions view) | not `isReadOnlyRole`; rows held by the user | SA AO AS RA DA |
| Reopen an endorsed file | dossiers (completed) and dossiers/[id] | `REOPEN_ROLES` / inline `SA, AO, AS` | SA AO AS |
| Archive / restore dossier | dossiers | `DOSSIER_ARCHIVE_ROLES` | SA AO AS RA DA |
| Export dossier list (Excel) / selection CSV | dossiers | not read-only | SA AO AS RA DA |
| Explain a warning / re-run checks | dossiers/[id] | `SURVEY_ROLES`, not read-only, `PENDING_REVIEW`, claim holder for Explain | SA AO AS RA DA |
| Resolve anomaly (correction / inspection) | centre-qualite | registry readable to `SURVEY_ROLES` (`ANOMALY_REGISTRY_ROLES`) | SA AO AS RA DA |
| Resolve by legal derogation | centre-qualite | `ANOMALY_DEROGATION_ROLES` | SA AO |
| Data export, codebook | diffusion | route (`NATIONAL_ROLES`) | SA AO AS |
| VT named roster / contact files | diffusion | **no extra front-end gate** (server: SA, AO only per CLAUDE.md §21) | SA AO AS (AS will be refused) |
| Send reminder to an admin ("Relancer") | equipe | route (`MONITORING_ROLES`) | SA AO RA |
| Add officer / invite officer / group links / approve staff requests / reassign territory | utilisateurs | route (`USER_ADMIN_ROLES`) | SA AO |
| Approve / reject / change role / suspend / delete users | annuaire (Utilisateurs tab) | tab only for SA | SA |
| Save settings | parametres | route | SA |
| Read audit journal | journal-audit, dossier/detail links | `AUDIT_ROLES` | SA AU |

### 4.4 Territory and scope model

- Levels: national (`NATIONAL_ROLES`, `NATIONAL_READ_ROLES`), region (`REGIONAL_ADMIN`, `user.region`), department/"division" (`DIVISIONAL_ADMIN`, `user.department`). Subdivision (arrondissement) exists on records but no role is scoped by it. Sectors are reference data, not a scope.
- How scope is determined: from the user record (`region`, `department`) in the auth store; the label is `computeUserScopeLabel`. The front-end comments repeatedly state the server narrows every list by the actor's territory (`territoryFromUser`, `assertTerritorialAuthority` — backend; not re-verified here).
- How each route filters, from the front end's side:
  - pilotage, dossiers, centre-qualite, cibles returns, equipe, etablissements, inscriptions: no client-side territory filter for territorial roles; the server is relied on. Region/department filters are offered to all, but `equipe` fixes the region for `REGIONAL_ADMIN` (`isRegional`).
  - inscriptions/nouvelle: `registrationTerritoryChoice` (`lib/inscriptions.ts`) — national roles choose region and department; `REGIONAL_ADMIN` has region fixed, chooses department; `DIVISIONAL_ADMIN` has both fixed.
  - cibles: read-only notice names the department or region (`readOnlyDepartment`, `readOnlyRegion`).
  - dossiers: scope line `scopeRegional` / `scopeDepartmental` / `scopeNational` / `…Unassigned` in bulk dialogs.
  - `UNSCOPED_ENDPOINTS = ["/audit/reports"]` (`lib/admin-data-state.ts`): the audit log is platform-wide, hence `AUDIT_ROLES`.
- Where checks live: route gate (`_routes.ts` + `RequireAdminRole`), page guard (`useAdminScreenGuard`), component conditionals (`hasRole`, `isReadOnlyRole`, `Gated` on campagnes), and the API (authoritative; `lib/roles.ts` header: "a group here that is wider than its backend counterpart shows a control that the API will still refuse").
