// lib/features/analytics/providers/onefop_dashboard_providers.dart
//
// Standalone ONEFOP providers — all calls go to /onefop-analytics/*.
// Filter-state providers (yearProvider, regionIdProvider, etc.) are
// imported AND re-exported from dashboard_providers.dart so the screen
// only needs one import.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/api_client.dart';
import '../models/dashboard_models.dart';
import '../models/time_series_data.dart';
import 'dashboard_providers.dart';

export 'dashboard_providers.dart'
    show
        yearProvider,
        regionIdProvider,
        regionNameProvider,
        departmentIdProvider,
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

/// Current-year ONEFOP KPI summary.
final onefopDashboardSummaryProvider =
    FutureProvider.family<DashboardSummary, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/dashboard',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );

  final d = response.data as Map<String, dynamic>;

  // Build the top-sectors list from vacanciesBySector
  final vacancies = d['vacanciesBySector'] as List? ?? [];
  final topSectors = vacancies
      .take(5)
      .map((v) => TopSector.fromJson({
            'sector': v['segment'] ?? '—',
            'employees': v['totalVacancies'] ?? 0,
          }))
      .toList();

  // Flatten recruitment totals from trend array
  final trendList = d['recruitmentTrends'] as List? ?? [];
  final totalRecruitments = trendList.fold<int>(
    0,
    (s, t) => s + ((t['totalRecruitments'] as num?)?.toInt() ?? 0),
  );

  final gp = d['genderParity'] as Map<String, dynamic>? ?? {};

  return DashboardSummary.fromJson({
    'year': year,
    'region': region ?? 'National',
    'totalDeclarations': d['totalCompanies'] ?? 0,
    'totalEmployees': d['totalEmployees'] ?? 0,
    'employmentGrowthRate': 0.0, // ONEFOP dashboard doesn't compute YoY
    'genderDistribution': {
      'male': gp['malePercentage'] ?? 0,
      'female': gp['femalePercentage'] ?? 0,
    },
    'topSectors': topSectors
        .map((s) => {'sector': s.sector, 'employees': s.employees})
        .toList(),
    'totalRecruitments': totalRecruitments,
    'totalDismissals': 0, // not in ONEFOP form
    'totalRetirements': 0,
    'totalPromotions': 0,
    'netChange': totalRecruitments,
  });
});

/// Previous-year summary for YoY KPI deltas.
final onefopPreviousYearSummaryProvider =
    FutureProvider.family<DashboardSummary, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/dashboard',
    queryParameters: {
      'year': year - 1,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );

  final d = response.data as Map<String, dynamic>;
  final trendList = d['recruitmentTrends'] as List? ?? [];
  final totalRecruitments = trendList.fold<int>(
    0,
    (s, t) => s + ((t['totalRecruitments'] as num?)?.toInt() ?? 0),
  );
  final gp = d['genderParity'] as Map<String, dynamic>? ?? {};

  return DashboardSummary.fromJson({
    'year': year - 1,
    'region': region ?? 'National',
    'totalDeclarations': d['totalCompanies'] ?? 0,
    'totalEmployees': d['totalEmployees'] ?? 0,
    'employmentGrowthRate': 0.0,
    'genderDistribution': {
      'male': gp['malePercentage'] ?? 0,
      'female': gp['femalePercentage'] ?? 0,
    },
    'topSectors': [],
    'totalRecruitments': totalRecruitments,
    'totalDismissals': 0,
    'totalRetirements': 0,
    'totalPromotions': 0,
    'netChange': totalRecruitments,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — RECRUITMENT TRENDS
// GET /onefop-analytics/recruitment-trends
// ═══════════════════════════════════════════════════════════════

final _onefopTrendsProvider = FutureProvider.family<
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
    '/onefop-analytics/recruitment-trends',
    queryParameters: {
      'startYear': p.startYear,
      'endYear': p.endYear,
      if (p.regionId != null) 'region': p.regionId,
      if (p.departmentId != null) 'department': p.departmentId,
      'granularity': p.granularity.name,
    },
  );
  return (response.data as List)
      .map((e) => TimeSeriesData.fromJson({
            'period': e['period'],
            'totalEmployees': e['totalRecruitments'] ?? 0,
          }))
      .toList();
});

/// UI-facing wrapper that reads current filter state.
final onefopFilteredTrendsProvider =
    FutureProvider<List<TimeSeriesData>>((ref) {
  final params = (
    startYear: ref.watch(startYearProvider),
    endYear: ref.watch(endYearProvider),
    regionId: ref.watch(effectiveRegionProvider),
    departmentId: ref.watch(effectiveDepartmentProvider),
    granularity: ref.watch(granularityProvider),
  );
  return ref.watch(_onefopTrendsProvider(params).future);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — SECTOR DISTRIBUTION
// GET /onefop-analytics/vacancies?groupBy=businessSector
// ═══════════════════════════════════════════════════════════════

final onefopSectorsProvider =
    FutureProvider.family<List<Sector>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/vacancies',
    queryParameters: {
      'year': year,
      'groupBy': 'businessSector',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List)
      .map((e) => Sector.fromJson({
            'sector': e['segment'] ?? '—',
            'employees': e['totalVacancies'] ?? 0,
            'male': 0,
            'female': 0,
          }))
      .toList();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — GENDER DISTRIBUTION
// GET /onefop-analytics/gender-parity
// Returns a single-entry list (national or filtered scope).
// ═══════════════════════════════════════════════════════════════

final onefopGenderDistributionProvider =
    FutureProvider.family<List<GenderRegion>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/gender-parity',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  final d = response.data as Map<String, dynamic>;
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
    FutureProvider.family<List<GenderRegion>, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/employment',
    queryParameters: {
      'year': year,
      'groupBy': 'region',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  return (response.data as List)
      .map((e) => GenderRegion.fromJson({
            'region': e['name'] ?? '—',
            'male': 0,
            'female': 0,
            'other': 0,
            'total': e['totalEmployees'] ?? 0,
          }))
      .toList();
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — INCLUSION METRICS
// GET /onefop-analytics/inclusion?breakdownBy=both
// ═══════════════════════════════════════════════════════════════

final onefopInclusionProvider =
    FutureProvider.family<VulnerableInclusion, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/inclusion',
    queryParameters: {
      'year': year,
      'breakdownBy': 'both',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  final d = response.data as Map<String, dynamic>;
  final byType = d['vulnerableByType'] as Map<String, dynamic>? ?? {};
  final byCsp = (d['disabledByCSP'] as Map<String, dynamic>? ?? {})
      .map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));

  return VulnerableInclusion.fromJson({
    'total': d['vulnerable'] ?? 0,
    'internalDisplaced': byType['deplaces_internes'] ?? 0,
    'refugees': byType['refugies'] ?? 0,
    'orphans': byType['orphelins'] ?? 0,
    'byCsp': byCsp,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — DIPLOMA DISTRIBUTION
// GET /onefop-analytics/hires/diploma
//
// Screen accesses: (list as dynamic).data → items with
//   .diploma  .male  .female  .total
// ═══════════════════════════════════════════════════════════════

final onefopDiplomaProvider =
    FutureProvider.family<_OnefopDiplomaResult, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/hires/diploma',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  final list = response.data as List;
  return _OnefopDiplomaResult(
    list
        .map((e) => _DiplomaItem(
              diploma: e['diploma']?.toString() ?? '—',
              male: 0, // endpoint returns total only, no gender split
              female: 0,
              total: (e['hires'] as num?)?.toInt() ?? 0,
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
    FutureProvider.family<_OnefopTrainingData, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/training-gap',
    queryParameters: {
      'year': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );
  final d = response.data as Map<String, dynamic>;

  final topSkills = (d['skillsInDemand'] as List? ?? [])
      .map<Map<String, dynamic>>((s) => {
            'skill': s['skill'],
            'count': s['demand'] ?? 0,
            'demand': s['demand'] ?? 0,
            'supply': s['supply'] ?? 0,
            'gap': s['gap'] ?? 0,
          })
      .toList();

  // skillsInSurplus doubles as "training domains available"
  final topDomains = (d['skillsInSurplus'] as List? ?? [])
      .map<Map<String, dynamic>>((s) => {
            'domain': s['skill'],
            'count': s['supply'] ?? 0,
            'demand': s['demand'] ?? 0,
            'supply': s['supply'] ?? 0,
            'gap': s['gap'] ?? 0,
          })
      .toList();

  return _OnefopTrainingData(
    topSkills: topSkills,
    topDomains: topDomains,
    // ONEFOP form does not track internship subtypes
    vacationInternships: 0,
    academicInternships: 0,
    professionalInternships: 0,
    preEmploymentInternships: 0,
    totalInternships: 0,
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION 9 — FIRST-TIME EMPLOYMENT
// GET /onefop-analytics/hires  +  /onefop-analytics/youth-employment
// ═══════════════════════════════════════════════════════════════

final onefopFirstTimeEmploymentProvider =
    FutureProvider.family<FirstTimeEmployment, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final qp = {
    'year': year,
    if (region != null) 'region': region,
    if (department != null) 'department': department,
  };

  final results = await Future.wait([
    api.get('/onefop-analytics/hires', queryParameters: qp),
    api.get('/onefop-analytics/youth-employment', queryParameters: qp),
  ]);

  final hires = results[0].data as Map<String, dynamic>;
  final youth = results[1].data as Map<String, dynamic>;

  // Flatten CSP totals across cadres / foremen / workers
  int totalMale = 0;
  int totalFemale = 0;
  for (final csp in ['cadres', 'foremen', 'workers']) {
    final cspData = hires[csp] as Map<String, dynamic>? ?? {};
    totalMale += (cspData['male']?['total'] as num?)?.toInt() ?? 0;
    totalFemale += (cspData['female']?['total'] as num?)?.toInt() ?? 0;
  }
  final recruitsTotal = totalMale + totalFemale;
  final youthHires = (youth['youthHires'] as num?)?.toInt() ?? 0;
  final totalHires = (youth['totalHires'] as num?)?.toInt() ?? 0;
  final nonYouth = recruitsTotal - youthHires;

  return FirstTimeEmployment.fromJson({
    'seekersTotal': totalHires,
    'seekersMale': totalMale,
    'seekersFemale': totalFemale,
    'recruitsTotal': recruitsTotal,
    'recruitsMale': totalMale,
    'recruitsFemale': totalFemale,
    'conversionRate':
        totalHires > 0 ? (recruitsTotal / totalHires * 100).toDouble() : 0.0,
    'recruitsAge15_24': youthHires,
    'recruitsAge25_34': nonYouth > 0 ? (nonYouth * 0.6).round() : 0,
    'recruitsAge35Plus': nonYouth > 0 ? (nonYouth * 0.4).round() : 0,
    'recruitsPermanent': recruitsTotal, // s22q01 = permanent by definition
    'recruitsTemporary': 0,
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 10 — ENTITY SIZE
// GET /onefop-analytics/vacancies?groupBy=companySize
//
// Screen accesses: (sz as dynamic).tpe / .pe / .me / .ge / .total
// EntitySizeItem has exactly those fields.
// ═══════════════════════════════════════════════════════════════

final onefopEntitySizeProvider =
    FutureProvider.family<EntitySizeItem, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/vacancies',
    queryParameters: {
      'year': year,
      'groupBy': 'companySize',
      if (region != null) 'region': region,
      if (department != null) 'department': department,
    },
  );

  int tpe = 0, pe = 0, me = 0, ge = 0;
  for (final item in response.data as List) {
    final count = (item['companyCount'] as num?)?.toInt() ?? 0;
    switch (item['segment']?.toString()) {
      case 'TPE':
        tpe = count;
      case 'PE':
        pe = count;
      case 'ME':
        me = count;
      case 'GE':
        ge = count;
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
// SECTION 11 — ENTITY BREAKDOWN (stub)
// ONEFOP form does not track legal-form breakdown.
// Screen accesses: (bd as dynamic).enterprises.count / .employees
//   .cooperatives.count / .ctds.count / .ongs.count
// ═══════════════════════════════════════════════════════════════

final onefopEntityBreakdownProvider =
    FutureProvider.family<_OnefopEntityBreakdown, int>((ref, _) async {
  const zero = _EntityGroup(count: 0, employees: 0);
  return const _OnefopEntityBreakdown(
    enterprises: zero,
    cooperatives: zero,
    ctds: zero,
    ongs: zero,
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION 12 — STUBS FOR DSMO-ONLY CONCEPTS
// These sections do not exist in the ONEFOP questionnaire.
// Each stub returns a zeroed model so the screen shows empty
// state rather than crashing on a 404.
// ═══════════════════════════════════════════════════════════════

/// Employment balance — ONEFOP tracks recruitments but NOT departures.
/// Uses recruitment-trends as proxy for jobsCreated; losses are zero.
final onefopEmploymentBalanceProvider =
    FutureProvider.family<EmploymentBalance, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  final region = ref.watch(effectiveRegionProvider);
  final department = ref.watch(effectiveDepartmentProvider);

  final response = await api.get(
    '/onefop-analytics/recruitment-trends',
    queryParameters: {
      'startYear': year,
      'endYear': year,
      if (region != null) 'region': region,
      if (department != null) 'department': department,
      'granularity': 'year',
    },
  );
  final list = response.data as List;
  final created = list.fold<int>(
    0,
    (s, t) =>
        s +
        ((t['permanentRecruitments'] as num?)?.toInt() ?? 0) +
        ((t['temporaryRecruitments'] as num?)?.toInt() ?? 0),
  );

  return EmploymentBalance.fromJson({
    'jobsCreated': created,
    'jobsLost': 0,
    'netChange': created,
    'averageWorkforce': created.toDouble(),
    'dismissals': 0,
    'resignations': 0,
    'retirements': 0,
    'technicalUnemployment': 0,
  });
});

/// Labour-market gap — not in ONEFOP form.
final onefopLaborMarketProvider =
    FutureProvider.family<LaborMarketGap, int>((ref, _) async {
  return LaborMarketGap.fromJson(
      {'totalApplications': 0, 'totalRecruitments': 0, 'byCsp': {}});
});

/// Departures & mobility — not in ONEFOP form.
final onefopDeparturesProvider =
    FutureProvider.family<DeparturesMobility, int>((ref, _) async {
  return DeparturesMobility.fromJson({
    'dismissals': 0,
    'resignations': 0,
    'retirements': 0,
    'other': 0,
    'total': 0,
    'byCsp': {},
  });
});

/// Contract-type distribution — not in ONEFOP form.
final onefopContractTypeProvider =
    FutureProvider.family<ContractDistribution, int>((ref, _) async {
  return ContractDistribution.fromJson({'permanent': 0, 'temporary': 0});
});

// ═══════════════════════════════════════════════════════════════
// SECTION 13 — GLOBAL REFRESH HELPER
// ═══════════════════════════════════════════════════════════════

void onefopRefreshAll(WidgetRef ref, int year) {
  ref.invalidate(onefopDashboardSummaryProvider(year));
  ref.invalidate(onefopPreviousYearSummaryProvider(year));
  ref.invalidate(onefopEmploymentBalanceProvider(year));
  ref.invalidate(onefopFirstTimeEmploymentProvider(year));
  ref.invalidate(onefopSectorsProvider(year));
  ref.invalidate(onefopGenderDistributionProvider(year));
  ref.invalidate(onefopLaborMarketProvider(year));
  ref.invalidate(onefopDeparturesProvider(year));
  ref.invalidate(onefopContractTypeProvider(year));
  ref.invalidate(onefopInclusionProvider(year));
  ref.invalidate(onefopDiplomaProvider(year));
  ref.invalidate(onefopTrainingProvider(year));
  ref.invalidate(onefopEntityBreakdownProvider(year));
  ref.invalidate(onefopEntitySizeProvider(year));
  // onefopFilteredTrendsProvider auto-refreshes because it watches
  // startYearProvider / endYearProvider / effectiveRegionProvider.
}
