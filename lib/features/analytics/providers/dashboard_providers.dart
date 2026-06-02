// lib/features/analytics/providers/dashboard_providers.dart
// ═══════════════════════════════════════════════════════════════
// Role-scoped analytics providers.
//
// SCOPING RULES:
//   COMPANY      → no analytics access (workspace only)
//   DIVISIONAL   → locked to user.region + user.department
//   REGIONAL     → locked to user.region
//   CENTRAL      → national read-only, manual filter allowed
//   SUPER_ADMIN_DSMO   → full DSMO access, manual filter allowed
//   SUPER_ADMIN_ONEFOP → full ONEFOP access, manual filter allowed
//
// Every data provider reads effectiveRegionProvider /
// effectiveDepartmentProvider instead of regionIdProvider directly,
// so geographic locking is enforced in one place.
// ═══════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../providers/auth_provider.dart';
import '../models/dashboard_models.dart';
import '../models/time_series_data.dart';

// ── Granularity enum ─────────────────────────────────────────

enum Granularity { year, semester, quarter }

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — MANUAL FILTER STATE (used by national roles only)
// ═══════════════════════════════════════════════════════════════

/// Year selected in the filter picker.
final yearProvider = StateProvider<int>((ref) => DateTime.now().year);

/// Region selected manually by a national user. Null = all regions.
final regionIdProvider = StateProvider<String?>((ref) => null);

/// Display name of the manually selected region (for the UI label).
final regionNameProvider = StateProvider<String?>((ref) => null);

/// Department selected manually by a national user. Null = all departments.
final departmentIdProvider = StateProvider<String?>((ref) => null);

/// Start year for trend range picker.
final startYearProvider = StateProvider<int>((ref) => DateTime.now().year - 3);

/// End year for trend range picker.
final endYearProvider = StateProvider<int>((ref) => DateTime.now().year);

/// Chart granularity for trend analysis.
final granularityProvider =
    StateProvider<Granularity>((ref) => Granularity.year);

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — ROLE-BASED SCOPE (derived from logged-in user)
// ═══════════════════════════════════════════════════════════════

/// Roles that are locked to a geographic unit.
/// These users cannot change their region filter.
const _geoLockedRoles = {'REGIONAL', 'DIVISIONAL'};

/// Roles that have access to analytics at all.
/// COMPANY is intentionally excluded — workspace only for now.
const _analyticsRoles = {
  'REGIONAL',
  'DIVISIONAL',
  'CENTRAL',
  'SUPER_ADMIN_DSMO',
  'SUPER_ADMIN_ONEFOP',
};

/// Whether the currently logged-in user can access analytics screens.
final canAccessAnalyticsProvider = Provider<bool>((ref) {
  final user = ref.watch(authProvider).value;
  if (user == null) return false;
  return _analyticsRoles.contains(user.role);
});

/// Whether the logged-in user's region scope is fixed (cannot be changed).
/// True for REGIONAL and DIVISIONAL agents.
final isScopeLockedProvider = Provider<bool>((ref) {
  final user = ref.watch(authProvider).value;
  if (user == null) return false;
  return _geoLockedRoles.contains(user.role);
});

/// The geographic scope automatically derived from the logged-in user's
/// profile. For REGIONAL → region only. For DIVISIONAL → region + department.
/// For all other roles → both null (no automatic lock).
final userScopeProvider =
    Provider<({String? region, String? department})>((ref) {
  final user = ref.watch(authProvider).value;
  if (user == null) return (region: null, department: null);

  switch (user.role) {
    case 'REGIONAL':
      // Locked to their assigned region; department is not restricted.
      return (region: user.region, department: null);

    case 'DIVISIONAL':
      // Locked to both their region and department.
      return (region: user.region, department: user.department);

    default:
      // CENTRAL, SUPER_ADMIN_DSMO, SUPER_ADMIN_ONEFOP — no forced scope.
      // They use the manual filter pickers.
      return (region: null, department: null);
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — EFFECTIVE FILTER (merges automatic + manual)
//
// Rule: automatic scope ALWAYS wins over the manual picker.
// If a REGIONAL agent somehow has a regionIdProvider value set,
// it is ignored — their user.region is always used.
// ═══════════════════════════════════════════════════════════════

/// The region that is actually sent to every API call.
/// Automatic (role-based) scope takes priority over the manual picker.
final effectiveRegionProvider = Provider<String?>((ref) {
  final scope = ref.watch(userScopeProvider);

  // Automatic lock → ignore the picker entirely.
  if (scope.region != null) return scope.region;

  // National user → use whatever the picker says (null = all regions).
  return ref.watch(regionIdProvider);
});

/// The department that is actually sent to every API call.
final effectiveDepartmentProvider = Provider<String?>((ref) {
  final scope = ref.watch(userScopeProvider);

  // DIVISIONAL users are locked to their department.
  if (scope.department != null) return scope.department;

  // National users → use the department picker (null = all departments).
  return ref.watch(departmentIdProvider);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — CORE METRIC PROVIDERS
// All use effectiveRegionProvider / effectiveDepartmentProvider.
// ═══════════════════════════════════════════════════════════════

/// Current year dashboard summary (KPIs, growth rate, top sectors).
final dashboardSummaryProvider =
    FutureProvider.family<DashboardSummary, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/dashboard-summary',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return DashboardSummary.fromJson(response.data);
});

/// Previous year summary — used to compute year-on-year deltas.
final previousYearSummaryProvider =
    FutureProvider.family<DashboardSummary, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/dashboard-summary',
    queryParameters: {
      'year': year - 1,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return DashboardSummary.fromJson(response.data);
});

// ── SECTION 4-B — EMPLOYMENT BALANCE ─────────────────────────

/// Employment balance: jobs created vs lost.
final employmentBalanceProvider =
    FutureProvider.family<EmploymentBalance, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/employment-balance',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return EmploymentBalance.fromJson(response.data);
});

/// First-time employment (young entrants, S23Q02).
final firstTimeEmploymentProvider =
    FutureProvider.family<FirstTimeEmployment, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/first-time-employment',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return FirstTimeEmployment.fromJson(response.data);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — TREND ANALYSIS PROVIDERS
// ═══════════════════════════════════════════════════════════════

/// Employment trends over a date range with configurable granularity.
/// Takes all its parameters as a record so FutureProvider.family can
/// cache correctly when any filter changes.
final employmentTrendsProvider = FutureProvider.family<
    List<TimeSeriesData>,
    ({
      int startYear,
      int endYear,
      String? regionId,
      String? departmentId,
      Granularity granularity,
    })>((ref, p) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get(
    '/dsmo/analytics/employment-trends',
    queryParameters: {
      'startYear': p.startYear,
      'endYear': p.endYear,
      if (p.regionId != null) 'region': p.regionId,
      if (p.departmentId != null) 'department': p.departmentId,
      'granularity': p.granularity.name,
    },
  );
  return (response.data as List)
      .map((e) => TimeSeriesData.fromJson(e))
      .toList();
});

/// UI-facing wrapper — builds the params record from current filter state
/// so screens don't have to assemble it manually.
final filteredEmploymentTrendsProvider =
    FutureProvider<List<TimeSeriesData>>((ref) async {
  final params = (
    startYear: ref.watch(startYearProvider),
    endYear: ref.watch(endYearProvider),
    regionId: ref.watch(effectiveRegionProvider),
    departmentId: ref.watch(effectiveDepartmentProvider),
    granularity: ref.watch(granularityProvider),
  );
  return ref.watch(employmentTrendsProvider(params).future);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — STRATEGIC & PREDICTIVE PROVIDERS
// ═══════════════════════════════════════════════════════════════

/// Employment breakdown by business sector.
final sectorsProvider =
    FutureProvider.family<List<Sector>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/sector-distribution',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List).map((e) => Sector.fromJson(e)).toList();
});

/// Gender breakdown by region (table / chart data).
final genderDistributionProvider =
    FutureProvider.family<List<GenderRegion>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/gender-distribution',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List).map((e) => GenderRegion.fromJson(e)).toList();
});

/// Multi-year recruitment forecast.
/// Note: no region filter — forecasts are always national.
final recruitmentForecastProvider =
    FutureProvider.family<List<Map<String, dynamic>>, int>((ref, window) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get(
    '/dsmo/analytics/recruitment-forecast',
    queryParameters: {'years': window},
  );
  return (response.data as List).cast<Map<String, dynamic>>();
});

/// Regions at highest unemployment risk for the given year.
final unemploymentRiskProvider =
    FutureProvider.family<List<Map<String, dynamic>>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);

  final response = await api.get(
    '/dsmo/analytics/unemployment-risk-regions',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
    },
  );
  return (response.data as List).cast<Map<String, dynamic>>();
});

/// Sectors with the most acute labour shortages.
final sectorShortagesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);

  final response = await api.get(
    '/dsmo/analytics/sector-labor-shortages',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
    },
  );
  return (response.data as List).cast<Map<String, dynamic>>();
});

// ── SECTION 6-B — LABOUR MARKET & MOBILITY ───────────────────

/// Labour-market gap (supply vs demand).
final laborMarketProvider =
    FutureProvider.family<LaborMarketGap, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/labor-market-gap',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return LaborMarketGap.fromJson(response.data);
});

/// Departures & mobility (dismissals, resignations, retirements, transfers).
final departuresProvider =
    FutureProvider.family<DeparturesMobility, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/departures',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return DeparturesMobility.fromJson(response.data);
});

// ── SECTION 6-C — CONTRACT & INCLUSION ───────────────────────

/// Contract-type distribution (CDI, CDD, internship, etc.).
final contractTypeProvider =
    FutureProvider.family<ContractDistribution, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/contract-types',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return ContractDistribution.fromJson(response.data);
});

/// Vulnerable-population inclusion (PWD, youth NEET, etc.).
final vulnerablePopProvider =
    FutureProvider.family<VulnerableInclusion, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/vulnerable-populations',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return VulnerableInclusion.fromJson(response.data);
});

// ── SECTION 6-D — QUALIFICATIONS & TRAINING ──────────────────

/// Diploma / qualification pyramid distribution.
final diplomaDistributionProvider =
    FutureProvider.family<DiplomaDistribution, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/diploma-distribution',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return DiplomaDistribution.fromJson(response.data);
});

/// Skills-training gap (demand vs supply by skill).
final trainingProvider =
    FutureProvider.family<List<SkillTraining>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/training-skills',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List).map((e) => SkillTraining.fromJson(e)).toList();
});

// ── SECTION 6-E — INTERNSHIP PIPELINE ────────────────────────

/// Internship pipeline (active interns, conversions to CDI).
final internshipPipelineProvider =
    FutureProvider.family<InternshipPipeline, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/internship-pipeline',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return InternshipPipeline.fromJson(response.data);
});

// ── SECTION 6-F — ENTITY STRUCTURE ───────────────────────────

/// Entity breakdown by legal form (Enterprise, CTD, ONG, Cooperative).
final entityBreakdownProvider =
    FutureProvider.family<EntityBreakdown, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/entity-breakdown',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return EntityBreakdown.fromJson(response.data);
});

/// Entity size distribution (micro, small, medium, large).
final entitySizeProvider =
    FutureProvider.family<List<EntitySizeItem>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/dsmo/analytics/entity-sizes',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List)
      .map((e) => EntitySizeItem.fromJson(e))
      .toList();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — REFERENCE DATA
// ═══════════════════════════════════════════════════════════════

/// Full list of regions — used to populate the filter picker for
/// national users. Geo-locked users never need this list.
final regionsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/locations/regions');
  return (response.data as List).cast<Map<String, dynamic>>();
});

/// Departments within a region — used when a national user has
/// already picked a region and wants to drill down further.
final departmentsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, regionId) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/locations/regions/$regionId/departments');
  return (response.data as List).cast<Map<String, dynamic>>();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 8 — GLOBAL REFRESH HELPER
// Invalidates every provider that depends on year or scope.
// Call this whenever the user changes year, region, or department.
// ═══════════════════════════════════════════════════════════════

void refreshAll(WidgetRef ref, int year) {
  ref.invalidate(dashboardSummaryProvider(year));
  ref.invalidate(previousYearSummaryProvider(year));
  ref.invalidate(employmentBalanceProvider(year));
  ref.invalidate(firstTimeEmploymentProvider(year));
  ref.invalidate(sectorsProvider(year));
  ref.invalidate(genderDistributionProvider(year));
  ref.invalidate(laborMarketProvider(year));
  ref.invalidate(departuresProvider(year));
  ref.invalidate(contractTypeProvider(year));
  ref.invalidate(vulnerablePopProvider(year));
  ref.invalidate(diplomaDistributionProvider(year));
  ref.invalidate(trainingProvider(year));
  ref.invalidate(internshipPipelineProvider(year));
  ref.invalidate(entityBreakdownProvider(year));
  ref.invalidate(entitySizeProvider(year));
  ref.invalidate(unemploymentRiskProvider(year));
  ref.invalidate(sectorShortagesProvider(year));
  // filteredEmploymentTrendsProvider auto-refreshes because it
  // watches startYearProvider / endYearProvider / effectiveRegionProvider.
  // recruitmentForecastProvider is national-only, no need to invalidate.
}
