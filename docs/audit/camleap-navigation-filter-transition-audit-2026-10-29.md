# CAMLEAP Navigation, Filtering and Transition-Flow Audit

**Audit date:** 29 October 2026  
**Scope:** `/admin/inscriptions`, `/admin/dossiers`, their detail/related routes, shared table/filter components, and the list APIs they call.

## 1. Executive assessment

Both pages have a solid base: they use the admin navigation shell, labels are generally translated, most list filters are reflected in the URL, server-side totals drive pagination, and the React Query keys include the filter values that determine each request. The list APIs also apply authorization and territory scope server-side. Search is debounced by 300 ms, and the normal filter controls use one request per changed query key. React Query keeps an older response attached to its old key, so the inspected code does not show an older response replacing the currently selected query's result.

The current experience still has correctness and context problems. Inscriptions tab links discard their query filters, while its page number survives a tab switch because it is local state. A direct Inscriptions URL can also show a status chip that disagrees with both the selected control and the organization-list request. On Dossiers, the detail-page return link drops list context, list refreshes retain old rows without a refreshing signal, and the follow-up subview keeps its filters only in component state.

The main problems are state and navigation behavior, with smaller feedback and translation issues. The highest-value work is:

1. Make Inscriptions view changes preserve only the filters meaningful to the destination, normalize the status when crossing views, and reset or scope pagination.
2. Put list pagination and record-return context in a reproducible URL contract, with a deliberate history policy.
3. Show scoped refreshing feedback whenever a table is serving placeholder data, including Dossiers and the Inscriptions organisations view.
4. Normalize invalid or conflicting URL values before they reach controls, chips, and requests.
5. Make Dossiers follow-up filters reproducible and provide a one-action clear state.

There are no P0 findings. Two confirmed P1 findings affect ordinary Inscriptions navigation and pagination. Correctness and state management should be addressed before visual polishing.

## 2. Audit coverage and verification limitations

### Inspected

- `react-web/src/app/admin/inscriptions/page.tsx` and `react-web/src/app/admin/dossiers/page.tsx`
- `react-web/src/components/admin/RegistrationsHubTabs.tsx`, `AdminPageHeader.tsx`, `AdminTablePanel.tsx`, `AdminActiveFilterChips.tsx`, `AdminFilterDisclosure.tsx`, `DataState.tsx`, `CampaignNonRespondentsTable.tsx`, `CoveragePanel.tsx`, and `CoveragePeriodSelector.tsx`
- `react-web/src/app/admin/_routes.ts`, `react-web/src/app/admin/layout.tsx`, `/admin/dossiers/[id]`, `/admin/etablissement-detail`, and the `/admin/cibles` handoff used by the Dossiers coverage/returns tab
- `react-web/src/lib/admin-url.ts`, `react-web/src/lib/inscriptions.ts`, `react-web/src/lib/api-client.ts`, `react-web/src/lib/user-directory.ts`, `src/questionnaires/admin-questionnaires.controller.ts`, `src/questionnaires/admin-list-filter.ts`, and the registration list controller/service paths
- English and French message keys for filters, empty/error feedback, and follow-up views
- Existing pure URL/registration tests and the Dossiers list-filter/controller tests

The working tree was already dirty before this audit, including both target pages, API/client files, translations, and unrelated backend files. Findings describe the current working-tree snapshot. No application code was edited by the audit; this report is the only file added.

### Runtime limits

`http://localhost:3000/admin/inscriptions` returned HTTP 200 from the local server. That confirms the route responds, not that an authenticated browser rendered the page or exercised its controls. The computer-use inventory reported that both the native pipe and browser access host were unavailable. I therefore did **not** browser-test filter combinations, browser history, detail-return behavior, viewport layouts, or the running request sequence. Those are explicitly marked source-traced or unverified below.

The existing `react-web/scripts/visual-check-admin-dossiers.mjs` was inspected but not run. It expects filter buttons inside table headers for the two registration tables; the current page source renders plain table headings and controls above the table, so those assertions appear stale for this snapshot. This is a source observation, not a test result.

### Checks run against the current working tree

| Check | Result |
|---|---|
| `react-web`: `npm.cmd run test -- admin-url` | Passed: 13 tests |
| `react-web`: `npm.cmd run test -- inscriptions` | Passed: 21 tests |
| Backend: targeted `admin-list-filter.spec.ts` and `admin-questionnaires.controller.spec.ts` | Passed: 2 suites, 46 tests; ts-jest emitted TS151002 configuration warnings |
| `react-web`: `npx.cmd tsc --noEmit` | Passed |
| Repository root: `npx.cmd tsc --noEmit` | Passed |
| Targeted ESLint for both pages and the filter components | Failed on one existing rule violation in clean, shared `AdminFilterDisclosure.tsx:24`: `react-hooks/set-state-in-effect` for `setOpen(true)` inside an effect. No other lint errors were reported in the selected files. |

These checks do not verify browser behavior or backend response latency. No new tests were added.

## 3. Highest-priority findings

1. **P1 — Inscriptions tabs drop active filter URLs.** `RegistrationsHubTabs` links to bare `?vue=queue`, `?vue=organisations`, or `?vue=coverage` URLs. Switching views discards the current search, status, territory, date, method, sort, and other query state, despite `inscriptionsHref()` being documented to preserve parameters when switching views.
2. **P1 — Inscriptions keeps one local page number across views.** Pagination lives in `page` state. The same page component remains mounted across its `vue` values. Switching views without a filter signature change can request page 3 of a shorter list and render an empty table even when the server reports matching records.
3. **P2 — Organization status can be visibly contradictory.** A direct or legacy organization URL with a queue-only `status` such as `PENDING_APPROVAL` leaves that value in the chip, displays `ALL` in the control, and requests `ACTIVE,REJECTED` from the API.
4. **P2 — Dossier detail return drops list context.** The row link retains only `includeArchived=true`; the detail page’s “back to dossiers” link is always `/admin/dossiers`. Browser Back may return to the source entry, but the visible return action does not restore filters, sort, view, or page.
5. **P2 — Dossiers and Inscriptions organisations can show unmarked old results while refreshing.** Both queries use `keepPreviousData`; the Dossiers list does not pass `questionnairesQuery.isFetching` to its table panel, and the organisations view has no equivalent of the queue’s updating indicator.
6. **P2 — Dossiers follow-up filters are local-only.** Search, region, department, type, outcome, and page are held in `CampaignNonRespondentsTable` state. Only the selected campaign is URL-backed. Refreshing or reopening the follow-up view resets these controls; there is no active-filter chip row or Clear All action.

## 4. Detailed findings register

| ID | Page/component | User-visible symptom | Reproduction steps | Root cause and evidence | Severity | Recommended fix |
|---|---|---|---|---|---|---|
| F-01 | Inscriptions tabs | Filters disappear when moving between Queue, Organisations, and Coverage. Users must reconstruct their search and territory context. | Open `/admin/inscriptions?vue=queue&region=Centre&type=ONG&status=PENDING_APPROVAL`; select Organisations. The target href is `/admin/inscriptions?vue=organisations`. | `RegistrationsHubTabs.tsx` defines static hrefs for each view. By contrast, `inscriptionsHref()` in `lib/inscriptions.ts` explicitly keeps unspecified parameters. The page uses that helper for filter edits, but not for these tab links. | **P1 — High**: loses active work context during an ordinary related-view transition. | Generate each tab href from the current query and retain only filters that have meaningful semantics in the destination. Keep queue-only context scoped for return to Queue or visibly clear it. Add a view-transition test. |
| F-02 | Inscriptions pagination and tabs | Switching views can land on an empty page or show an invalid range although the destination has records. | On Queue, go to page 3 without changing URL filters, then select Organisations. The component remains on `/admin/inscriptions`, `page` remains 3, and the Organisations request uses that page. | `page` is `useState(1)` in `inscriptions/page.tsx`; it is not tied to `vue`. `RegistrationsHubTabs` changes only the query string, and `InscriptionsContent` is not keyed by `vue`. Filter-state reconciliation resets the page only when its filter signature changes. | **P1 — High**: page-level pagination can contradict the destination result total and hide valid rows. | Reset to page 1 on view change or keep independent page state per view. Also clamp to the response’s last valid page. Put page in the URL if a page should be shareable/restorable. |
| F-03 | Inscriptions Organisations status | A status chip can say “Pending” while the control shows “All” and the API returns approved/rejected organisations. | Open `/admin/inscriptions?vue=organisations&status=PENDING_APPROVAL` (or a saved link with a queue-only status). Compare the chip, select, and table. | `initialStatus` accepts queue and organisation statuses. The organisation select maps anything except `ACTIVE`/`REJECTED` to `ALL`; `buildOrganisationsRequestParams()` maps the same values to `statuses: "ACTIVE,REJECTED"`; `activeQueueFilters` still emits the original status label. | **P2 — Medium**: on a direct or legacy link, the control, chip, URL, and rows describe different filters. | Parse status by view. Either use separate scoped status keys or canonicalize unsupported statuses on entering Organisations; derive chip and request parameters from the same normalized value. |
| F-04 | Dossiers detail and establishment detail | The visible “back” action returns to a default list or a different register page, rather than the filtered table the user came from. | Apply filters in Dossiers and open a row; use the detail header’s back link. For an organisation, open a row from `vue=organisations` and use the establishment detail back link. | Dossier row links keep only `includeArchived=true` in the detail URL, and both detail branches use `backHref="/admin/dossiers"`. The establishment detail page uses `backHref="/admin/etablissements"`, even when opened from Inscriptions Organisations. | **P2 — Medium**: repeated work and confusing distinction between browser Back and the page’s own Back action. | Pass a validated local `returnTo` URL (or use a stateful return mechanism with a safe fallback). Preserve only the source route’s relevant query and do not copy unrelated filters between workflows. |
| F-05 | Dossiers list; Inscriptions Organisations list | After changing filters, old rows and totals can remain visible with controls/chips already reflecting the new query; there is no clear “updating” state. | Load results, change a filter, and observe while the next request is pending. | Both list queries use `keepPreviousData`. Dossiers derives `tableState` from `isLoading` and row count but does not use `questionnairesQuery.isFetching` or set `AdminTablePanel.busy`. Inscriptions Queue does show `queueUpdating`, a status message, and `busy`; Organisations does not. The status panel’s `aria-busy` is tied to `queueUpdating`, even when the organisations query is the active one. | **P2 — Medium**: users can mistake stale rows/counts for results matching the newly selected filters. Browser reproduction unavailable. | Keep the stable rows, but mark only the table panel busy, announce that results are refreshing, and ensure counts/chips remain associated with the response being shown. Use the active view’s query state. |
| F-06 | Both list pages: URL, history, pagination | A filtered URL can be refreshed, but Back does not step through filter changes; page number is lost on refresh or sharing. | Change two filters, press browser Back; go to page 2, refresh or copy the URL into a new tab. | Filter setters use `router.replace`. Tabs use links and therefore do create entries, but filter changes do not. Inscriptions `page` and Dossiers `offset` are local state; neither is read from the URL. Dossiers resets offset when the filter signature changes. | **P2 — Medium**: the URL reproduces most filter state but not the complete table view, and history behavior differs between tabs and filters. | Define the policy: use `replace` for debounced search/canonicalization; use `push` only for deliberate navigable view/page changes. Serialize page or offset when page restoration is a user requirement. |
| F-07 | Dossiers Follow-up / `CampaignNonRespondentsTable` | Search, territory, type, outcome, and page disappear after refresh or after leaving and re-entering Follow-up; clearing all filters takes several manual actions. | Select a campaign, enter a search, choose Region/Department/Type/Outcome, then refresh or switch away and back. | These controls are local `useState` values; only `campaignId` is in the parent URL. `filtersActive` affects the summary sentence only; there are no chips or Clear All control. The component’s current filter is applied client-side to the fetched campaign data. | **P2 — Medium**: non-reproducible filtered working views and extra effort in the follow-up workflow. | Store meaningful follow-up filters under scoped query keys such as `followupSearch`, `followupRegion`, and `followupOutcome`; add a Clear All action; retain client-side filtering unless dataset size or freshness evidence warrants server changes. |
| F-08 | Dossiers and Inscriptions direct URLs | Invalid or conflicting query values can create a false active chip, an unmatched control value, an unfiltered request, or an API error. | Try a malformed `quality`, an unknown `period`, `assignment=other&assignedToMe=1`, or an unknown `registrationMethod` in a direct URL. | Dossiers passes only whitelisted quality values, but constructs a chip from raw `qualityFilter`; `period` is passed raw and the controller rejects unknown periods; the controller rejects conflicting assignment parameters. Inscriptions accepts raw `registrationMethod` from the URL and passes it into the request. Several other fields are normalized for rendering but left in the URL. | **P2 — Medium**: stale links can show controls/chips that do not reflect an applied query, or turn a filter typo into a request error. Exact server response for unknown registration method was not runtime-verified. | Normalize each filter once at the URL boundary. Use the same normalized value for control, chip, query key, and request; remove or explicitly correct malformed values without discarding unrelated parameters. |
| F-09 | Dossiers response-rate tile | With “All campaigns” selected, the dossier list covers all campaigns while the response-rate tile still reads from the first active campaign; the tile has no visible campaign qualifier. | Select the empty “All campaigns” option on Submissions and compare the tile with the list scope. | The list query omits `campaignId` when none is selected; `effectiveCampaignId` falls back to `activeCampaigns[0]` for the returns query. This split is explicitly noted in code, but the tile markup displays only the response-rate label/value. | **P2 — Medium (design opportunity)**: readers may attribute a single-campaign rate to the all-campaign list. Code scope is confirmed; visual interpretation was not browser-tested. | Label the metric with its campaign/period, or hide it until a specific campaign is selected. Keep the server calculations unchanged absent a business decision. |
| F-10 | Follow-up pagination translation | In English, the result range and page status still contain French wording. | Switch the console to English and open Dossiers Follow-up with more than 15 filtered records. | `CampaignNonRespondentsTable.tsx` hardcodes `sur` and `Page … sur …`; adjacent filter and button labels use translations. | **P3 — Low**: small but visible translation inconsistency. | Add `adminCiblesPage` message keys in both locales and use them for the range and page sentence. |
| F-11 | Result announcements and table accessibility | Dossiers result changes have no table-level `aria-busy` or live result-count announcement. Inscriptions Queue announces refresh, but the Organisations refresh does not. | Change filters using only a screen reader; observe whether refresh and new result count are announced. | Dossiers result summary is a plain `<span>` and its `AdminTablePanel` does not receive `busy`. `DataState` uses status/alert roles for empty/error/loading, but not for a successful count change. | **P3 — Low**: users of assistive technology may not know when the table has refreshed or how many rows now match. Not browser-tested. | Add scoped `aria-busy` and a polite live result summary that updates after the response is committed. Preserve focus in the active filter. |
| F-12 | Shared `AdminFilterDisclosure` | Activating a filter can trigger a synchronous state update from an effect; this is also a lint failure. | Run targeted ESLint; no runtime issue is established. | `AdminFilterDisclosure.tsx:24` calls `setOpen(true)` in an effect when `active` changes. The same component is consumed by Inscriptions, Dossiers, and the establishments list. | **P3 — Low**: maintainability/performance concern; no user-visible defect proven. | Derive initial openness from active state and keep user-controlled disclosure state without a synchronous effect update. Regression-check all three consumers. |

### What is already working

- `_routes.ts` groups `/admin/inscriptions` and establishment detail under the registrations hub, and `/admin/dossiers` and quality pages under the declaration hub. Active hub selection is prefix-based, so detail routes remain in the correct sidebar group.
- The company row’s “Declarations” action links to `/admin/dossiers?vue=submissions&companyId=…`, which carries only the meaningful company context. The dossier list accepts `companyId` and presents it as an active filter.
- Opening an Inscriptions Queue row opens a review dialog rather than leaving the list. Closing the dialog retains the table view; status mutations invalidate the registration queries.
- Dossiers scopes its list filters per view, keeps each view’s query parameters in the URL, and clears legacy generic parameters when a user changes one scoped filter. Region/Department validation and campaign/quarter incompatibility are handled in page code.
- Both main list APIs use server-side filtering and report the filtered total. Dossier `quality` and `assignment` filters are sent to the backend and applied in `buildAdminListWhere`; they are not only client-side filters.
- Empty/error/loading states are distinct in `DataState`; errors render retry controls. `apiFetch` clears invalid auth state on 401, and the admin guard redirects an unauthenticated user to login.
- The changed `FilterTableOptions` translation props are supplied at its other current consumers (`equipe`, `sectors`, `journal-audit`, `centre-qualite`); frontend type-check passes.

### Source anchors for the findings

These line references point to the audited working-tree snapshot; lines may move as the existing dirty changes evolve.

- **F-01:** `RegistrationsHubTabs.tsx:18–24` (static destinations); `inscriptions/page.tsx:374–376` (parameter-preserving filter updates).
- **F-02:** `inscriptions/page.tsx:333` (shared local page state), `418–438` (filter signature/reset), `534–542` (organisations query and paging); `RegistrationsHubTabs.tsx:18–24`.
- **F-03:** `inscriptions/page.tsx:239` (accepted initial status), `137–153` (organisation request normalization), `776–788` (active status chip), `929` (organisation control).
- **F-04:** `dossiers/page.tsx:1303–1307` (detail links); `dossiers/[id]/page.tsx:594,633` (static return links); `inscriptions/page.tsx:1000` and `etablissement-detail/page.tsx:222,273` (organisation detail navigation/return).
- **F-05/F-11:** `dossiers/page.tsx:488–515` (placeholder rows), `827–829` (table state), `1123` (table panel); `inscriptions/page.tsx:518,538` (placeholder queries), `723` (queue refresh state), `852` (status-panel busy flag), `1077,1107` (queue refresh message/table busy).
- **F-06:** `inscriptions/page.tsx:333,374–376`; `dossiers/page.tsx:320,633,694–697` (local offset and replace/paging behavior).
- **F-07/F-10:** `CampaignNonRespondentsTable.tsx:76–81,108–134,431,443` (local filter/page state, filtering, and pagination text).
- **F-08:** `dossiers/page.tsx:296,319,425–499`; `admin-questionnaires.controller.ts:134–149`; `inscriptions/page.tsx:303,508`.
- **F-09:** `dossiers/page.tsx:423–437,1061–1063` (list campaign scope, KPI query, and unlabeled metric).
- **F-12:** `AdminFilterDisclosure.tsx:21–25`.

### Row and selection state

| Page | State and lifetime | URL / transition behavior | Assessment |
|---|---|---|---|
| Inscriptions Queue | The review target, decision, comment, and verification checks are local to the open review workflow (`inscriptions/page.tsx:334–342`). Organisations keeps the archive target in local dialog state. There is no persistent multi-row selection in these views. | No selection URL state; opening a review dialog stays on the list. Closing it retains the list. Navigation does not serialize an in-progress dialog. | Appropriate for transient sensitive actions. Treat the dialog as an interruption rather than a restorable list state; warn or confirm before discarding unsaved review input if navigation can occur while open. |
| Dossiers Submissions | `selectedIds` is a local `Set<string>` (`dossiers/page.tsx:347`). | Cleared when filters/search or page change, on bulk-mutation success, and when the keyed view component remounts (`dossiers/page.tsx:227,565–622,696–705`). It is not restored by refresh or copied URLs. | Good protection against applying bulk actions to a changed result set. Document that selection is page-local/ephemeral; keep it out of the URL. |
| Dossiers Completed / Follow-up | The view-keyed component owns modal/row action state; bulk selection is shown only for editable Submissions. | Switching `vue` changes the `DossiersContent` key and remounts the component; main filters and pagination clear bulk selection. | Selection is scoped to the eligible table and does not leak between views. Browser confirmation is still needed for focus return after dialogs. |

## 5. Inscriptions transition-flow map

```mermaid
flowchart TD
  A[Sidebar or deep link] --> B[/admin/inscriptions?vue=queue/]
  B --> C[Parse URL + initialize filter state]
  C --> D[GET /auth/company-registrations]
  D --> E{Initial result}
  E -->|pending| F[Loading row]
  E -->|success| G[Rows + total + status counts]
  E -->|empty/error| H[Empty or retry state]
  G --> I[Select filter; search waits 300 ms]
  I --> J[Set local state + router.replace]
  J --> K[React Query request; Queue retains prior rows and announces updating]
  K --> G
  G --> L[Queue Open]
  L --> M[Review dialog]
  M -->|close| G
  M -->|decision succeeds| N[Invalidate registration query]
  N --> G
  G --> O[Organisations tab]
  O --> P[Static tab href drops query filters]
  P --> Q[/admin/inscriptions?vue=organisations/]
  Q --> R[Organisation list request; local page may carry across]
  R --> S[Open establishment]
  S --> T[/admin/etablissement-detail?id=…]
  T --> U[Back link to /admin/etablissements]
  R --> V[Declarations action]
  V --> W[/admin/dossiers?vue=submissions&companyId=…/]
  G --> X[Coverage tab]
  X --> Y[CoveragePanel; year/semester/quarter URL state]
```

**Observed from source:** Filter edits update the URL with `replace`; Queue filter changes reset `page` to 1. Search is debounced. Queue has an updating message and disabled row/pagination actions. Organisations uses `keepPreviousData` but has no corresponding busy indicator. The tabs use static links and do not call the parameter-preserving helper. The coverage year and period are URL-backed; its Territory/Entity Type tab and expanded region rows are local state. The page itself does not expose a single-record route for Queue review.

**Target flow:** Preserve shared destination-relevant filters when changing Queue/Organisations, retain queue-only values in scoped Queue state rather than showing them as active in Organisations, normalize status for each view, and reset page to 1 on a view change. Search should replace the current URL after its debounce; explicit view and page changes should have a documented Back/Forward policy. During a request, retain old rows with `aria-busy` plus a localized “updating” message; commit rows, total, chips, and page range together. Establishment and dossier detail links should carry a safe return URL.

## 6. Dossiers transition-flow map

```mermaid
flowchart TD
  A[Sidebar, dashboard, or direct link] --> B[/admin/dossiers?vue=submissions/]
  B --> C[Parse scoped filters; legacy generic filters seed active view]
  C --> D[GET /admin/questionnaires with server filters + offset]
  D --> E{Initial result}
  E -->|pending| F[Loading row]
  E -->|success| G[Rows + filtered total]
  E -->|empty/error| H[Empty or retry state]
  G --> I[Change status/filter; search waits 300 ms]
  I --> J[Scoped URL via router.replace; offset resets to 0]
  J --> K[keepPreviousData: old table remains, no table busy signal]
  K --> G
  G --> L[Open record]
  L --> M[/admin/dossiers/{id}; list query mostly dropped]
  M --> N[Back link to /admin/dossiers]
  G --> O[Completed tab]
  O --> P[Link keeps per-view scoped filters; view component remount resets local offset]
  G --> Q[Follow-up tab]
  Q --> R[Campaign selected from shared campaignId]
  R --> S[GET non-respondents for campaign]
  S --> T[Client-side search/region/department/type/outcome/page]
  T --> U[Refresh or re-enter: local filters reset]
  G --> V[Coverage/Returns tab]
  V --> W[/admin/cibles?vue=retours&campagne=…/]
```

**Observed from source:** Main Dossiers filters are URL-backed and scoped to `submissions` or `completed`; campaign is shared. Search waits 300 ms. Filter changes reset offset; page changes update local state only. `DossiersContent` is keyed by view, which clears selection and local modal state when switching views. The list query uses `keepPreviousData` but does not set a busy state. Detail-page back links are static. The Coverage tab hands off to `/admin/cibles` and translates the campaign key to that route’s `campagne` parameter. Follow-up filters are client-side and local; the Region handler correctly clears a department that is not valid in the new region.

**Target flow:** Keep the existing per-view URL model for Submissions/Completed. Add page/offset URL state if users should share or restore pages. On detail entry, store the current list URL and restore it from the detail header. In Follow-up, put its filters in namespaced URL state, preserve `campaignId`, offer Clear All, and use campaign-scoped loading/error feedback. Keep the Coverage/Returns route handoff explicit and preserve only the selected campaign.

## 7. Filtering and URL-state matrices

### Inscriptions

`vue` selects `queue`, `organisations`, or `coverage`. Most list filters share generic URL keys. The queue’s default status is absent from the URL and is interpreted by the backend as its default queue; the Organisations default is `ACTIVE,REJECTED`.

| Filter | State source | URL key | Request effect | Pagination reset | Clear behavior | Refresh/deep-link support | Findings |
|---|---|---|---|---|---|---|---|
| View | `parseRegistrationVue(searchParams)` | `vue` (`file`/`couverture` legacy aliases) | Enables Queue, Organisations, or Coverage query/view | No explicit view reset; filters may reset page via signature, but page-only state can carry | Tab link switches view | Yes; tab links currently drop all other query parameters | F-01, F-02 |
| Search | `organisationInput` / debounced `organisation` | `search`, legacy `organisation` | `search` to registration list endpoint; 300 ms debounce | Yes | Chip clears both aliases; Clear All clears both | Yes | Input can temporarily differ from applied value during debounce |
| Status | `statusFilter` | `status` | Queue sends status/overdue; Organisations sends `statuses` | Yes on filter edit | Individual chip and Clear All | Yes, but queue-only status is not normalized in Organisations | F-03 |
| Entity type | Local state synced from URL | `type` | `entityType` | Yes | Chip / Clear All | Yes; whitelist used | Shared by Queue and Organisations |
| Region | Local state synced from URL | `region` | `region` | Yes | Chip / Clear All | Yes; async territory validation can canonicalize invalid values | Changing to incompatible region clears Department; clearing Region retains Department |
| Department | Local state synced from URL | `department` | `department` | Yes | Chip / Clear All | Yes; validated against Region | Region-dependent |
| Registration method | Local state from raw URL value | `registrationMethod` | `registrationMethod` | Yes | Chip / Clear All | Yes, but unknown values are not normalized first | F-08 |
| Date range | Local range + custom date state | `dateRange`, `from`, `to` | Date bounds | Yes | Chip and Clear All remove both bounds | Yes for valid values; custom applies once both dates exist | Custom control has localized labels |
| Assignment to me | Local boolean | `assignedToMe=1` | `assignedToMe` (Queue only) | Yes | Chip / Clear All | Yes; hidden/unused on Organisations | Queue-specific |
| Duplicate status | Local enum `with/without` | `duplicates` | Server-side duplicate filter (Queue only) | Yes | Chip / Clear All | Yes; invalid values fall back to blank | Queue-specific |
| Registered by | `createdBy` from URL/context | `createdBy` | `createdBy` | Yes when cleared via filter setter | Chip and Clear All; separate contextual notice also shown | Yes; `/admin/equipe` link seeds it | Queue-specific; not copied by the tab component |
| Archived organisations | Boolean from URL | `includeArchived=true` | `includeArchived` (Organisations only) | Yes | Checkbox, chip, Clear All | Yes | Default hides archived rows |
| Sort | Local enum; default newest | `sort=oldest`; newest omitted | `sortOrder` | Yes | Chip / Clear All | Yes | Applies in Queue and Organisations |
| Pagination | `page`, page size 8 | None | `page`, `pageSize` | Filters reset to 1; view changes do not reliably reset | Previous/Next | No; refresh/deep link starts page 1 | F-02, F-06 |
| Row/dialog target | Local `reviewing`, `archiveTarget`, and review fields | None | Opens the selected row’s review or archive dialog; no new list request | Not applicable | Close/cancel clears target; success updates/invalidate queries | No; transient action state is intentionally not restorable | Unsaved form state can be lost if the user leaves |
| Coverage period | Parent URL state | `annee`, `semestre`, `trimestre` | Coverage endpoint: annual/semester/quarter | New query by period | Period selector | Yes for valid values | Coverage panel loads a new period query |
| Coverage table mode/expanded rows | Local state | None | No new request | N/A | Tab/row toggles | No | Territory vs Entity Type tab and expanded rows are presentation state |

### Dossiers

`filterParam()` prefers view-scoped keys such as `submissionsStatus` and falls back to generic keys only for the view named by `vue`. `setUrlFilter()` writes scoped keys and removes the corresponding generic key. `campaignId` remains shared.

| Filter | State source | URL key | Request effect | Pagination reset | Clear behavior | Refresh/deep-link support | Findings |
|---|---|---|---|---|---|---|---|
| View | `parseDossierVue(searchParams)` | `vue` | Enables Submissions, Completed, Follow-up; Coverage redirects | View key remount resets main-list offset | Header link changes view | Yes; legacy aliases canonicalized | Coverage is `/admin/cibles?vue=retours`, not a Dossiers table |
| Status | Parsed view filter | `submissionsStatus` / `completedStatus`; legacy `status` | Queue default is pending + correction; Completed defaults approved/rejected/superseded | Yes | ViewSwitch + Clear All | Yes; values are validated | Status counts are separately fetched and scope-labeled |
| Search | `searchInput` / debounced `search` | `<view>Search`; legacy `search` or `q` | Server-side multi-column search | Yes | Chip / Clear All | Yes; 300 ms debounce | Current query is URL-backed after debounce |
| Form/entity type | Fixed form-type whitelist | `<view>FormType`; legacy `formType` | `formType` | Yes | Chip / Clear All | Yes; invalid values become blank but remain in URL | |
| Region / Department | URL-backed; territory tree validation | `<view>Region`, `<view>Department` | Server filters | Yes | Individual chip / Clear All | Yes | Changing Region clears an incompatible Department; clearing Region keeps a valid Department |
| Period | Raw URL string | `<view>Period` | Server period filter | Yes | Chip / Clear All | Valid values supported; unknown value reaches controller and returns 400 | F-08 |
| Campaign | URL string | Shared `campaignId` | Main list campaign filter; no selection means all campaigns | Choosing a campaign clears quarter | Header select, chip, Clear All | Yes | Response-rate KPI uses `effectiveCampaignId`, which falls back to first active campaign when the list is all campaigns (F-09) |
| Quarter | Validated `YYYY-Tn` | `<view>QuarterCode`; legacy `quarterCode` | Server quarter filter when no campaign selected | Yes | Chip / Clear All | Yes for valid value | Choosing a campaign removes quarter |
| Late | Explicit-true flag | `<view>Late` | `late=1` | Yes | Chip / Clear All | Yes | |
| Overdue | Explicit-true flag | `<view>Overdue` | `overdue=1`; omitted for Completed | Yes | Chip / Clear All | Yes | Can combine with a status; backend ANDs predicates, so incompatible status/overdue combinations may return no rows |
| Quality | Raw URL value; only three values sent | `<view>Quality` | `clean`, `warnings`, or `blocking` sent server-side | Yes | Chip / Clear All | Valid values supported; invalid value may show raw chip but is omitted from request | F-08 |
| Assignment | Parsed enum plus legacy `assignedToMe` | `<view>Assignment` and `<view>AssignedToMe` | `assignment` or legacy flag | Yes | Chip / Clear All | Yes; simultaneous conflicting values are rejected by API | F-08 |
| Company | URL filter | `<view>CompanyId`; legacy `companyId` | `companyId` | Yes | Named/short-ID chip / Clear All | Yes; used by Inscriptions “Declarations” link | |
| Include archived | Boolean, default true on Completed | `completedIncludeArchived`; legacy `includeArchived` | `includeArchived` | Yes | Checkbox, chip when hidden, Clear All restores default | Yes | |
| Sort | Parsed oldest or default newest | `<view>Sort`; legacy `sort=oldest` | Server `sort` | Yes | Chip / Clear All | Yes | |
| Pagination | `offset`, page size 10 | None | `limit`, `offset`; server returns total | Filter changes reset to 0 | Previous/Next | No page restoration from URL | F-06 |
| Selected rows | `selectedIds: Set<string>` local to `DossiersContent` | None | Drives editable-row checkboxes and bulk action eligibility | Cleared on filter/search and page changes, mutation success, and view remount | Row checkbox / selection controls; bulk success clears | No; selection is deliberately ephemeral | Selection cannot leak across query/page/view transitions |
| Follow-up search | Local `searchQuery` | None | Client-side filter on campaign response | Yes | No Clear All | No | F-07 |
| Follow-up Region / Department | Local state; Department options narrow by Region | None | Client-side filter | Yes; invalid Department cleared on Region change | No Clear All | No | Region/Department dependency is handled |
| Follow-up type / outcome | Local state; outcome only for contact-capable roles | None | Client-side filter | Yes | No Clear All | No | F-07 |
| Follow-up pagination | Local page, size 15 | None | Slice of filtered campaign response | Filters reset to 1 | Previous/Next | No | Labels have French hardcoded in English locale (F-10) |
| Coverage/Returns | Route handoff | `/admin/cibles?vue=retours&campagne=…` | Campaign returns view on `/admin/cibles` | N/A | Destination page owns its controls | Campaign handoff is URL-backed | The Dossiers coverage tab is a separate workflow |

## 8. Proposed target transition model

| Principle | Assessment | Evidence and target |
|---|---|---|
| 1. Predictable URL state | **Partly satisfied** | Main list filters and tabs are usually URL-backed; Inscriptions tabs drop them, pagination is not represented, and Follow-up filters are local. Include state required to reproduce the filtered page. |
| 2. Selective history updates | **Partly satisfied** | Filter controls mostly use `replace`, while view links push. Adopt `replace` for debounced search and canonicalization; use `push` for intentional view/page steps if Back should revisit them. |
| 3. Stable table during refresh | **Partly satisfied** | `keepPreviousData` retains rows. Add busy styling/message so retained rows cannot be mistaken for the new result. |
| 4. Stale-response protection | **Partly satisfied** | Distinct query keys prevent an older response becoming the current key’s result. Requests do not receive React Query’s `AbortSignal`, so superseded fetches are not cancelled. Measure before optimizing. |
| 5. Consistent filter clearing | **Mostly satisfied** | Main pages expose individual chips and Clear All. Follow-up lacks them; Inscriptions currently clears view state through static tab links and shares status semantics inconsistently. |
| 6. Pagination correctness | **Partly satisfied** | Main filters reset page/offset. Inscriptions tab changes can preserve an invalid page; page/offset are not shareable or restorable. |
| 7. Context preservation | **Partly satisfied** | Inscriptions review dialog preserves list context; company-to-Dossiers link passes company ID. Record detail back links do not restore source query state. |
| 8. Scoped feedback | **Partly satisfied** | Queue has local busy feedback, but Dossiers and Inscriptions Organisations do not. Keep the shell interactive and mark only the affected panel busy. |
| 9. Useful empty/error states | **Mostly satisfied** | `DataState` distinguishes loading, empty, forbidden, missing, and error, and errors offer retry. Ensure a refresh error labels retained rows as stale. |
| 10. Shared design, distinct workflows | **Mostly satisfied** | Shared disclosure, chips, data state, and panel frame support different controls. Keep Follow-up and coverage rules distinct while standardizing state contracts. |
| 11. Accessible transitions | **Partly satisfied** | Labels, status roles, filter-chip labels, and details/summary are present. Add result-count live updates and active-query `aria-busy`; keyboard/focus behavior still needs browser verification. |
| 12. Consistent translations | **Partly satisfied** | Most fields use next-intl. Follow-up range and page strings are French literals in both locales. Audit hardcoded visible text after adding route-state controls. |

### Applying a filter — target

1. The control changes immediately.
2. A normalized filter model updates the control, chip, request key, and URL from one value.
3. Search waits 300 ms; a select change starts one request immediately.
4. The URL uses the documented history rule and resets pagination.
5. The table retains prior rows with a localized, accessible busy state.
6. The newest query response updates rows, total, range, and chips together.
7. A failure leaves controls and URL intact, marks retained rows as stale, and offers retry.

### Moving between Inscriptions and Dossiers — target

1. Sidebar navigation opens the destination’s normal default view; unrelated filters are not carried.
2. The Inscriptions Organisations “Declarations” action passes only `companyId` and the intended Dossiers view.
3. Inscriptions Queue/Organisations tabs preserve shared filters and keep view-specific filters scoped.
4. Detail routes preserve a safe return URL. Browser Back and the visible return action both return to the filtered source view.
5. No record status or data changes occur from a navigation control.

### Clearing filters — target

1. A chip removes exactly one filter and preserves the others.
2. Region/Department changes clear only an invalid dependent department.
3. Clear All resets every filter represented in that view, its dependent values, and pagination.
4. Hidden filters from another view remain scoped and are not silently shown as active or accidentally erased.
5. The result count and table refresh status correspond to the new query.

## 9. Prioritized implementation roadmap

| Phase/change | Problem solved | Likely files | Ownership and regression risk | Required tests | Acceptance criterion |
|---|---|---|---|---|---|
| **Phase 1 — Correctness:** define Inscriptions tab state contract; preserve common filters, scope queue-only filters, normalize status, reset page on view change | F-01 through F-03 | `RegistrationsHubTabs.tsx`, `inscriptions/page.tsx`, `lib/inscriptions.ts` | Page-specific behavior plus tab helper. Risk: legacy links and coverage deep links. | Unit tests for URL merge/normalization; component test for tab transition from filtered Queue and Organisations. | Moving Queue → Organisations leaves only valid shared state; no pending chip appears on an all-organisations query; destination always starts on a valid page. |
| **Phase 1 — Correctness:** normalize all URL filter values and resolve incompatible combinations | F-08 and overdue/status edge case | `admin-url.ts`, both page files, `inscriptions.ts`, optionally API-client parameter types | Shared parser changes may affect other admin routes; page-specific whitelist should remain local where vocabularies differ. | Valid/invalid direct URL matrix; controller tests for assignment conflict and period validation. | Invalid values are removed or mapped to a documented default before controls/chips/requests render; no false active chip or avoidable 400. |
| **Phase 1 — Correctness:** serialize page/offset where required and reset/clamp on filter/view changes | F-02 and F-06 | both page files, `admin-url.ts`, URL tests | User-visible history contract; risk of old saved links. | Page 1/2 deep links, refresh, filter reset, Back/Forward, cross-tab page tests. | A copied URL restores the same page; filter/view change lands on a valid first page; total/range never shows `start > total`. |
| **Phase 1 — Correctness:** refresh feedback for every list query | F-05 | `dossiers/page.tsx`, `inscriptions/page.tsx`, `AdminTablePanel.tsx` | Shared panel supports optional `busy`; other consumers must remain unaffected. | Render tests with previous data plus `isFetching`; error after filter change. | During refetch only the relevant panel has `aria-busy=true` and localized refresh feedback; rows/counts are not presented as current without a cue. |
| **Phase 2 — Flow consistency:** source-aware detail return URLs | F-04 | `dossiers/page.tsx`, `dossiers/[id]/page.tsx`, `inscriptions/page.tsx`, `etablissement-detail/page.tsx`, `AdminPageHeader.tsx` only if needed | Keep destination allowlisted to local admin routes. Risk: query propagation and archived detail links. | Navigate from filtered list to detail, use visible Back and browser Back, test new-tab direct detail fallback. | Visible Back restores source route, view, filters, sort, and page; direct detail has a safe default return. |
| **Phase 2 — Flow consistency:** URL-back Follow-up filters and Clear All | F-07 | `dossiers/page.tsx`, `CampaignNonRespondentsTable.tsx` | Shared component currently has one consumer; keep filters client-side and campaign authorization as-is. | URL initialize, refresh, clear-one, clear-all, Region→Department, outcome visibility by role. | Follow-up URL reproduces campaign and all active filters; Clear All restores every control and page 1. |
| **Phase 2 — Flow consistency:** campaign scope label for KPI | F-09 | `dossiers/page.tsx`, `messages/en.json`, `messages/fr.json` | Product copy only; do not change response-rate endpoint scope without business agreement. | Render all-campaign and selected-campaign states in both locales. | The visible KPI identifies the campaign/period it measures, or is absent in All campaigns mode. |
| **Phase 3 — UX polish:** complete translations and live result announcements | F-10/F-11 | `CampaignNonRespondentsTable.tsx`, locale JSON, `dossiers/page.tsx`, shared table panel | Low-risk additive translations and ARIA props. | English/French rendering, accessibility tree check, keyboard-only filter and dialog flow. | No French literals remain in English follow-up pagination; screen readers receive refresh and updated result count. |
| **Phase 3 — UX polish:** remove `AdminFilterDisclosure` effect-driven state update | F-12 | `AdminFilterDisclosure.tsx` | Shared fix affects Inscriptions, Dossiers, and Establishments. | Disclosure starts open for active deep links, can be closed, and remains keyboard accessible on all consumers. | Lint passes and active-filter disclosure behavior is unchanged. |
| **Phase 4 — Performance:** measure superseded request volume/latency; add cancellation only if material | Superseded requests are not aborted, but no latency problem was measured | `api-client.ts`, `user-directory.ts`, list query functions | Shared API fetch change can affect many clients; avoid cache or concurrency changes without evidence. | Delayed A/B response test; verify current query result and auth/error behavior. | Network trace shows fewer obsolete requests with unchanged latest-result correctness and authorization semantics. |

## 10. Regression test plan

### Automated tests first

1. **Inscriptions URL contract:** preserve common filters across tabs; keep Queue-only values scoped; map Queue status into valid Organisations state; preserve unrelated query keys; canonicalize invalid values.
2. **Inscriptions pagination:** page 2 on Queue followed by Organisations; filtered deep link with page; result total smaller than page; assert page range never starts after total.
3. **Inscriptions filter combinations:** search + status + type + region + department + method + date range; clear one filter; Clear All; Region change retaining/clearing Department; page reset.
4. **Dossiers URL contract:** view-scoped parameters, legacy generic fallback only for the active view, campaign shared across views, quarter cleared when campaign selected, refresh and unknown values.
5. **Dossiers query state:** quality, assignment, late, overdue, archived, company ID, sort, status, campaign, quarter, and pagination all appear in query key/API params and return filtered total.
6. **Assignment invalid combinations:** `assignment=other&assignedToMe=1` does not render a misleading chip; either canonicalize client-side or assert the intentional API error handling.
7. **Stale-response ordering:** delay filter request A, issue request B, resolve B first and A last; B remains the visible query. Assert busy state and result count update together.
8. **Loading/error/empty:** first load, filter refetch with placeholder data, successful zero rows, 4xx filter error, 5xx network failure, retry, and 401 session expiry.
9. **Dossier detail return:** filtered list → detail → visible Back; also browser Back, archived record, and direct detail without a return URL.
10. **Follow-up filters:** campaign, search, Region→Department cascade, type, outcome role gating, page reset, deep-link refresh, clear-one, Clear All, empty result.
11. **Translations/accessibility:** English/French filter labels, chips, loading, errors, empty states, follow-up counts, `aria-busy`, live result count, keyboard focus and dialog return.
12. **Shared consumers:** test `AdminFilterDisclosure` on Inscriptions, Dossiers, and Establishments; `FilterTableHead` consumers in `equipe`, `sectors`, `journal-audit`, and `centre-qualite` after shared prop changes.

### Browser-level tests after the state tests

- Open both pages from the sidebar and confirm active navigation/title.
- Use two filters, clear one, clear all, paginate, change sort, refresh, and use Back/Forward.
- Open a dossier and establishment from their tables and return through both browser Back and the visible control.
- Switch Queue/Organisations after setting filters and while on a later page.
- Change filters while requests are pending; verify no misleading result/count combination.
- Test direct URLs with several valid and invalid parameters.
- Test Region→Department in both main list pages and Follow-up.
- Verify empty results, failed requests, expired session, English/French, keyboard focus, and mobile/browser zoom.

### Results actually executed

Only the checks in Section 2 were executed. No browser scenario, request timing, visual comparison, or live interaction test is claimed. The tests listed above are proposals.

## 11. Final recommendation

Implement these first, in order:

1. Fix the Inscriptions view transition contract: retain valid shared filters, keep view-specific filters scoped, normalize status, and reset/clamp pagination on each tab switch.
2. Make pagination and record return state reproducible through the URL, with explicit `push`/`replace` rules and safe detail fallbacks.
3. Add accurate, scoped busy feedback to the Dossiers and Inscriptions Organisations tables while preserving their current rows during refresh.

Then normalize invalid query values, address Follow-up state and Clear All, and finish translations/accessibility polish. The two pages are **not ready for implementation-level polishing yet**: the Inscriptions filter/page transition defects and missing Dossiers return/refresh state need correction first.
