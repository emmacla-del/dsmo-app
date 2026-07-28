// lib/features/analytics/models/dashboard_bundle.dart
import 'dashboard_models.dart';
import 'labor_market_tension.dart';

class DashboardBundle {
  final DashboardSummary dashboard;
  final DashboardSummary? previous;
  final List<TimeSeriesData> trends;
  final List<Sector> sectors;
  final List<GenderRegion> gender;
  final EmploymentBalance? employmentBalance;
  final FirstTimeEmployment? firstTimeEmployment;
  final LaborMarketTension? laborMarketGap;
  final DeparturesMobility? departuresMobility;
  final ContractDistribution? contractDistribution;
  final VulnerableInclusion? vulnerableInclusion;
  final List<({String diploma, int count})> diplomaBreakdown;
  final ({int totalHires, int cadres, int foremen, int workers})? cspProfile;
  final List<SkillTraining>? topSkills;
  final List<SkillTraining>? topTraining;
  final InternshipPipeline? internshipPipeline;
  final EntityBreakdown? entityBreakdown;
  final EntitySizeItem? entitySize;

  const DashboardBundle({
    required this.dashboard,
    required this.previous,
    required this.trends,
    required this.sectors,
    required this.gender,
    this.employmentBalance,
    this.firstTimeEmployment,
    this.laborMarketGap,
    this.departuresMobility,
    this.contractDistribution,
    this.vulnerableInclusion,
    this.diplomaBreakdown = const [],
    this.cspProfile,
    this.topSkills,
    this.topTraining,
    this.internshipPipeline,
    this.entityBreakdown,
    this.entitySize,
  });
}
