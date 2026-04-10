import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../../data/api_client.dart';
import '../../../theme/app_colors.dart';

class AnalyticsDashboardScreen extends ConsumerStatefulWidget {
  const AnalyticsDashboardScreen({super.key});

  @override
  ConsumerState<AnalyticsDashboardScreen> createState() =>
      _AnalyticsDashboardScreenState();
}

class _AnalyticsDashboardScreenState
    extends ConsumerState<AnalyticsDashboardScreen> {
  int selectedYear = DateTime.now().year;
  bool isLoading = true;
  Map<String, dynamic> dashboardData = {};
  Map<String, dynamic> prevYearData = {};
  List<dynamic> employmentTrends = [];
  List<dynamic> sectorDistribution = [];

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => isLoading = true);
    try {
      final api = ref.read(apiClientProvider);

      final results = await Future.wait([
        api.get('/dsmo/analytics/dashboard-summary',
            queryParameters: {'year': selectedYear}),
        api.get('/dsmo/analytics/dashboard-summary',
            queryParameters: {'year': selectedYear - 1}),
        api.get('/dsmo/analytics/employment-trends', queryParameters: {
          'startYear': selectedYear - 3,
          'endYear': selectedYear,
        }),
        api.get('/dsmo/analytics/sector-distribution',
            queryParameters: {'year': selectedYear}),
      ]);

      if (!mounted) return;
      setState(() {
        dashboardData = results[0].data ?? {};
        prevYearData = results[1].data ?? {};
        employmentTrends = results[2].data ?? [];
        sectorDistribution = results[3].data ?? [];
        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
            'Tableau de bord de l\'intelligence du marché du travail'),
        backgroundColor: AppColors.deepEmerald,
        foregroundColor: Colors.white,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Year selector ──────────────────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Année :',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      DropdownButton<int>(
                        value: selectedYear,
                        items: List.generate(5, (i) => DateTime.now().year - i)
                            .map((y) =>
                                DropdownMenuItem(value: y, child: Text('$y')))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => selectedYear = value);
                            _loadDashboardData();
                          }
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // ── Key metrics ────────────────────────────────────────────
                  _sectionTitle(context, 'Métriques clés — $selectedYear'),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.3,
                    children: [
                      _buildMetricCard(
                        'Total des employés',
                        '${dashboardData['totalEmployees'] ?? 0}',
                        Icons.people,
                      ),
                      _buildMetricCard(
                        'Croissance de l\'emploi',
                        '${dashboardData['employmentGrowthRate'] ?? 'N/A'}%',
                        Icons.trending_up,
                      ),
                      _buildMetricCard(
                        'Déclarations soumises',
                        '${dashboardData['totalDeclarations'] ?? 0}',
                        Icons.check_circle,
                      ),
                      _buildMetricCard(
                        'Changement net',
                        '${dashboardData['netChange'] ?? 0}',
                        Icons.swap_horiz,
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),

                  // ── Year-over-year comparison ──────────────────────────────
                  _sectionTitle(
                      context,
                      'Comparaison ${selectedYear - 1} → $selectedYear'),
                  const SizedBox(height: 4),
                  Text(
                    'Évolution des indicateurs clés par rapport à l\'année précédente',
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 12),
                  _YoYComparisonSection(
                    currentData: dashboardData,
                    prevData: prevYearData,
                    currentYear: selectedYear,
                  ),
                  const SizedBox(height: 28),

                  // ── Sector distribution ────────────────────────────────────
                  _sectionTitle(
                      context, 'Secteurs d\'activité — Top 5'),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 300,
                    child: sectorDistribution.isNotEmpty
                        ? PieChart(
                            PieChartData(
                              sections: List.generate(
                                sectorDistribution.length > 5
                                    ? 5
                                    : sectorDistribution.length,
                                (index) => PieChartSectionData(
                                  value:
                                      (sectorDistribution[index]['employees']
                                              as int)
                                          .toDouble(),
                                  title:
                                      '${sectorDistribution[index]['sector']}\n${sectorDistribution[index]['employees']}',
                                  radius: 100,
                                  color: _getColorForIndex(index),
                                  titleStyle: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white),
                                ),
                              ),
                            ),
                          )
                        : const Center(
                            child: Text('Pas de données disponibles')),
                  ),
                  const SizedBox(height: 28),

                  // ── Employment trends bar chart ────────────────────────────
                  _sectionTitle(context, 'Évolution de l\'emploi (4 ans)'),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 220,
                    child: employmentTrends.isNotEmpty
                        ? BarChart(
                            BarChartData(
                              barGroups: List.generate(
                                employmentTrends.length,
                                (index) {
                                  final t = employmentTrends[index];
                                  final isCurrentYear =
                                      t['year'] == selectedYear;
                                  return BarChartGroupData(
                                    x: index,
                                    barRods: [
                                      BarChartRodData(
                                        toY: ((t['totalEmployees'] as int)
                                                .toDouble() /
                                            1000),
                                        color: isCurrentYear
                                            ? AppColors.deepEmerald
                                            : AppColors.lightEmerald
                                                .withAlpha(180),
                                        width: 20,
                                        borderRadius:
                                            const BorderRadius.vertical(
                                                top: Radius.circular(4)),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              titlesData: FlTitlesData(
                                bottomTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (value, meta) {
                                      final idx = value.toInt();
                                      if (idx < 0 ||
                                          idx >= employmentTrends.length) {
                                        return const SizedBox.shrink();
                                      }
                                      final y =
                                          employmentTrends[idx]['year'];
                                      return Padding(
                                        padding:
                                            const EdgeInsets.only(top: 4),
                                        child: Text(
                                          '$y',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight:
                                                y == selectedYear
                                                    ? FontWeight.bold
                                                    : FontWeight.normal,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    reservedSize: 36,
                                    getTitlesWidget: (value, meta) => Text(
                                        '${value.toInt()}K',
                                        style:
                                            const TextStyle(fontSize: 10)),
                                  ),
                                ),
                                topTitles: const AxisTitles(
                                    sideTitles:
                                        SideTitles(showTitles: false)),
                                rightTitles: const AxisTitles(
                                    sideTitles:
                                        SideTitles(showTitles: false)),
                              ),
                              gridData: FlGridData(
                                drawVerticalLine: false,
                                getDrawingHorizontalLine: (v) => FlLine(
                                    color: Colors.grey.shade200,
                                    strokeWidth: 1),
                              ),
                              borderData: FlBorderData(show: false),
                            ),
                          )
                        : const Center(
                            child: Text('Pas de données disponibles')),
                  ),
                  const SizedBox(height: 28),

                  // ── Gender distribution ────────────────────────────────────
                  _sectionTitle(context, 'Distribution par genre'),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _GenderTile(
                          icon: Icons.male,
                          label: 'Hommes',
                          value:
                              '${dashboardData['genderDistribution']?['male'] ?? '0'}%',
                          color: Colors.blue,
                        ),
                        _GenderTile(
                          icon: Icons.female,
                          label: 'Femmes',
                          value:
                              '${dashboardData['genderDistribution']?['female'] ?? '0'}%',
                          color: Colors.pink,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Text(title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold, color: AppColors.deepEmerald));
  }

  Widget _buildMetricCard(String label, String value, IconData icon) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.lightEmerald),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.deepEmerald, size: 28),
          const SizedBox(height: 8),
          Text(label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
              textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepEmerald)),
        ],
      ),
    );
  }

  Color _getColorForIndex(int index) {
    final colors = [
      AppColors.deepEmerald,
      AppColors.lightEmerald,
      Colors.teal,
      Colors.green,
      Colors.greenAccent,
    ];
    return colors[index % colors.length];
  }
}

// ── Year-over-year comparison section ───────────────────────────────────────

class _YoYComparisonSection extends StatelessWidget {
  final Map<String, dynamic> currentData;
  final Map<String, dynamic> prevData;
  final int currentYear;

  const _YoYComparisonSection({
    required this.currentData,
    required this.prevData,
    required this.currentYear,
  });

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _YoYMetric(
        label: 'Employés',
        icon: Icons.people_outline,
        current: currentData['totalEmployees'] as int? ?? 0,
        previous: prevData['totalEmployees'] as int? ?? 0,
      ),
      _YoYMetric(
        label: 'Recrutements',
        icon: Icons.person_add_outlined,
        current: currentData['totalRecruitments'] as int? ?? 0,
        previous: prevData['totalRecruitments'] as int? ?? 0,
      ),
      _YoYMetric(
        label: 'Départs',
        icon: Icons.person_remove_outlined,
        current: currentData['totalDismissals'] as int? ?? 0,
        previous: prevData['totalDismissals'] as int? ?? 0,
        lowerIsBetter: true,
      ),
      _YoYMetric(
        label: 'Solde net',
        icon: Icons.balance,
        current: currentData['netChange'] as int? ?? 0,
        previous: prevData['netChange'] as int? ?? 0,
      ),
    ];

    return Column(
      children: [
        // Header row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Row(
            children: [
              const Expanded(flex: 3, child: SizedBox()),
              Expanded(
                flex: 2,
                child: Text(
                  '${currentYear - 1}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.slate),
                ),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  '$currentYear',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.deepEmerald),
                ),
              ),
              const Expanded(
                flex: 2,
                child: Text(
                  'Évolution',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.slate),
                ),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        ...metrics.map((m) => _YoYRow(metric: m)),
      ],
    );
  }
}

class _YoYMetric {
  final String label;
  final IconData icon;
  final int current;
  final int previous;
  final bool lowerIsBetter;

  const _YoYMetric({
    required this.label,
    required this.icon,
    required this.current,
    required this.previous,
    this.lowerIsBetter = false,
  });

  int get delta => current - previous;

  double? get pct {
    if (previous == 0) return null;
    return (delta / previous) * 100;
  }

  bool get isPositive => lowerIsBetter ? delta < 0 : delta > 0;
  bool get isNeutral => delta == 0;
}

class _YoYRow extends StatelessWidget {
  final _YoYMetric metric;

  const _YoYRow({required this.metric});

  @override
  Widget build(BuildContext context) {
    final pct = metric.pct;
    final pctText = pct != null
        ? '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(1)}%'
        : metric.delta > 0
            ? '+${metric.delta}'
            : '${metric.delta}';

    Color deltaColor;
    IconData deltaIcon;
    if (metric.isNeutral) {
      deltaColor = Colors.grey;
      deltaIcon = Icons.remove;
    } else if (metric.isPositive) {
      deltaColor = Colors.green.shade700;
      deltaIcon =
          metric.lowerIsBetter ? Icons.trending_down : Icons.trending_up;
    } else {
      deltaColor = Colors.red.shade600;
      deltaIcon =
          metric.lowerIsBetter ? Icons.trending_up : Icons.trending_down;
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Row(
              children: [
                Icon(metric.icon,
                    size: 16, color: AppColors.deepEmerald),
                const SizedBox(width: 6),
                Text(metric.label,
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              _fmt(metric.previous),
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12, color: Colors.grey.shade600),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              _fmt(metric.current),
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(
            flex: 2,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(deltaIcon, size: 14, color: deltaColor),
                const SizedBox(width: 2),
                Text(
                  pctText,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: deltaColor),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(int v) {
    if (v.abs() >= 1000) {
      return '${(v / 1000).toStringAsFixed(1)}K';
    }
    return '$v';
  }
}

// ── Gender tile ─────────────────────────────────────────────────────────────

class _GenderTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _GenderTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 32),
        const SizedBox(height: 8),
        Text(label,
            style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(value,
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: color)),
      ],
    );
  }
}
