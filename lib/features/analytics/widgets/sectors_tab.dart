// ==================================================================
// sectors_tab.dart – sector pie chart and list
// ==================================================================
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import 'common_cards.dart';

class SectorsTab extends StatelessWidget {
  final List<Sector> sectors;
  final List<Animation<double>> cardAnimations;

  const SectorsTab(
      {super.key, required this.sectors, required this.cardAnimations});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          sectionLabel('Distribution sectorielle'),
          const SizedBox(height: 10),
          AnimatedCard(
              animation: cardAnimations[0],
              child: SectorPieChart(sectors: sectors)),
          const SizedBox(height: 16),
          sectionLabel('Détail par secteur'),
          const SizedBox(height: 10),
          AnimatedCard(
              animation: cardAnimations[1],
              child: SectorList(sectors: sectors)),
        ],
      ),
    );
  }
}

class SectorPieChart extends StatelessWidget {
  final List<Sector> sectors;
  const SectorPieChart({super.key, required this.sectors});

  static const _colors = [
    AccentColor.teal,
    AccentColor.blue,
    AccentColor.gold,
    AccentColor.rose,
    AccentColor.purple,
    AccentColor.cyan,
    Color(0xFFFF7744)
  ];

  @override
  Widget build(BuildContext context) {
    if (sectors.isEmpty) {
      return const SizedBox(
          height: 80,
          child: Center(
              child: Text('Aucune donnée sectorielle',
                  style: TextStyle(color: TextColor.muted, fontSize: 12))));
    }
    final top = sectors.take(7).toList();
    return GlassCard(
      child: SizedBox(
        height: 220,
        child: PieChart(PieChartData(
          sections: top.asMap().entries.map((e) {
            final color = _colors[e.key % _colors.length];
            return PieChartSectionData(
              value: e.value.employees.toDouble(),
              color: color,
              radius: 72,
              title: '',
            );
          }).toList(),
          centerSpaceRadius: 44,
          sectionsSpace: 2,
        )),
      ),
    );
  }
}

class SectorList extends StatelessWidget {
  final List<Sector> sectors;
  const SectorList({super.key, required this.sectors});

  static const _colors = [
    AccentColor.teal,
    AccentColor.blue,
    AccentColor.gold,
    AccentColor.rose,
    AccentColor.purple,
    AccentColor.cyan,
    Color(0xFFFF7744)
  ];

  @override
  Widget build(BuildContext context) {
    final top = sectors.take(7).toList();
    final totalEmployees = sectors.fold<int>(0, (sum, s) => sum + s.employees);
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
      child: Column(
        children: top.asMap().entries.map((e) {
          final s = e.value;
          final color = _colors[e.key % _colors.length];
          final emp = s.employees;
          final maxEmp = top.first.employees;
          final percent = totalEmployees > 0
              ? (emp / totalEmployees * 100).toStringAsFixed(0)
              : '0';
          return InkWell(
            onTap: () => _onSectorTap(context, s, totalEmployees),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
              child: Row(children: [
                Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                        color: color, borderRadius: BorderRadius.circular(2))),
                const SizedBox(width: 10),
                Expanded(
                    child: Text(s.sector,
                        style: textMono(11, color: TextColor.secondary),
                        overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                SizedBox(
                  width: 80,
                  height: 4,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                        value: emp / maxEmp,
                        backgroundColor: Colors.white.withAlpha(12),
                        valueColor: AlwaysStoppedAnimation(color)),
                  ),
                ),
                const SizedBox(width: 10),
                Text('$percent%',
                    style: textMono(10, color: color, weight: FontWeight.bold)),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded,
                    size: 13, color: TextColor.muted),
              ]),
            ),
          );
        }).toList(),
      ),
    );
  }

  void _onSectorTap(BuildContext context, Sector sector, int totalEmployees) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DrillSheet(
        title: sector.sector,
        value: '${formatNumber(sector.employees)} employés',
        desc: 'Détail sectoriel',
        rows: [
          {'label': 'Hommes', 'value': formatNumber(sector.male)},
          {'label': 'Femmes', 'value': formatNumber(sector.female)},
          {
            'label': 'Part du total',
            'value':
                '${(sector.employees / totalEmployees * 100).toStringAsFixed(1)}%'
          },
        ],
      ),
    );
  }
}
