// lib/features/analytics/components/analytics_charts.dart
// fl_chart widgets wired to YOUR existing dashboard_models.dart types.
//
// Depends on:
//   ../models/dashboard_models.dart  → Sector, GenderRegion, EmploymentTrend
//   ../../../core/theme/app_theme.dart → AppColors

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../core/theme/app_theme.dart';
import '../models/dashboard_models.dart';

// ============================================================
// LINE CHART — Employment trends (uses your EmploymentTrend)
// ============================================================

class EmploymentTrendChart extends StatelessWidget {
  final List<EmploymentTrend> data;
  final List<EmploymentTrend>? secondaryData;
  final String primaryLabel;
  final String? secondaryLabel;

  const EmploymentTrendChart({
    super.key,
    required this.data,
    this.secondaryData,
    this.primaryLabel = 'Effectif total',
    this.secondaryLabel,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(
          child: Text('Aucune donnée',
              style: TextStyle(color: AppColors.textMuted)));
    }

    final maxY = _calculateMaxY();
    final interval = _calculateInterval(maxY);

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: interval,
          getDrawingHorizontalLine: (_) => const FlLine(
            color: AppColors.divider,
            strokeWidth: 1,
            dashArray: [4, 4],
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: interval,
              reservedSize: 44,
              getTitlesWidget: (value, _) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  _formatNumber(value.toInt()),
                  style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (value, _) {
                final idx = value.toInt();
                if (idx < 0 || idx >= data.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    data[idx].period,
                    style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500),
                  ),
                );
              },
            ),
          ),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: (data.length - 1).toDouble(),
        minY: 0,
        maxY: maxY * 1.15,
        lineBarsData: [
          _buildLineBar(
            data: data.map((e) => e.totalEmployees).toList(),
            color: AppColors.primary,
            gradientColors: [AppColors.primary, AppColors.primaryLight],
          ),
          if (secondaryData != null)
            _buildLineBar(
              data: secondaryData!.map((e) => e.totalEmployees).toList(),
              color: AppColors.danger,
              gradientColors: [
                AppColors.danger,
                AppColors.danger.withValues(alpha: 0.7)
              ],
              isSecondary: true,
            ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            tooltipBgColor: AppColors.textPrimary,
            tooltipRoundedRadius: 8,
            tooltipPadding: const EdgeInsets.all(12),
            getTooltipItems: (spots) => spots.map((spot) {
              final isSecondary = spot.barIndex == 1;
              final label = isSecondary && secondaryLabel != null
                  ? secondaryLabel!
                  : primaryLabel;
              return LineTooltipItem(
                '$label\n${_formatNumber(spot.y.toInt())}',
                const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  LineChartBarData _buildLineBar({
    required List<int> data,
    required Color color,
    required List<Color> gradientColors,
    bool isSecondary = false,
  }) {
    return LineChartBarData(
      spots: data
          .asMap()
          .entries
          .map((e) => FlSpot(e.key.toDouble(), e.value.toDouble()))
          .toList(),
      isCurved: true,
      curveSmoothness: 0.35,
      barWidth: isSecondary ? 2.5 : 3,
      isStrokeCapRound: true,
      color: color,
      belowBarData: BarAreaData(
        show: true,
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            gradientColors[0].withValues(alpha: 0.15),
            gradientColors[1].withValues(alpha: 0.02),
          ],
        ),
      ),
      dotData: FlDotData(
        show: true,
        getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(
          radius: 4,
          color: Colors.white,
          strokeWidth: 2,
          strokeColor: color,
        ),
      ),
    );
  }

  double _calculateMaxY() {
    double max = 0;
    for (final d in data) {
      if (d.totalEmployees > max) max = d.totalEmployees.toDouble();
    }
    if (secondaryData != null) {
      for (final d in secondaryData!) {
        if (d.totalEmployees > max) max = d.totalEmployees.toDouble();
      }
    }
    return max;
  }

  double _calculateInterval(double maxY) {
    if (maxY <= 10) return 2;
    if (maxY <= 50) return 10;
    if (maxY <= 100) return 20;
    if (maxY <= 500) return 100;
    if (maxY <= 1000) return 200;
    return 500;
  }

  String _formatNumber(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }
}

// ============================================================
// BAR CHART — Sector performance (uses your Sector)
// ============================================================

class SectorBarChart extends StatelessWidget {
  final List<Sector> sectors;
  final bool showGenderSplit;

  const SectorBarChart(
      {super.key, required this.sectors, this.showGenderSplit = false});

  @override
  Widget build(BuildContext context) {
    if (sectors.isEmpty) {
      return const Center(
          child: Text('Aucune donnée',
              style: TextStyle(color: AppColors.textMuted)));
    }

    final maxY = sectors
        .map((s) => s.employees)
        .reduce((a, b) => a > b ? a : b)
        .toDouble();
    final interval = _calculateInterval(maxY);

    return BarChart(
      BarChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: interval,
          getDrawingHorizontalLine: (_) => const FlLine(
            color: AppColors.divider,
            strokeWidth: 1,
            dashArray: [4, 4],
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: interval,
              reservedSize: 44,
              getTitlesWidget: (value, _) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  _formatNumber(value.toInt()),
                  style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w500),
                ),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, _) {
                final idx = value.toInt();
                if (idx < 0 || idx >= sectors.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    sectors[idx].sector,
                    style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              },
            ),
          ),
          rightTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles:
              const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        maxY: maxY * 1.15,
        barGroups: sectors.asMap().entries.map((e) {
          final s = e.value;
          return BarChartGroupData(
            x: e.key,
            barRods: [
              BarChartRodData(
                toY: s.employees.toDouble(),
                width: showGenderSplit ? 16 : 28,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(4)),
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    AppColors.chartColors[e.key % AppColors.chartColors.length]
                        .withValues(alpha: 0.7),
                    AppColors.chartColors[e.key % AppColors.chartColors.length],
                  ],
                ),
              ),
              if (showGenderSplit)
                BarChartRodData(
                  toY: s.male.toDouble(),
                  width: 16,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(4)),
                  color: AppColors.primary.withValues(alpha: 0.5),
                ),
            ],
          );
        }).toList(),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            tooltipBgColor: AppColors.textPrimary,
            tooltipRoundedRadius: 8,
            tooltipPadding: const EdgeInsets.all(12),
            getTooltipItem: (group, _, rod, rodIndex) {
              final s = sectors[group.x];
              final label = rodIndex == 0 ? 'Total' : 'Hommes';
              return BarTooltipItem(
                '${s.sector}\n$label: ${_formatNumber(rod.toY.toInt())}',
                const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
              );
            },
          ),
        ),
      ),
    );
  }

  double _calculateInterval(double maxY) {
    if (maxY <= 10) return 2;
    if (maxY <= 50) return 10;
    if (maxY <= 100) return 20;
    if (maxY <= 500) return 100;
    if (maxY <= 1000) return 200;
    return 500;
  }

  String _formatNumber(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }
}

// ============================================================
// PIE CHART — Gender distribution (uses your GenderDistribution)
// ============================================================

class GenderPieChart extends StatelessWidget {
  final GenderDistribution distribution;
  final bool showLegend;
  final double radius;

  const GenderPieChart({
    super.key,
    required this.distribution,
    this.showLegend = true,
    this.radius = 80,
  });

  @override
  Widget build(BuildContext context) {
    final total = distribution.male + distribution.female;
    if (total == 0) {
      return const Center(
          child: Text('Aucune donnée',
              style: TextStyle(color: AppColors.textMuted)));
    }

    final data = [
      _PieSlice(
          label: 'Hommes',
          value: distribution.male,
          color: AppColors.primary,
          icon: Icons.male),
      _PieSlice(
          label: 'Femmes',
          value: distribution.female,
          color: AppColors.secondary,
          icon: Icons.female),
    ];

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: radius * 0.4,
              sections: data.map((d) {
                final pct = total > 0 ? (d.value / total * 100) : 0;
                return PieChartSectionData(
                  value: d.value,
                  color: d.color,
                  radius: radius,
                  title: '${pct.toStringAsFixed(1)}%',
                  titleStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                  titlePositionPercentageOffset: 0.6,
                  badgeWidget: d.icon != null
                      ? Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 4)
                            ],
                          ),
                          child: Icon(d.icon, size: 14, color: d.color),
                        )
                      : null,
                  badgePositionPercentageOffset: 1.1,
                );
              }).toList(),
            ),
          ),
        ),
        if (showLegend) ...[
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: data.map((d) {
                final pct = total > 0 ? (d.value / total * 100) : 0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                            color: d.color,
                            borderRadius: BorderRadius.circular(3)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          d.label,
                          style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(
                        '${pct.toStringAsFixed(1)}%',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ],
    );
  }
}

class _PieSlice {
  final String label;
  final double value;
  final Color color;
  final IconData? icon;
  _PieSlice(
      {required this.label,
      required this.value,
      required this.color,
      this.icon});
}

// ============================================================
// HORIZONTAL RANKING — Generic, works with any RankData
// ============================================================

class HorizontalRankingChart extends StatelessWidget {
  final List<RankData> data;
  final String? unit;

  const HorizontalRankingChart({super.key, required this.data, this.unit});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(
          child: Text('Aucune donnée',
              style: TextStyle(color: AppColors.textMuted)));
    }

    final maxValue = data.map((d) => d.value).reduce((a, b) => a > b ? a : b);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: data.asMap().entries.map((e) {
        final d = e.value;
        final pct = maxValue > 0 ? d.value / maxValue : 0;
        final color = _rankColor(e.key);

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration:
                        BoxDecoration(color: color, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: Text('${e.key + 1}',
                        style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(d.label,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis),
                  ),
                  Text('${_formatNumber(d.value)}${unit ?? ''}',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: color)),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct.toDouble(),
                  backgroundColor: AppColors.background,
                  valueColor: AlwaysStoppedAnimation<Color>(
                      color.withValues(alpha: 0.7)),
                  minHeight: 6,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Color _rankColor(int idx) {
    final colors = [
      AppColors.primary,
      AppColors.secondary,
      AppColors.success,
      AppColors.warning,
      AppColors.info,
      AppColors.textSecondary
    ];
    return colors[idx % colors.length];
  }

  String _formatNumber(num n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }
}

class RankData {
  final String label;
  final num value;
  const RankData({required this.label, required this.value});
}
