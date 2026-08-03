// lib/features/analytics/widgets/workforce_structure_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_section_header.dart';
import 'analytics_type_utils.dart';

class WorkforceStructureTab extends ConsumerWidget {
  final List<Sector> sectors;
  final List<Animation<double>>? cardAnimations;

  const WorkforceStructureTab({
    super.key,
    required this.sectors,
    this.cardAnimations,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final cspAsync = ref.watch(onefopRecruitmentCspProfileProvider(period));
    final diplomaAsync = ref.watch(onefopDiplomaProvider(period));
    final entityAsync = ref.watch(onefopEntityBreakdownProvider(period));
    final entitySizeAsync = ref.watch(onefopEntitySizeProvider(period));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Structure de la main-d\'œuvre'),
          subtitleLabel('Basé sur les recrutements de la période'),
          const SizedBox(height: 16),

          // ── KPIs ─────────────────────────────────────────────
          _buildKpiGrid(cspAsync),
          const SizedBox(height: 24),

          // ── Entity Type Breakdown ───────────────────────────
          sectionLabel('Répartition des déclarants par type d\'entité'),
          const SizedBox(height: 10),
          entityAsync.when(
            loading: () => const Shimmer(height: 120),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _EntityTypeBreakdownCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Entity Size Breakdown ────────────────────────────
          sectionLabel('Répartition par taille d\'entreprise'),
          subtitleLabel('Entreprises uniquement (S1Q12)'),
          const SizedBox(height: 10),
          entitySizeAsync.when(
            loading: () => const Shimmer(height: 100),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _EntitySizeCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── CSP Pyramid ─────────────────────────────────────
          sectionLabel('Pyramide des CSP des recrutements'),
          const SizedBox(height: 10),
          cspAsync.when(
            loading: () => const Shimmer(height: 220),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _CspPyramidCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Gender by CSP ───────────────────────────────────
          sectionLabel('Parité hommes/femmes par CSP (recrutements)'),
          const SizedBox(height: 10),
          cspAsync.when(
            loading: () => const Shimmer(height: 200),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _GenderByCspCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Diploma Distribution ────────────────────────────
          sectionLabel('Niveau de formation des recrues'),
          const SizedBox(height: 10),
          diplomaAsync.when(
            loading: () => const Shimmer(height: 260),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _DiplomaStructureCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Top Sectors ─────────────────────────────────────
          sectionLabel('Postes vacants par secteur'),
          subtitleLabel('Basé sur les postes vacants déclarés sur la période'),
          const SizedBox(height: 10),
          _SectorsTable(sectors: sectors),
        ],
      ),
    );
  }

  Widget _buildKpiGrid(AsyncValue<dynamic> cspAsync) {
    final total = safeInt(cspAsync.valueOrNull?['totalHires']);
    final cadres = safeInt(cspAsync.valueOrNull?['cadres']);
    final foremen = safeInt(cspAsync.valueOrNull?['foremen']);
    final workers = safeInt(cspAsync.valueOrNull?['workers']);

    final cadresPct = total > 0 ? (cadres / total * 100) : 0.0;
    final foremenPct = total > 0 ? (foremen / total * 100) : 0.0;
    final workersPct = total > 0 ? (workers / total * 100) : 0.0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.4,
      children: [
        _SimpleKpiCard(
          title: 'Recrutements totaux',
          value: formatNumber(total),
          icon: Icons.people_rounded,
          color: AccentColor.teal,
        ),
        _SimpleKpiCard(
          title: 'Cadres',
          value: '${cadresPct.toStringAsFixed(1)}%',
          subtitle: formatNumber(cadres),
          icon: Icons.manage_accounts_outlined,
          color: AccentColor.blue,
        ),
        _SimpleKpiCard(
          title: 'Agents de maîtrise',
          value: '${foremenPct.toStringAsFixed(1)}%',
          subtitle: formatNumber(foremen),
          icon: Icons.engineering_outlined,
          color: AccentColor.gold,
        ),
        _SimpleKpiCard(
          title: 'Ouvriers',
          value: '${workersPct.toStringAsFixed(1)}%',
          subtitle: formatNumber(workers),
          icon: Icons.construction_outlined,
          color: AccentColor.rose,
        ),
      ],
    );
  }
}

// ── Simple KPI Card (replacement for KpiCard from analytics_widgets)
class _SimpleKpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subtitle;
  final IconData icon;
  final Color color;

  const _SimpleKpiCard({
    required this.title,
    required this.value,
    this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, size: 18, color: color),
              Container(
                width: 3,
                height: 3,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            title,
            style: const TextStyle(fontSize: 9, color: TextColor.muted),
          ),
          if (subtitle != null)
            Text(
              subtitle!,
              style: const TextStyle(fontSize: 8, color: TextColor.muted),
            ),
        ],
      ),
    );
  }
}

// ── Entity Type Breakdown Card ──────────────────────────────
// `data` is the providers file's private _OnefopEntityBreakdown — access
// its public-named members dynamically: `.enterprises/.cooperatives/
// .ctds/.ongs`, each exposing `.count` and `.employees`.

class _EntityTypeBreakdownCard extends StatelessWidget {
  final dynamic data;
  const _EntityTypeBreakdownCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Entreprises', data.enterprises, AccentColor.teal),
      ('Coopératives', data.cooperatives, AccentColor.blue),
      ('CTD', data.ctds, AccentColor.gold),
      ('ONG', data.ongs, AccentColor.rose),
    ];
    final totalCount = rows.fold<int>(0, (s, r) => s + (r.$2.count as int));

    if (totalCount == 0) {
      return emptyState('Aucune donnée');
    }

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Expanded(
                    flex: 3,
                    child: Text("TYPE D'ENTITÉ",
                        style: textMono(9, color: TextColor.muted))),
                Expanded(
                    flex: 2,
                    child: Text('DÉCLARANTS',
                        textAlign: TextAlign.right,
                        style: textMono(9, color: TextColor.muted))),
                Expanded(
                    flex: 2,
                    child: Text('EFFECTIF',
                        textAlign: TextAlign.right,
                        style: textMono(9, color: TextColor.muted))),
              ],
            ),
          ),
          const Divider(color: InkColor.border, height: 1),
          ...rows.where((r) => (r.$2.count as int) > 0).map((r) {
            final label = r.$1;
            final count = r.$2.count as int;
            final employees = r.$2.employees as int;
            final color = r.$3;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration:
                        BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: Text(label,
                        style: textMono(11, color: TextColor.secondary)),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(formatNumber(count),
                        textAlign: TextAlign.right,
                        style: textMono(11, color: TextColor.secondary)),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(formatNumber(employees),
                        textAlign: TextAlign.right,
                        style: textMono(11,
                            color: color, weight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ── Entity Size Card ─────────────────────────────────────────

class _EntitySizeCard extends StatelessWidget {
  final EntitySizeItem data;
  const _EntitySizeCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final segments = [
      ('TPE', data.tpe, AccentColor.teal),
      ('PE', data.pe, AccentColor.blue),
      ('ME', data.me, AccentColor.gold),
      ('GE', data.ge, AccentColor.rose),
    ];

    if (data.total == 0) {
      return emptyState('Aucune donnée');
    }

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Row(
              children: segments
                  .where((s) => s.$2 > 0)
                  .map((s) => Flexible(
                        flex: s.$2,
                        child: Container(height: 10, color: s.$3),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: segments.map((s) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration:
                        BoxDecoration(color: s.$3, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text('${s.$1}: ${formatNumber(s.$2)}',
                      style: textMono(10, color: TextColor.secondary)),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

// ── CSP Pyramid Card ──────────────────────────────────────────

class _CspPyramidCard extends StatelessWidget {
  final dynamic data;
  const _CspPyramidCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final total = safeInt(data['totalHires']);
    final cadres = safeInt(data['cadres']);
    final foremen = safeInt(data['foremen']);
    final workers = safeInt(data['workers']);

    final sections = [
      _PyramidSection('Cadres', cadres, total, AccentColor.blue),
      _PyramidSection('Maîtrise', foremen, total, AccentColor.gold),
      _PyramidSection('Exécution', workers, total, AccentColor.rose),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 180,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.center,
                barGroups: sections.asMap().entries.map((e) {
                  return BarChartGroupData(
                    x: e.key,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.pct * 100,
                        color: e.value.color,
                        width: 60,
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(6)),
                      ),
                    ],
                  );
                }).toList(),
                titlesData: FlTitlesData(
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (v, _) {
                        final i = v.toInt();
                        if (i < 0 || i >= sections.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            sections[i].label,
                            style: textMono(10, color: TextColor.secondary),
                          ),
                        );
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 36,
                      getTitlesWidget: (v, _) => Text(
                        '${v.toInt()}%',
                        style: textMono(9, color: TextColor.muted),
                      ),
                    ),
                  ),
                  topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false)),
                ),
                gridData: FlGridData(
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: InkColor.border,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
              ),
            ),
          ),
          const SizedBox(height: 12),
          ...sections.map((s) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                        color: s.color, borderRadius: BorderRadius.circular(2)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${s.label}: ${formatNumber(s.value)}',
                      style: textMono(10, color: TextColor.secondary),
                    ),
                  ),
                  Text(
                    '${(s.pct * 100).toStringAsFixed(1)}%',
                    style:
                        textMono(10, color: s.color, weight: FontWeight.bold),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _PyramidSection {
  final String label;
  final int value;
  final int total;
  final Color color;
  double get pct => total > 0 ? value / total : 0;
  _PyramidSection(this.label, this.value, this.total, this.color);
}

String _cspLabel(String cspCategory) {
  switch (cspCategory) {
    case 'CADRES':
      return 'Cadres';
    case 'FOREMEN':
      return 'Agents de maîtrise';
    case 'WORKERS':
      return 'Ouvriers';
    default:
      return cspCategory;
  }
}

// ── Gender by CSP Card ──────────────────────────────────────

class _GenderByCspCard extends StatelessWidget {
  final dynamic data;
  const _GenderByCspCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final List<dynamic> rows = (data['byCsp'] as List?) ?? [];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (rows.isEmpty)
            emptyState('Aucune donnée')
          else
            ...rows.map((r) {
              final csp = _cspLabel(r['cspCategory']?.toString() ?? '');
              final male = safeInt(r['maleCount']);
              final female = safeInt(r['femaleCount']);
              final total = male + female;

              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(csp,
                        style: textMono(10,
                            color: TextColor.secondary,
                            weight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: Row(
                        children: [
                          if (male > 0)
                            Flexible(
                              flex: male,
                              child: Container(
                                height: 8,
                                color: AccentColor.blue,
                              ),
                            ),
                          if (female > 0)
                            Flexible(
                              flex: female,
                              child: Container(
                                height: 8,
                                color: AccentColor.rose,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text('${formatNumber(male)} H',
                            style: textMono(9, color: AccentColor.blue)),
                        const SizedBox(width: 8),
                        Text('${formatNumber(female)} F',
                            style: textMono(9, color: AccentColor.rose)),
                        const Spacer(),
                        Text(formatNumber(total),
                            style: textMono(9,
                                color: TextColor.muted,
                                weight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

// ── Diploma Structure Card ────────────────────────────────────

class _DiplomaStructureCard extends StatelessWidget {
  final dynamic data;
  const _DiplomaStructureCard({required this.data});

  @override
  Widget build(BuildContext context) {
    // `data` is the providers file's private _OnefopDiplomaResult — access
    // its public-named members dynamically: `.data` (List<_DiplomaItem>),
    // each item exposing `.diploma` and `.total`.
    final List<dynamic> rows = (data.data as List?) ?? [];
    final total = rows.fold<int>(0, (s, r) => s + safeInt(r.total));
    final sorted = [...rows]..sort(
        (a, b) => safeInt(b.total).compareTo(safeInt(a.total)));

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('NIVEAU DE FORMATION DES RECRUES',
              style: textMono(10,
                  color: AccentColor.teal, weight: FontWeight.bold)),
          const SizedBox(height: 12),
          if (sorted.isEmpty)
            emptyState('Aucune donnée')
          else
            ...sorted.take(8).map((r) {
              final label = r.diploma?.toString() ?? 'Non précisé';
              final count = safeInt(r.total);
              final pct = total > 0 ? count / total : 0.0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 140,
                      child: Text(label,
                          style: textMono(10, color: TextColor.secondary),
                          overflow: TextOverflow.ellipsis),
                    ),
                    Expanded(
                      child: LinearProgressIndicator(
                        value: pct,
                        backgroundColor: Colors.white.withAlpha(12),
                        valueColor: const AlwaysStoppedAnimation(AccentColor.teal),
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 60,
                      child: Text(formatNumber(count),
                          style: textMono(10,
                              color: AccentColor.teal, weight: FontWeight.bold),
                          textAlign: TextAlign.right),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

// ── Sectors Table ────────────────────────────────────────────

class _SectorsTable extends StatelessWidget {
  final List<Sector> sectors;
  const _SectorsTable({required this.sectors});

  @override
  Widget build(BuildContext context) {
    if (sectors.isEmpty) {
      return emptyState('Aucune donnée sectorielle');
    }
    final sorted = [...sectors]
      ..sort((a, b) => b.employees.compareTo(a.employees));

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Expanded(
                    flex: 3,
                    child: Text('SECTEUR',
                        style: textMono(9, color: TextColor.muted))),
                Expanded(
                    flex: 2,
                    child: Text('POSTES VACANTS',
                        textAlign: TextAlign.right,
                        style: textMono(9, color: TextColor.muted))),
              ],
            ),
          ),
          const Divider(color: InkColor.border, height: 1),
          ...sorted.take(10).map((s) => Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                        flex: 3,
                        child: Text(s.sector,
                            style: textMono(11, color: TextColor.secondary),
                            overflow: TextOverflow.ellipsis)),
                    Expanded(
                        flex: 2,
                        child: Text(formatNumber(s.employees),
                            textAlign: TextAlign.right,
                            style: textMono(11,
                                color: AccentColor.teal,
                                weight: FontWeight.bold))),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
