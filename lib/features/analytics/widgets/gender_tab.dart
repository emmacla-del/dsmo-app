// ==================================================================
// gender_tab.dart – gender donut and regional table
// ==================================================================
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import 'common_cards.dart';

class GenderTab extends StatelessWidget {
  final List<GenderRegion> gender;
  final DashboardSummary dashboard;
  final List<Animation<double>> cardAnimations;

  const GenderTab({
    super.key,
    required this.gender,
    required this.dashboard,
    required this.cardAnimations,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sectionLabel('Parité hommes / femmes · ${dashboard.year}'),
          const SizedBox(height: 10),
          AnimatedCard(
              animation: cardAnimations[0],
              child: GenderDonut(
                  genderDistribution: dashboard.genderDistribution)),
          const SizedBox(height: 16),
          sectionLabel('Répartition régionale'),
          const SizedBox(height: 10),
          AnimatedCard(
              animation: cardAnimations[1], child: GenderTable(rows: gender)),
        ],
      ),
    );
  }
}

class GenderDonut extends StatelessWidget {
  final GenderDistribution genderDistribution;
  const GenderDonut({super.key, required this.genderDistribution});

  @override
  Widget build(BuildContext context) {
    final malePct = genderDistribution.male;
    final femalePct = genderDistribution.female;

    if (malePct == 0 && femalePct == 0) {
      return const SizedBox(
          height: 140,
          child: Center(
              child: Text('Données non disponibles',
                  style: TextStyle(color: TextColor.muted, fontSize: 12))));
    }

    return GlassCard(
      child: Row(children: [
        SizedBox(
          width: 140,
          height: 140,
          child: PieChart(PieChartData(
            sections: [
              PieChartSectionData(
                value: malePct,
                color: AccentColor.blue,
                radius: 50,
                title: '${malePct.toStringAsFixed(0)}%',
                // titleStyle removed to avoid const error – default style is fine
              ),
              PieChartSectionData(
                value: femalePct,
                color: AccentColor.rose,
                radius: 50,
                title: '${femalePct.toStringAsFixed(0)}%',
              ),
            ],
            centerSpaceRadius: 38,
            sectionsSpace: 2,
          )),
        ),
        const SizedBox(width: 20),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GenderStat(color: AccentColor.blue, label: 'HOMMES', pct: malePct),
            const SizedBox(height: 16),
            GenderStat(
                color: AccentColor.rose, label: 'FEMMES', pct: femalePct),
          ],
        ),
      ]),
    );
  }
}

class GenderStat extends StatelessWidget {
  final Color color;
  final String label;
  final double pct;
  const GenderStat(
      {super.key, required this.color, required this.label, required this.pct});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(
                  color: color, borderRadius: BorderRadius.circular(2))),
          Text(label, style: textMono(9, color: TextColor.muted)),
        ]),
        const SizedBox(height: 2),
        Text('${pct.toStringAsFixed(1)}%',
            style: textMono(20, color: color, weight: FontWeight.bold)),
      ],
    );
  }
}

class GenderTable extends StatelessWidget {
  final List<GenderRegion> rows;
  const GenderTable({super.key, required this.rows});

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return const SizedBox(
          height: 80,
          child: Center(
              child: Text('Données non disponibles',
                  style: TextStyle(color: TextColor.muted, fontSize: 12))));
    }
    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(children: [
            Expanded(
                flex: 3,
                child:
                    Text('Région', style: textMono(9, color: TextColor.muted))),
            Expanded(
                flex: 2,
                child: Text('Hommes',
                    textAlign: TextAlign.center,
                    style: textMono(9, color: AccentColor.blue))),
            Expanded(
                flex: 2,
                child: Text('Femmes',
                    textAlign: TextAlign.center,
                    style: textMono(9, color: AccentColor.rose))),
          ]),
        ),
        const Divider(color: InkColor.border, height: 1),
        ...rows.take(10).map((row) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(children: [
                Expanded(
                    flex: 3,
                    child: Text(row.region,
                        style: textMono(11, color: TextColor.secondary),
                        overflow: TextOverflow.ellipsis)),
                Expanded(
                    flex: 2,
                    child: Text(formatNumber(row.male),
                        textAlign: TextAlign.center,
                        style: textMono(11,
                            color: AccentColor.blue, weight: FontWeight.bold))),
                Expanded(
                    flex: 2,
                    child: Text(formatNumber(row.female),
                        textAlign: TextAlign.center,
                        style: textMono(11,
                            color: AccentColor.rose, weight: FontWeight.bold))),
              ]),
            )),
      ]),
    );
  }
}
