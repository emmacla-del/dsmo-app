// lib/features/analytics/models/mobility_dashboard.dart
// GET /onefop-analytics/mobility-dashboard
// Departure rates relative to total workforce (turnover/retention),
// as opposed to departure-type shares (which DeparturesMobility covers).
class MobilityDashboard {
  final int totalEmployees;
  final int totalDepartures;
  final double resignationRate;
  final double dismissalRate;
  final double retirementRate;
  final double turnoverRate;
  final double retentionRate;

  const MobilityDashboard({
    required this.totalEmployees,
    required this.totalDepartures,
    required this.resignationRate,
    required this.dismissalRate,
    required this.retirementRate,
    required this.turnoverRate,
    required this.retentionRate,
  });

  factory MobilityDashboard.fromJson(Map<String, dynamic> json) {
    return MobilityDashboard(
      totalEmployees: (json['totalEmployees'] as num?)?.toInt() ?? 0,
      totalDepartures: (json['totalDepartures'] as num?)?.toInt() ?? 0,
      resignationRate: (json['resignationRate'] as num?)?.toDouble() ?? 0.0,
      dismissalRate: (json['dismissalRate'] as num?)?.toDouble() ?? 0.0,
      retirementRate: (json['retirementRate'] as num?)?.toDouble() ?? 0.0,
      turnoverRate: (json['turnoverRate'] as num?)?.toDouble() ?? 0.0,
      retentionRate: (json['retentionRate'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
