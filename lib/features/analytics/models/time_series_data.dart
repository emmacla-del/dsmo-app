// lib/features/analytics/models/time_series_data.dart
import 'dart:convert';

// Granularity enum has been removed from this file.
// It is defined exclusively in:
//   lib/features/analytics/providers/dashboard_providers.dart
// Import it from there wherever it is needed.

/// Represents a single data point in an employment trend timeline.
class TimeSeriesData {
  final int year;
  final String period; // "S1", "S2", "Q1", "Q2", or empty string
  final String label; // "2024 S1", "2024"
  final int totalEmployees;

  TimeSeriesData({
    required this.year,
    required this.period,
    required this.label,
    required this.totalEmployees,
  });

  /// Factory constructor to parse JSON from the NestJS AnalyticsService.
  factory TimeSeriesData.fromJson(Map<String, dynamic> json) {
    return TimeSeriesData(
      year: json['year'] as int? ?? 0,
      period: json['period'] as String? ?? '',
      label: json['label'] as String? ?? '',
      totalEmployees: (json['totalEmployees'] as num?)?.toInt() ?? 0,
    );
  }

  /// Converts the object back to a Map for storage or local state management.
  Map<String, dynamic> toJson() {
    return {
      'year': year,
      'period': period,
      'label': label,
      'totalEmployees': totalEmployees,
    };
  }

  /// Returns a clean label for chart X-axes (e.g., "S1 '24" or "'24").
  String get shortLabel {
    final yearStr = year.toString();
    final shortYear = yearStr.length >= 4 ? yearStr.substring(2) : yearStr;

    if (period.isEmpty) {
      return "'$shortYear";
    }
    return "$period '$shortYear";
  }

  /// Helper to create a copy of the object with modified fields.
  TimeSeriesData copyWith({
    int? year,
    String? period,
    String? label,
    int? totalEmployees,
  }) {
    return TimeSeriesData(
      year: year ?? this.year,
      period: period ?? this.period,
      label: label ?? this.label,
      totalEmployees: totalEmployees ?? this.totalEmployees,
    );
  }

  /// Static helper to parse a list from decoded JSON.
  static List<TimeSeriesData> listFromJson(List<dynamic> json) {
    return json
        .map((e) => TimeSeriesData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Standard override for value-based comparison in Flutter states.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TimeSeriesData &&
          runtimeType == other.runtimeType &&
          year == other.year &&
          period == other.period &&
          label == other.label &&
          totalEmployees == other.totalEmployees;

  @override
  int get hashCode =>
      year.hashCode ^
      period.hashCode ^
      label.hashCode ^
      totalEmployees.hashCode;

  @override
  String toString() {
    return 'TimeSeriesData(label: $label, total: $totalEmployees)';
  }
}

/// Helper extension to easily parse lists of data from a JSON string.
extension TimeSeriesParser on String {
  List<TimeSeriesData> toTimeSeriesList() {
    final decoded = jsonDecode(this);
    if (decoded is List) {
      return TimeSeriesData.listFromJson(decoded);
    }
    throw const FormatException(
        'Expected a JSON array for TimeSeriesData list');
  }
}
