# CAM-LEAP Staff Console Layout Specification

**Status:** Normative companion to `docs/standards/ui-grammar.md`. Revision 3 (2026-11-08, owner: "government platform" upgrade) adds the institutional masthead on every route, the light labelled rail, IBM Plex Sans in the console, the KPI strip and the table conventions; see §11. Revision 2 (2026-11-02), approved by the owner on 2026-11-06: adds the filter bar pattern (§4F), the three-column review workspace (§4C), the compact rail on a dossier (§2) and a change record (§10). Sections marked **[v2]** describe the layout now in the code; each is listed in §10, the record of what was accepted.
**Scope:** Every route under `react-web/src/app/admin/**` and every shared layout component under `react-web/src/components/admin/**`.
**Purpose:** Specify page composition, hierarchy, responsive behavior, and the responsibility of each route and shared component. This is a layout map and implementation contract; it does not prescribe token values or replace route-specific product requirements.

## 1. Authority and coverage

Use this document for *where content goes and how page regions relate*. Use `ui-grammar.md` for allowed classes/components and `tokens.css` for visual values. Backend contracts and the Engineering Constitution remain authoritative for data meaning.

Revision 1 cited `docs/standards/admin-ui-constitution.md` for interaction, permissions, data states and action semantics. That file does not exist (audit part 4, item 31). Until it is written, those rules live in `ui-grammar.md` (G9, G10) and in the role groups of `lib/roles.ts`.

"All files" means every admin page route and every shared admin component has an assigned layout role below. It does not mean every utility, test, API module, or data model needs its own visual design. Tests should verify their component's contract; nonvisual modules do not define layout.

A route-specific layout below is a composition contract, not a mandate to redesign the current screen. Preserve existing domain workflows unless a reviewed product decision changes them. If the rendered screen differs from this map, record the difference as a known exception or update this spec with evidence.

## 2. Console shell

### Desktop (1024px and wider)

- Persistent left rail and one main document scroll area.
- Rail contains brand, role-filtered hubs, current hub state, account/scope identity, and account actions.
- Main column contains the route's page root. The shell owns overall width and outer padding; route pages do not set page width or shell padding.
- No fixed page header is implied. Each route owns its `AdminPageHeader`.
- **[v2] One compact rail on every route.** From 1024px the rail is the same on every console page: the green rail with its brand, full height, as an icon strip (`--cam-admin-rail-compact-width`; class `is-rail-compact` on the shell). Hovering or focusing a hub opens a flyout with the hub's name and its pages (role-filtered, `hidden` routes left out); Escape closes it. « Afficher les libellés du menu » switches to full labels (`--cam-admin-rail-expanded-width`, class `is-rail-expanded`); the choice is kept per browser (`camleap.adminRail.expanded`). Hub names stay in the DOM for screen readers; badges stay visible on the icon; the account menu opens beside the strip. On `/admin/dossiers*` the institutional masthead starts at the rail's edge instead of running over it. Content gutters are the same on both sides (`--cam-space-6`).

### Tablet and phone (below 1024px)

- Rail becomes a drawer opened by the shell menu control. The drawer traps keyboard focus, makes the page behind it inert, closes on navigation/Escape, and returns focus to its opener.
- Main content occupies available width; action clusters and header regions may wrap/stack in their existing responsive patterns.
- Wide data tables may scroll horizontally within their table frame only. Avoid horizontal page overflow and nested vertical scrolling.

### Shared shell states

The shell has distinct loading, unauthenticated redirect/transition, and forbidden states. Loading and forbidden screens are centered in the viewport and do not render a partial rail/page. Route-level data states remain inside the page content area.

## 3. Standard page frame

Default order for a route:

1. `.cam-admin-page` root.
2. `AdminPageHeader`: breadcrumb (when useful), page title, short context line, route-level actions, and hub sub-navigation when the route belongs to a multi-route hub.
3. Route-level notice or action feedback, if present.
4. Optional overview metrics or summary strip, only when it helps the route's main task.
5. Primary work region: a table panel, dashboard composition, form, directory, or detail workspace.
6. Pagination, result count, or selection actions attached to the region they control.
7. Secondary history/help content after the primary task region.

A route may omit inapplicable regions. Do not add an empty card to preserve the sequence. Keep one dominant work region per view; supplementary regions must be visibly subordinate.

Headers stack at narrow widths: title/context first, actions next, navigation below. If actions cannot fit, wrap or move to an explicit menu without hiding the primary task. Hub navigation is route navigation (`aria-current="page"`), not ARIA tabs unless actual tab panels are present.

**[v2] Search and filters are never header actions.** They belong to the result region they change (§4B, §4F). The header keeps route actions (create, export of the whole route) only.

## 4. Layout patterns

### A. Overview/dashboard

Use a compact page header, then a clearly grouped KPI/summary band, then the main monitoring/workflow panels. Put the highest-priority queue or trend first. Related charts and tables share a panel; unrelated metrics do not get merged solely to save space. On narrow screens, multi-column panels collapse to one column in reading order. Provide text labels and accessible summaries for charts; do not rely on chart color alone.

### B. Queue/directory/list

Use header and route navigation, then a filter/search region (the filter bar, §4F), then result count/context, the table/list, and its pagination or selection toolbar. Keep filters above the results they change. Preserve URL state for shareable filters/view/page. The result region owns loading/empty/error states. On narrow screens, retain a readable table with local horizontal scrolling or use an established card/list presentation; never silently drop identifying fields or actions.

Status colour in a queue: red is reserved for blocking findings and refusals. A time signal (overdue, waiting) uses the information tone, so lateness never reads as an error. **[v2]**

### C. Detail/workspace

Lead with record identity, status, and territory/scope. Place the primary decision controls beside or immediately after the identity summary, then the record's key facts, substantive content, findings, and history. For dossier review, preserve the review workflow's claim model, decision rules, section navigation, findings/figures, answer tables, and audit/history relationships; do not flatten the analytical workspace into generic cards. Keep section navigation and decision context available at narrow widths, and ensure sticky regions never obscure focused content.

**[v2] Dossier review workspace — three columns.**

| Column | Width | Holds | Behaviour |
|---|---|---|---|
| Sections (left) | `--cam-dossier-sections-width` (13.75rem) | Section index with flag counts; « Sections parcourues : n sur N » with a progress bar | Fixed; scrolls on its own only if taller than the screen |
| Answers (centre) | remaining | « À vérifier » finding cards (figures, Expliquer, links to answers), Identification, questionnaire sections, notes and history | **The only scroll area** |
| Review panel (right) | `--cam-dossier-panel-width` (21.25rem; 18rem below 1280px) | Claim card (holder, expiry; Réclamer as the main button when free, Libérer when held); « À vérifier » card (n sur N traités with a bar, counts, checklist of open findings linked to their cards, eligibility, Recalculer); « Décision » card; link to notes and history | Fixed; scrolls on its own only if taller than the screen |

Scroll model (1024px and wider): the page does not scroll on a dossier. The header, section index and review panel stay in place; the centre column is the one scroll area, and in-page links, J / K and « Aller à la réponse » scroll it. Below 1024px the page scrolls as a document.

Header: name, status badge and « En attente depuis n jours » (information tone) on one line; reference, type, territory, reception date and respondent below; previous / next at the right.

Rules inside the workspace:

- Previous / next file sit in the header, at the right of the title, with « Dossier n sur N » before them; not in the decision area.
- Each answer shows the previous period (the establishment's last endorsed earlier file) when it differs; each table offers it as a « Période précédente (T2 2026) » disclosure. The earlier tables carry none of the current findings.
- While the file is not claimed, the claim action is the panel's main (full-width, primary) button and the decision area says « Réclamez ce dossier pour décider »; decision buttons appear once the claim is held.
- Decisions are stacked full width, main action first. « Viser » is primary when the file can be endorsed; when blocking findings prevent it, « Viser » is disabled with the reason above it and « Demander une correction » becomes primary. « Rejeter » uses the danger style. « Rouvrir pour correction » appears only on an endorsed file for the roles allowed.
- A finding is also said directly **under** the answer it concerns (`PlacedFlagNotice`), with the flagged table outlined in the finding's severity colour.
- A questionnaire section with no finding folds to one line (« Aucun signalement »). Any in-page link to a folded section or to an answer inside it opens it first.
- Finding cards are focusable; J / K move between them while focus is on a finding or in the review panel (WCAG 2.1.4), except while typing or while a dialog is open.
- 1024–1279px: answers and review panel side by side; the section index becomes a horizontal strip above them.
- Below 1024px: one column, the review panel first.
- Below 640px: the review panel is a bottom sheet opened from a fixed summary bar (« n points à vérifier · n bloquants · visa impossible » + « Décider »). Escape, the close button, the scrim or following a checklist link closes it. The page reserves bottom padding so the bar never covers content.

Unchanged by v2: the claim model, expected-revision checks and the 409 reload path, certification checkboxes, 10-character reasons, the warning justification before a visa, the institutional masthead.

### D. Creation/edit form

Explain the object being created or changed in the header, group fields by task in a single clear sequence, and keep primary save/submit actions at the end of the form (with a consistent accessible action region). Destructive/cancel actions remain visually secondary. Long forms use document scrolling; do not create a second vertical scroller inside the page.

### E. Configuration/reference

Organize settings and reference data by named sections. Place edit controls with the setting they affect and section-level actions in that section's heading. Avoid one giant undifferentiated form. Where settings affect other workflows, state the scope in the section description.

### F. Filter bar **[v2]**

One filter model for every list. Order, left to right:

1. **Search** (pill-shaped input, magnifier icon).
2. **Locked scope pill** for territorial roles (« 🔒 Région Centre »): shows the scope the server enforces; not editable.
3. **Up to four filter pills**, chosen per route for the role's daily task. Dossier queue: Contrôles, Région (Département for a regional admin, none for a departmental admin), Formulaire, Agent (only when no quick view is active).
4. **« Filtres »** button: opens the side panel that holds **every** filter, the pills' included. Its count shows only filters not visible as a pill.
5. **« Tout effacer »**, only when a filter is active.

Rules:

- A pill is single-choice. Off: outlined, « Label ▾ ». On: filled in the primary tint, « Label : Valeur », with its own × to clear.
- Choosing an option applies it at once and writes it to the URL (G15). There is no « Apply » step on desktop.
- A filter shown as a pill is never repeated as a chip. Chips under the bar show only active filters that have no pill.
- Views that decide *whose* items are listed (Toute la file, Mes dossiers, Non réclamés…) are tabs or quick views above the bar, not filters.
- Narrow widths: pills wrap. (A later revision may move pills into « Filtres » below 1024px, with chips shown instead.)
- Each option shows how many items it would list with the other filters kept (`GET /admin/questionnaires/facets`, built from `buildAdminListWhere`); an option at 0 is greyed but still selectable.
- « Vues enregistrées » (before « Filtres »): saves the list's URL state under a name, per officer and per device (browser storage). Applying a view replaces the URL; nothing is sent to the server.

## 5. Route inventory and page contracts

| Route | Pattern | Primary region and ordering |
|---|---|---|
| `/admin/equipe` | Overview/directory | Header → territory context → team/coverage summary → staff activity and assignment regions. |
| `/admin/inscriptions` | Queue | Header/actions → status/search filters → registration queue table → pagination/row actions. |
| `/admin/inscriptions/[id]` | Detail/review workspace (§4C) | Header (name, status, waiting time, « Inscription n sur N », previous/next) → sections index \| possible duplicate, declarant's changes, the four verifications, respondent, identification \| claim, « À vérifier » checklist, decision (Approuver, Demander des compléments, Rejeter with an inline reason). Only the centre column scrolls from 1024px; on phones the panel is a sheet. |
| `/admin/inscriptions/nouvelle` | Creation form | Header/back context → organization/territory fields grouped by task → submit actions. |
| `/admin/etablissements` | Directory | Header → directory filters/search → establishment table → pagination. |
| `/admin/etablissement-detail` | Detail | Header/back context → establishment identity/status/scope → facts and related declarations/history. |
| `/admin/annuaire` | Directory with views | Header → entity/account view switch and relevant filters → directory table/list → pagination. |
| `/admin/campagnes` | Queue/management **[v2]** | Header (« Lancer une campagne ») → running campaigns as cards (period elapsed, facts, follow-up actions, then lifecycle actions) → history table card with its filter bar (search, Statut, Type) → dialogs for short decisions. |
| `/admin/cibles` | Monitoring/workflow **[v2]** | Header → view controls → one table card per view, with the campaign picker (select, period, kind, status, note) in its toolbar → target grid or returns table; « Enregistrer » at the foot of the quotas card. |
| `/admin/questionnaires` | Configuration/list | Header → questionnaire register card (sections, questions, declarations, Aperçu / Voir dossiers) → preview dialog with the numbered sections. |
| `/admin/dossiers` | Review queue **[v2]** | Header + hub sub-nav → views (queue / completed / follow-up) → quick views → filter bar (§4F) → selection toolbar → dossier table → pagination. |
| `/admin/dossiers/[id]` | Review workspace **[v2]** | Masthead → identity header → previous/next → three columns (§4C) → notes and history. |
| `/admin/centre-qualite` | Quality workspace | Header → quality/period context → quality summary and severity overview → anomaly registry/table → resolution actions/dialogs. |
| `/admin/diffusion` | Export/configuration | Header → export scope/period controls → preview or export configuration → generated result/download feedback. |
| `/admin/sectors` | Reference (read-only) | Header → searchable reference table. |
| `/admin/utilisateurs` | User administration | Header/actions → role/status filters → user table → invite/edit dialogs and pagination. |
| `/admin/parametres` | Configuration | Header → grouped settings sections → section-level edit/save actions and feedback. |
| `/admin/journal-audit` | Audit list | Header → date/actor/action filters → audit table → pagination and detail inspection. |
| `/admin/notifications` | Inbox/list | Header → read/unread filter or grouping → notification list → per-item navigation/read actions. |

Questionnaires and sectors are described as read-only because that is what they are (audit §13.10); revision 1 asked for create/edit actions that do not exist.

The inventory is tied to `react-web/src/app/admin/**`. When a route is added, add it here before considering its layout contract complete. When a route is removed or renamed, update this table and navigation mapping together.

## 6. Shared admin component layout responsibilities

| Component(s) | Responsibility / placement contract |
|---|---|
| `AdminSidebar` | Shell rail/drawer only; hub navigation, current state, scoped account footer. Hub links carry their name as `title` so the compact rail (§2) stays legible. It does not own page titles or route content. |
| `AdminPageHeader` | Page intro, breadcrumb, title, contextual subtitle, hub navigation, route actions. Never search or filters (§3). Avoid page-built duplicate headers. |
| `AdminHeaderActions` | Compact route action cluster in header; wraps/stacks on small screens. |
| `NotificationBell`, `NotificationBell` inbox entry | Shell-level notification entry; not repeated as page content. |
| `RequireAdminRole` | Access gate; renders an explicit forbidden state, not a blank region. |
| `DataState`, `DataStateRow` | State occupies the content slot of the region whose request it represents; table row variant spans the owning table. |
| `AdminTablePanel` | Shared frame for title/context/actions, filter toolbar, table body, and footer. One panel per coherent result set. |
| `AdminFilterPill`, `AdminLockedFilterPill` **[v2]** | The filter bar's pills (§4F): single choice, own clear button, Escape returns focus. The locked pill shows an enforced scope. |
| `AdminFilterPill`, `AdminFilterBarParts`, `AdminSavedViews`, `AdminActiveFilterChips`, `AdminLiveResultCount` | Filter/search/sort controls immediately before or within the list region they control; active filters and result count remain visible with the results. Chips show only filters without a pill. |
| `ViewSwitch`, `RegistrationsHubTabs`, `CoveragePeriodSelector` | View/scope controls adjacent to the relevant header or panel, with current choice visible and URL/state behavior preserved as appropriate. |
| `AdminDialog`, `InviteAgentDialog`, `ArchiveActions`, other action dialogs | Overlay for short decisions only; field-heavy flows use a route. Dialog does not become a nested page. |
| `StatStrip` | Overview or detail summary region, ordered by task relevance and visually subordinate to the main work region. |
| `CampaignActivityTrendChart`, `CampaignReviewStatusChart`, `RegistrationTrendChart`, `CoverageBarChart`, `CoveragePanel`, `CoverageTable` | Dashboard/monitoring panels with heading, timeframe/scope context, accessible chart alternative, and responsive stacking. |
| `CampaignReturnsTable`, `CampaignNonRespondentsTable`, `TargetGrid`, `CompaniesDirectory`, `UsersDirectory`, `PendingStaffRequests` | Primary or secondary data region appropriate to its route; include local state, filters/context, and responsive treatment. |
| `ReviewStatisticalTable`, `DossierAnswerSections`, `DossierVtSections`, `DossierFindingFigures`, `DossierExplainFinding` | Centre column of the review workspace; preserve links between finding, explanation, figures, and underlying answers. `DossierAnswerSections` folds sections without a finding and places `PlacedFlagNotice` under the flagged answer. Never use as generic dashboard decoration. |
| `DossierBarClaim`, `DossierClaimPanel` | Claim state: `DossierBarClaim` at the top of the review panel; `DossierClaimPanel` in notes and history. |
| `GroupInvitationLinks` | Supporting action/content section within team or user administration, near the relevant invitation context. |

Any new shared component under `components/admin` must be assigned to one of these page regions or added to this table. Component-level CSS should define internal layout only; page-level CSS owns relationships between sibling regions.

## 7. Responsive and content rules

- Preserve reading order when columns collapse; primary task and record identity come first. In the review workspace the decision panel comes before the answers below 1024px.
- Header action groups wrap before text truncates. Long identifiers may wrap or use a deliberate compact treatment; do not truncate the only record identifier.
- Filters reflow as a balanced grid or wrapping pill row and remain labelled. Dense filters may collapse behind an explicit disclosure that exposes active-filter count/state.
- Wide tables scroll horizontally inside their own region. Keep identifying columns and action affordances usable; announce the scrollable region where needed.
- Dashboard grids collapse progressively to one column. Charts retain labels/legends or a text summary.
- Dialogs fit the viewport and scroll as a whole when necessary; avoid nested scroll areas.
- Sticky regions are exceptional: they must have a documented task benefit, measured offsets, phone behavior, and focus/anchor clearance. Documented sticky regions: the workspace section index and review panel (§4C), both with `top: calc(var(--cam-space-5) + 64px)` and released below 1024px.
- Test the actual route at desktop, tablet, and phone widths using long French and English labels, empty data, and realistic dense data.

## 8. Exceptions and change control

A route may depart from a family pattern when the domain workflow requires it. Document the route, the exact region/order difference, and why the standard pattern would impair the task. Do not encode a new global rule from a single screen.

Documented exceptions:

- Cards (decided 2026-11-02, accepted by the owner 2026-11-06): the admin console uses cards as its container for result sets, answer sections, side panels and history, one card each and never a card inside a card. This replaces revision 1's « one document, no card » rule for admin routes. Respondent screens keep the no-card rule (Engineering Constitution §8).

- `/admin/dossiers*`: institutional masthead (tricolour, scope) above the page; the workspace's three-column layout and review panel (§4C) replace the standard header actions for decisions.

Update this specification when adding/removing an admin route, changing the shell breakpoints/scroll model, introducing a new page family, or changing the structural order of a major workflow. Token or class changes alone belong in `tokens.css`/`ui-grammar.md`, not here.

## 9. Layout review checklist

- [ ] Route is in the route inventory and matches its page family.
- [ ] Header, primary region, and secondary content follow the stated order.
- [ ] Search and filters sit with the results they change, never in the header.
- [ ] Each filter/action is placed beside the content it controls.
- [ ] Responsive collapse preserves reading order, identity, and actions.
- [ ] No page-level horizontal overflow or unintended nested vertical scroll.
- [ ] Sticky regions, if any, document offsets and focus clearance.
- [ ] Loading, empty, error, forbidden, and unavailable states occupy the correct region.
- [ ] Red marks blocking or refused states only; time signals use the information tone.
- [ ] Long localized labels and dense realistic data have been considered.
- [ ] Any exception is documented with a route-specific reason.

## 10. Change record (revision 2)

Every line below was accepted by the owner in chat on 2026-11-06, the card decision included. This is now the layout of the console: changing a line is a new product decision, made in the code and in this file together. IDs match the stage-1 change log.

| ID | Kind | Section | Change | Files |
|---|---|---|---|---|
| F2, F3 | Conformance | §3, §4B | Dossier queue: search and filters moved from the header into the filter bar | `app/admin/dossiers/page.tsx` |
| C3 | Convention | §4F | Filter bar pattern: search, ≤ 4 pills, one panel, applied at once | `components/admin/AdminFilterPill.tsx`, `admin-console.css` |
| C2 | Convention | §4F | Locked scope pill for regional and departmental admins | `app/admin/dossiers/page.tsx` |
| — | Convention | §4B | Overdue waiting in the information tone instead of red | `admin-console.css` |
| S2 | Spec change | §4C, §8 | Three-column review workspace with a sticky review panel; decisions stacked, main action first | `app/admin/dossiers/[id]/page.tsx`, `admin-console.css` |
| — | Convention | §4C | Finding notice placed under the answer; flagged table outlined | `components/admin/DossierAnswerSections.tsx` |
| — | Convention | §4C | Sections without a finding fold; links open them | `components/admin/DossierAnswerSections.tsx`, `[id]/page.tsx` |
| — | Convention | §4C | Sections-viewed progress; J / K between findings | `[id]/page.tsx` |
| — | Spec change | §4C, §7 | Phone: review panel as a bottom sheet behind a summary bar | `[id]/page.tsx`, `admin-console.css` |
| — | Spec change | §4C | Only the centre column scrolls on desktop; notes and history moved into it | `[id]/page.tsx`, `admin-console.css` |
| — | Decision | §8 | Cards are the admin container | `admin-console.css` |
| — | Spec change | §2 | Compact icon rail on a dossier | `app/admin/layout.tsx`, `components/admin/AdminSidebar.tsx`, `admin-console.css` |
| — | Spec change | §2 | One compact, expandable rail on every route (flyouts, remembered per browser); dossier masthead beside the rail | `app/admin/layout.tsx`, `components/admin/AdminSidebar.tsx`, `lib/admin-rail-preference.ts`, `tokens.css`, `admin-console.css` |
| — | Convention | §5 | Campaigns, quotas and questionnaires moved to cards and the §4F filter bar | `app/admin/campagnes`, `app/admin/cibles`, `app/admin/questionnaires`, `admin-console.css` |
| — | Convention | §5 | Exports, users, settings, audit journal and notifications aligned with the card and filter-bar patterns | `diffusion`, `utilisateurs`, `parametres`, `journal-audit`, `notifications`, `admin-console.css` |
| — | Convention | §5 | Annuaire, Équipe territoriale and Référentiels on the §4F filter bar | `app/admin/annuaire`, `equipe`, `sectors`, `components/admin/UsersDirectory.tsx`, `CompaniesDirectory.tsx` |
| — | Convention | §8 | Activating and pausing a campaign are confirmed | `app/admin/campagnes/page.tsx` |
| — | Decision | §8 | One button size in the console: 36px, 14px medium, for `.cam-button` and the shadcn `Button`; respondent screens unchanged | `app/tokens.css`, `admin-console.css` |
| S4 | Spec change | §1 | Citation of the missing admin-ui-constitution.md replaced | this file |
| S5 | Spec change | §5 | Questionnaires and sectors described as read-only | this file |

Added 2026-11-02 with backend support: per-option counts (`GET /admin/questionnaires/facets`), « Dossier n sur N » (`position` and `total` on `GET …/:id/neighbours`), the previous period (`previousPeriod` on `GET …/:id`: the establishment's last endorsed file of an earlier round, shown under each answer when it differs and as a « Période précédente » disclosure under each table). Saved views are stored per officer in the browser, not on the server.

Added 2026-11-02, workflow change approved by the product owner: the registration review moves from the queue's dialog to `/admin/inscriptions/[id]` (`GET /auth/company-registrations/:id`, same territory rules as the list). The queue's main row action is « Réclamer et ouvrir » for an unclaimed file (« Ouvrir » otherwise); its menu holds « Ouvrir sans réclamer ». The owner approved the page on 2026-11-06 and the dialog is removed: this page is the only place a registration is decided. Previous/next follow the queue page the reviewer opened from (kept for the tab in sessionStorage); after a decision the page moves to the next file, or back to the queue with the decision notice.

Added 2026-11-02, presentation only (no workflow change): the registration queue, its Organisations view, the establishment register and the quality centre's anomaly register use the §4F filter bar (search, scope, pills, « Filtres » popover, chips for panel-only filters; export and refresh in the table panel). The registration queue and Organisations view have saved views. The establishment detail is a record page: identification, location and contact, respondent, workforce and declarations in the main column; account, registration and audit in a side column that stays in view. The assisted registration form shows its steps beside the form from 1024px, marks completed steps, and its action bar says how many steps are complete.

Added 2026-11-03: the establishment register keeps its filters and page in the URL (saved views, shareable links); its type and « Suspendu » filters are applied by `GET /companies` (`entityType`, `status=SUSPENDED`), so the total and the pager describe the filtered list. The registration review page shows the file's history (`GET /auth/company-registrations/:id/history`: the account's audit entries, reasons sent to the declarant and the names of changed fields, never the stored values). Fix: on phones the review workspaces' summary bar and sheet were pinned to the page instead of the screen (the route-enter animation left a transform on their wrapper); pages with a review panel now enter without it, and their section index is a row of chips.

Added 2026-11-03, presentation only (no workflow change): the console rail is the same on every route (compact by default, expandable, see §2); the dossier pages keep their masthead, which now sits beside the rail. The campaign pages follow the card pattern: `/admin/campagnes` shows running campaigns as cards and the rest as one history table with search, Statut and Type filters in the URL (`q`, `statut`, `type`); the campaign pill is no longer repeated in the header of the three campaign pages. `/admin/cibles` moves its campaign picker into the table card's toolbar. Every action and its confirmation is unchanged.

Added 2026-11-03 (second pass), presentation only: the dashboard's « À traiter » tiles sit on one row and colour the figures that need attention (overdue in the information tone, blocking alerts in red); the activity chart is a card beside the coverage table. The audit journal's filters (period, actor, action, resource, identifier) form a §4F filter bar kept in the URL (`periode`, `actor`, `action`, `type`, `resourceId`, `page`), with the pager inside the table card; deep links keep their « all dates » default. The agents table on « Utilisateurs & rôles » gets a search box and Rôle / Statut pills applied by `GET /auth/users` (`q`, `role`, `etat` in the URL), the creation date, author and method in one column, and its row actions pinned while the table scrolls. Notifications are grouped by day with « Toutes / Non lues » (`?vue=non-lues`), a per-row « Marquer comme lue », and kind tags from the messages instead of stored codes. Settings put the two forms side by side; the export summary stays in view while the export is configured. The campaign pill is no longer repeated in the Administration hub headers. Fixed on the way: the dashboard's response-rate caption read « NaN établissements » once the register passed 999 (a formatted string was given to an ICU plural).

Added 2026-11-03 (third pass): activating a campaign and pausing one now open a confirmation that names the campaign and states the consequence (collection opens, with an announcement email when automatic reminders are on; collection closes until reactivation, declarations received are kept), as the dialogs rule already required. Équipe territoriale, Annuaire (Utilisateurs) and Référentiels use the §4F filter bar with their filters in the URL; a regional administrator sees their region as a locked pill. Équipe merges role into the administrator cell and department into the ressort cell (the missing « Département » label is fixed), and the « En retard » count uses the information tone (a time signal). The Annuaire « Entités » search moved into the card toolbar with a label.

## 11. Change record (revision 3)

Decided by the owner in chat on 2026-11-08 ("adopt a more tidy and professional UI ... to the standard of a government platform"), from the canvas « CAMLEAP console — Inscriptions & Télédéclarations UI upgrade ». The shared rules live in `src/app/admin-console-standard.css`, loaded after `admin-console.css`; colours stay in `tokens.css`.

| Kind | Section | Change | Files |
|---|---|---|---|
| Spec change | §2 | Institutional masthead on **every** console route, no longer on `/admin/dossiers*` only: the national tricolour as a 4px line pinned to the top of the window; a band with the coat of arms (40px tall, never smaller; hidden below 640px), « République du Cameroun · Paix – Travail – Patrie » and the ministry / ONEFOP line; the application bar with CAMLEAP, « Console des agents », the locked territorial scope and notifications. Below 1024px the bar also holds the drawer toggle. | `components/admin/AdminMasthead.tsx`, `app/admin/layout.tsx`, `public/images/cameroon-coat-of-arms.svg` |
| Spec change | §2 | The rail is light (surface, border, primary tint for the current hub) instead of dark green, and **labelled by default** (the icon strip stays one click away and is remembered as `camleap.adminRail.expanded = "0"`). The open hub lists its pages under it. The rail no longer repeats the brand on desktop. | `components/admin/AdminSidebar.tsx`, `lib/admin-rail-preference.ts` |
| Decision | §1 | IBM Plex Sans is the console typeface, page titles included (the Newsreader page title is retired). Respondent screens keep Inter. | `app/layout.tsx`, `admin-console-standard.css` |
| Convention | §3, §6 | One tab style for hub navigation: underline with a count, wrapping on phones. | `admin-console-standard.css` |
| Convention | §3, §4B | Key figures are an `AdminKpiStrip` (one bordered strip, at most four figures, each a filter on the list, with a one-line scope note). It replaces loose status summaries and overdue banners on the route. Loading and failure are a status line, never a placeholder figure (G10). | `components/admin/AdminKpiStrip.tsx` |
| Convention | §4B, §7 | Table conventions: record cell (name, then reference and short type tag); « Région · Département » in one column; relative age in lists with the full stamp as title; overdue in the information tone; the order control always visible at the end of the filter bar; numbered pager (`AdminNumberedPager`) in the panel footer; 14px table text; no sticky first column; below 640px a table marked `.cam-table-stack` becomes stacked records with labelled values and a full-width action (ux-pilot audit 6 Nov, HIGH). | `components/admin/AdminPager.tsx`, `admin-console-standard.css` |
| Conformance | §5 | `/admin/inscriptions` (queue and organisations) moved onto the above: breadcrumb, view title and purpose line; KPI strip; duplicates shown in the status cell; type in the record cell. | `app/admin/inscriptions/page.tsx` |
| Conformance | §5 | `/admin/dossiers`: breadcrumb and visible title (it was visually hidden), underline views, « Dossiers terminés » decision counts as an `AdminKpiStrip` (filters), completed table 9 → 6 columns (reference and type in the record cell, archive as a badge beside the decision), « Région · Département », overdue waiting in the information tone, numbered pager, stacked phone records. The table frame is `cam-dossier-table-frame`; the old per-view classes and their fixed `!important` widths (1380px / 960px) no longer apply. | `app/admin/dossiers/page.tsx`, `admin-console-standard.css` |
| Fix | §5 | « Dossiers terminés » rendered its filters but never its list: the table sat inside a submissions-only block. It now renders for both views. | `app/admin/dossiers/page.tsx` |
| Conformance | §5 | `/admin/etablissements`: breadcrumb, title « Registre des établissements », KPI strip (each figure filters by account status), record cell with type, territory with arrondissement below, contact with phone below, numbered pager in the panel. | `app/admin/etablissements/page.tsx` |
| Conformance | §5 | « Relances » (`/admin/dossiers?vue=followup`): title is the view, purpose line; key figures above the list (sans déclaration, non relancé, déjà relancé, ne plus contacter), each filtering by follow-up state; filter bar with search, scope and pills instead of four labelled selects; table 10 → 6 columns (record cell with type, « Région · Département », contact with e-mail and person below, file, last follow-up as outcome + channel · date · agent, « Relancer »); numbered pager; stacked phone records. The old 1540px minimum width no longer applies. | `components/admin/CampaignNonRespondentsTable.tsx`, `app/admin/dossiers/page.tsx`, `admin-console-standard.css` |
| Conformance | §5 | `/admin/dossiers`: the title follows the view (« Examen des télédéclarations », « Dossiers terminés », « Relances ») with its own purpose line. | `app/admin/dossiers/page.tsx` |
| Fix | §5 | Phones: the campaign selector of « Dossiers terminés » and « Relances » took 220px of height (a flex basis applied in a column). It is one full-width row. | `admin-console-standard.css` |
| Conformance | §5 | `/admin/etablissement-detail`: declarations history follows the table conventions (reference, short type tag, relative date with the stamp as title, stacked on phones, « Consulter » no longer cut off); « Région · Département » in the header; two fields per row on phones. | `app/admin/etablissement-detail/page.tsx`, `admin-console-standard.css` |
| Conformance | §4C | Review workspaces: « Région · Département » in the header; the registration review's overdue badge in the information tone. Layout and workflow unchanged. | `app/admin/inscriptions/[id]/page.tsx`, `app/admin/dossiers/[id]/page.tsx` |
| Fix | — | `src/app/admin/CLAUDE.md` described revision 2 (icon-strip rail by default, sticky first column). Updated to revision 3. | `app/admin/CLAUDE.md` |
| Decision | §4C, §21 | Deciding a registration requires holding its claim, as for declarations (owner, 2026-11-08, replacing the morning's rule that a free file is claimed by the decision). Without the claim the panel says « Réclamez cette inscription pour décider ». The server refuses both: a file another officer holds, and a free file (« Réclamez cette inscription avant de décider. », 409). Staff sign-ups are not claimed and are unaffected. | `lib/registration-decision.ts`, `app/admin/inscriptions/[id]/page.tsx`, `src/auth/auth.service.ts` (backend) |
| Fix | §4C | Registration review: leaving the file (Précédent / Suivant, a duplicate link) asks first when marks or a reason would be lost; rejection and complements keep separate texts; both need 10 characters and say how many are missing; one time signal in the header. | `app/admin/inscriptions/[id]/page.tsx` |
| Fix | §4E | Organisations list: suspend, reactivate and restore are confirmed (organisation and consequence named) and report success or failure; archive confirms its success; the « Déclarations » link reaches every reader. | `app/admin/inscriptions/page.tsx` |
| Conformance | §4F | Registration queue: « Toute la file / Mes inscriptions » are quick views above the bar; Type takes the freed pill; claiming happens once, in the Actions column; row buttons are secondary (G5) and no longer grey out during background refreshes; the order is not a filter chip. | `app/admin/inscriptions/page.tsx`, `admin-console-standard.css` |
| Conformance | §3, §4B | Dossier queue: the campaign selector moved from the header to the list (Terminés, Relances); the overdue threshold is the server's (`reviewDelay.thresholdDays`), not 7; row buttons secondary, « Valider » shortcut kept (owner, 2026-11-08); one closable notice for list actions, success included; the review-delay banner that could never show is removed. | `app/admin/dossiers/page.tsx`, `admin-console-standard.css` |
| Conformance | §4D | Assisted registration: every error under its field plus a linked summary (the browser's bubbles are off); organisation types as a plain radio list; the public form's order and rules (function from the list, respondent phone required and checked, phones stored normalized); native selects. | `app/admin/inscriptions/nouvelle/page.tsx`, `admin-console-standard.css` |
| Fix | — | The unsaved-changes guard treated in-page links (#section) as leaving the page, so the assisted form's step list asked « Quitter ? ». | `components/auth/UnsavedNavigationGuard.tsx` |
| Conformance | §2 | Checked against the canvas boards (2026-11-08, afternoon). The masthead spans the window above the rail; the coat of arms and the CAMLEAP logo sit over the rail column (owner). The bar holds a search of the establishment register, the scope, the other language, notifications and the account menu, which left the foot of the rail. | `components/admin/AdminMasthead.tsx`, `AdminAccountMenu.tsx`, `app/admin/layout.tsx` |
| Conformance | §2 | Rail in sections (Instruction, Collecte, Données, Système) with a foot naming the platform and the support line; a page foot on every console page (ONEFOP, personal data, help — no accessibility page exists yet, so no link to one). | `components/admin/AdminSidebar.tsx`, `AdminFooter.tsx` |
| Conformance | §3, §5 | One 20px step between header, views, figures and list; exports in the page header; registration tabs carry their counts; the figures' note heads the list card; « Toute la file / Mes inscriptions » in the card heading; bar order: search, pills, Filtres, Tout effacer, then order and saved views. | `app/admin/inscriptions/page.tsx`, `etablissements/page.tsx`, `RegistrationsHubTabs.tsx`, `admin-console-standard.css` |
| Conformance | §4B | Dossier queue: four figures from the server's queue counts (to review, blocking, waiting past the threshold, corrections), each a filter; card heading; the file number in mono under the name; the table fits its card (actions were cut off). The board's response rate is not shown: this page does not read the expected establishments. | `app/admin/dossiers/page.tsx` |
| Conformance | §4C | Review workspaces: the record's header is a card (title, status, time signal, facts, previous/next) under the breadcrumb, on both review pages; the section index stays, as on the boards. Registration review: the claim card is headed « Réclamation » with who holds the file; without the claim, the decision card shows the reason in a note and the three decisions unavailable, then says the reason is sent to the declarant. | `components/admin/AdminPageHeader.tsx` (`record`), `app/admin/inscriptions/[id]/page.tsx`, `app/admin/dossiers/[id]/page.tsx` |
| Conformance | §4B | Télédéclarations views (examen, dossiers terminés, relances) are rail sub-routes under Télédéclarations, as the registration views are; the tab row above the list is gone. |
| Conformance | §4B | Column proportions on every list: older fixed and percentage column widths are reset; the record column takes one share (register 34 %, organisations 46 %, registration queue and dossier lists 28 %), the actions column shrinks to its buttons and the other columns share the rest by content, so no column carries a wide empty gap. Dossier control badges stack one per line. The table spans the full card. Phones keep stacked records. |

Differences kept on purpose, from later decisions: row actions are secondary (G5, audit D-4), not green as on the boards; the dossier campaign selector stays with the list (audit D-1), not in the header; status and duplicates share a column in the registration queue (board 0 §6 row standard). Not built: « Lignes par page » (fixed page sizes on the server).

Every console route listed in this revision now follows it. `/admin/inscriptions/nouvelle` already follows the form pattern (steps, numbered sections, action bar) and was left as is.
