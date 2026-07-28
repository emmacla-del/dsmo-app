// lib/screens/onefop/onefop_analytics_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../data/api_client.dart';
import '../../theme/ultra_theme.dart';
import '../../widgets/period_selector.dart';

class OnefopAnalyticsScreen extends ConsumerStatefulWidget {
  const OnefopAnalyticsScreen({super.key});

  @override
  ConsumerState<OnefopAnalyticsScreen> createState() =>
      _OnefopAnalyticsScreenState();
}

class _OnefopAnalyticsScreenState extends ConsumerState<OnefopAnalyticsScreen> {
  PeriodConfig _period = PeriodConfig(
    type: PeriodType.year,
    year: DateTime.now().year,
  );

  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedSubdivision;

  // Data holders — types corrected to match backend responses
  Map<String, dynamic> _dashboard = {};
  List<dynamic> _employment = [];
  List<dynamic> _recruitmentTrends = [];
  List<dynamic> _hiresByDemographics = []; // ← was Map, backend returns List
  List<dynamic> _hiresByDiploma = [];
  List<dynamic> _vacancies = [];
  List<dynamic> _skills = [];
  Map<String, dynamic> _trainingGap = {};
  Map<String, dynamic> _genderParity = {};
  Map<String, dynamic> _youthEmployment = {};
  Map<String, dynamic> _inclusion = {};

  bool _loading = true;
  String? _error;

  // Filters
  String _employmentGroupBy = 'region';
  String _trendsGranularity = 'year';
  String _vacanciesGroupBy = 'sector';
  String? _selectedCsp; // values: null | 'CADRES' | 'FOREMEN' | 'WORKERS'
  String? _selectedGender; // values: null | 'MALE' | 'FEMALE'
  String?
      _selectedAgeBand; // values: null | 'AGE_15_24' | 'AGE_25_34' | 'AGE_35_PLUS'

  final int _currentYear = DateTime.now().year;
  List<Map<String, dynamic>> _geoStructure = [];
  bool _geoLoading = true;

  List<String> get _regionNames =>
      _geoStructure.map((r) => r['name'] as String).toList();

  List<String> _departmentNames(String? regionName) {
    if (regionName == null) return [];
    final region = _geoStructure.firstWhere(
      (r) => r['name'] == regionName,
      orElse: () => <String, dynamic>{},
    );
    if (region.isEmpty) return [];
    return (region['departments'] as List<dynamic>)
        .map((d) => d['name'] as String)
        .toList();
  }

  List<String> _subdivisionNames(String? regionName, String? deptName) {
    if (regionName == null || deptName == null) return [];
    final region = _geoStructure.firstWhere(
      (r) => r['name'] == regionName,
      orElse: () => <String, dynamic>{},
    );
    if (region.isEmpty) return [];
    final depts = region['departments'];
    if (depts is! List) return [];
    final dept = depts.whereType<Map>().firstWhere(
          (d) => d['name'] == deptName,
          orElse: () => {},
        );
    if (dept.isEmpty) return [];
    final subs = dept['subdivisions'];
    if (subs is! List) return [];
    return subs
        .whereType<Map>()
        .map((s) => s['name']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadGeoStructure();
    _fetchAll();
  }

  Future<void> _loadGeoStructure() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.getLocationStructure();
      if (mounted) {
        setState(() {
          _geoStructure =
              res.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _geoLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _geoLoading = false);
    }
  }

  Future<void> _fetchAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final periodParams = _period.toApiParams();

      final results = await Future.wait([
        // 0 — dashboard
        api.getOnefopDashboard(
          year: periodParams['year'],
          fromQuarter: periodParams['fromQuarter'],
          toQuarter: periodParams['toQuarter'],
          startDate: periodParams['startDate'],
          endDate: periodParams['endDate'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
        ),
        // 1 — employment by location
        api.getOnefopEmployment(
          year: periodParams['year'],
          fromQuarter: periodParams['fromQuarter'],
          toQuarter: periodParams['toQuarter'],
          startDate: periodParams['startDate'],
          endDate: periodParams['endDate'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          groupBy: _employmentGroupBy,
        ),
        // 2 — recruitment trends
        api.getOnefopRecruitmentTrends(
          startYear: (periodParams['year'] ?? _currentYear) - 2,
          endYear: periodParams['year'] ?? _currentYear,
          fromQuarter: periodParams['fromQuarter'],
          toQuarter: periodParams['toQuarter'],
          startDate: periodParams['startDate'],
          endDate: periodParams['endDate'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          granularity: _trendsGranularity,
        ),
        // 3 — hires by demographics (returns List)
        api.getOnefopHires(
          year: periodParams['year'],
          fromQuarter: periodParams['fromQuarter'],
          toQuarter: periodParams['toQuarter'],
          startDate: periodParams['startDate'],
          endDate: periodParams['endDate'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          csp: _selectedCsp,
          gender: _selectedGender,
          ageGroup: _selectedAgeBand,
        ),
        // 4 — hires by diploma
        api.getOnefopHiresByDiploma(
          year: periodParams['year'],
          fromQuarter: periodParams['fromQuarter'],
          toQuarter: periodParams['toQuarter'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          limit: 10,
        ),
        // 5 — vacancies
        api.getOnefopVacancies(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          groupBy: _vacanciesGroupBy,
        ),
        // 6 — skills
        api.getOnefopSkills(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          limit: 10,
        ),
        // 7 — training gap
        api.getOnefopTrainingGap(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
        ),
        // 8 — gender parity
        api.getOnefopGenderParity(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
        ),
        // 9 — youth employment
        api.getOnefopYouthEmployment(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
        ),
        // 10 — inclusion
        api.getOnefopInclusion(
          year: periodParams['year'],
          region: _selectedRegion,
          department: _selectedDepartment,
          subdivision: _selectedSubdivision,
          breakdownBy: 'both',
        ),
      ]);

      setState(() {
        _dashboard = (results[0] as Map?)?.cast<String, dynamic>() ?? {};
        _employment = results[1] is List ? results[1] as List : [];
        _recruitmentTrends = results[2] is List ? results[2] as List : [];
        _hiresByDemographics = results[3] is List ? results[3] as List : [];
        _hiresByDiploma = results[4] is List ? results[4] as List : [];
        _vacancies = results[5] is List ? results[5] as List : [];
        _skills = results[6] is List ? results[6] as List : [];
        _trainingGap = (results[7] as Map?)?.cast<String, dynamic>() ?? {};
        _genderParity = (results[8] as Map?)?.cast<String, dynamic>() ?? {};
        _youthEmployment = (results[9] as Map?)?.cast<String, dynamic>() ?? {};
        _inclusion = (results[10] as Map?)?.cast<String, dynamic>() ?? {};
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: UltraTheme.background,
      appBar: AppBar(
        backgroundColor: UltraTheme.surface,
        foregroundColor: UltraTheme.textPrimary,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ONEFOP · Analyse approfondie',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: UltraTheme.textPrimary,
                    fontWeight: FontWeight.bold)),
            Text(_period.displayText,
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: UltraTheme.textMuted)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_alt_outlined, size: 20),
            onPressed: _showFilterDialog,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: _fetchAll,
          ),
        ],
      ),
      body: _loading
          ? _skeleton()
          : _error != null
              ? _errorState()
              : RefreshIndicator(
                  onRefresh: _fetchAll,
                  color: UltraTheme.primary,
                  backgroundColor: UltraTheme.surface,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      PeriodSelector(
                        initialType: _period.type,
                        initialYear: _period.year,
                        initialQuarter: _period.quarter,
                        initialSemester: _period.semester,
                        initialCustomRange: _period.customRange,
                        onChanged: (newPeriod) {
                          setState(() => _period = newPeriod);
                          _fetchAll();
                        },
                      ),
                      const SizedBox(height: 16),
                      _buildLiveBanner(),
                      _buildKpiRow(),
                      const SizedBox(height: 16),
                      _buildEmploymentSection(),
                      const SizedBox(height: 24),
                      _buildRecruitmentTrendsSection(),
                      const SizedBox(height: 24),
                      _buildHiresDemographicsSection(),
                      const SizedBox(height: 24),
                      _buildDiplomaSection(),
                      const SizedBox(height: 24),
                      _buildVacanciesSection(),
                      const SizedBox(height: 24),
                      _buildSkillsSection(),
                      const SizedBox(height: 24),
                      _buildSocialMetricsSection(),
                      const SizedBox(height: 16),
                      _buildArchiveShortcut(),
                    ],
                  ),
                ),
    );
  }

  void _showFilterDialog() {
    String? tempRegion = _selectedRegion;
    String? tempDepartment = _selectedDepartment;
    String? tempSubdivision = _selectedSubdivision;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: UltraTheme.surface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('Filtres géographiques',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  color: UltraTheme.textPrimary,
                  fontWeight: FontWeight.bold)),
          content: SizedBox(
            width: 320,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_geoLoading)
                  const LinearProgressIndicator(color: Color(0xFF1D9E75))
                else ...[
                  DropdownButtonFormField<String?>(
                    value: tempRegion,
                    decoration: const InputDecoration(
                      labelText: 'Région',
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      const DropdownMenuItem(
                          value: null, child: Text('Toutes les régions')),
                      ..._regionNames.map(
                          (r) => DropdownMenuItem(value: r, child: Text(r))),
                    ],
                    onChanged: (v) => setDialogState(() {
                      tempRegion = v;
                      tempDepartment = null;
                      tempSubdivision = null;
                    }),
                  ),
                  if (tempRegion != null) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: tempDepartment,
                      decoration: const InputDecoration(
                        labelText: 'Département',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('Tous les départements')),
                        ..._departmentNames(tempRegion).map(
                            (d) => DropdownMenuItem(value: d, child: Text(d))),
                      ],
                      onChanged: (v) => setDialogState(() {
                        tempDepartment = v;
                        tempSubdivision = null;
                      }),
                    ),
                  ],
                  if (tempDepartment != null &&
                      _subdivisionNames(tempRegion, tempDepartment)
                          .isNotEmpty) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String?>(
                      value: tempSubdivision,
                      decoration: const InputDecoration(
                        labelText: 'Arrondissement',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem(
                            value: null,
                            child: Text('Tous les arrondissements')),
                        ..._subdivisionNames(tempRegion, tempDepartment).map(
                            (s) => DropdownMenuItem(value: s, child: Text(s))),
                      ],
                      onChanged: (v) =>
                          setDialogState(() => tempSubdivision = v),
                    ),
                  ],
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Annuler',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: UltraTheme.textMuted)),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedRegion = tempRegion;
                  _selectedDepartment = tempDepartment;
                  _selectedSubdivision = tempSubdivision;
                });
                Navigator.pop(ctx);
                _fetchAll();
              },
              child: Text('Appliquer',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      color: UltraTheme.primary)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiRow() {
    final employment = _dashboard['employment'] as Map? ?? {};
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _kpiItem(
              'Effectif total',
              (employment['totalEmployees'] ?? 0).toString(),
              UltraTheme.primary,
            ),
            _kpiItem(
              'Soumissions',
              (_dashboard['submissionCount'] ?? 0).toString(),
              UltraTheme.primaryLight,
            ),
          ],
        ),
      ),
    );
  }

  Widget _kpiItem(String label, String value, Color accent) {
    return Column(
      children: [
        Text(label,
            style: TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: UltraTheme.textMuted)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: accent,
          ),
        ),
      ],
    );
  }

  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        8,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Container(
            height: i == 0 ? 80 : 240,
            decoration: BoxDecoration(
              color: UltraTheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
          ),
        ),
      ),
    );
  }

  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded,
                size: 56, color: UltraTheme.textMuted),
            const SizedBox(height: 16),
            const Text('Connexion impossible',
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: UltraTheme.textPrimary,
                )),
            const SizedBox(height: 8),
            Text(_error ?? '',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 11,
                    color: UltraTheme.textMuted),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _fetchAll,
              style: ElevatedButton.styleFrom(
                backgroundColor: UltraTheme.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmploymentSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Emploi par localisation',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: UltraTheme.textPrimary,
                        fontWeight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _employmentGroupBy,
                  items: const [
                    DropdownMenuItem(value: 'region', child: Text('Région')),
                    DropdownMenuItem(
                        value: 'department', child: Text('Département')),
                    DropdownMenuItem(
                        value: 'subdivision', child: Text('Arrondissement')),
                  ],
                  onChanged: (v) {
                    setState(() => _employmentGroupBy = v!);
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 300,
              child: _employment.isEmpty
                  ? const Center(child: Text('Aucune donnée'))
                  : BarChart(
                      BarChartData(
                        barGroups: _employment.asMap().entries.map((e) {
                          return BarChartGroupData(
                            x: e.key,
                            barRods: [
                              BarChartRodData(
                                toY:
                                    (e.value['totalEmployees'] ?? 0).toDouble(),
                                color: UltraTheme.primary,
                              ),
                            ],
                          );
                        }).toList(),
                        titlesData: FlTitlesData(
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                final index = value.toInt();
                                if (index >= 0 && index < _employment.length) {
                                  return Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      _employment[index]['name'] ?? '',
                                      style: const TextStyle(fontSize: 10),
                                    ),
                                  );
                                }
                                return const Text('');
                              },
                            ),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        gridData: const FlGridData(show: false),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecruitmentTrendsSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Tendances des recrutements',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: UltraTheme.textPrimary,
                        fontWeight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _trendsGranularity,
                  items: const [
                    DropdownMenuItem(value: 'year', child: Text('Année')),
                    DropdownMenuItem(
                        value: 'quarter', child: Text('Trimestre')),
                    DropdownMenuItem(
                        value: 'semester', child: Text('Semestre')),
                    DropdownMenuItem(value: 'month', child: Text('Mois')),
                  ],
                  onChanged: (v) {
                    setState(() => _trendsGranularity = v!);
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 250,
              child: _recruitmentTrends.isEmpty
                  ? const Center(child: Text('Aucune donnée'))
                  : LineChart(
                      LineChartData(
                        lineBarsData: [
                          LineChartBarData(
                            spots: _recruitmentTrends
                                .asMap()
                                .entries
                                .map((e) => FlSpot(
                                      e.key.toDouble(),
                                      (e.value['totalRecruitments'] ?? 0)
                                          .toDouble(),
                                    ))
                                .toList(),
                            isCurved: true,
                            color: UltraTheme.primary,
                            barWidth: 3,
                          ),
                        ],
                        titlesData: FlTitlesData(
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                final index = value.toInt();
                                if (index >= 0 &&
                                    index < _recruitmentTrends.length) {
                                  return Text(
                                    _recruitmentTrends[index]['period'] ?? '',
                                    style: const TextStyle(fontSize: 10),
                                  );
                                }
                                return const Text('');
                              },
                            ),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        gridData: const FlGridData(show: true),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHiresDemographicsSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Embauches par démographie',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: UltraTheme.textPrimary,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),

            // CSP — uppercase values matching backend CspCategory enum
            Wrap(spacing: 8, children: [
              FilterChip(
                label: const Text('Tous CSP'),
                selected: _selectedCsp == null,
                onSelected: (_) {
                  setState(() => _selectedCsp = null);
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('Cadres'),
                selected: _selectedCsp == 'CADRES',
                onSelected: (_) {
                  setState(() => _selectedCsp = 'CADRES');
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('Agents de maîtrise'),
                selected: _selectedCsp == 'FOREMEN',
                onSelected: (_) {
                  setState(() => _selectedCsp = 'FOREMEN');
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('Ouvriers'),
                selected: _selectedCsp == 'WORKERS',
                onSelected: (_) {
                  setState(() => _selectedCsp = 'WORKERS');
                  _fetchAll();
                },
              ),
            ]),
            const SizedBox(height: 8),

            // Gender — uppercase values matching backend Gender enum
            Wrap(spacing: 8, children: [
              FilterChip(
                label: const Text('Tous genres'),
                selected: _selectedGender == null,
                onSelected: (_) {
                  setState(() => _selectedGender = null);
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('Hommes'),
                selected: _selectedGender == 'MALE',
                onSelected: (_) {
                  setState(() => _selectedGender = 'MALE');
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('Femmes'),
                selected: _selectedGender == 'FEMALE',
                onSelected: (_) {
                  setState(() => _selectedGender = 'FEMALE');
                  _fetchAll();
                },
              ),
            ]),
            const SizedBox(height: 8),

            // Age band — matches backend AgeBand enum exactly
            Wrap(spacing: 8, children: [
              FilterChip(
                label: const Text('Tous âges'),
                selected: _selectedAgeBand == null,
                onSelected: (_) {
                  setState(() => _selectedAgeBand = null);
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('15–24'),
                selected: _selectedAgeBand == 'AGE_15_24',
                onSelected: (_) {
                  setState(() => _selectedAgeBand = 'AGE_15_24');
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('25–34'),
                selected: _selectedAgeBand == 'AGE_25_34',
                onSelected: (_) {
                  setState(() => _selectedAgeBand = 'AGE_25_34');
                  _fetchAll();
                },
              ),
              FilterChip(
                label: const Text('35+'),
                selected: _selectedAgeBand == 'AGE_35_PLUS',
                onSelected: (_) {
                  setState(() => _selectedAgeBand = 'AGE_35_PLUS');
                  _fetchAll();
                },
              ),
            ]),
            const SizedBox(height: 16),

            if (_hiresByDemographics.isEmpty)
              const Center(child: Text('Aucune donnée'))
            else
              ..._hiresByDemographics.map((row) => ListTile(
                    dense: true,
                    title: Text(
                      '${row['cspCategory']} · ${row['gender']} · ${row['ageBand']}',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 12,
                          color: UltraTheme.textPrimary),
                    ),
                    trailing: Text(
                      '${row['count']}',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: UltraTheme.primary),
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildDiplomaSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Embauches par diplôme',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: UltraTheme.textPrimary,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (_hiresByDiploma.isEmpty)
              const Center(child: Text('Aucune donnée'))
            else
              ..._hiresByDiploma.map((d) => ListTile(
                    dense: true,
                    title: Text(d['diploma']?.toString() ?? '',
                        style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            color: UltraTheme.textPrimary)),
                    trailing: Text(
                      '${d['total'] ?? 0}',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: UltraTheme.primary),
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildVacanciesSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Postes vacants par segment',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 14,
                        color: UltraTheme.textPrimary,
                        fontWeight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _vacanciesGroupBy,
                  items: const [
                    DropdownMenuItem(value: 'sector', child: Text('Secteur')),
                    DropdownMenuItem(
                        value: 'companySize', child: Text('Taille entreprise')),
                  ],
                  onChanged: (v) {
                    setState(() => _vacanciesGroupBy = v!);
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_vacancies.isEmpty)
              const Center(child: Text('Aucune donnée'))
            else
              ..._vacancies.map((v) => ListTile(
                    dense: true,
                    title: Text(v['segment']?.toString() ?? '',
                        style: TextStyle(
                            fontFamily: 'Inter',
                            fontSize: 12,
                            color: UltraTheme.textPrimary)),
                    trailing: Text(
                      '${v['totalVacancies']} postes',
                      style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 13,
                          color: UltraTheme.primary),
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildSkillsSection() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Compétences demandées',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: UltraTheme.textPrimary,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (_skills.isEmpty)
              const Center(child: Text('Aucune donnée'))
            else
              ..._skills.map((s) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(s['skill']?.toString() ?? '',
                              style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12,
                                  color: UltraTheme.textPrimary)),
                        ),
                        Text(
                          '${s['totalCount']} mentions',
                          style: TextStyle(
                              fontFamily: 'Inter',
                              fontSize: 11,
                              color: UltraTheme.primary),
                        ),
                      ],
                    ),
                  )),
            const SizedBox(height: 16),
            Text('Écart formation (Demande vs Offre)',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 13,
                    color: UltraTheme.textSecondary,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...(_trainingGap['skillsInDemand'] as List? ?? [])
                .map((g) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g['skill']?.toString() ?? '',
                              style: TextStyle(
                                  fontFamily: 'Inter',
                                  fontSize: 12,
                                  color: UltraTheme.textPrimary)),
                          Text(
                            'Demande: ${g['demand']}, Offre: ${g['supply']}',
                            style: TextStyle(
                                fontFamily: 'Inter',
                                fontSize: 11,
                                color: UltraTheme.textMuted),
                          ),
                        ],
                      ),
                    )),
          ],
        ),
      ),
    );
  }

  Widget _buildSocialMetricsSection() {
    final femalePct =
        ((_genderParity['femalePercentage'] as num?)?.toDouble() ?? 0) / 100;
    final disabledByCsp = (_inclusion['disabledByCsp'] as List?) ?? [];
    final vulnerableByType = (_inclusion['vulnerableByType'] as List?) ?? [];

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: UltraTheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Parité · Jeunes · Inclusion',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 14,
                    color: UltraTheme.textPrimary,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            // Gender parity
            Text('Parité H/F',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: UltraTheme.textSecondary)),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: femalePct.clamp(0.0, 1.0),
              backgroundColor: UltraTheme.primaryLight.withAlpha(60),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(UltraTheme.primary),
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
            const SizedBox(height: 4),
            Text(
              'H: ${(_genderParity['malePercentage'] as num?)?.toStringAsFixed(1) ?? '0.0'}%'
              '  ·  '
              'F: ${(_genderParity['femalePercentage'] as num?)?.toStringAsFixed(1) ?? '0.0'}%',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 11,
                  color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 12),

            // Youth employment
            Text('Emploi jeunes',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: UltraTheme.textSecondary)),
            Text(
              '${_youthEmployment['youthHires'] ?? 0} embauches'
              ' (${(_youthEmployment['youthPercentage'] as num?)?.toStringAsFixed(1) ?? '0.0'}%)',
              style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  color: UltraTheme.primaryLight),
            ),
            const SizedBox(height: 12),

            // Inclusion totals
            Text('Inclusion',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: UltraTheme.textSecondary)),
            Text('Handicapés : ${_inclusion['disabled'] ?? 0}',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: UltraTheme.textPrimary)),
            Text('Vulnérables : ${_inclusion['vulnerable'] ?? 0}',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 12,
                    color: UltraTheme.textPrimary)),

            if (disabledByCsp.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Par CSP (handicapés)',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: UltraTheme.textMuted)),
              ...disabledByCsp.map((e) => Text(
                    '${e['cspCategory']}: ${e['count']}',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        color: UltraTheme.textPrimary),
                  )),
            ],

            if (vulnerableByType.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Par type (vulnérables)',
                  style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 11,
                      color: UltraTheme.textMuted)),
              ...vulnerableByType.map((e) => Text(
                    '${e['vulnerableType']}: ${e['count']}',
                    style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 11,
                        color: UltraTheme.textPrimary),
                  )),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLiveBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF5E7),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE67E22), width: 0.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded,
              size: 16, color: Color(0xFF854F0B)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Données en temps réel — ${_period.displayText}'
              '${_selectedRegion != null ? ' · $_selectedRegion' : ''}. '
              'Les chiffres reflètent l\'état actuel de la base et peuvent '
              'différer des rapports officiels archivés.',
              style: const TextStyle(
                fontFamily: 'Inter',
                fontSize: 11,
                color: Color(0xFF854F0B),
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArchiveShortcut() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: OutlinedButton.icon(
        onPressed: () {
          Navigator.pushNamed(context, '/reports', arguments: {
            'prefill': {
              'periodType': _period.type.name,
              'year': _period.year,
              'quarter': _period.quarter,
              'semester': _period.semester,
              'customRange': _period.customRange,
            },
            'region': _selectedRegion,
            'department': _selectedDepartment,
            'subdivision': _selectedSubdivision,
          });
        },
        icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
        label: const Text(
          'Archiver ces données en rapport officiel',
          style: TextStyle(fontFamily: 'Inter', fontSize: 12),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF0F6E56),
          side: const BorderSide(color: Color(0xFF1D9E75), width: 0.5),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    );
  }
}
