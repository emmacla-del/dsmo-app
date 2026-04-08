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

      final summaryResp = await api.get(
        '/dsmo/analytics/dashboard-summary',
        queryParameters: {'year': selectedYear},
      );
      final trendsResp = await api.get(
        '/dsmo/analytics/employment-trends',
        queryParameters: {
          'startYear': selectedYear - 2,
          'endYear': selectedYear,
        },
      );
      final sectorsResp = await api.get(
        '/dsmo/analytics/sector-distribution',
        queryParameters: {'year': selectedYear},
      );

      if (!mounted) return;
      setState(() {
        dashboardData = summaryResp.data;
        employmentTrends = trendsResp.data ?? [];
        sectorDistribution = sectorsResp.data ?? [];
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
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Year selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Année:',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      DropdownButton<int>(
                        value: selectedYear,
                        items: List.generate(5, (i) => selectedYear - i)
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
                  const SizedBox(height: 24),

                  // Key metrics
                  Text('Métriques clés',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepEmerald)),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
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
                  const SizedBox(height: 24),

                  // Distribution par secteur
                  Text('Secteurs d\'activité (Top 5)',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepEmerald)),
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
                                  value: (sectorDistribution[index]['employees']
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
                  const SizedBox(height: 24),

                  // Employment trends
                  Text('Évolution de l\'emploi',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepEmerald)),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 200,
                    child: employmentTrends.isNotEmpty
                        ? BarChart(
                            BarChartData(
                              barGroups: List.generate(
                                employmentTrends.length,
                                (index) => BarChartGroupData(
                                  x: index,
                                  barRods: [
                                    BarChartRodData(
                                      toY: (employmentTrends[index]
                                                  ['totalEmployees'] as int)
                                              .toDouble() /
                                          1000,
                                      color: AppColors.deepEmerald,
                                    ),
                                  ],
                                ),
                              ),
                              titlesData: FlTitlesData(
                                bottomTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (value, meta) => Text(
                                      '${employmentTrends[value.toInt()]['year']}',
                                      style: const TextStyle(fontSize: 10),
                                    ),
                                  ),
                                ),
                                leftTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (value, meta) => Text(
                                        '${value.toInt()}K',
                                        style: const TextStyle(fontSize: 10)),
                                  ),
                                ),
                              ),
                            ),
                          )
                        : const Center(
                            child: Text('Pas de données disponibles')),
                  ),
                  const SizedBox(height: 24),

                  // Distribution par genre
                  Text('Distribution par genre',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepEmerald)),
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
                        Column(
                          children: [
                            const Icon(Icons.male,
                                color: Colors.blue, size: 32),
                            const SizedBox(height: 8),
                            Text('Hommes',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                            Text(
                                '${dashboardData['genderDistribution']?['male'] ?? '0'}%'),
                          ],
                        ),
                        Column(
                          children: [
                            const Icon(Icons.female,
                                color: Colors.pink, size: 32),
                            const SizedBox(height: 8),
                            Text('Femmes',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                            Text(
                                '${dashboardData['genderDistribution']?['female'] ?? '0'}%'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
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
