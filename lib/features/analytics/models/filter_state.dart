// lib/features/analytics/models/filter_state.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../widgets/period_selector.dart';
import '../providers/onefop_dashboard_providers.dart'; // Granularity is exported here

class AnalyticsFilterState {
  final int year;
  final String? region;
  final String? department;
  final String? subdivision;
  final String? entityType;
  final String? sector;
  final Granularity granularity;
  final PeriodType periodType;
  final String? quarter;
  final String? semester;
  final DateTimeRange? customRange;

  const AnalyticsFilterState({
    required this.year,
    this.region,
    this.department,
    this.subdivision,
    this.entityType,
    this.sector,
    this.granularity = Granularity.year,
    this.periodType = PeriodType.year,
    this.quarter,
    this.semester,
    this.customRange,
  });

  /// The single shared period state, derived from the scattered
  /// year/periodType/quarter/semester/customRange fields above.
  /// Every screen/provider that needs "what time window is selected"
  /// should read this instead of `year` directly.
  PeriodConfig get period => PeriodConfig(
        type: periodType,
        year: year,
        quarter: quarter,
        semester: semester,
        customRange: customRange,
      );

  /// Replaces all period fields atomically from a PeriodSelector change.
  /// Unlike copyWith (which falls back to the old value via `??`), this
  /// fully adopts the new config so stale quarter/semester/customRange
  /// values don't linger after switching period type.
  AnalyticsFilterState withPeriod(PeriodConfig newPeriod) {
    return AnalyticsFilterState(
      year: newPeriod.year ?? year,
      region: region,
      department: department,
      subdivision: subdivision,
      entityType: entityType,
      sector: sector,
      granularity: granularity,
      periodType: newPeriod.type,
      quarter: newPeriod.quarter,
      semester: newPeriod.semester,
      customRange: newPeriod.customRange,
    );
  }

  AnalyticsFilterState copyWith({
    int? year,
    String? region,
    String? department,
    String? subdivision,
    String? entityType,
    String? sector,
    Granularity? granularity,
    PeriodType? periodType,
    String? quarter,
    String? semester,
    DateTimeRange? customRange,
  }) {
    return AnalyticsFilterState(
      year: year ?? this.year,
      region: region ?? this.region,
      department: department ?? this.department,
      subdivision: subdivision ?? this.subdivision,
      entityType: entityType ?? this.entityType,
      sector: sector ?? this.sector,
      granularity: granularity ?? this.granularity,
      periodType: periodType ?? this.periodType,
      quarter: quarter ?? this.quarter,
      semester: semester ?? this.semester,
      customRange: customRange ?? this.customRange,
    );
  }
}

final dashboardFilterProvider = StateProvider<AnalyticsFilterState>((ref) {
  return AnalyticsFilterState(year: DateTime.now().year);
});
