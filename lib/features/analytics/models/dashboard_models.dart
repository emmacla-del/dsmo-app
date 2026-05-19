// ==================================================================
// dashboard_models.dart – typed data models for the analytics dashboard
// ==================================================================

class DashboardSummary {
  final int year;
  final String region;
  final int totalDeclarations;
  final int totalEmployees;
  final double employmentGrowthRate;
  final GenderDistribution genderDistribution;
  final List<TopSector> topSectors;
  final int totalRecruitments;
  final int totalDismissals;
  final int totalRetirements;
  final int totalPromotions;
  final int netChange;

  DashboardSummary.fromJson(Map<String, dynamic> json)
      : year = json['year'] ?? 0,
        region = json['region'] ?? 'National',
        totalDeclarations = json['totalDeclarations'] ?? 0,
        totalEmployees = json['totalEmployees'] ?? 0,
        employmentGrowthRate =
            (json['employmentGrowthRate'] as num?)?.toDouble() ?? 0.0,
        genderDistribution =
            GenderDistribution.fromJson(json['genderDistribution'] ?? {}),
        topSectors = (json['topSectors'] as List?)
                ?.map((e) => TopSector.fromJson(e))
                .toList() ??
            [],
        totalRecruitments = json['totalRecruitments'] ?? 0,
        totalDismissals = json['totalDismissals'] ?? 0,
        totalRetirements = json['totalRetirements'] ?? 0,
        totalPromotions = json['totalPromotions'] ?? 0,
        netChange = json['netChange'] ?? 0;
}

class GenderDistribution {
  final double male;
  final double female;

  GenderDistribution.fromJson(Map<String, dynamic> json)
      : male = (json['male'] as num?)?.toDouble() ?? 0.0,
        female = (json['female'] as num?)?.toDouble() ?? 0.0;
}

class TopSector {
  final String sector;
  final int employees;

  TopSector.fromJson(Map<String, dynamic> json)
      : sector = json['sector'] ?? '',
        employees = json['employees'] ?? 0;
}

class Sector {
  final String sector;
  final int employees;
  final int male;
  final int female;

  Sector.fromJson(Map<String, dynamic> json)
      : sector = json['sector'] ?? '',
        employees = (json['employees'] as num?)?.toInt() ?? 0,
        male = (json['male'] as num?)?.toInt() ?? 0,
        female = (json['female'] as num?)?.toInt() ?? 0;
}

class GenderRegion {
  final String region;
  final int male;
  final int female;
  final int other;
  final int total;

  GenderRegion.fromJson(Map<String, dynamic> json)
      : region = json['region'] ?? '',
        male = (json['male'] as num?)?.toInt() ?? 0,
        female = (json['female'] as num?)?.toInt() ?? 0,
        other = (json['other'] as num?)?.toInt() ?? 0,
        total = (json['total'] as num?)?.toInt() ?? 0;
}

// ✅ CORRECTED – uses 'period' (string) instead of 'year'
class EmploymentTrend {
  final String period; // e.g., "2024", "2024-S1", "2024-Q1"
  final int totalEmployees;

  EmploymentTrend.fromJson(Map<String, dynamic> json)
      : period = json['period']?.toString() ?? '',
        totalEmployees = (json['totalEmployees'] as num?)?.toInt() ?? 0;
}
