// lib/features/analytics/widgets/overview_tab.dart

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import '../models/time_series_data.dart';
import 'common_cards.dart';

class OverviewTab extends StatelessWidget {
  final DashboardSummary dashboard;
  final DashboardSummary? previous;
  final List<TimeSeriesData> trends;
  final List<Animation<double>> cardAnimations;
  final Granularity granularity;
  final void Function(Granularity) onGranularityChanged;

  const OverviewTab({
    required this.dashboard,
    required this.previous,
    required this.trends,
    required this.cardAnimations,
    required this.granularity,
    required this.onGranularityChanged,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sectionLabel('Indicateurs clés · ${dashboard.year}'),
          const SizedBox(height: 10),
          _kpiGrid(dashboard, previous, context),
          const SizedBox(height: 20),
          sectionLabel('Évolution ${dashboard.year - 1} → ${dashboard.year}'),
          const SizedBox(height: 10),
          _yoyTable(dashboard, previous),
          const SizedBox(height: 20),
          sectionLabel('Tendance emploi (période sélectionnée)'),
          const SizedBox(height: 10),
          _trendChart(trends, dashboard.year),
        ],
      ),
    );
  }

  Widget _kpiGrid(
      DashboardSummary cur, DashboardSummary? prev, BuildContext context) {
    final kpis = [
      const KpiDef('totalEmployees', 'Effectif total', Icons.people_rounded,
          AccentColor.teal),
      const KpiDef('employmentGrowthRate', 'Croissance',
          Icons.show_chart_rounded, AccentColor.blue),
      const KpiDef('totalDeclarations', 'Déclarations',
          Icons.assignment_turned_in_rounded, AccentColor.gold),
      const KpiDef(
          'netChange', 'Solde net', Icons.balance_rounded, AccentColor.rose),
    ];

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 800),
        child: GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: kpis.asMap().entries.map((e) {
            final idx = e.key;
            final def = e.value;
            return AnimatedCard(
              animation: cardAnimations[idx % cardAnimations.length],
              child: KpiCard(
                def: def,
                value: _kpiValue(cur, def.key),
                delta: _kpiDelta(cur, prev, def.key),
                onTap: () => _drillDown(context, def.key, cur),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  String _kpiValue(DashboardSummary cur, String key) {
    switch (key) {
      case 'totalEmployees':
        return formatNumber(cur.totalEmployees);
      case 'employmentGrowthRate':
        return '${cur.employmentGrowthRate.toStringAsFixed(1)}%';
      case 'totalDeclarations':
        return formatNumber(cur.totalDeclarations);
      case 'netChange':
        final sign = cur.netChange >= 0 ? '+' : '';
        return '$sign${formatNumber(cur.netChange)}';
      default:
        return '—';
    }
  }

  int? _kpiDelta(DashboardSummary cur, DashboardSummary? prev, String key) {
    if (prev == null) return null;
    switch (key) {
      case 'totalEmployees':
        return cur.totalEmployees - prev.totalEmployees;
      case 'totalDeclarations':
        return cur.totalDeclarations - prev.totalDeclarations;
      case 'netChange':
        return cur.netChange - prev.netChange;
      default:
        return null;
    }
  }

  void _drillDown(BuildContext context, String key, DashboardSummary cur) {
    String title, value, desc;
    List<Map<String, dynamic>> rows = [];
    switch (key) {
      case 'totalEmployees':
        title = 'Effectif total';
        value = formatNumber(cur.totalEmployees);
        desc = 'Annuel (pas de détail trimestriel)';
        break;
      case 'employmentGrowthRate':
        title = 'Taux de croissance';
        value = '${cur.employmentGrowthRate.toStringAsFixed(1)}%';
        desc = 'Comparaison annuelle';
        break;
      case 'totalDeclarations':
        title = 'Déclarations';
        value = formatNumber(cur.totalDeclarations);
        desc = 'Volume annuel';
        break;
      case 'netChange':
        title = 'Solde net';
        value =
            '${cur.netChange >= 0 ? '+' : ''}${formatNumber(cur.netChange)}';
        desc = 'Recrutements moins départs';
        break;
      default:
        return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          DrillSheet(title: title, value: value, desc: desc, rows: rows),
    );
  }

  Widget _yoyTable(DashboardSummary cur, DashboardSummary? prev) {
    final rows = [
      YoyDef('Effectif', Icons.people_outline, cur.totalEmployees,
          prev?.totalEmployees),
      YoyDef('Recrutements', Icons.person_add_outlined, cur.totalRecruitments,
          prev?.totalRecruitments),
      YoyDef('Départs', Icons.person_remove_outlined, cur.totalDismissals,
          prev?.totalDismissals,
          lowerBetter: true),
      YoyDef('Solde net', Icons.balance, cur.netChange, prev?.netChange),
    ];

    return GlassCard(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(children: [
              const Expanded(flex: 3, child: SizedBox()),
              Expanded(
                  flex: 2,
                  child: Text('${cur.year - 1}',
                      textAlign: TextAlign.center,
                      style: textMono(10, color: TextColor.muted))),
              Expanded(
                  flex: 2,
                  child: Text('${cur.year}',
                      textAlign: TextAlign.center,
                      style: textMono(10,
                          color: AccentColor.teal, weight: FontWeight.bold))),
              Expanded(
                  flex: 2,
                  child: Text('Δ',
                      textAlign: TextAlign.right,
                      style: textMono(10, color: TextColor.muted))),
            ]),
          ),
          const Divider(color: InkColor.border, height: 1),
          ...rows.asMap().entries.map(
              (e) => YoyRow(def: e.value, isLast: e.key == rows.length - 1)),
        ],
      ),
    );
  }

  Widget _trendChart(List<TimeSeriesData> trends, int currentYear) {
    if (trends.isEmpty) return emptyState('Aucune donnée de tendance');
    final maxVal = trends
        .map((t) => t.totalEmployees.toDouble())
        .reduce((a, b) => a > b ? a : b);

    return GlassCard(
      child: SizedBox(
        height: 200,
        child: BarChart(BarChartData(
          barGroups: trends.asMap().entries.map((e) {
            final t = e.value;
            final isCur = t.year == currentYear;
            return BarChartGroupData(
              x: e.key,
              barRods: [
                BarChartRodData(
                  toY: t.totalEmployees / 1000,
                  color:
                      isCur ? AccentColor.teal : AccentColor.teal.withAlpha(60),
                  width: 24,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(5)),
                  backDrawRodData: BackgroundBarChartRodData(
                      show: true,
                      toY: maxVal / 1000 * 1.2,
                      color: Colors.white.withAlpha(8)),
                ),
              ],
            );
          }).toList(),
          titlesData: FlTitlesData(
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 36,
                getTitlesWidget: (value, _) {
                  final i = value.toInt();
                  if (i < 0 || i >= trends.length) {
                    return const SizedBox.shrink();
                  }
                  final t = trends[i];
                  final isCur = t.year == currentYear;
                  return Transform.rotate(
                    angle: -0.785398, // -45 degrees in radians
                    child: Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(t.shortLabel,
                          style: textMono(9,
                              color: isCur ? AccentColor.teal : TextColor.muted,
                              weight:
                                  isCur ? FontWeight.bold : FontWeight.normal)),
                    ),
                  );
                },
              ),
            ),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 34,
                getTitlesWidget: (v, _) => Text('${v.toInt()}K',
                    style: textMono(8, color: TextColor.muted)),
              ),
            ),
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          gridData: FlGridData(
              drawVerticalLine: false,
              getDrawingHorizontalLine: (_) =>
                  FlLine(color: Colors.white.withAlpha(12), strokeWidth: 1)),
          borderData: FlBorderData(show: false),
        )),
      ),
    );
  }
}
