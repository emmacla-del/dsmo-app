# Analytics aggregate territory-scope plan (2026-10-06)

Status: **plan only, nothing implemented.** Read-only audit.

**Approval gate.** This is an RBAC / geographic-isolation change. Under CLAUDE.md §21 it needs explicit human review before anyone implements it. It is also blocked on domain decision **D5** (`docs/audit/onefop-scope-gap-fix-plan-2026-10-06.md:44`): may REGIONAL_ADMIN / DIVISIONAL_ADMIN see national aggregate indicators?

Related change already in the working tree (uncommitted): `GET /onefop-analytics/submissions` now has a handler-level `@Roles('ADMIN_ONEFOP', 'SUPER_ADMIN')`, so it is out of scope here. No react-web or Flutter caller of that route was found.

---

## 1. Route inventory

Controller: `src/analytics/onefop-analytics.controller.ts`
Class guards: `JwtAuthGuard, RolesGuard, ActiveCompanyGuard` (`:32`)
Class roles: `ADMIN_ONEFOP, REGIONAL_ADMIN, DIVISIONAL_ADMIN, SUPER_ADMIN` (`:33`). Every route below inherits these, except `submissions`.
`RolesGuard` uses `getAllAndOverride`, so a handler-level `@Roles` replaces the class list (`src/auth/roles.guard.ts`).

All handlers are `GET`. Facade: `src/analytics/facade/onefop-analytics.facade.ts`. Domain services: `src/analytics/domain/*.analytics.service.ts`.

| Path | Ctrl line | Facade → service method |
|---|---|---|
| dashboard | 41 | facade `getDashboard` (composite, 13 domain calls on pre-resolved `_ids`) |
| employment-summary | 57 | employment `getPermanentEmployeeSummary` |
| employment | 77 | employment `getPermanentEmployeesByLocation` (groupBy, default region) |
| employment-by-location | 94 | employment `getPermanentEmployeesByLocation` |
| employment-by-entity-type | 111 | employment `getPermanentEmployeesByEntityType` |
| employment-by-size | 127 | employment `getPermanentEmployeesBySize` |
| recruitment-trends | 147 | recruitment `getRecruitmentTrends` |
| net-employment-trends | 165 | facade `getNetEmploymentTrends` (recruitment + mobility trends) |
| hires | 183 | recruitment `getHiresByDemographics` |
| hires-by-demographics | 202 | recruitment `getHiresByDemographics` |
| hires/diploma | 221 | recruitment `getDiplomaSummary` |
| labor-market-tension | 240 | recruitment `getVacancyFulfilment` |
| gender-parity | 261 | facade `getGenderParity` → jobApplications `getJobApplicationSummary` |
| youth-employment | 277 | recruitment `getYouthShareOfRecruitment` |
| inclusion | 293 | inclusion `getInclusionMetrics` |
| inclusion-metrics | 310 | inclusion `getInclusionMetrics` |
| skills | 331 | skills `getSkillNeeds` |
| skill-needs | 344 | skills `getSkillNeeds` |
| training-needs | 357 | skills `getTrainingNeeds` |
| training-gap | 370 | skills `getTrainingGap` |
| vacancies | 390 | enterpriseProfile `getVacanciesBySegment` |
| vacancies-by-segment | 403 | enterpriseProfile `getVacanciesBySegment` |
| diploma-distribution | 420 | recruitment `getDiplomaDistribution` |
| diploma-summary | 434 | recruitment `getDiplomaSummary` |
| disability-data | 453 | inclusion `getDisabilityData` |
| vulnerable-workers | 467 | inclusion `getVulnerableWorkers` |
| first-time-workers | 485 | inclusion `getFirstTimeWorkers` |
| departures | 499 | mobility `getDepartures` |
| departure-summary | 513 | mobility `getDepartureSummary` |
| mobility-dashboard | 527 | facade `getMobilityDashboard` (employment + mobility on `_ids`) |
| dismissal-reasons | 545 | mobility `getDismissalReasons` |
| dismissal-unemployment | 559 | mobility `getDismissalUnemployment` |
| internships | 577 | mobility `getInternships` |
| job-applications | 595 | jobApplications `getJobApplications` |
| job-applications/conversion | 611 | jobApplications `getApplicationConversionRate` |
| job-applications/trend | 627 | jobApplications `getApplicationTrends` |
| registered-seekers | 648 | inclusion `getRegisteredFirstTimeSeekers` |
| first-time-labor-gap | 664 | inclusion `getFirstTimeLaborGap` |
| enterprise-profile | 684 | enterpriseProfile `getEnterpriseProfile` |
| recruitment-by-location | 697 | recruitment `getRecruitmentByLocation` (groupBy, default region) |
| departures-by-location | 714 | mobility `getDeparturesByLocation` (groupBy, default region) |
| skill-trends | 735 | skills `getSkillTrends` |
| inclusion-trends | 756 | inclusion `getInclusionTrends` |
| sectors | 777 | query `getDistinctSectors`. No filters. Returns a national list of sector names. |
| submissions | 786 | education `getSubmissions`. **Now ADMIN_ONEFOP + SUPER_ADMIN only.** |

## 2. Filter parameters

All come from an untyped `@Query() q: any`. There is no DTO and no validation.

- **Geographic:** `region`, `department`, `subdivision`. Every aggregate route accepts them. `sectors` accepts none.
- **Geographic grouping:** `groupBy=region|department|subdivision` on `employment`, `employment-by-location`, `recruitment-by-location` and `departures-by-location`. The default is `region`, so the response is a per-region breakdown of the whole country.
- **Other filters:**
  - `year`/`surveyYear`, `fromQuarter`/`toQuarter`, `startDate`/`endDate`, `entityType`, `sector`
  - per-route: `csp`, `gender`, `ageGroup`/`ageBand`, `granularity`, `breakdownBy`, `limit`, `dimension`

## 3. Current behaviour with an out-of-territory filter

There is one choke point. Every aggregate resolves its submission set through `AnalyticsQueryService.resolveSubmissions` / `resolveSubmissionIds` (`src/analytics/core/analytics-query.service.ts:40-71`). That calls `buildSubmissionWhere` (`:16-32`). The only other direct `onefopSubmission` query in `src/analytics/domain` is `education.getSubmissions` (`education.analytics.service.ts:43-44`), which uses the same builder.

```ts
// analytics-query.service.ts:27-29
if (filter.region) where['region'] = { contains: filter.region, mode: 'insensitive' };
if (filter.department) where['department'] = { contains: filter.department, mode: 'insensitive' };
if (filter.subdivision) where['subdivision'] = { contains: filter.subdivision, mode: 'insensitive' };
```

Consequences:

1. **No territory scope at all.** The caller's `req.user` is never read; the controller does not inject `@Req()`. A REGIONAL_ADMIN for Littoral can:
   - send `?region=Centre` and get Centre's aggregates;
   - omit `region` and get national aggregates;
   - send `groupBy=region` and get every region side by side.

   The DIVISIONAL_ADMIN case is the same.
2. **The only restriction is on the client.** Flutter's `effectiveRegionProvider` / `effectiveDepartmentProvider` (`lib/features/analytics/providers/dashboard_providers.dart:124-143`) lock the filter for territorial users. A direct API call bypasses this.
3. **`contains` is a substring match, not equality.**
   - `region=Nord` also matches `Nord-Ouest` and `Extrême-Nord`.
   - `region=Ouest` also matches `Nord-Ouest` and `Sud-Ouest`.
   - `region=Sud` also matches `Sud-Ouest`.

   For national users this is a **statistical-correctness bug**: a "Nord" dashboard silently sums three regions. If it were reused as a scope, it would also be an isolation leak.
4. **Array injection.** `?region=a&region=b` passes an array into `contains`. Prisma then throws, and the caller gets a 500. This is low impact.
5. `_ids` is only set internally by the facade. The controller builds explicit filter objects, so a caller cannot inject `_ids`.

## 4. Design options

Shared mechanism for all three options: derive the scope server-side from `territoryWhere(territoryFromUser(req.user))` (`src/auth/territory.ts:85`), which is the same helper used in:
- `onefop.service.ts:197` (commit 099666e0, list);
- `onefop.service.ts:272` (4f804456, detail/PDF);
- `campaign.service.ts:318` (acd9bc73).

That helper already:
- returns `{}` for SUPER_ADMIN and ADMIN_ONEFOP;
- matches region (REGIONAL), or region AND department (DIVISIONAL), with case-insensitive `equals`;
- fails closed with `{ id: { in: [] } }` for an unassigned or unknown role.

**A. Force / intersect (AND).** Append the territory fragment to `where.AND` in `buildSubmissionWhere`. Caller filters can then only narrow the result:
- an out-of-territory `region` returns empty aggregates;
- no `region` returns the caller's own territory.

This is exactly the rule in `onefop.service.ts:200-206`: "the region query parameter only narrows". The change is minimal and in one place, every route is covered at once, and there is no existence signal.

**B. Reject (403).** Compare the supplied `region`/`department` with the caller's territory using `assertTerritorialAuthority` (`territory.ts:174`), and throw on a mismatch. This gives clearer UX ("hors de votre région"). On its own it is insufficient: an omitted filter would still return national data. It also needs per-handler code, and the `contains` problem breaks name comparison.

**C. Both.** Apply A for enforcement and B as an explicit 403 when a supplied filter contradicts the territory.

**Recommendation: A, with an optional thin B layer later if UX wants a message.** A is the security control. B is only a usability nicety on top. Also replace `contains` with case-insensitive `equals` for region/department/subdivision in `buildSubmissionWhere`. That fixes the "Nord" over-count for national users too, which is a statistical change, so the ONEFOP domain owner should confirm it.

Implementation notes for A:
- Put the scope under `where.AND`; **do not** `Object.assign` it. `resolveSubmissions` overwrites `where['id']` when `sector` is set (`analytics-query.service.ts:55`). That would erase the fail-closed `{ id: { in: [] } }` and silently re-open national data for an unassigned REGIONAL_ADMIN who also sends `sector=`.
- Carry the scope on the filter as a server-only field (for example `_territory?: Record<string, unknown>` on `AnalyticsFilter` in `core/analytics-types.ts:33`). The controller sets it from `req.user` and never from `q`. The facade's `{ ...filter, _ids }` spreads preserve it.
- `_territory` must be **required in practice**. If a handler forgets it, the route is unscoped. Use a controller spec that walks every handler on the prototype (section 7) to catch omissions.
- `req.user` carries `role, region, department` only (`src/auth/jwt.strategy.ts:58-59`), with no `regionId`/`departmentId`. `territoryWhere` therefore takes the name branches. That is consistent with the onefop/campaign fixes.

**Impact if D5 rules "territorial":**
- The Flutter Synthèse tab's national benchmark (`onefopNationalSummaryProvider`, `lib/features/analytics/providers/onefop_dashboard_providers.dart:381-389`) deliberately omits region. For territorial users it would then return their own territory, so each "share of national" KPI would read 100%. The benchmark would need hiding for territorial roles, or a separately approved national-only summary endpoint.
- The `groupBy=region` charts would show a single bar.

**If D5 rules "national aggregates allowed":** do not add scope. Still fix `contains` → `equals`, and keep `submissions` restricted, which is done.

## 5. Empty territory

`territoryWhere` returns `{ id: { in: [] } }` (`territory.ts:38-39, 156, 164, 167`) in these cases:
- a REGIONAL_ADMIN with no or blank region;
- a DIVISIONAL_ADMIN missing either region or department;
- any unknown role.

Under option A, every aggregate then resolves zero submission ids. Each service already short-circuits to its empty shape (for example `facade.getDashboard` → `emptyDashboard`). This is **fail closed**, which is the required behaviour. As noted above, it holds only if the scope sits in `AND` and survives the `sector` path.

## 6. Other analytics routes with geographic filters (brief)

- `/dsmo/analytics/*` (`src/analytics/analytics.controller.ts`). These are DSMO Declaration aggregates with roles ADMIN_ONEFOP, REGIONAL_ADMIN, DIVISIONAL_ADMIN and SUPER_ADMIN.
  - Endpoints taking `?region=`: `employment-trends` (`:44`), `sector-distribution` (`:59`), `gender-distribution` (`:68`), `dashboard-summary` (`:113`), and the executive endpoint (`:163`).
  - `employment-by-region` and `unemployment-risk-regions` are national per-region breakdowns.
  - The service uses exact `where.region = region` (`analytics.service.ts:68,134,168`), and nothing scopes by the caller. This is the same gap. Fix it with `territoryWhereForDeclaration` (`territory.ts:115`) after D5. Flutter calls these routes (`lib/features/analytics/providers/dashboard_providers.dart:191-315`).
- `/dsmo/analytics/bilan*` (`bilan.controller.ts`) is scoped to the caller's own company via `req.user.id`. Not affected.
- `/reports/*` (`src/report/report.controller.ts`) is ADMIN_ONEFOP/SUPER_ADMIN only and uses the legacy `src/analytics/onefop-analytics.service.ts`, which has its own `contains` builder (`:49-63`). Its roles are national, so there is no isolation issue, but the `contains` over-count applies there too.
- `GET /onefop-analytics/sectors` returns national distinct sector names, which is reference data. Recommend leaving it as is.

## 7. Files that change and tests to add (option A)

Files:
1. `src/analytics/core/analytics-types.ts`: add `_territory?: Record<string, unknown>` to `AnalyticsFilter`.
2. `src/analytics/core/analytics-query.service.ts`: in `buildSubmissionWhere`:
   - push `filter._territory` into `where.AND`;
   - switch region/department/subdivision to `{ equals, mode: 'insensitive' }` on a trimmed string;
   - ignore non-string values (this fixes the array 500).
3. `src/analytics/onefop-analytics.controller.ts`: inject `@Req() req` in each aggregate handler and set `_territory: territoryWhere(territoryFromUser(req.user))`. Preferably add a small private helper so it is one line per handler.
4. `src/analytics/facade/onefop-analytics.facade.ts`: no logic change expected. Verify that every path spreads the filter.
5. `src/analytics/domain/employment.analytics.service.ts:252`: `getPermanentEmployeesBySize` spreads the filter, so verify only.
6. Follow-up, separately approved: `src/analytics/analytics.controller.ts` + `analytics.service.ts` for `/dsmo/analytics/*`.
7. Flutter (owner's call): hide the national benchmark for territorial users.

Tests to add (do not use `src/auth/roles.guard.spec.ts`; that area is owned by a concurrent agent):
- `src/analytics/core/analytics-query.service.spec.ts` (new):
  - REGIONAL scope is ANDed;
  - an out-of-territory `region` yields a where that matches nothing;
  - the fail-closed `{id:{in:[]}}` survives when `sector` is set;
  - `region=Nord` produces `equals`, not `contains`;
  - an array `region` is ignored;
  - national roles add no scope.
- `src/analytics/onefop-analytics.controller.spec.ts` (new):
  - iterate every `@Get` handler on the prototype with a mocked facade;
  - call each as REGIONAL_ADMIN (region set), DIVISIONAL_ADMIN with no department, and ADMIN_ONEFOP;
  - assert that the filter passed to the facade carries the expected `_territory` (fail-closed for the unassigned user);
  - this guards against a future handler forgetting the scope;
  - also assert the `getSubmissions` handler metadata is `['ADMIN_ONEFOP','SUPER_ADMIN']` and that REGIONAL_ADMIN/DIVISIONAL_ADMIN are rejected by `RolesGuard`. This covers the step-3 change.
- Facade test: `getDashboard` with a fail-closed scope returns `emptyDashboard` (submissionCount 0).
- Gate: `jest --runInBand` (authoritative per project memory).

## 8. Approval checklist

- [ ] D5 domain ruling (territorial vs national aggregates for REGIONAL/DIVISIONAL).
- [ ] Human RBAC approval (CLAUDE.md §21).
- [ ] ONEFOP domain sign-off on `contains` → `equals` (it changes figures for Nord/Sud/Ouest filters).
- [ ] UX decision on the Synthèse national benchmark for territorial users.
