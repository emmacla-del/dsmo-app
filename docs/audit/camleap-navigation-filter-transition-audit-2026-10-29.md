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

## 12. Phase 2 implementation update

**Implementation date:** 29 October 2026
**Scope:** F-06 URL/history state, F-07 Follow-up filters, and F-08 URL normalization. Phase 3 work was not started.

### URL normalization rules

- Inscriptions uses a view-aware normalization boundary. Unsupported status, entity type, registration method, sort, date range, coverage period, and page values are removed or canonicalized. Queue-only filters are removed in Organisations; organization status is normalized before it feeds controls, chips, query keys, or requests. Territory values are validated against the shared territory tree; list requests and exports wait for validation when a territory filter is present.
- Dossiers uses view-scoped filters. A valid scoped value takes precedence over its legacy generic key; generic values seed only the view named by `vue`. Unsupported quality, period, status, sort, form type, flags, assignment, and page values are removed. A campaign takes precedence over a quarter because the campaign already identifies its period. For the legacy assignment conflict, a valid `assignment` wins over `assignedToMe=1`; if `assignment` is invalid, a valid legacy true flag canonicalizes to `assignment=me`; otherwise both are cleared. Final-status links from Submissions redirect to Completed before the list query runs.
- Follow-up state uses `followupSearch`, `followupRegion`, `followupDepartment`, `followupType`, `followupOutcome`, and `followupPage`. Regions and departments validate against the full territory tree; types validate against supported entity types; outcomes are removed when unavailable to the current role. A Follow-up campaign ID is validated against the campaign list available to that role before its non-respondents request runs. Clear All removes only these six Follow-up parameters.
- Canonicalization uses `replace`, preserves unrelated valid parameters, and compares the normalized URL before navigating, so a canonical URL does not create a rewrite loop. Invalid region/department filters gate list requests until validation completes.

### History and pagination policy

- Debounced search and normalization/clamping use `replace`.
- Filter selections, Clear All, intentional view changes, and page changes use `push`; unchanged destinations are not pushed.
- Page 1 is omitted from URLs. Inscriptions stores `page`; Dossiers stores `submissionsPage` or `completedPage`; Follow-up stores `followupPage`. Filter changes clear the active view's page. Page changes are URL-backed, and response totals clamp out-of-range pages.
- Browser Back/Forward restores Follow-up controls and results from the updated URL. Dossiers and Inscriptions derive their view and page from URL state, preserving the Phase 1 return-context behavior.

### Verification

- Passed focused frontend tests: `admin-url` (19), `inscriptions` (26), `follow-up-url` (4), `CampaignNonRespondentsTable` (3), `RegistrationsHubTabs` (1), `admin-return` (5), `AdminTablePanel` (1), and `admin-query-state` (1): **60 tests passed**.
- Passed `react-web`: `npx.cmd tsc --noEmit`.
- Passed focused ESLint for the changed page, helper, and Follow-up component/test files.
- A broader lint check including two unchanged shared/detail files reports the existing five `no-explicit-any` errors in `dossiers/[id]/page.tsx` and the existing `react-hooks/set-state-in-effect` error in `AdminFilterDisclosure.tsx:24`. No new errors were reported in the Phase 2 implementation files.
- `git diff --check` passed. No backend change was needed. Browser verification could not run: the computer-use native pipe was unavailable after the documented retry and reset/retry sequence.

No unrelated working-tree changes were reverted or discarded, and no commit was created.

## 13. Phase 3 implementation update

**Implementation date:** 29 October 2026
**Scope:** F-09 response-rate scope, F-10 Follow-up pagination translations, F-11 accessible refresh/result feedback, and F-12 shared filter-disclosure state. No Phase 4 work was started.

### Changes

- The Dossiers response-rate KPI is hidden when the list is scoped to All campaigns. With a selected campaign, it keeps the existing campaign calculation and displays the selected campaign's period/name from the campaign selector. No aggregate or backend calculation was added.
- Follow-up range, page, Previous, and Next labels now use English/French messages. The range message supports plural forms; the existing no-match empty state remains in place without pagination text.
- A shared result-count pattern exposes one polite screen-reader announcement while hiding the duplicate visible copy from the accessibility tree. Dossiers and Inscriptions Organisations announce a range only after the replacement result is committed; during placeholder refreshes, `AdminTablePanel` retains its busy message and prior rows.
- `AdminFilterDisclosure` no longer synchronizes state from an effect. It opens initially or when active filters transition from inactive to active, while a user's manual close remains in effect across unrelated rerenders.

### Verification

- Passed the focused Phase 1/2 regression set plus Phase 3 component checks: **66 tests passed**. This includes URL normalization, Inscriptions tabs, Dossiers returns and pagination, Follow-up URL state, KPI scope, EN/FR pagination, zero-result behavior, table busy feedback, result announcements, and disclosure behavior.
- Passed `react-web`: `npx.cmd tsc --noEmit` and focused ESLint for all Phase 3 implementation and test files.
- `git diff --check` passed. Broader relevant ESLint reports only the five existing `no-explicit-any` errors in `react-web/src/app/admin/dossiers/[id]/page.tsx`; the `AdminFilterDisclosure` hook violation is resolved.
- The full frontend unit suite exited nonzero. A separate run of the untouched `ProjectProgramScopeQuiz.test.tsx` suite had four failures and two passes; those tests and source files are outside this phase and were not modified.
- Browser verification was unavailable: the CUA check reported that both the native pipe and browser access host could not connect. Screen-reader behavior therefore remains unverified in a real browser; component tests verify the live-region and busy-state markup only.

Phase 1/2 URL, pagination, and return-context behavior remains covered by the passing regression set. Existing unrelated working-tree changes were preserved, and no commit was created.

## 14. Phase 4 final verification and release readiness

**Verification date:** 29 October 2026
**Scope:** Final source/test review, focused and full frontend checks, Project Program scope failure diagnosis, and available browser verification. No production code or test files were changed during this phase.

### F-01–F-12 verification matrix

| Finding | Expected behaviour | Current implementation and regression test | Status | Remaining limitation |
|---|---|---|---|---|
| F-01 | Registration view changes preserve destination-relevant shared filters and drop incompatible filters. | The view URL helper is used by RegistrationsHubTabs; RegistrationsHubTabs.test.tsx and inscriptions.test.ts cover filter retention and view changes. | Verified by automated test | The authenticated browser transition was not exercised. |
| F-02 | Page state is URL-backed, resets on view/filter changes, and clamps to the last valid page. | Inscriptions and Dossiers parse page parameters and clamp against response totals; admin-url.test.ts and the registration-tab tests cover parsing, clamping, and page reset. | Partially verified | Route-level page changes and browser Back/Forward were not exercised. |
| F-03 | Organisation status control, chip, and request use the same normalized value. | normalizeRegistrationStatus is applied before page state/request construction; inscriptions.test.ts covers queue-only status normalization and aligned request scope. | Verified by automated test | Results were not compared in an authenticated browser. |
| F-04 | Detail return restores a safe local source list URL, with a safe fallback for direct visits. | Dossier and establishment pages resolve allowlisted returnTo values through admin-return.ts; five admin-return.test.ts cases cover scoped filters, pages, invalid destinations, and fallbacks. | Partially verified | Source-to-detail-to-return was not exercised in the browser. |
| F-05 | Placeholder rows remain visible with scoped busy and updating feedback. | Both list pages wire isBackgroundRefreshing to AdminTablePanel; admin-query-state.test.ts and AdminTablePanel.test.tsx verify the refresh predicate, aria-busy, status text, and retained rows. | Partially verified | Page wiring was source-reviewed; no authenticated delayed-request browser run was possible. |
| F-06 | Filter, view, and page history follows the documented push/replace policy, and pages restore from URLs. | Main-list page parameters are URL-backed; Follow-up component tests verify page push and debounced-search replace, and URL tests verify the state contract. | Partially verified | Actual browser Back/Forward across Inscriptions and Dossiers was not tested. |
| F-07 | Follow-up filters and page survive refresh/share, with scoped Clear All and dependent territory handling. | Namespaced state is parsed and normalized by follow-up-url.ts; URL and CampaignNonRespondentsTable tests cover restoration, Clear All, region/department changes, pagination, and search history. | Verified by automated test | Real refresh/share navigation was not exercised in an authenticated browser. |
| F-08 | Invalid and conflicting URL values are normalized before controls, chips, and requests use them. | Inscriptions and Dossiers normalize at the URL boundary; admin-url.test.ts and inscriptions.test.ts cover unsupported values, assignment conflicts, period/quality, malformed dates, and territory pairs. | Verified by automated test | Browser canonicalization and rewrite-loop behaviour were not exercised. |
| F-09 | Response-rate KPI is absent for All campaigns and names the selected campaign when scoped. | DossierResponseRateKpi renders only for a selected campaign; DossierResponseRateKpi.test.tsx covers both states. | Verified by automated test | Page-level campaign selection was not exercised in the browser. |
| F-10 | Follow-up pagination copy uses the active locale. | The table uses translated range/page/button messages present in English and French; CampaignNonRespondentsTable.test.tsx checks the French pagination copy. | Partially verified | An explicit English-rendering assertion is absent. |
| F-11 | Refresh and committed result changes expose scoped busy state and one polite count announcement; placeholder counts are not announced. | AdminTablePanel and AdminLiveResultCount implement the status/live-region markup; their tests cover busy feedback, duplicate visible/live copy, and placeholder announcement suppression. | Partially verified | Tests inspect DOM markup only; page-level screen-reader behaviour and real assistive technology were not tested. |
| F-12 | Active filters open the disclosure; manual close persists until active state changes. | AdminFilterDisclosure uses transition-aware state; its regression test covers initial activation, manual close, rerenders, and reactivation. | Verified by automated test | Keyboard/browser behaviour was not separately exercised. |

### Automated check results

| Check | Result |
|---|---|
| Focused CAMLEAP URL, return, Follow-up, refresh, KPI, translation, and disclosure tests | Passed: 66 tests, 0 failures. |
| Isolated ProjectProgramScopeQuiz.test.tsx | Failed: 6 tests, 2 passed, 4 failed. Exact failures are diagnosed below. |
| Full react-web frontend test suite | Failed: 1,188 tests, 1,184 passed, 4 failed; exit code 1. The four failures are the same Project Program scope tests. |
| react-web TypeScript check: npx.cmd tsc --noEmit | Passed. |
| Focused ESLint over changed CAMLEAP page, helper, component, and test files | Passed with no reported errors. |
| Broader relevant ESLint over Inscriptions, Dossiers, admin components, and URL/query helpers | Failed: 11 errors and 2 warnings. Five are the known no-explicit-any findings in the unchanged Dossiers detail page; six other errors and two warnings are in unchanged files listed below. |
| git diff --check | Passed. Git emitted only the existing working-copy LF-to-CRLF notices for the audit, AdminFilterDisclosure, and follow-up-url files. |

The five known Dossiers detail lint errors are at dossiers/[id]/page.tsx lines 472, 484, 494, 505, and 514, all rule @typescript-eslint/no-explicit-any. The AdminFilterDisclosure react-hooks/set-state-in-effect violation is resolved and did not appear in either lint run. The broader command also reports two react-hooks/immutability errors in dossiers/detail-reopen.test.tsx lines 47–48, one react-hooks/purity error in CampaignProgressChart.tsx:91, one react-hooks/set-state-in-effect error in CoveragePanel.tsx:129, one no-restricted-syntax error in NotificationBell.tsx:180, and one react-hooks/immutability error in StatusDonutChart.tsx:54. These files were unchanged in the starting working tree. Its two warnings are unused imports/variables in ArchiveActions.test.tsx and CoveragePanel.tsx.

### Project Program scope failures

The isolated run reports the following four failures:

| Test | Failure | Evidence and likely cause |
|---|---|---|
| project quiz asks one labelled Oui/Non question at a time (test line 52) | After selecting Oui, the current group remains “Personnel permanent”; the assertion expects “Personnel temporaire”. | Current onSelect only updates hasPermanentStaff, and the next step runs from the explicit Continue action. Commit 34030a83 changed the earlier onSelect flow, which called goAfter("permanent"), while the test still expects automatic advancement. |
| the review lists all selected tables using respondent-facing labels (test line 73) | The helper cannot find a checkbox after selecting Oui. | The helper advances to the next item without clicking Continue; the accessible DOM still contains the permanent-staff question. This has the same flow-contract mismatch. |
| re-opening a closed table clears its derived zeros when the quiz is confirmed (test line 85) | The expected “Confirmer et ouvrir les tableaux” button is absent. | The scripted answers do not advance from the current Yes/No beat through the explicit Continue controls, so the test never reaches the review action. |
| a nil declaration still requires confirmation in a named dialog (test line 110) | The expected “Confirmer et ouvrir les tableaux” button is absent. | This test also assumes the answer sequence advances without Continue and remains on the permanent-staff beat. |

These failures are reproducible in isolation, so the unimplemented Window.scrollTo warnings are not their cause. The full run also emitted separate jsdom diagnostics for CSS and IndexedDB in other tests; neither appears in the four failing assertions. Git history shows the quiz/test refactor predates this CAMLEAP verification, and git diff HEAD for the quiz source and test is empty. However, the same refactor introduced both the explicit Continue flow and the still-auto-advance-oriented test assertion; the evidence cannot determine whether Continue is now the intended UX or whether automatic advancement was accidentally removed. Treat this as an unresolved pre-existing Project Program flow/test contract issue, not as proven unrelated test noise. No quiz code or test was changed because it is outside this audit scope.

### Browser, accessibility, and scope review

- Playwright Chromium launched successfully. Read-only navigation to 127.0.0.1:3000/admin/inscriptions returned the CAMLEAP page shell, then the client redirected to /login. No authenticated browser session was available, so none of the Inscriptions or Dossiers workflow scenarios could be completed.
- A separate Next dev-server start attempt could not bind 127.0.0.1:3000 (EACCES). No server process from that attempt remained running. The earlier navigation using localhost timed out; the successful check used 127.0.0.1.
- No real screen reader was available. The tests verify DOM live-region and aria-busy markup, not spoken output. Use the manual checklist below with an authenticated session before release.
- The tracked feature diff is confined to CAMLEAP admin routes, shared admin components/helpers, their tests, locale messages, and this audit record. No Project Program quiz files, unrelated design files, credentials, or debug scaffolding were added by this phase. Existing untracked files were present at the initial status check and were preserved. No test-generated files were added to the repository.
- No commit was created. No user changes were reset, cleaned, stashed, reverted, or discarded.

#### Manual release checklist

1. In an authenticated browser, change Queue filters, move to Organisations and Coverage, and verify destination-valid filters, status control/chips/results, and page reset.
2. Change Inscriptions and Dossiers pages and filters, use Back/Forward, refresh filtered URLs, and verify the displayed page and query state agree.
3. Open a dossier and an establishment from filtered lists; verify the visible return action restores the source view/page. Try direct detail links and an invalid/external returnTo value.
4. Exercise Dossiers assignment, quality, period, campaign, and conflicting/invalid parameters; verify canonicalization settles without loops or misleading chips.
5. Exercise Follow-up search, region/department, type, outcome, pagination, Clear All, refresh, and copied URL restoration. Confirm KPI scope for All campaigns and one selected campaign.
6. Trigger a delayed refresh and inspect the relevant panel’s aria-busy/status message and result count. Confirm placeholder totals are not announced as final.
7. Test filter-disclosure activation, manual close, rerender, and reactivation with keyboard navigation. Where possible, verify announcements with a real screen reader.

### Release recommendation

**Ready after specified fixes/verification.** The CAMLEAP-focused automated regression set, TypeScript check, and focused ESLint pass, and the source/test mapping covers all twelve audit findings. A general release should wait for resolution or an explicit product decision on the four failing Project Program quiz tests, the authenticated browser checklist, and a release-gate decision on the broader lint baseline. Screen-reader output remains unverified. This phase made no production or test changes and created no commit.

## 15. Campaign coverage and returns navigation update

**Implementation date:** 29 October 2026
**Decision:** Both Registration coverage and Submission returns hand off to the Campaign targets page, which now hosts Quotas, Submission returns, and Registration coverage views.

- Registration coverage now renders under `/admin/cibles?vue=couverture`. Handoffs preserve a valid year, semester, and quarter. Legacy `/admin/inscriptions?vue=coverage` links redirect to the Campaign targets view.
- Submission returns was handed off from a Dossiers tab to `/admin/cibles?vue=retours`. That Dossiers tab has since been removed; the Campaign targets page remains the destination and owns the campaign picker and default when Dossiers is set to All campaigns.
- The Campaign targets view switch retains its campaign and coverage-period URL state. The English and French navigation labels identify Registration coverage and Submission returns separately.
- `react-web`: `npx.cmd tsc --noEmit` passed. `git diff --check` passed with existing LF-to-CRLF notices. No tests or authenticated browser checks were run for this navigation update.

**Role visibility follow-up:** Shared national and territorial administrators can switch between Submission Returns and Registration Coverage. Roles that can list campaigns also see Quotas; Divisional Admins see the two returns views and get their active collection campaign through the reader-scoped campaign endpoint. The submission specialist sees the submission views, not Registration Coverage. The registration specialist reaches Campaign targets from the Campaigns hub and lands on Registration Coverage. The coverage API endpoints use registration-reader roles while Submission Returns endpoints retain survey-reader roles. Frontend and backend TypeScript checks pass. Focused ESLint still reports two `react-hooks/set-state-in-effect` violations in existing quota/returns panel effects at `cibles/page.tsx:244` and `:642`; those effects were not changed by this role update. No role-matrix test or authenticated browser check was run.

## 16. Remove duplicate workflow handoff tabs

**Decision:** Campaign targets is the single navigation point for Submission Returns and Registration Coverage.

- Removed the Registration Coverage handoff tab from the Inscriptions and Establishments tab strip and the Submission Returns handoff tab from Dossiers.
- The Campaigns hub still links to Campaign targets, where role-filtered views remain available. Registration specialists land on Registration Coverage; submission specialists see their submission views; shared admins see both returns views.
- Legacy `vue=coverage` URLs on Inscriptions/Dossiers continue to redirect to Campaign targets, so saved links still work.
- The Registration tab regression test now asserts that it preserves list context and does not duplicate the Campaign targets entry. Frontend/backend TypeScript checks, focused lint for the changed UI files, and `git diff --check` passed. Tests and authenticated browser verification were not run.
