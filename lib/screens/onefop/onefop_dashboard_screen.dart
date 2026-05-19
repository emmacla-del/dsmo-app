import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../data/api_client.dart';
import '../../features/analytics/widgets/common_cards.dart';

class OnefopDashboardScreen extends ConsumerStatefulWidget {
  const OnefopDashboardScreen({super.key});

  @override
  ConsumerState<OnefopDashboardScreen> createState() =>
      _OnefopDashboardScreenState();
}

class _OnefopDashboardScreenState extends ConsumerState<OnefopDashboardScreen> {
  int _selectedYear = DateTime.now().year;
  Map<String, dynamic> _dashboard = {};
  Map<String, dynamic> _prevDashboard = {};
  List<dynamic> _skills = [];
  Map<String, dynamic> _genderParity = {};
  Map<String, dynamic> _youthEmployment = {};
  Map<String, dynamic> _inclusion = {};
  List<dynamic> _vacancies = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final results = await Future.wait([
        api.getOnefopDashboard(year: _selectedYear),
        api.getOnefopDashboard(
            year: _selectedYear - 1), // previous year for YoY
        api.getOnefopSkills(year: _selectedYear, limit: 5),
        api.getOnefopGenderParity(year: _selectedYear),
        api.getOnefopYouthEmployment(year: _selectedYear),
        api.getOnefopInclusion(year: _selectedYear, breakdownBy: 'both'),
        api.getOnefopVacancies(year: _selectedYear, groupBy: 'businessSector'),
      ]);

      setState(() {
        _dashboard = (results[0] as Map<String, dynamic>?) ?? {};
        _prevDashboard = (results[1] as Map<String, dynamic>?) ?? {};
        _skills = (results[2] as List<dynamic>?) ?? [];
        _genderParity = (results[3] as Map<String, dynamic>?) ?? {};
        _youthEmployment = (results[4] as Map<String, dynamic>?) ?? {};
        _inclusion = (results[5] as Map<String, dynamic>?) ?? {};
        _vacancies = (results[6] as List<dynamic>?) ?? [];
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
            Text('LMIS · Tableau de bord exécutif',
                style:
                    textMono(13, color: Colors.white, weight: FontWeight.bold)),
            Text('Année $_selectedYear',
                style: textMono(11, color: TextColor.muted)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today_outlined, size: 20),
            tooltip: 'Changer d\'année',
            onPressed: _selectYear,
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: _fetchData,
          ),
        ],
      ),
      body: _loading
          ? _skeleton()
          : _error != null
              ? _errorState()
              : RefreshIndicator(
                  onRefresh: _fetchData,
                  color: AccentColor.teal,
                  backgroundColor: InkColor.card,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _kpiGrid(),
                      const SizedBox(height: 20),
                      _genderCard(),
                      const SizedBox(height: 16),
                      _skillsCard(),
                      const SizedBox(height: 16),
                      _vacanciesCard(),
                      const SizedBox(height: 16),
                      _inclusionCard(),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  // ── KPI grid with YoY deltas ──────────────────────────────────────────────
  Widget _kpiGrid() {
    final totalEmp = _dashboard['totalEmployees'] as int? ?? 0;
    final prevTotalEmp = _prevDashboard['totalEmployees'] as int? ?? 0;
    final totalCo = _dashboard['totalCompanies'] as int? ?? 0;
    final prevCo = _prevDashboard['totalCompanies'] as int? ?? 0;
    final totalVac = _vacancies.fold<int>(
        0, (s, v) => s + (v['totalVacancies'] as int? ?? 0));
    final youthPct =
        (_youthEmployment['youthPercentage'] as num?)?.toDouble() ?? 0.0;
    const prevYouth =
        0.0; // previous year youth not fetched for brevity – delta omitted

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 1.45,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: [
        _kpiTile('Effectif total', totalEmp, prevTotalEmp, Icons.people_rounded,
            AccentColor.teal),
        _kpiTile('Entreprises', totalCo, prevCo, Icons.business_rounded,
            AccentColor.blue),
        _kpiTile('Postes vacants', totalVac, 0, Icons.work_outline_rounded,
            AccentColor.gold),
        _youthTile(youthPct),
      ],
    );
  }

  Widget _kpiTile(
      String label, int current, int previous, IconData icon, Color accent) {
    final delta = previous > 0 ? current - previous : null;
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: accent),
                const Spacer(),
                if (delta != null) DeltaBadge(delta: delta),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _fmt(current),
                  style: GoogleFonts.dmMono(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: TextColor.primary),
                ),
                const SizedBox(height: 2),
                Text(label, style: textMono(11, color: TextColor.muted)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _youthTile(double pct) {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Icon(Icons.people_outline_rounded,
                size: 18, color: AccentColor.rose),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${pct.toStringAsFixed(1)}%',
                  style: GoogleFonts.dmMono(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: TextColor.primary),
                ),
                const SizedBox(height: 2),
                Text('Jeunes (15–24)',
                    style: textMono(11, color: TextColor.muted)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Gender Parity ─────────────────────────────────────────────────────────
  Widget _genderCard() {
    final male = (_genderParity['malePercentage'] as num?)?.toDouble() ?? 0.0;
    final female =
        (_genderParity['femalePercentage'] as num?)?.toDouble() ?? 0.0;
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Parité homme / femme (candidatures)',
                style: textMono(12,
                    color: TextColor.secondary, weight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(
              children: [
                _genderStat('Hommes', male, AccentColor.blue),
                const Spacer(),
                SizedBox(
                  width: 72,
                  height: 72,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: female / 100,
                        strokeWidth: 8,
                        backgroundColor: AccentColor.blue.withAlpha(50),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            AccentColor.teal),
                      ),
                      Text('${female.toStringAsFixed(0)}%',
                          style: textMono(12,
                              color: TextColor.primary,
                              weight: FontWeight.bold)),
                    ],
                  ),
                ),
                const Spacer(),
                _genderStat('Femmes', female, AccentColor.teal),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _genderStat(String label, double pct, Color color) {
    return Column(
      children: [
        Text(label, style: textMono(11, color: color)),
        const SizedBox(height: 4),
        Text('${pct.toStringAsFixed(1)}%',
            style: textMono(18,
                color: TextColor.primary, weight: FontWeight.bold)),
      ],
    );
  }

  // ── Top Skills ────────────────────────────────────────────────────────────
  Widget _skillsCard() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome_rounded,
                    size: 16, color: AccentColor.gold),
                const SizedBox(width: 8),
                Text('Compétences les plus demandées',
                    style: textMono(12,
                        color: TextColor.secondary, weight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            if (_skills.isEmpty)
              Text('Aucune donnée', style: textMono(11, color: TextColor.muted))
            else
              ..._skills.map((s) {
                final count = s['count'] as int? ?? 0;
                final maxCount =
                    (_skills.first['count'] as int? ?? 1).clamp(1, 99999);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                              child: Text(s['skill']?.toString() ?? '',
                                  style:
                                      textMono(12, color: TextColor.primary))),
                          Text('$count',
                              style: textMono(12,
                                  color: AccentColor.teal,
                                  weight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: count / maxCount,
                        backgroundColor: InkColor.border,
                        valueColor: const AlwaysStoppedAnimation<Color>(
                            AccentColor.teal),
                        minHeight: 3,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }

  // ── Vacancies by sector ───────────────────────────────────────────────────
  Widget _vacanciesCard() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.work_outline_rounded,
                    size: 16, color: AccentColor.gold),
                const SizedBox(width: 8),
                Text('Postes vacants par secteur',
                    style: textMono(12,
                        color: TextColor.secondary, weight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            if (_vacancies.isEmpty)
              Text('Aucune donnée', style: textMono(11, color: TextColor.muted))
            else
              ..._vacancies.map((v) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                            child: Text(v['segment']?.toString() ?? '',
                                style: textMono(12, color: TextColor.primary))),
                        Text('${v['totalVacancies'] ?? 0}',
                            style: textMono(12,
                                color: AccentColor.blue,
                                weight: FontWeight.bold)),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  // ── Inclusion ─────────────────────────────────────────────────────────────
  Widget _inclusionCard() {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.accessibility_new_rounded,
                    size: 16, color: AccentColor.rose),
                const SizedBox(width: 8),
                Text('Inclusion',
                    style: textMono(12,
                        color: TextColor.secondary, weight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 12),
            _inclusionRow('Recrutements personnes handicapées',
                _inclusion['disabled'] as int? ?? 0),
            _inclusionRow('Recrutements personnes vulnérables',
                _inclusion['vulnerable'] as int? ?? 0),
          ],
        ),
      ),
    );
  }

  Widget _inclusionRow(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
              child:
                  Text(label, style: textMono(12, color: TextColor.primary))),
          Text('$value',
              style: textMono(13,
                  color: AccentColor.rose, weight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _skeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: List.generate(
        5,
        (i) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Shimmer(height: i == 0 ? 180 : 120),
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
            Text('Connexion impossible',
                style: GoogleFonts.dmSans(
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
              onTap: _fetchData,
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }

  void _selectYear() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: InkColor.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Sélectionner l\'année',
            style: textMono(14,
                color: TextColor.primary, weight: FontWeight.bold)),
        content: DropdownButton<int>(
          value: _selectedYear,
          dropdownColor: InkColor.card,
          style: textMono(13, color: TextColor.primary),
          items: List.generate(6, (i) => DateTime.now().year - i)
              .map((y) => DropdownMenuItem(value: y, child: Text(y.toString())))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              setState(() => _selectedYear = v);
              Navigator.pop(ctx);
              _fetchData();
            }
          },
        ),
      ),
    );
  }
}
