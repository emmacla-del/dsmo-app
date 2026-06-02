import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../data/api_client.dart';
import '../../features/analytics/widgets/common_cards.dart';

class OnefopAnalyticsScreen extends ConsumerStatefulWidget {
  const OnefopAnalyticsScreen({super.key});

  @override
  ConsumerState<OnefopAnalyticsScreen> createState() =>
      _OnefopAnalyticsScreenState();
}

class _OnefopAnalyticsScreenState extends ConsumerState<OnefopAnalyticsScreen> {
  // Shared state
  int _selectedYear = DateTime.now().year;
  String? _selectedRegion;
  String? _selectedDepartment;
  String? _selectedSubdivision;

  // Data holders
  Map<String, dynamic> _dashboard = {};
  List<dynamic> _employment = [];
  List<dynamic> _recruitmentTrends = [];
  Map<String, dynamic> _hiresByDemographics = {};
  dynamic _hiresByDiploma;
  List<dynamic> _vacancies = [];
  List<dynamic> _skills = [];
  Map<String, dynamic> _trainingGap = {};
  Map<String, dynamic> _genderParity = {};
  Map<String, dynamic> _youthEmployment = {};
  Map<String, dynamic> _inclusion = {};

  bool _loading = true;
  String? _error;

  // Filters for granular endpoints
  String _employmentGroupBy = 'region'; // region, department, subdivision
  String _trendsGranularity = 'year'; // year, quarter, month
  String _vacanciesGroupBy = 'businessSector'; // businessSector, companySize
  String? _selectedCsp;
  String? _selectedGender;
  String? _selectedAgeGroup;

  final int _currentYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);

      // Run all requests in parallel
      final results = await Future.wait([
        api.getOnefopDashboard(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision),
        api.getOnefopEmployment(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            groupBy: _employmentGroupBy),
        api.getOnefopRecruitmentTrends(
            startYear: _selectedYear - 2,
            endYear: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            granularity: _trendsGranularity),
        api.getOnefopHires(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            csp: _selectedCsp,
            gender: _selectedGender,
            ageGroup: _selectedAgeGroup),
        api.getOnefopHiresByDiploma(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            limit: 10),
        api.getOnefopVacancies(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            groupBy: _vacanciesGroupBy),
        api.getOnefopSkills(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            limit: 10),
        api.getOnefopTrainingGap(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision),
        api.getOnefopGenderParity(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision),
        api.getOnefopYouthEmployment(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision),
        api.getOnefopInclusion(
            year: _selectedYear,
            region: _selectedRegion,
            department: _selectedDepartment,
            subdivision: _selectedSubdivision,
            breakdownBy: 'both'),
      ]);

      setState(() {
        _dashboard = results[0];
        _employment = results[1];
        _recruitmentTrends = results[2];
        _hiresByDemographics = results[3];
        _hiresByDiploma = results[4];
        _vacancies = results[5];
        _skills = results[6];
        _trainingGap = results[7];
        _genderParity = results[8];
        _youthEmployment = results[9];
        _inclusion = results[10];
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
      backgroundColor: InkColor.base,
      appBar: AppBar(
        backgroundColor: InkColor.surface,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ONEFOP · Analyse approfondie',
                style:
                    textMono(13, color: Colors.white, weight: FontWeight.bold)),
            Text(
                '$_selectedYear${_selectedRegion != null ? ' · $_selectedRegion' : ''}',
                style: textMono(11, color: TextColor.muted)),
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
                  color: AccentColor.teal,
                  backgroundColor: InkColor.card,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Live data disclaimer + archive shortcut
                      _buildLiveBanner(),
                      // Summary KPIs
                      _buildKpiRow(),
                      const SizedBox(height: 16),
                      // Employment by location
                      _buildEmploymentSection(),
                      const SizedBox(height: 24),
                      // Recruitment trends
                      _buildRecruitmentTrendsSection(),
                      const SizedBox(height: 24),
                      // Hires by demographics
                      _buildHiresDemographicsSection(),
                      const SizedBox(height: 24),
                      // Hires by diploma
                      _buildDiplomaSection(),
                      const SizedBox(height: 24),
                      // Vacancies by segment
                      _buildVacanciesSection(),
                      const SizedBox(height: 24),
                      // Skills & training gap
                      _buildSkillsSection(),
                      const SizedBox(height: 24),
                      // Gender, youth, inclusion
                      // Gender, youth, inclusion
                      _buildSocialMetricsSection(),
                      const SizedBox(height: 16),
                      // Shortcut to freeze current view as an official report
                      _buildArchiveShortcut(),
                    ],
                  ),
                ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: InkColor.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Filtres',
            style: textMono(14,
                color: TextColor.primary, weight: FontWeight.bold)),
        content: StatefulBuilder(
          builder: (ctx, setDialogState) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<int>(
                initialValue: _selectedYear,
                decoration: const InputDecoration(labelText: 'Année'),
                items: List.generate(5, (i) => _currentYear - i)
                    .map((y) =>
                        DropdownMenuItem(value: y, child: Text(y.toString())))
                    .toList(),
                onChanged: (v) => setDialogState(() => _selectedYear = v!),
              ),
              TextFormField(
                initialValue: _selectedRegion,
                decoration:
                    const InputDecoration(labelText: 'Region (optional)'),
                onChanged: (v) => setDialogState(
                    () => _selectedRegion = v.isEmpty ? null : v),
              ),
              TextFormField(
                initialValue: _selectedDepartment,
                decoration:
                    const InputDecoration(labelText: 'Department (optional)'),
                onChanged: (v) => setDialogState(
                    () => _selectedDepartment = v.isEmpty ? null : v),
              ),
              TextFormField(
                initialValue: _selectedSubdivision,
                decoration:
                    const InputDecoration(labelText: 'Subdivision (optional)'),
                onChanged: (v) => setDialogState(
                    () => _selectedSubdivision = v.isEmpty ? null : v),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child:
                  Text('Annuler', style: textMono(12, color: TextColor.muted))),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _fetchAll();
            },
            child:
                Text('Appliquer', style: textMono(12, color: AccentColor.teal)),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiRow() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _kpiItem(
                'Effectif total',
                _dashboard['totalEmployees']?.toString() ?? '0',
                AccentColor.teal),
            _kpiItem(
                'Entreprises',
                _dashboard['totalCompanies']?.toString() ?? '0',
                AccentColor.blue),
          ],
        ),
      ),
    );
  }

  Widget _kpiItem(String label, String value, Color accent) {
    return Column(
      children: [
        Text(label, style: textMono(11, color: TextColor.muted)),
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
        5,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Shimmer(height: i == 0 ? 80 : 240),
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
                size: 56, color: TextColor.muted),
            const SizedBox(height: 16),
            const Text('Connexion impossible',
                style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: TextColor.primary)),
            const SizedBox(height: 8),
            Text(_error ?? '',
                style: textMono(11, color: TextColor.muted),
                textAlign: TextAlign.center),
            const SizedBox(height: 24),
            TealButton(
                label: 'Réessayer',
                icon: Icons.refresh_rounded,
                onTap: _fetchAll),
          ],
        ),
      ),
    );
  }

  Widget _buildEmploymentSection() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Emploi par localisation',
                    style: textMono(14,
                        color: TextColor.primary, weight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _employmentGroupBy,
                  items: const [
                    DropdownMenuItem(value: 'region', child: Text('Region')),
                    DropdownMenuItem(
                        value: 'department', child: Text('Department')),
                    DropdownMenuItem(
                        value: 'subdivision', child: Text('Subdivision')),
                  ],
                  onChanged: (v) {
                    setState(() {
                      _employmentGroupBy = v!;
                    });
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 300,
              child: _employment.isEmpty
                  ? const Center(child: Text('No data'))
                  : BarChart(
                      BarChartData(
                        barGroups: _employment.asMap().entries.map((e) {
                          return BarChartGroupData(
                            x: e.key,
                            barRods: [
                              BarChartRodData(
                                  toY: (e.value['totalEmployees'] ?? 0)
                                      .toDouble(),
                                  color: AccentColor.teal),
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
                                        style: const TextStyle(fontSize: 10)),
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
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Tendances des recrutements',
                    style: textMono(14,
                        color: TextColor.primary, weight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _trendsGranularity,
                  items: const [
                    DropdownMenuItem(value: 'year', child: Text('Year')),
                    DropdownMenuItem(value: 'quarter', child: Text('Quarter')),
                    DropdownMenuItem(value: 'month', child: Text('Month')),
                  ],
                  onChanged: (v) {
                    setState(() {
                      _trendsGranularity = v!;
                    });
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 250,
              child: _recruitmentTrends.isEmpty
                  ? const Center(child: Text('No data'))
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
                                        .toDouble()))
                                .toList(),
                            isCurved: true,
                            color: AccentColor.teal,
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
                                      style: const TextStyle(fontSize: 10));
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
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Embauches par démographie',
                style: textMono(14,
                    color: TextColor.primary, weight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All CSP'),
                  selected: _selectedCsp == null,
                  onSelected: (_) => setState(() => _selectedCsp = null),
                ),
                FilterChip(
                  label: const Text('Executives'),
                  selected: _selectedCsp == 'executives',
                  onSelected: (_) =>
                      setState(() => _selectedCsp = 'executives'),
                ),
                FilterChip(
                  label: const Text('Foremen'),
                  selected: _selectedCsp == 'foremen',
                  onSelected: (_) => setState(() => _selectedCsp = 'foremen'),
                ),
                FilterChip(
                  label: const Text('Field Workers'),
                  selected: _selectedCsp == 'fieldWorkers',
                  onSelected: (_) =>
                      setState(() => _selectedCsp = 'fieldWorkers'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All Genders'),
                  selected: _selectedGender == null,
                  onSelected: (_) => setState(() => _selectedGender = null),
                ),
                FilterChip(
                  label: const Text('Male'),
                  selected: _selectedGender == 'male',
                  onSelected: (_) => setState(() => _selectedGender = 'male'),
                ),
                FilterChip(
                  label: const Text('Female'),
                  selected: _selectedGender == 'female',
                  onSelected: (_) => setState(() => _selectedGender = 'female'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All Ages'),
                  selected: _selectedAgeGroup == null,
                  onSelected: (_) => setState(() => _selectedAgeGroup = null),
                ),
                FilterChip(
                  label: const Text('15-24'),
                  selected: _selectedAgeGroup == '15_24',
                  onSelected: (_) =>
                      setState(() => _selectedAgeGroup = '15_24'),
                ),
                FilterChip(
                  label: const Text('25-34'),
                  selected: _selectedAgeGroup == '25_34',
                  onSelected: (_) =>
                      setState(() => _selectedAgeGroup = '25_34'),
                ),
                FilterChip(
                  label: const Text('35+'),
                  selected: _selectedAgeGroup == '35plus',
                  onSelected: (_) =>
                      setState(() => _selectedAgeGroup = '35plus'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_hiresByDemographics.isNotEmpty)
              Text(
                  'Total hires: ${_hiresByDemographics['value'] ?? _hiresByDemographics.toString()}'),
          ],
        ),
      ),
    );
  }

  Widget _buildDiplomaSection() {
    List<dynamic> diplomas = [];
    if (_hiresByDiploma is List) {
      diplomas = _hiresByDiploma;
    } else if (_hiresByDiploma is Map &&
        _hiresByDiploma.containsKey('diploma')) {
      diplomas = [_hiresByDiploma];
    }
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Embauches par diplôme',
                style: textMono(14,
                    color: TextColor.primary, weight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...diplomas.map((d) => ListTile(
                title: Text(d['diploma']),
                trailing: Text('${d['hires']} hires'))),
            if (diplomas.isEmpty) const Text('No data'),
          ],
        ),
      ),
    );
  }

  Widget _buildVacanciesSection() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Postes vacants par segment',
                    style: textMono(14,
                        color: TextColor.primary, weight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _vacanciesGroupBy,
                  items: const [
                    DropdownMenuItem(
                        value: 'businessSector',
                        child: Text('Business Sector')),
                    DropdownMenuItem(
                        value: 'companySize', child: Text('Company Size')),
                  ],
                  onChanged: (v) {
                    setState(() {
                      _vacanciesGroupBy = v!;
                    });
                    _fetchAll();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            ..._vacancies.map((v) => ListTile(
                title: Text(v['segment']),
                trailing: Text('${v['totalVacancies']} vacancies'))),
            if (_vacancies.isEmpty) const Text('No data'),
          ],
        ),
      ),
    );
  }

  Widget _buildSkillsSection() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Compétences demandées',
                style: textMono(14,
                    color: TextColor.primary, weight: FontWeight.bold)),
            const SizedBox(height: 8),
            ..._skills.map((s) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                          child: Text(s['skill']?.toString() ?? '',
                              style: textMono(12, color: TextColor.primary))),
                      Text('${s['count']} mentions',
                          style: textMono(11, color: AccentColor.teal)),
                    ],
                  ),
                )),
            const SizedBox(height: 16),
            Text('Écart formation (Demande vs Offre)',
                style: textMono(13,
                    color: TextColor.secondary, weight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...(_trainingGap['skillsInDemand'] as List? ?? [])
                .map((g) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(g['skill']?.toString() ?? '',
                              style: textMono(12, color: TextColor.primary)),
                          Text('Demande: ${g['demand']}, Offre: ${g['supply']}',
                              style: textMono(11, color: TextColor.muted)),
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
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Parité · Jeunes · Inclusion',
                style: textMono(14,
                    color: TextColor.primary, weight: FontWeight.bold)),
            const SizedBox(height: 12),
            Text('Parité H/F', style: textMono(12, color: TextColor.secondary)),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: femalePct,
              backgroundColor: AccentColor.blue.withAlpha(60),
              valueColor: const AlwaysStoppedAnimation<Color>(AccentColor.teal),
              minHeight: 6,
              borderRadius: BorderRadius.circular(3),
            ),
            const SizedBox(height: 4),
            Text(
                'H: ${_genderParity['malePercentage']?.toStringAsFixed(1)}%  ·  F: ${_genderParity['femalePercentage']?.toStringAsFixed(1)}%',
                style: textMono(11, color: TextColor.muted)),
            const SizedBox(height: 12),
            Text('Emploi jeunes',
                style: textMono(12, color: TextColor.secondary)),
            Text(
                '${_youthEmployment['youthHires'] ?? 0} embauches  (${_youthEmployment['youthPercentage']?.toStringAsFixed(1)}%)',
                style: textMono(13, color: AccentColor.blue)),
            const SizedBox(height: 12),
            Text('Inclusion', style: textMono(12, color: TextColor.secondary)),
            Text('Handicapés : ${_inclusion['disabled'] ?? 0}',
                style: textMono(12, color: TextColor.primary)),
            Text('Vulnérables : ${_inclusion['vulnerable'] ?? 0}',
                style: textMono(12, color: TextColor.primary)),
            if (_inclusion['disabledByCSP'] != null) ...[
              const SizedBox(height: 8),
              Text('Par CSP (handicapés)',
                  style: textMono(11, color: TextColor.muted)),
              ...(_inclusion['disabledByCSP'] as Map<String, dynamic>)
                  .entries
                  .map((e) => Text('${e.key}: ${e.value}',
                      style: textMono(11, color: TextColor.primary))),
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
              'Données en temps réel — $_selectedYear'
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
          // Pre-fill ReportScreen wizard with current filters.
          // Adjust the route name to match your Navigator setup.
          Navigator.pushNamed(context, '/reports', arguments: {
            'year': _selectedYear,
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
