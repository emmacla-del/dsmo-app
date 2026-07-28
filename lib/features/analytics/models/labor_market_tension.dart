// lib/features/analytics/models/labor_market_tension.dart

/// Mirrors the backend's LaborMarketTension interface exactly.
/// No computed fields — all figures arrive pre-calculated from the server.
class LaborMarketTension {
  /// Total declared unfilled positions (onefopEnterpriseDetail.vacancies sum).
  final int totalVacancies;

  /// Total actual hires, permanent + temporary (s22q01 + s22q02).
  final int totalRecruitments;

  /// totalVacancies − totalRecruitments. Positive = more openings than fills.
  final int gap;

  /// totalRecruitments / totalVacancies × 100. Null when totalVacancies = 0.
  final double? absorptionRate;

  /// Hires broken down by CSP. vacancies is always null at this granularity.
  final List<LaborMarketCspRow> byCsp;

  const LaborMarketTension({
    required this.totalVacancies,
    required this.totalRecruitments,
    required this.gap,
    required this.absorptionRate,
    required this.byCsp,
  });

  factory LaborMarketTension.fromJson(Map<String, dynamic> json) {
    return LaborMarketTension(
      totalVacancies: (json['totalVacancies'] as num?)?.toInt() ?? 0,
      totalRecruitments: (json['totalRecruitments'] as num?)?.toInt() ?? 0,
      gap: (json['gap'] as num?)?.toInt() ?? 0,
      absorptionRate: (json['vacancyFulfilmentRate'] as num?)?.toDouble(),
      byCsp: (json['occupationalDemand'] as List<dynamic>? ?? [])
          .map((e) => LaborMarketCspRow.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class LaborMarketCspRow {
  final String cspCategory;

  /// Actual hires for this CSP category.
  final int hires;

  /// Always null — vacancy data is not available at CSP granularity.
  final int? vacancies;

  /// Hire share of total hires (0–100).
  final double hireSharePct;

  const LaborMarketCspRow({
    required this.cspCategory,
    required this.hires,
    required this.vacancies,
    required this.hireSharePct,
  });

  factory LaborMarketCspRow.fromJson(Map<String, dynamic> json) {
    return LaborMarketCspRow(
      cspCategory: json['cspCategory'] as String,
      hires: (json['hires'] as num?)?.toInt() ?? 0,
      vacancies: (json['vacancies'] as num?)?.toInt(),
      hireSharePct: (json['hireSharePct'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
