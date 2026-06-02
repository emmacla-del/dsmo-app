// ==================================================================
// dashboard_models.dart – typed data models for the analytics dashboard
// ==================================================================

class DashboardSummary {
  // ── Original API fields ──
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

  // ── Additional KPI / mock fields ──
  final int? totalEnterprises;
  final int? totalWorkforce;
  final int? jobsCreated;
  final int? jobsLost;
  final int? netEmploymentChange;
  final double? femalePercentage;
  final double? youthPercentage;
  final String? topRecruitingSector;
  final double? topRecruitingSectorPercentage;

  DashboardSummary({
    this.year = 0,
    this.region = 'National',
    this.totalDeclarations = 0,
    this.totalEmployees = 0,
    this.employmentGrowthRate = 0.0,
    GenderDistribution? genderDistribution,
    List<TopSector>? topSectors,
    this.totalRecruitments = 0,
    this.totalDismissals = 0,
    this.totalRetirements = 0,
    this.totalPromotions = 0,
    this.netChange = 0,
    this.totalEnterprises,
    this.totalWorkforce,
    this.jobsCreated,
    this.jobsLost,
    this.netEmploymentChange,
    this.femalePercentage,
    this.youthPercentage,
    this.topRecruitingSector,
    this.topRecruitingSectorPercentage,
  })  : genderDistribution =
            genderDistribution ?? GenderDistribution(male: 0, female: 0),
        topSectors = topSectors ?? [];

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
        netChange = json['netChange'] ?? 0,
        totalEnterprises = json['totalEnterprises'],
        totalWorkforce = json['totalWorkforce'],
        jobsCreated = json['jobsCreated'],
        jobsLost = json['jobsLost'],
        netEmploymentChange = json['netEmploymentChange'],
        femalePercentage = (json['femalePercentage'] as num?)?.toDouble(),
        youthPercentage = (json['youthPercentage'] as num?)?.toDouble(),
        topRecruitingSector = json['topRecruitingSector'],
        topRecruitingSectorPercentage =
            (json['topRecruitingSectorPercentage'] as num?)?.toDouble();
}

class GenderDistribution {
  final double male;
  final double female;
  final int? total;

  GenderDistribution({
    required num male,
    required num female,
    this.total,
  })  : male = male.toDouble(),
        female = female.toDouble();

  GenderDistribution.fromJson(Map<String, dynamic> json)
      : male = (json['male'] as num?)?.toDouble() ?? 0.0,
        female = (json['female'] as num?)?.toDouble() ?? 0.0,
        total = (json['total'] as num?)?.toInt();
}

class TopSector {
  final String sector;
  final int employees;

  TopSector({
    required this.sector,
    required this.employees,
  });

  TopSector.fromJson(Map<String, dynamic> json)
      : sector = json['sector'] ?? '',
        employees = (json['employees'] as num?)?.toInt() ?? 0;
}

class Sector {
  final String sector;
  final int employees;
  final int male;
  final int female;

  // ── Mock / UI fields ──
  final int? jobsCreated;
  final int? jobsLost;
  final int? netChange;
  final double? percentageOfTotal;

  Sector({
    required this.sector,
    this.employees = 0,
    this.male = 0,
    this.female = 0,
    this.jobsCreated,
    this.jobsLost,
    this.netChange,
    this.percentageOfTotal,
  });

  Sector.fromJson(Map<String, dynamic> json)
      : sector = json['sector'] ?? '',
        employees = (json['employees'] as num?)?.toInt() ?? 0,
        male = (json['male'] as num?)?.toInt() ?? 0,
        female = (json['female'] as num?)?.toInt() ?? 0,
        jobsCreated = (json['jobsCreated'] as num?)?.toInt(),
        jobsLost = (json['jobsLost'] as num?)?.toInt(),
        netChange = (json['netChange'] as num?)?.toInt(),
        percentageOfTotal = (json['percentageOfTotal'] as num?)?.toDouble();
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

class EmploymentTrend {
  final String period; // e.g., "2024", "2024-S1", "2024-Q1"
  final int totalEmployees;

  // ── Mock / UI fields ──
  final int? created;
  final int? lost;

  EmploymentTrend({
    required this.period,
    this.totalEmployees = 0,
    this.created,
    this.lost,
  });

  EmploymentTrend.fromJson(Map<String, dynamic> json)
      : period = json['period']?.toString() ?? '',
        totalEmployees = (json['totalEmployees'] as num?)?.toInt() ?? 0,
        created = (json['created'] as num?)?.toInt(),
        lost = (json['lost'] as num?)?.toInt();
}

// ==================================================================
// Missing classes added for mock_analytics_service.dart
// ==================================================================

class RegionalSummary {
  final String region;
  final int workforceSize;
  final int jobsCreated;
  final int jobsLost;
  final double growthRate;

  RegionalSummary({
    required this.region,
    required this.workforceSize,
    required this.jobsCreated,
    required this.jobsLost,
    required this.growthRate,
  });

  RegionalSummary.fromJson(Map<String, dynamic> json)
      : region = json['region'] ?? '',
        workforceSize = (json['workforceSize'] as num?)?.toInt() ?? 0,
        jobsCreated = (json['jobsCreated'] as num?)?.toInt() ?? 0,
        jobsLost = (json['jobsLost'] as num?)?.toInt() ?? 0,
        growthRate = (json['growthRate'] as num?)?.toDouble() ?? 0.0;
}

class AgeDistribution {
  final int age15_24;
  final int age25_34;
  final int age35Plus;

  AgeDistribution({
    required this.age15_24,
    required this.age25_34,
    required this.age35Plus,
  });

  AgeDistribution.fromJson(Map<String, dynamic> json)
      : age15_24 = (json['age15_24'] as num?)?.toInt() ?? 0,
        age25_34 = (json['age25_34'] as num?)?.toInt() ?? 0,
        age35Plus = (json['age35Plus'] as num?)?.toInt() ?? 0;
}

class SkillDemand {
  final String skillName;
  final int demandCount;
  final double percentage;

  SkillDemand({
    required this.skillName,
    required this.demandCount,
    required this.percentage,
  });

  SkillDemand.fromJson(Map<String, dynamic> json)
      : skillName = json['skillName'] ?? '',
        demandCount = (json['demandCount'] as num?)?.toInt() ?? 0,
        percentage = (json['percentage'] as num?)?.toDouble() ?? 0.0;
}

class TrainingNeed {
  final String domain;
  final int requestCount;
  final double percentage;

  TrainingNeed({
    required this.domain,
    required this.requestCount,
    required this.percentage,
  });

  TrainingNeed.fromJson(Map<String, dynamic> json)
      : domain = json['domain'] ?? '',
        requestCount = (json['requestCount'] as num?)?.toInt() ?? 0,
        percentage = (json['percentage'] as num?)?.toDouble() ?? 0.0;
}

// ==================================================================
// ADDITIONAL CLASSES for analytics_dashboard_screen.dart
// ==================================================================

class EmploymentBalance {
  final int jobsCreated;
  final int jobsLost;
  final int netChange;
  final double averageWorkforce;
  final int dismissals;
  final int resignations;
  final int retirements;
  final int technicalUnemployment;

  EmploymentBalance({
    required this.jobsCreated,
    required this.jobsLost,
    required this.netChange,
    required this.averageWorkforce,
    required this.dismissals,
    required this.resignations,
    required this.retirements,
    required this.technicalUnemployment,
  });

  factory EmploymentBalance.fromJson(Map<String, dynamic> json) {
    return EmploymentBalance(
      jobsCreated: (json['jobsCreated'] as num?)?.toInt() ?? 0,
      jobsLost: (json['jobsLost'] as num?)?.toInt() ?? 0,
      netChange: (json['netChange'] as num?)?.toInt() ?? 0,
      averageWorkforce: (json['averageWorkforce'] as num?)?.toDouble() ?? 0.0,
      dismissals: (json['dismissals'] as num?)?.toInt() ?? 0,
      resignations: (json['resignations'] as num?)?.toInt() ?? 0,
      retirements: (json['retirements'] as num?)?.toInt() ?? 0,
      technicalUnemployment:
          (json['technicalUnemployment'] as num?)?.toInt() ?? 0,
    );
  }
}

class FirstTimeEmployment {
  final int seekersTotal;
  final int seekersMale;
  final int seekersFemale;
  final int recruitsTotal;
  final int recruitsMale;
  final int recruitsFemale;
  final double conversionRate;
  final int recruitsAge15_24;
  final int recruitsAge25_34;
  final int recruitsAge35Plus;
  final int recruitsPermanent;
  final int recruitsTemporary;

  FirstTimeEmployment({
    required this.seekersTotal,
    required this.seekersMale,
    required this.seekersFemale,
    required this.recruitsTotal,
    required this.recruitsMale,
    required this.recruitsFemale,
    required this.conversionRate,
    required this.recruitsAge15_24,
    required this.recruitsAge25_34,
    required this.recruitsAge35Plus,
    required this.recruitsPermanent,
    required this.recruitsTemporary,
  });

  factory FirstTimeEmployment.fromJson(Map<String, dynamic> json) {
    return FirstTimeEmployment(
      seekersTotal: (json['seekersTotal'] as num?)?.toInt() ?? 0,
      seekersMale: (json['seekersMale'] as num?)?.toInt() ?? 0,
      seekersFemale: (json['seekersFemale'] as num?)?.toInt() ?? 0,
      recruitsTotal: (json['recruitsTotal'] as num?)?.toInt() ?? 0,
      recruitsMale: (json['recruitsMale'] as num?)?.toInt() ?? 0,
      recruitsFemale: (json['recruitsFemale'] as num?)?.toInt() ?? 0,
      conversionRate: (json['conversionRate'] as num?)?.toDouble() ?? 0.0,
      recruitsAge15_24: (json['recruitsAge15_24'] as num?)?.toInt() ?? 0,
      recruitsAge25_34: (json['recruitsAge25_34'] as num?)?.toInt() ?? 0,
      recruitsAge35Plus: (json['recruitsAge35Plus'] as num?)?.toInt() ?? 0,
      recruitsPermanent: (json['recruitsPermanent'] as num?)?.toInt() ?? 0,
      recruitsTemporary: (json['recruitsTemporary'] as num?)?.toInt() ?? 0,
    );
  }
}

class LaborMarketGap {
  final int totalApplications;
  final int totalRecruitments;
  final Map<String, dynamic> byCsp;

  LaborMarketGap({
    required this.totalApplications,
    required this.totalRecruitments,
    required this.byCsp,
  });

  factory LaborMarketGap.fromJson(Map<String, dynamic> json) {
    return LaborMarketGap(
      totalApplications: (json['totalApplications'] as num?)?.toInt() ?? 0,
      totalRecruitments: (json['totalRecruitments'] as num?)?.toInt() ?? 0,
      byCsp: json['byCsp'] as Map<String, dynamic>? ?? {},
    );
  }
}

class DeparturesMobility {
  final int dismissals;
  final int resignations;
  final int retirements;
  final int other;
  final int total;
  final Map<String, dynamic> byCsp;

  DeparturesMobility({
    required this.dismissals,
    required this.resignations,
    required this.retirements,
    required this.other,
    required this.total,
    required this.byCsp,
  });

  factory DeparturesMobility.fromJson(Map<String, dynamic> json) {
    return DeparturesMobility(
      dismissals: (json['dismissals'] as num?)?.toInt() ?? 0,
      resignations: (json['resignations'] as num?)?.toInt() ?? 0,
      retirements: (json['retirements'] as num?)?.toInt() ?? 0,
      other: (json['other'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      byCsp: json['byCsp'] as Map<String, dynamic>? ?? {},
    );
  }
}

class ContractDistribution {
  final int permanent;
  final int temporary;
  final double permanentPercent;
  final double temporaryPercent;

  ContractDistribution({
    required this.permanent,
    required this.temporary,
    required this.permanentPercent,
    required this.temporaryPercent,
  });

  factory ContractDistribution.fromJson(Map<String, dynamic> json) {
    final perm = (json['permanent'] as num?)?.toInt() ?? 0;
    final temp = (json['temporary'] as num?)?.toInt() ?? 0;
    final total = perm + temp;
    return ContractDistribution(
      permanent: perm,
      temporary: temp,
      permanentPercent: total > 0 ? (perm / total) * 100 : 0,
      temporaryPercent: total > 0 ? (temp / total) * 100 : 0,
    );
  }
}

class VulnerableInclusion {
  final int internalDisplaced;
  final int refugees;
  final int orphans;
  final int total;
  final Map<String, dynamic> byCsp;

  VulnerableInclusion({
    required this.internalDisplaced,
    required this.refugees,
    required this.orphans,
    required this.total,
    required this.byCsp,
  });

  factory VulnerableInclusion.fromJson(Map<String, dynamic> json) {
    return VulnerableInclusion(
      internalDisplaced: (json['internalDisplaced'] as num?)?.toInt() ?? 0,
      refugees: (json['refugees'] as num?)?.toInt() ?? 0,
      orphans: (json['orphans'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      byCsp: json['byCsp'] as Map<String, dynamic>? ?? {},
    );
  }
}

class DiplomaDistribution {
  final int none;
  final int primary;
  final int secondary;
  final int bachelor;
  final int master;
  final int doctorate;
  final int total;
  final Map<String, dynamic> distribution;

  DiplomaDistribution({
    required this.none,
    required this.primary,
    required this.secondary,
    required this.bachelor,
    required this.master,
    required this.doctorate,
    required this.total,
    required this.distribution,
  });

  factory DiplomaDistribution.fromJson(Map<String, dynamic> json) {
    return DiplomaDistribution(
      none: (json['none'] as num?)?.toInt() ?? 0,
      primary: (json['primary'] as num?)?.toInt() ?? 0,
      secondary: (json['secondary'] as num?)?.toInt() ?? 0,
      bachelor: (json['bachelor'] as num?)?.toInt() ?? 0,
      master: (json['master'] as num?)?.toInt() ?? 0,
      doctorate: (json['doctorate'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      distribution: json,
    );
  }
}

class SkillTraining {
  final String skill;
  final int demand;
  final int supply;
  final int gap;
  final int count;

  SkillTraining({
    required this.skill,
    required this.demand,
    required this.supply,
    required this.gap,
    required this.count,
  });

  factory SkillTraining.fromJson(Map<String, dynamic> json) {
    return SkillTraining(
      skill: json['skill']?.toString() ?? '',
      demand: (json['demand'] as num?)?.toInt() ?? 0,
      supply: (json['supply'] as num?)?.toInt() ?? 0,
      gap: (json['gap'] as num?)?.toInt() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class InternshipPipeline {
  final int vacationInternships;
  final int academicInternships;
  final int professionalInternships;
  final int preEmploymentInternships;
  final int totalInternships;
  final int conversionsToCdi;
  final double conversionRate;

  InternshipPipeline({
    required this.vacationInternships,
    required this.academicInternships,
    required this.professionalInternships,
    required this.preEmploymentInternships,
    required this.totalInternships,
    required this.conversionsToCdi,
    required this.conversionRate,
  });

  factory InternshipPipeline.fromJson(Map<String, dynamic> json) {
    final total = (json['totalInternships'] as num?)?.toInt() ?? 0;
    final conversions = (json['conversionsToCdi'] as num?)?.toInt() ?? 0;
    return InternshipPipeline(
      vacationInternships: (json['vacationInternships'] as num?)?.toInt() ?? 0,
      academicInternships: (json['academicInternships'] as num?)?.toInt() ?? 0,
      professionalInternships:
          (json['professionalInternships'] as num?)?.toInt() ?? 0,
      preEmploymentInternships:
          (json['preEmploymentInternships'] as num?)?.toInt() ?? 0,
      totalInternships: total,
      conversionsToCdi: conversions,
      conversionRate: total > 0 ? (conversions / total) * 100 : 0.0,
    );
  }
}

class EntityBreakdown {
  final int enterprises;
  final int cooperatives;
  final int ctds;
  final int ongs;
  final int total;

  EntityBreakdown({
    required this.enterprises,
    required this.cooperatives,
    required this.ctds,
    required this.ongs,
    required this.total,
  });

  factory EntityBreakdown.fromJson(Map<String, dynamic> json) {
    return EntityBreakdown(
      enterprises: (json['enterprises'] as num?)?.toInt() ?? 0,
      cooperatives: (json['cooperatives'] as num?)?.toInt() ?? 0,
      ctds: (json['ctds'] as num?)?.toInt() ?? 0,
      ongs: (json['ongs'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class EntitySizeItem {
  final int tpe;
  final int pe;
  final int me;
  final int ge;
  final int total;

  EntitySizeItem({
    required this.tpe,
    required this.pe,
    required this.me,
    required this.ge,
    required this.total,
  });

  factory EntitySizeItem.fromJson(Map<String, dynamic> json) {
    return EntitySizeItem(
      tpe: (json['tpe'] as num?)?.toInt() ?? 0,
      pe: (json['pe'] as num?)?.toInt() ?? 0,
      me: (json['me'] as num?)?.toInt() ?? 0,
      ge: (json['ge'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}
