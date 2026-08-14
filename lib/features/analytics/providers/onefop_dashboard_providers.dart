// lib/features/analytics/providers/onefop_dashboard_providers.dart
//
// Standalone ONEFOP providers — all calls go to /onefop-analytics/*.
// Filter-state providers (dashboardFilterProvider, regionIdProvider, etc.) are
// imported AND re-exported from dashboard_providers.dart so the screen
// only needs one import.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../../../widgets/period_selector.dart';
import '../models/dashboard_models.dart';
import '../models/dashboard_bundle.dart';
import '../models/filter_state.dart';
import '../models/labor_market_tension.dart';
import '../models/mobility_dashboard.dart';
import 'dashboard_providers.dart';

export 'dashboard_providers.dart'
    show
        regionIdProvider,
        departmentIdProvider,
        entityTypeProvider,
        sectorProvider,
        sectorFilterOptionsProvider,
        startYearProvider,
        endYearProvider,
        granularityProvider,
        Granularity,
        effectiveRegionProvider,
        effectiveDepartmentProvider,
        isScopeLockedProvider,
        canAccessAnalyticsProvider,
        regionsProvider,
        departmentsProvider;

export '../models/filter_state.dart' show dashboardFilterProvider, AnalyticsFilterState;

Map<String, dynamic> _safeMap(dynamic value) {
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return <String, dynamic>{};
}

List<dynamic> _safeList(dynamic value) {
  if (value is List) {
    return List<dynamic>.from(value);
  }
  return <dynamic>[];
}

Future<T?> _safeProviderFuture<T>(Future<T> future) async {
  try {
    return await future;
  } catch (_) {
    return null;
  }
}

/// Parses a `/onefop-analytics/departure-summary` response into its four
/// raw categories. Shared by [_fetchDepartureTotals] and
/// [onefopEmploymentBalanceProvider] so both a) the KPI/YoY departures total
/// and b) the "Dynamique du travail" jobs-lost figure are always derived
/// from the same categories — previously the latter re-parsed the same
/// endpoint without an `OTHER` case, so the two could disagree whenever
/// OTHER-type departures existed.
({int dismissals, int resignations, int retirements, int other})
    _parseDepartureBreakdown(dynamic responseData) {
  int dismissals = 0, resignations = 0, retirements = 0, other = 0;
  for (final item in _safeList(responseData).map((e) => _safeMap(e))) {
    final type = (item['departureType'] as String? ?? '').toUpperCase();
    final count = (item['total'] as num?)?.toInt() ?? 0;
    switch (type) {
      case 'DISMISSAL':
        dismissals = count;
        break;
      case 'RESIGNATION':
        resignations = count;
        break;
      case 'RETIREMENT':
        retirements = count;
        break;
      case 'OTHER':
        other = count;
        break;
    }
  }
  return (
    dismissals: dismissals,
    resignations: resignations,
    retirements: retirements,
    other: other,
  );
}

/// Shared by [onefopDashboardSummaryProvider] and
/// [onefopPreviousYearSummaryProvider] — both need real departure totals
/// (dismissals + resignations + retirements + other) to compute an honest
/// "Départs" KPI and "Variation nette" (recruitments − departures), instead
/// of the hardcoded zeros the dashboard endpoint alone provides.
Future<({int dismissals, int retirements, int total})> _fetchDepartureTotals(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/departure-summary',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final b = _parseDepartureBreakdown(response.data);
  return (
    dismissals: b.dismissals + b.resignations + b.other,
    retirements: b.retirements,
    total: b.dismissals + b.resignations + b.retirements + b.other,
  );
}

/// Shared by [onefopDashboardSummaryProvider] and
/// [onefopPreviousYearSummaryProvider]. The dashboard endpoint itself has no
/// gender breakdown of the employee stock — ONEFOP doesn't collect that.
/// The only gender split available is of job *applicants* (S21Q01), via the
/// dedicated gender-parity endpoint. Callers must label this distinctly
/// from workforce composition (e.g. "Part féminine (candidatures)").
Future<({int male, int female})> _fetchApplicantGenderSplit(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/gender-parity',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  final d = _safeMap(response.data);
  return (
    male: (d['maleApplicants'] as num?)?.toInt() ?? 0,
    female: (d['femaleApplicants'] as num?)?.toInt() ?? 0,
  );
}

/// Used by [onefopDashboardSummaryProvider] for the "Secteur leader" KPI.
/// The dashboard endpoint has no `vacanciesBySector` field — that key never
/// existed in OnefopAnalyticsFacade.getDashboard's response, so reading it
/// always produced an empty list. The real per-sector breakdown (S1Q07),
/// sorted by `totalEmployees` descending, comes from the same
/// vacancies-by-segment endpoint already used by [onefopSectorsProvider].
Future<List<TopSector>> _fetchTopSectorsByEmployees(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/vacancies',
    queryParameters: {
      ...period.toApiParams(),
      'groupBy': 'sector',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data)
      .map((e) => _safeMap(e))
      .take(5)
      .map((v) => TopSector.fromJson({
            'sector': v['segment'] ?? '—',
            'employees': v['totalEmployees'] ?? 0,
          }))
      .toList();
}

// ═══════════════════════════════════════════════════════════════
// PRIVATE HELPER CLASSES
// Screen accesses these via `as dynamic`, so they need the exact
// field names the screen uses — not the flat model fields.
// ═══════════════════════════════════════════════════════════════

/// Used by _QualificationPyramidBlock: `(list as dynamic).data`
/// Each item needs `.diploma`, `.male`, `.female`, `.total`.
class _DiplomaItem {
  final String diploma;
  final int male;
  final int female;
  final int total;
  const _DiplomaItem({
    required this.diploma,
    required this.male,
    required this.female,
    required this.total,
  });
}

class _OnefopDiplomaResult {
  final List<_DiplomaItem> data;
  const _OnefopDiplomaResult(this.data);
}

/// Used by _SkillsTrainingGapBlock / _InternshipPipelineBlock:
/// `(d as dynamic).topSkills`, `.topDomains`, `.vacationInternships`, etc.
class _OnefopTrainingData {
  final List<Map<String, dynamic>> topSkills;
  final List<Map<String, dynamic>> topDomains;
  final int vacationInternships;
  final int academicInternships;
  final int professionalInternships;
  final int preEmploymentInternships;
  final int totalInternships;

  const _OnefopTrainingData({
    required this.topSkills,
    required this.topDomains,
    required this.vacationInternships,
    required this.academicInternships,
    required this.professionalInternships,
    required this.preEmploymentInternships,
    required this.totalInternships,
  });
}

/// Used by _EntityStructureBlock:
/// `(bd as dynamic).enterprises.count`, `.enterprises.employees`, etc.
class _EntityGroup {
  final int count;
  final int employees;
  const _EntityGroup({required this.count, required this.employees});
}

class _OnefopEntityBreakdown {
  final _EntityGroup enterprises;
  final _EntityGroup cooperatives;
  final _EntityGroup ctds;
  final _EntityGroup ongs;

  const _OnefopEntityBreakdown({
    required this.enterprises,
    required this.cooperatives,
    required this.ctds,
    required this.ongs,
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — DASHBOARD SUMMARY
// GET /onefop-analytics/dashboard
// ═══════════════════════════════════════════════════════════════

/// Shared by [onefopDashboardSummaryProvider] and
/// [onefopNationalSummaryProvider] — fetches and aggregates the dashboard
/// KPI summary for an explicit scope, so the "vs national" benchmark (which
/// needs the exact same aggregation with region/department/subdivision
/// forced to null) can't drift from the real per-filter computation.
Future<DashboardSummary> _fetchDashboardSummaryData(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/dashboard',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final d = _safeMap(response.data);

  // OnefopAnalyticsFacade.getDashboard returns the employment aggregate
  // under `employmentSummary` (PermanentEmployeeSummary: totalPermanentEmployees,
  // totalVacancies, vacancyRate, reportingEntities) — `employment` is kept
  // as a fallback for older/alternate API shapes.
  final employment = d['employmentSummary'] is Map
      ? _safeMap(d['employmentSummary'])
      : (d['employment'] is Map ? _safeMap(d['employment']) : d);

  final topSectors = await _fetchTopSectorsByEmployees(
      api, period, region, department, subdivision, entityType, sector);

  final genderSplit = await _fetchApplicantGenderSplit(
      api, period, region, department, subdivision, entityType, sector);
  final genderTotal = genderSplit.male + genderSplit.female;
  final femalePct =
      genderTotal > 0 ? genderSplit.female / genderTotal * 100 : 0.0;
  final malePct = genderTotal > 0 ? genderSplit.male / genderTotal * 100 : 0.0;

  // Total recruitments is not provided as a flat field by this endpoint —
  // youthShareOfRecruitment.totalHires is the same underlying figure
  // (total hires across the period) and is always populated.
  final youthShare = d['youthShareOfRecruitment'] is Map
      ? _safeMap(d['youthShareOfRecruitment'])
      : <String, dynamic>{};
  final totalRecruitments = (d['totalRecruitments'] as num?)?.toInt() ??
      (employment['totalRecruitments'] as num?)?.toInt() ??
      (youthShare['totalHires'] as num?)?.toInt() ??
      0;

  final departures = await _fetchDepartureTotals(
      api, period, region, department, subdivision, entityType, sector);

  return DashboardSummary.fromJson({
    'year': period.year ?? DateTime.now().year,
    'region': region ?? 'National',
    // The dashboard endpoint has no `totalCompanies` field (that key only
    // exists in an unused DTO) — `submissionCount` is the real count of
    // resolved submissions for this filter, i.e. the declaring companies.
    'totalDeclarations': d['submissionCount'] ?? 0,
    'totalEmployees': employment['totalPermanentEmployees'] ??
        employment['totalEmployees'] ??
        d['totalEmployees'] ??
        0,
    'employmentGrowthRate': 0.0, // ONEFOP dashboard doesn't compute YoY
    'genderDistribution': {
      'male': malePct,
      'female': femalePct,
    },
    'topSectors': topSectors
        .map((s) => {'sector': s.sector, 'employees': s.employees})
        .toList(),
    'totalRecruitments': totalRecruitments,
    'totalDismissals': departures.dismissals,
    'totalRetirements': departures.retirements,
    'totalPromotions': 0,
    'netChange': totalRecruitments - departures.total,
  });
}

/// Current-year ONEFOP KPI summary.
final onefopDashboardSummaryProvider =
    FutureProvider.family<DashboardSummary, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchDashboardSummaryData(
      api, period, region, department, subdivision, entityType, sector);
});

/// National-scope counterpart of [onefopDashboardSummaryProvider] — always
/// omits region/department/subdivision so the Synthèse tab can show each
/// KPI's share of the national total ("vs national average" benchmark)
/// regardless of which geographic filter is active. Entity type and sector
/// are kept so the comparison stays apples-to-apples on entity/sector,
/// isolating only the geographic effect.
final onefopNationalSummaryProvider =
    FutureProvider.family<DashboardSummary, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchDashboardSummaryData(
      api, period, null, null, null, entityType, sector);
});

/// Previous-year summary for YoY KPI deltas.
final onefopPreviousYearSummaryProvider =
    FutureProvider.family<DashboardSummary, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  final previousPeriod = period.previousYearPeriod;

  final response = await api.get(
    '/onefop-analytics/dashboard',
    queryParameters: {
      ...previousPeriod.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final d = _safeMap(response.data);
  final employment = d['employmentSummary'] is Map
      ? _safeMap(d['employmentSummary'])
      : (d['employment'] is Map ? _safeMap(d['employment']) : d);

  final genderSplit = await _fetchApplicantGenderSplit(
      api, previousPeriod, region, department, subdivision, entityType, sector);
  final genderTotal = genderSplit.male + genderSplit.female;
  final femalePct =
      genderTotal > 0 ? genderSplit.female / genderTotal * 100 : 0.0;
  final malePct = genderTotal > 0 ? genderSplit.male / genderTotal * 100 : 0.0;

  final youthShare = d['youthShareOfRecruitment'] is Map
      ? _safeMap(d['youthShareOfRecruitment'])
      : <String, dynamic>{};
  final totalRecruitments = (d['totalRecruitments'] as num?)?.toInt() ??
      (employment['totalRecruitments'] as num?)?.toInt() ??
      (youthShare['totalHires'] as num?)?.toInt() ??
      0;

  final departures = await _fetchDepartureTotals(
      api, previousPeriod, region, department, subdivision, entityType, sector);

  return DashboardSummary.fromJson({
    'year': (period.year ?? DateTime.now().year) - 1,
    'region': region ?? 'National',
    'totalDeclarations': d['submissionCount'] ?? 0,
    'totalEmployees': employment['totalPermanentEmployees'] ??
        employment['totalEmployees'] ??
        d['totalEmployees'] ??
        0,
    'employmentGrowthRate': 0.0,
    'genderDistribution': {
      'male': malePct,
      'female': femalePct,
    },
    'topSectors': [],
    'totalRecruitments': totalRecruitments,
    'totalDismissals': departures.dismissals,
    'totalRetirements': departures.retirements,
    'totalPromotions': 0,
    'netChange': totalRecruitments - departures.total,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — NET EMPLOYMENT TREND (for the "Évolution de la
// variation nette" chart on the Synthèse tab)
// GET /onefop-analytics/net-employment-trends
//
// Deliberately NOT total headcount over time: ONEFOP's periodic survey
// only ever reports each entity's *current* permanent headcount at
// submission time, there's no historical stock series to draw from (see
// EmploymentAnalyticsService.getPermanentEmployeeSummary — one aggregate
// for the whole filtered set, not bucketed by period). And deliberately
// NOT raw recruitment volume either — that ignores departures and would
// only ever go up. This is recruitments minus departures per period,
// matching what the insight banner and "Variation nette" KPI already
// headline for the current period, just shown as a trend instead of one
// snapshot. `totalEmployees` below carries the (possibly negative)
// netChange value — same field-reuse pattern the rest of this file
// already uses for other charts, not a literal headcount.
// ═══════════════════════════════════════════════════════════════

final _onefopTrendsProvider = FutureProvider.family<
    List<TimeSeriesData>,
    ({
      int startYear,
      int endYear,
      String? regionId,
      String? departmentId,
      String? subdivisionId,
      String? entityType,
      String? sector,
      Granularity granularity,
    })>((ref, p) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get(
    '/onefop-analytics/net-employment-trends',
    queryParameters: {
      'startYear': p.startYear,
      'endYear': p.endYear,
      if (p.regionId != null) 'region': p.regionId,
      if (p.departmentId != null) 'department': p.departmentId,
      if (p.subdivisionId != null) 'subdivision': p.subdivisionId,
      if (p.entityType != null) 'entityType': p.entityType,
      if (p.sector != null) 'sector': p.sector,
      'granularity': p.granularity.name,
    },
  );
  return _safeList(response.data).map((e) {
    final m = _safeMap(e);
    final yearValue = (m['year'] as num?)?.toInt() ??
        int.tryParse(m['period']?.toString().split('-').first ?? '') ??
        0;
    final period = m['period']?.toString() ?? '';
    final label = m['label']?.toString() ??
        (period.isEmpty ? yearValue.toString() : '$yearValue $period');
    return TimeSeriesData.fromJson({
      'year': yearValue,
      'period': period,
      'shortLabel': label,
      'totalEmployees': (m['netChange'] as num?)?.toInt() ?? 0,
    });
  }).toList();
});

/// UI-facing wrapper that reads current filter state.
final onefopFilteredTrendsProvider =
    FutureProvider<List<TimeSeriesData>>((ref) {
  final params = (
    startYear: ref.watch(startYearProvider),
    endYear: ref.watch(endYearProvider),
    regionId: ref.watch(effectiveRegionProvider),
    departmentId: ref.watch(effectiveDepartmentProvider),
    subdivisionId: ref.watch(subdivisionIdProvider),
    entityType: ref.watch(entityTypeProvider),
    sector: ref.watch(sectorProvider),
    granularity: ref.watch(granularityProvider),
  );
  return ref.watch(_onefopTrendsProvider(params).future);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — SECTOR DISTRIBUTION
// GET /onefop-analytics/vacancies?groupBy=sector
// ═══════════════════════════════════════════════════════════════

final onefopSectorsProvider =
    FutureProvider.family<List<Sector>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/vacancies',
    queryParameters: {
      ...period.toApiParams(),
      'groupBy': 'sector',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data).map((e) {
    final m = _safeMap(e);
    return Sector.fromJson({
      'sector': m['segment'] ?? '—',
      'employees': m['totalVacancies'] ?? 0,
      'male': 0,
      'female': 0,
    });
  }).toList();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — GENDER DISTRIBUTION
// GET /onefop-analytics/gender-parity
// Returns a single-entry list (national or filtered scope).
// ═══════════════════════════════════════════════════════════════

final onefopGenderDistributionProvider =
    FutureProvider.family<List<GenderRegion>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/gender-parity',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final d = response.data is List
      ? _safeMap((response.data as List).isNotEmpty ? response.data[0] : {})
      : _safeMap(response.data);
  final male = (d['maleApplicants'] as num?)?.toInt() ?? 0;
  final female = (d['femaleApplicants'] as num?)?.toInt() ?? 0;

  return [
    GenderRegion.fromJson({
      'region': region ?? 'National',
      'male': male,
      'female': female,
      'other': 0,
      'total': male + female,
    }),
  ];
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — REGIONAL BREAKDOWN
// GET /onefop-analytics/employment?groupBy=region
// ═══════════════════════════════════════════════════════════════

final onefopRegionalProvider =
    FutureProvider.family<List<GenderRegion>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/employment',
    queryParameters: {
      ...period.toApiParams(),
      'groupBy': 'region',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data).map((e) {
    final m = _safeMap(e);
    return GenderRegion.fromJson({
      'region': m['name'] ?? '—',
      'male': 0,
      'female': 0,
      'other': 0,
      'total': m['totalEmployees'] ?? 0,
    });
  }).toList();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — INCLUSION METRICS
// GET /onefop-analytics/inclusion?breakdownBy=both
// ═══════════════════════════════════════════════════════════════

/// Shared by [onefopInclusionProvider] and [onefopNationalInclusionProvider]
/// — same lesson as [_fetchDashboardSummaryData]: one fetch body, not two,
/// so the national baseline can't silently drop a filter the real one has.
Future<VulnerableInclusion> _fetchInclusionData(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/inclusion',
    queryParameters: {
      ...period.toApiParams(),
      'breakdownBy': 'both',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  final d = _safeMap(response.data);

  // vulnerableByType may be returned as a Map or as a List of { vulnerableType, _sum }
  final dynamic vRaw = d['vulnerableByType'];
  final Map<String, int> byType = {};
  if (vRaw is Map) {
    vRaw.forEach((k, v) {
      byType[k.toString()] = (v as num?)?.toInt() ?? 0;
    });
  } else if (vRaw is Iterable) {
    for (final item in vRaw) {
      final m = _safeMap(item);
      final key = m['vulnerableType']?.toString() ?? '';
      final count = (m['_sum'] is Map && m['_sum']['value'] is num)
          ? (m['_sum']['value'] as num).toInt()
          : (m['count'] as num?)?.toInt() ?? (m['value'] as num?)?.toInt() ?? 0;
      if (key.isNotEmpty) byType[key] = (byType[key] ?? 0) + count;
    }
  }

  // disabledByCsp may also be a Map or a List of { cspCategory, _sum }
  final dynamic cRaw = d['disabledByCsp'];
  final Map<String, int> byCsp = {};
  if (cRaw is Map) {
    cRaw.forEach((k, v) {
      byCsp[k.toString()] = (v as num?)?.toInt() ?? 0;
    });
  } else if (cRaw is Iterable) {
    for (final item in cRaw) {
      final m = _safeMap(item);
      final key = m['cspCategory']?.toString() ?? '';
      final count = (m['_sum'] is Map && m['_sum']['value'] is num)
          ? (m['_sum']['value'] as num).toInt()
          : (m['count'] as num?)?.toInt() ?? (m['value'] as num?)?.toInt() ?? 0;
      if (key.isNotEmpty) byCsp[key] = (byCsp[key] ?? 0) + count;
    }
  }

  return VulnerableInclusion.fromJson({
    'total': d['vulnerable'] ?? 0,
    'internalDisplaced': byType['DEPLACES_INTERNES'] ?? 0,
    'refugees': byType['REFUGIES'] ?? 0,
    'orphans': byType['ORPHELINS'] ?? 0,
    'byCsp': byCsp,
    'totalHires': d['totalHires'] ?? 0,
  });
}

final onefopInclusionProvider =
    FutureProvider.family<VulnerableInclusion, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchInclusionData(
      api, period, region, department, subdivision, entityType, sector);
});

/// National-scope counterpart — see [onefopNationalSummaryProvider] for why
/// region/department/subdivision are forced null while entityType/sector
/// are kept (isolates the geographic effect for the benchmarking tab).
final onefopNationalInclusionProvider =
    FutureProvider.family<VulnerableInclusion, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchInclusionData(api, period, null, null, null, entityType, sector);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — DIPLOMA DISTRIBUTION
// GET /onefop-analytics/hires/diploma
//
// Screen accesses: (list as dynamic).data → items with
//   .diploma  .male  .female  .total
// ═══════════════════════════════════════════════════════════════

final onefopDiplomaProvider =
    FutureProvider.family<_OnefopDiplomaResult, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/hires/diploma',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  final list = _safeList(response.data).map((e) => _safeMap(e)).toList();
  return _OnefopDiplomaResult(
    list
        .map((e) => _DiplomaItem(
              diploma: e['diploma']?.toString() ?? '—',
              male: 0, // endpoint returns total only, no gender split
              female: 0,
              total: (e['hires'] as num?)?.toInt() ??
                  (e['total'] as num?)?.toInt() ??
                  0,
            ))
        .toList(),
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION 8 — TRAINING / SKILLS GAP
// GET /onefop-analytics/training-gap
//
// Screen accesses: (d as dynamic).topSkills, .topDomains,
//   .vacationInternships, .academicInternships, etc.
// ═══════════════════════════════════════════════════════════════

final onefopTrainingProvider =
    FutureProvider.family<_OnefopTrainingData, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/training-gap',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  final d = _safeMap(response.data);

  final topSkills =
      _safeList(d['skillsInDemand']).map<Map<String, dynamic>>((s) {
    final m = _safeMap(s);
    return {
      'skill': m['skill'],
      'count': m['demand'] ?? 0,
      'demand': m['demand'] ?? 0,
      'supply': m['supply'] ?? 0,
      'gap': m['gap'] ?? 0,
    };
  }).toList();

  // skillsInSurplus doubles as "training domains available"
  final topDomains =
      _safeList(d['skillsInSurplus']).map<Map<String, dynamic>>((s) {
    final m = _safeMap(s);
    return {
      'domain': m['skill'],
      'count': m['supply'] ?? 0,
      'demand': m['demand'] ?? 0,
      'supply': m['supply'] ?? 0,
      'gap': m['gap'] ?? 0,
    };
  }).toList();

  final internshipsResponse = await api.get(
    '/onefop-analytics/internships',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  final internshipRows =
      _safeList(internshipsResponse.data).map((e) => _safeMap(e)).toList();

  int vacation = 0, academic = 0, professional = 0, preEmployment = 0;
  for (final row in internshipRows) {
    final type = row['internshipType']?.toString() ?? '';
    final count = (row['count'] as num?)?.toInt() ?? 0;
    switch (type) {
      case 'VACATION':
        vacation += count;
        break;
      case 'ACADEMIC':
        academic += count;
        break;
      case 'PROFESSIONAL':
        professional += count;
        break;
      case 'PRE_EMPLOYMENT':
        preEmployment += count;
        break;
    }
  }

  return _OnefopTrainingData(
    topSkills: topSkills,
    topDomains: topDomains,
    vacationInternships: vacation,
    academicInternships: academic,
    professionalInternships: professional,
    preEmploymentInternships: preEmployment,
    totalInternships: vacation + academic + professional + preEmployment,
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION 9 — FIRST-TIME EMPLOYMENT
// GET /onefop-analytics/hires  +  /onefop-analytics/youth-employment
// ═══════════════════════════════════════════════════════════════
// This tab is about the first-time job-seeker funnel (S23Q01 registered vs
// S23Q02 recruited) — NOT general enterprise hires (S22Q01/02). Using
// /hires + /youth-employment here made "Taux de conversion" structurally
// ~100% (hires divided by hires) and fabricated the age split via a fixed
// 60/40 ratio. /first-time-labor-gap + the raw /registered-seekers and
// /first-time-workers rows give the real S23 figures instead.
final onefopFirstTimeEmploymentProvider =
    FutureProvider.family<FirstTimeEmployment, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final qp = {
    ...period.toApiParams(),
    if (region != null) 'region': region,
    if (department != null) 'department': department,
    if (subdivision != null) 'subdivision': subdivision,
    if (entityType != null) 'entityType': entityType,
    if (sector != null) 'sector': sector,
  };

  final results = await Future.wait([
    api.get('/onefop-analytics/first-time-labor-gap', queryParameters: qp),
    api.get('/onefop-analytics/registered-seekers', queryParameters: qp),
    api.get('/onefop-analytics/first-time-workers', queryParameters: qp),
  ]);

  // { registered, recruited, absorptionRate, byCsp } — authoritative totals
  final gap = _safeMap(results[0].data);

  // Rows: { contractType, cspCategory, gender, ageBand, count }, crossed
  // across all four dimensions — every read below pins the other three
  // dimensions to TOTAL so the requested one isn't double-counted.
  final seekerRows = _safeList(results[1].data).map((e) => _safeMap(e)).toList();
  final recruitRows = _safeList(results[2].data).map((e) => _safeMap(e)).toList();

  int seekersMale = 0, seekersFemale = 0;
  for (final r in seekerRows) {
    if (r['contractType'] != 'TOTAL' ||
        r['cspCategory'] != 'TOTAL' ||
        r['ageBand'] != 'TOTAL') {
      continue;
    }
    final count = (r['count'] as num?)?.toInt() ?? 0;
    if (r['gender'] == 'MALE') seekersMale += count;
    if (r['gender'] == 'FEMALE') seekersFemale += count;
  }

  int recruitsMale = 0, recruitsFemale = 0;
  int age15 = 0, age25 = 0, age35 = 0;
  int permanent = 0, temporary = 0;
  for (final r in recruitRows) {
    final count = (r['count'] as num?)?.toInt() ?? 0;
    final contractType = r['contractType']?.toString() ?? '';
    final cspCategory = r['cspCategory']?.toString() ?? '';
    final ageBand = r['ageBand']?.toString() ?? '';
    final gender = r['gender']?.toString() ?? '';

    if (contractType == 'TOTAL' && cspCategory == 'TOTAL' && ageBand == 'TOTAL') {
      if (gender == 'MALE') recruitsMale += count;
      if (gender == 'FEMALE') recruitsFemale += count;
    }
    if (contractType == 'TOTAL' && cspCategory == 'TOTAL' && gender == 'TOTAL') {
      switch (ageBand) {
        case 'AGE_15_24':
          age15 += count;
          break;
        case 'AGE_25_34':
          age25 += count;
          break;
        case 'AGE_35_PLUS':
          age35 += count;
          break;
      }
    }
    if (cspCategory == 'TOTAL' && gender == 'TOTAL' && ageBand == 'TOTAL') {
      if (contractType == 'PERMANENT') permanent += count;
      if (contractType == 'TEMPORARY') temporary += count;
    }
  }

  final seekersTotal =
      (gap['registered'] as num?)?.toInt() ?? (seekersMale + seekersFemale);
  final recruitsTotal =
      (gap['recruited'] as num?)?.toInt() ?? (recruitsMale + recruitsFemale);
  final conversionRate = (gap['absorptionRate'] as num?)?.toDouble() ??
      (seekersTotal > 0 ? recruitsTotal / seekersTotal * 100 : 0.0);

  return FirstTimeEmployment.fromJson({
    'seekersTotal': seekersTotal,
    'seekersMale': seekersMale,
    'seekersFemale': seekersFemale,
    'recruitsTotal': recruitsTotal,
    'recruitsMale': recruitsMale,
    'recruitsFemale': recruitsFemale,
    'conversionRate': conversionRate,
    'recruitsAge15_24': age15,
    'recruitsAge25_34': age25,
    'recruitsAge35Plus': age35,
    'recruitsPermanent': permanent,
    'recruitsTemporary': temporary,
  });
});
// ═══════════════════════════════════════════════════════════════
// SECTION 10 — ENTITY SIZE
// GET /onefop-analytics/employment-by-size
// Counts ALL reporting enterprises by S1Q12 size category (TPE/PE/ME/GE),
// not just those with posted vacancies — more complete than grouping
// /vacancies by enterpriseSize.
//
// Screen accesses: (sz as dynamic).tpe / .pe / .me / .ge / .total
// EntitySizeItem has exactly those fields.
// ═══════════════════════════════════════════════════════════════

final onefopEntitySizeProvider =
    FutureProvider.family<EntitySizeItem, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/employment-by-size',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  int tpe = 0, pe = 0, me = 0, ge = 0;
  for (final item in _safeList(response.data).map((e) => _safeMap(e))) {
    final count = (item['entityCount'] as num?)?.toInt() ?? 0;
    switch (item['sizeCategory']?.toString()) {
      case 'TPE':
        tpe = count;
        break;
      case 'PE':
        pe = count;
        break;
      case 'ME':
        me = count;
        break;
      case 'GE':
        ge = count;
        break;
    }
  }
  return EntitySizeItem.fromJson({
    'tpe': tpe,
    'pe': pe,
    'me': me,
    'ge': ge,
    'total': tpe + pe + me + ge,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 11 — ENTITY BREAKDOWN
// GET /onefop-analytics/employment-by-entity-type
// formType is the canonical discriminator on OnefopSubmission — always
// populated, unlike the per-entity detail tables which only exist for the
// matching form type.
// Screen accesses: (bd as dynamic).enterprises.count / .employees
//   .cooperatives.count / .ctds.count / .ongs.count
// ═══════════════════════════════════════════════════════════════

final onefopEntityBreakdownProvider =
    FutureProvider.family<_OnefopEntityBreakdown, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/employment-by-entity-type',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  const zero = _EntityGroup(count: 0, employees: 0);
  final byType = <String, _EntityGroup>{};
  for (final row in _safeList(response.data).map((e) => _safeMap(e))) {
    final type = row['entityType']?.toString() ?? '';
    byType[type] = _EntityGroup(
      count: (row['entityCount'] as num?)?.toInt() ?? 0,
      employees: (row['totalPermanentEmployees'] as num?)?.toInt() ?? 0,
    );
  }

  return _OnefopEntityBreakdown(
    enterprises: byType['ENTREPRISE'] ?? zero,
    cooperatives: byType['COOPERATIVE'] ?? zero,
    ctds: byType['CTD'] ?? zero,
    ongs: byType['ONG'] ?? zero,
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION 12 — REAL MOVEMENTS & DEPARTURES
// ═══════════════════════════════════════════════════════════════

// ── Real departure summary ─────────────────────────────────────
final onefopDeparturesProvider =
    FutureProvider.family<DeparturesMobility, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/departure-summary',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final list = _safeList(response.data).map((e) => _safeMap(e)).toList();

  int dismissals = 0;
  int resignations = 0;
  int retirements = 0;
  int other = 0;
  final Map<String, int> byCsp = {};

  for (final item in list) {
    final type = (item['departureType'] as String? ?? '').toUpperCase();
    final count = (item['total'] as num?)?.toInt() ?? 0;
    switch (type) {
      case 'DISMISSAL':
        dismissals = count;
        break;
      case 'RESIGNATION':
        resignations = count;
        break;
      case 'RETIREMENT':
        retirements = count;
        break;
      case 'OTHER':
        other = count;
        break;
    }
  }

  final total = dismissals + resignations + retirements + other;

  return DeparturesMobility.fromJson({
    'dismissals': dismissals,
    'resignations': resignations,
    'retirements': retirements,
    'other': other,
    'total': total,
    'byCsp': byCsp,
  });
});

// ── Mobility dashboard (turnover / retention rates vs. workforce) ─
Future<MobilityDashboard> _fetchMobilityDashboardData(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/mobility-dashboard',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return MobilityDashboard.fromJson(_safeMap(response.data));
}

final onefopMobilityDashboardProvider =
    FutureProvider.family<MobilityDashboard, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchMobilityDashboardData(
      api, period, region, department, subdivision, entityType, sector);
});

/// National-scope counterpart — see [onefopNationalSummaryProvider].
final onefopNationalMobilityDashboardProvider =
    FutureProvider.family<MobilityDashboard, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchMobilityDashboardData(
      api, period, null, null, null, entityType, sector);
});

// ── Dismissal reasons ─────────────────────────────────────────
final onefopDismissalReasonsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/dismissal-reasons',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  return _safeList(response.data)
      .map((e) => _safeMap(e))
      .where((m) => (m['totalCount'] as num? ?? 0) > 0)
      .toList();
});

// ── Technical unemployment ────────────────────────────────────
final onefopTechnicalUnemploymentProvider =
    FutureProvider.family<Map<String, dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/dismissal-unemployment',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final list = _safeList(response.data).map((e) => _safeMap(e)).toList();

  int technicalTotal = 0;
  int dismissalTotal = 0;
  final Map<String, int> techByCsp = {};

  for (final item in list) {
    final type = (item['type'] as String? ?? '').toUpperCase();
    final csp = item['cspCategory'] as String? ?? '';
    final gender = (item['gender'] as String? ?? '').toUpperCase();
    final count = (item['count'] as num?)?.toInt() ?? 0;

    if (gender != 'TOTAL') continue;

    if (type == 'TECHNICAL_UNEMPLOYMENT') {
      technicalTotal += count;
      if (csp != 'TOTAL') {
        techByCsp[csp] = (techByCsp[csp] ?? 0) + count;
      }
    } else if (type == 'DISMISSAL') {
      dismissalTotal += count;
    }
  }

  String? mostAffectedCsp;
  int mostAffectedCount = 0;
  techByCsp.forEach((k, v) {
    if (v > mostAffectedCount) {
      mostAffectedCount = v;
      mostAffectedCsp = k;
    }
  });

  final grandTotal = technicalTotal + dismissalTotal;
  final techShare = grandTotal > 0 ? technicalTotal / grandTotal : 0.0;

  return {
    'technicalTotal': technicalTotal,
    'dismissalTotal': dismissalTotal,
    'grandTotal': grandTotal,
    'techShare': techShare,
    'techByCsp': techByCsp,
    'mostAffectedCsp': mostAffectedCsp,
    'mostAffectedCount': mostAffectedCount,
  };
});

// ── Employment balance ─────────────────────────────────────────
final onefopEmploymentBalanceProvider =
    FutureProvider.family<EmploymentBalance, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  final resolvedYear = period.year ?? DateTime.now().year;

  final qp = {
    ...period.toApiParams(),
    if (region != null) 'region': region,
    if (department != null) 'department': department,
    if (subdivision != null) 'subdivision': subdivision,
    if (entityType != null) 'entityType': entityType,
    if (sector != null) 'sector': sector,
  };

  final results = await Future.wait([
    api.get('/onefop-analytics/recruitment-trends', queryParameters: {
      ...qp,
      'startYear': resolvedYear,
      'endYear': resolvedYear,
      'granularity': 'year',
    }),
    api.get('/onefop-analytics/departure-summary', queryParameters: qp),
    api.get('/onefop-analytics/dismissal-unemployment', queryParameters: qp),
  ]);

  final trendList = _safeList(results[0].data).map((e) => _safeMap(e)).toList();
  int permanent = 0;
  int temporary = 0;
  for (final t in trendList) {
    permanent += (t['permanentRecruitments'] as num?)?.toInt() ?? 0;
    temporary += (t['temporaryRecruitments'] as num?)?.toInt() ?? 0;
  }
  final jobsCreated = permanent + temporary;

  final departures = _parseDepartureBreakdown(results[1].data);
  final dismissals = departures.dismissals;
  final resignations = departures.resignations;
  final retirements = departures.retirements;
  final other = departures.other;
  final jobsLost = dismissals + resignations + retirements + other;

  final techList = _safeList(results[2].data).map((e) => _safeMap(e)).toList();
  int techUnemployment = 0;
  for (final t in techList) {
    final type = (t['type'] as String? ?? '').toUpperCase();
    final gender = (t['gender'] as String? ?? '').toUpperCase();
    if (type == 'TECHNICAL_UNEMPLOYMENT' && gender == 'TOTAL') {
      techUnemployment += (t['count'] as num?)?.toInt() ?? 0;
    }
  }

  final netChange = jobsCreated - jobsLost;
  final avgWorkforce = jobsCreated > 0 ? jobsCreated.toDouble() : 1.0;

  return EmploymentBalance.fromJson({
    'jobsCreated': jobsCreated,
    'jobsLost': jobsLost,
    'netChange': netChange,
    'averageWorkforce': avgWorkforce,
    'dismissals': dismissals,
    'resignations': resignations,
    'retirements': retirements,
    'other': other,
    'technicalUnemployment': techUnemployment,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 12.5 — LABOR MARKET TENSION
// GET /onefop-analytics/labor-market-tension
// ═══════════════════════════════════════════════════════════════

Future<LaborMarketTension> _fetchLaborMarketData(
  dynamic api,
  PeriodConfig period,
  String? region,
  String? department,
  String? subdivision,
  String? entityType,
  String? sector,
) async {
  final response = await api.get(
    '/onefop-analytics/labor-market-tension',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return LaborMarketTension.fromJson(_safeMap(response.data));
}

final onefopLaborMarketProvider =
    FutureProvider.family<LaborMarketTension, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchLaborMarketData(
      api, period, region, department, subdivision, entityType, sector);
});

/// National-scope counterpart — see [onefopNationalSummaryProvider].
final onefopNationalLaborMarketProvider =
    FutureProvider.family<LaborMarketTension, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  return _fetchLaborMarketData(
      api, period, null, null, null, entityType, sector);
});

/// Contract-type distribution — not in ONEFOP form.
final onefopContractTypeProvider =
    FutureProvider.family<ContractDistribution, PeriodConfig>((ref, _) async {
  return ContractDistribution.fromJson({'permanent': 0, 'temporary': 0});
});

// ── Workforce Structure ─────────────────────────────────────
final onefopVacanciesProvider =
    FutureProvider.family<List<dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/vacancies',
    queryParameters: {
      ...period.toApiParams(),
      'groupBy': 'sector',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data);
});

final onefopEmploymentSummaryProvider =
    FutureProvider.family<PermanentEmployeeSummary, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/employment-summary',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return PermanentEmployeeSummary.fromJson(_safeMap(response.data));
});

// CSP breakdown only exists for recruitment flows (S22Q01/S22Q02) — there
// is no CSP breakdown of the permanent employee stock. This is therefore a
// recruitment profile (new hires by CSP), not a workforce stock snapshot.
final onefopRecruitmentCspProfileProvider =
    FutureProvider.family<Map<String, dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/hires-by-demographics',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );

  final rows = _safeList(response.data).map((e) => _safeMap(e)).toList();

  int cadres = 0, foremen = 0, workers = 0;
  final byCspGender = <String, Map<String, int>>{};

  for (final r in rows) {
    final csp = r['cspCategory']?.toString() ?? '';
    final gender = r['gender']?.toString() ?? '';
    final count = (r['count'] as num?)?.toInt() ?? 0;

    switch (csp) {
      case 'CADRES':
        cadres += count;
        break;
      case 'FOREMEN':
        foremen += count;
        break;
      case 'WORKERS':
        workers += count;
        break;
    }

    final bucket =
        byCspGender.putIfAbsent(csp, () => {'maleCount': 0, 'femaleCount': 0});
    if (gender == 'MALE') {
      bucket['maleCount'] = (bucket['maleCount'] ?? 0) + count;
    } else if (gender == 'FEMALE') {
      bucket['femaleCount'] = (bucket['femaleCount'] ?? 0) + count;
    }
  }

  return {
    'totalHires': cadres + foremen + workers,
    'cadres': cadres,
    'foremen': foremen,
    'workers': workers,
    'byCsp': byCspGender.entries
        .map((e) => {
              'cspCategory': e.key,
              'maleCount': e.value['maleCount'],
              'femaleCount': e.value['femaleCount'],
            })
        .toList(),
  };
});

final onefopRecruitmentTrendsProvider =
    FutureProvider.family<List<dynamic>, ({int year, String granularity})>(
        (ref, params) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);
  final startYear = params.year - 2;
  final endYear = params.year;

  final response = await api.get(
    '/onefop-analytics/recruitment-trends',
    queryParameters: {
      'startYear': startYear,
      'endYear': endYear,
      'granularity': params.granularity,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data);
});

final onefopYouthProvider =
    FutureProvider.family<Map<String, dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/youth-employment',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeMap(response.data);
});

final onefopFirstTimeProvider =
    FutureProvider.family<List<dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/first-time-workers',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data);
});

final onefopDismissalUnemploymentProvider =
    FutureProvider.family<List<dynamic>, PeriodConfig>((ref, period) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);
  final subdivision = ref.watch(subdivisionIdProvider);
  final entityType = ref.watch(entityTypeProvider);
  final sector = ref.watch(sectorProvider);

  final response = await api.get(
    '/onefop-analytics/dismissal-unemployment',
    queryParameters: {
      ...period.toApiParams(),
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      if (subdivision != null) 'subdivision': subdivision,
      if (entityType != null) 'entityType': entityType,
      if (sector != null) 'sector': sector,
    },
  );
  return _safeList(response.data);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 13 — GLOBAL REFRESH HELPER
// ═══════════════════════════════════════════════════════════════

void onefopRefreshAll(WidgetRef ref) {
  final filter = ref.read(dashboardFilterProvider);
  final period = filter.period;

  final providersToInvalidate = [
    onefopDashboardSummaryProvider(period),
    onefopPreviousYearSummaryProvider(period),
    onefopEmploymentBalanceProvider(period),
    onefopFirstTimeEmploymentProvider(period),
    onefopSectorsProvider(period),
    onefopGenderDistributionProvider(period),
    onefopLaborMarketProvider(period),
    onefopDeparturesProvider(period),
    onefopMobilityDashboardProvider(period),
    onefopDismissalReasonsProvider(period),
    onefopTechnicalUnemploymentProvider(period),
    onefopContractTypeProvider(period),
    onefopInclusionProvider(period),
    onefopDiplomaProvider(period),
    onefopTrainingProvider(period),
    onefopEntityBreakdownProvider(period),
    onefopEntitySizeProvider(period),
    onefopVacanciesProvider(period),
    onefopEmploymentSummaryProvider(period),
    onefopRecruitmentCspProfileProvider(period),
    onefopYouthProvider(period),
    onefopFirstTimeProvider(period),
    onefopDismissalUnemploymentProvider(period),
  ];

  for (final provider in providersToInvalidate) {
    ref.invalidate(provider);
  }

  ref.invalidate(onefopRecruitmentTrendsProvider(
    (year: period.year ?? DateTime.now().year, granularity: 'year'),
  ));
  ref.invalidate(onefopDashboardBundleProvider);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 14 — DASHBOARD BUNDLE
// ═══════════════════════════════════════════════════════════════

final onefopDashboardBundleProvider =
    FutureProvider<DashboardBundle>((ref) async {
  final filter = ref.watch(dashboardFilterProvider);
  final period = filter.period;

  // Fire all sub-fetches concurrently instead of one-at-a-time — the
  // sequential `await` chain this replaced turned ~15 independent API
  // calls into ~15 back-to-back round trips on every dashboard load.
  final results = await Future.wait([
    ref.watch(onefopDashboardSummaryProvider(period).future),
    _safeProviderFuture(ref.watch(onefopPreviousYearSummaryProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopFilteredTrendsProvider.future)),
    _safeProviderFuture(ref.watch(onefopSectorsProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopGenderDistributionProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopEmploymentBalanceProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopFirstTimeEmploymentProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopLaborMarketProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopDeparturesProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopContractTypeProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopInclusionProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopDiplomaProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopTrainingProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopEntityBreakdownProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopEntitySizeProvider(period).future)),
    _safeProviderFuture(ref.watch(onefopRecruitmentCspProfileProvider(period).future)),
  ]);

  final dashboard = results[0] as DashboardSummary;
  final previous = results[1] as DashboardSummary?;
  final trends = (results[2] as List<TimeSeriesData>?) ?? <TimeSeriesData>[];
  final sectors = (results[3] as List<Sector>?) ?? <Sector>[];
  final gender = (results[4] as List<GenderRegion>?) ?? <GenderRegion>[];
  final employmentBalance = results[5] as EmploymentBalance?;
  final firstTimeEmployment = results[6] as FirstTimeEmployment?;
  final laborMarketGap = results[7] as LaborMarketTension?;
  final departuresMobility = results[8] as DeparturesMobility?;
  final contractDistribution = results[9] as ContractDistribution?;
  final vulnerableInclusion = results[10] as VulnerableInclusion?;
  final diplomaResult = results[11] as _OnefopDiplomaResult?;
  final trainingData = results[12] as _OnefopTrainingData?;
  final entityResult = results[13] as _OnefopEntityBreakdown?;
  final entitySize = results[14] as EntitySizeItem?;
  final cspProfileData = results[15] as Map<String, dynamic>?;

  final cspProfile = cspProfileData == null
      ? null
      : (
          totalHires: (cspProfileData['totalHires'] as num?)?.toInt() ?? 0,
          cadres: (cspProfileData['cadres'] as num?)?.toInt() ?? 0,
          foremen: (cspProfileData['foremen'] as num?)?.toInt() ?? 0,
          workers: (cspProfileData['workers'] as num?)?.toInt() ?? 0,
        );

  final diplomaBreakdown = <({String diploma, int count})>[
    for (final item in diplomaResult?.data ?? const <_DiplomaItem>[])
      if (item.total > 0) (diploma: item.diploma, count: item.total),
  ]..sort((a, b) => b.count.compareTo(a.count));

  final topSkills = trainingData?.topSkills
          .map((item) => SkillTraining(
                skill: item['skill']?.toString() ?? '',
                demand: (item['demand'] as num?)?.toInt() ?? 0,
                supply: (item['supply'] as num?)?.toInt() ?? 0,
                gap: (item['gap'] as num?)?.toInt() ?? 0,
                count: (item['count'] as num?)?.toInt() ?? 0,
              ))
          .toList() ??
      <SkillTraining>[];

  final topTraining = trainingData?.topDomains
          .map((item) => SkillTraining(
                skill: item['domain']?.toString() ?? '',
                demand: (item['demand'] as num?)?.toInt() ?? 0,
                supply: (item['supply'] as num?)?.toInt() ?? 0,
                gap: (item['gap'] as num?)?.toInt() ?? 0,
                count: (item['count'] as num?)?.toInt() ?? 0,
              ))
          .toList() ??
      <SkillTraining>[];

  final entityBreakdown = entityResult == null
      ? null
      : EntityBreakdown(
          enterprises: entityResult.enterprises.count,
          cooperatives: entityResult.cooperatives.count,
          ctds: entityResult.ctds.count,
          ongs: entityResult.ongs.count,
          total: entityResult.enterprises.count +
              entityResult.cooperatives.count +
              entityResult.ctds.count +
              entityResult.ongs.count,
        );

  return DashboardBundle(
    dashboard: dashboard,
    previous: previous,
    trends: trends,
    sectors: sectors,
    gender: gender,
    employmentBalance: employmentBalance,
    firstTimeEmployment: firstTimeEmployment,
    laborMarketGap: laborMarketGap,
    departuresMobility: departuresMobility,
    contractDistribution: contractDistribution,
    vulnerableInclusion: vulnerableInclusion,
    diplomaBreakdown: diplomaBreakdown,
    cspProfile: cspProfile,
    topSkills: topSkills.isEmpty ? null : topSkills,
    topTraining: topTraining.isEmpty ? null : topTraining,
    internshipPipeline: null,
    entityBreakdown: entityBreakdown,
    entitySize: entitySize,
  );
});
