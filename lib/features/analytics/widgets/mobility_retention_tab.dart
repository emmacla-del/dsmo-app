// lib/features/analytics/widgets/mobility_retention_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import '../models/mobility_dashboard.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_widgets.dart';
import 'analytics_type_utils.dart';
import 'analytics_section_header.dart';

class MobilityRetentionTab extends ConsumerWidget {
  const MobilityRetentionTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final departuresAsync = ref.watch(onefopDeparturesProvider(period));
    final dismissalReasonsAsync =
        ref.watch(onefopDismissalReasonsProvider(period));
    final dismissalUnemploymentAsync =
        ref.watch(onefopTechnicalUnemploymentProvider(period));
    final mobilityAsync = ref.watch(onefopMobilityDashboardProvider(period));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Mobilité & Rétention'),
          const SizedBox(height: 16),

          // ── KPIs ─────────────────────────────────────────────
          _buildKpiGrid(
              departuresAsync, dismissalUnemploymentAsync, mobilityAsync),
          const SizedBox(height: 24),

          // ── Departures by Type ──────────────────────────────
          sectionLabel('Départs par type'),
          const SizedBox(height: 10),
          departuresAsync.when(
            loading: () => const Shimmer(height: 220),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _DeparturesCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Dismissal Reasons ───────────────────────────────
          sectionLabel('Motifs de licenciement'),
          const SizedBox(height: 10),
          dismissalReasonsAsync.when(
            loading: () => const Shimmer(height: 260),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _DismissalReasonsCard(data: data),
          ),
          const SizedBox(height: 24),

          // ── Technical Unemployment / Business Stress ──────
          sectionLabel('Chômage technique & stress économique'),
          const SizedBox(height: 10),
          dismissalUnemploymentAsync.when(
            loading: () => const Shimmer(height: 200),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _BusinessStressCard(data: data),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiGrid(
      AsyncValue<DeparturesMobility> departuresAsync,
      AsyncValue<dynamic> unemploymentAsync,
      AsyncValue<MobilityDashboard> mobilityAsync) {
    final departures = departuresAsync.valueOrNull;
    final totalDepartures = departures?.total ?? 0;
    final dismissals = departures?.dismissals ?? 0;
    final resignations = departures?.resignations ?? 0;
    final retirements = departures?.retirements ?? 0;

    final dismissalSharePct =
        totalDepartures > 0 ? (dismissals / totalDepartures * 100) : 0.0;

    final techUnemployment =
        safeInt(unemploymentAsync.valueOrNull?['technicalTotal']);
    final techShare =
        safeDouble(unemploymentAsync.valueOrNull?['techShare']);
    final stressIndex = techShare * 100;

    final mobility = mobilityAsync.valueOrNull;

    return ResponsiveGrid(
      children: [
        KpiCard(
          def: const KpiDef(
            'total_departures',
            'Départs totaux',
            Icons.people_outline,
            AccentColor.blue,
          ),
          value: formatNumber(totalDepartures),
          delta: null,
          onTap: () {},
        ),
        KpiCard(
          def: const KpiDef(
            'attrition_rate',
            'Part des licenciements',
            Icons.trending_down,
            AccentColor.rose,
          ),
          value: '${dismissalSharePct.toStringAsFixed(1)}% des départs',
          delta: null,
          onTap: () {},
        ),
        KpiCard(
          def: const KpiDef(
            'dismissals',
            'Licenciements',
            Icons.work_off,
            AccentColor.gold,
          ),
          value:
              '${formatNumber(dismissals)} · $resignations démissions · $retirements retraites',
          delta: null,
          onTap: () {},
        ),
        KpiCard(
          def: const KpiDef(
            'economic_stress',
            'Stress économique',
            Icons.warning,
            AccentColor.teal,
          ),
          value:
              '${stressIndex.toStringAsFixed(2)}% · ${formatNumber(techUnemployment)} chômage technique',
          delta: null,
          onTap: () {},
        ),
        KpiCard(
          def: const KpiDef(
            'turnover_rate',
            'Taux de rotation',
            Icons.autorenew_rounded,
            AccentColor.blue,
          ),
          value: mobility != null
              ? '${mobility.turnoverRate.toStringAsFixed(1)}% de l\'effectif'
              : '—',
          delta: null,
          onTap: () {},
        ),
        KpiCard(
          def: const KpiDef(
            'retention_rate',
            'Taux de rétention',
            Icons.shield_outlined,
            AccentColor.teal,
          ),
          value: mobility != null
              ? '${mobility.retentionRate.toStringAsFixed(1)}%'
              : '—',
          delta: null,
          onTap: () {},
        ),
      ],
    );
  }
}

// ── Departures Breakdown Card ─────────────────────────────────

class _DeparturesCard extends StatelessWidget {
  final DeparturesMobility data;
  const _DeparturesCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final dismissals = data.dismissals;
    final resignations = data.resignations;
    final retirements = data.retirements;
    final other = data.other;
    final total = dismissals + resignations + retirements + other;

    final sections = [
      _PieSection('Licenciements', dismissals, total, AccentColor.rose),
      _PieSection('Démissions', resignations, total, AccentColor.gold),
      _PieSection('Retraites', retirements, total, AccentColor.teal),
      _PieSection('Autres', other, total, AccentColor.blue),
    ].where((s) => s.value > 0).toList();

    return GlassCard(
      child: Row(
        children: [
          SizedBox(
            width: 160,
            height: 160,
            child: PieChart(
              PieChartData(
                sections: sections.map((s) {
                  return PieChartSectionData(
                    value: s.value.toDouble(),
                    color: s.color,
                    radius: 50,
                    title: '${(s.pct * 100).toStringAsFixed(0)}%',
                    titleStyle: textMono(10,
                        color: Colors.white, weight: FontWeight.bold),
                  );
                }).toList(),
                centerSpaceRadius: 35,
                sectionsSpace: 2,
              ),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: sections.map((s) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                            color: s.color,
                            borderRadius: BorderRadius.circular(2)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(s.label,
                            style: textMono(10, color: TextColor.secondary)),
                      ),
                      Text(formatNumber(s.value),
                          style: textMono(10,
                              color: s.color, weight: FontWeight.bold)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _PieSection {
  final String label;
  final int value;
  final int total;
  final Color color;
  double get pct => total > 0 ? value / total : 0;
  _PieSection(this.label, this.value, this.total, this.color);
}

// ── Dismissal Reasons Card ────────────────────────────────────

class _DismissalReasonsCard extends StatelessWidget {
  final dynamic data;
  const _DismissalReasonsCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final reasons = (data as List<dynamic>?) ?? [];
    final total =
        reasons.fold<int>(0, (s, r) => s + safeInt(r['totalCount']));

    final sorted = [...reasons]..sort((a, b) =>
        safeInt(b['totalCount']).compareTo(safeInt(a['totalCount'])));

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PRINCIPAUX MOTIFS DE LICENCIEMENT',
              style: textMono(10,
                  color: AccentColor.rose, weight: FontWeight.bold)),
          const SizedBox(height: 12),
          if (sorted.isEmpty)
            emptyState('Aucune donnée')
          else
            ...sorted.take(6).map((r) {
              final reason = r['reason']?.toString() ?? 'Non précisé';
              final count = safeInt(r['totalCount']);
              final pct = total > 0 ? count / total : 0.0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(reason,
                              style: textMono(10, color: TextColor.secondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                        ),
                        Text(formatNumber(count),
                            style: textMono(10,
                                color: AccentColor.rose,
                                weight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(
                      value: pct,
                      backgroundColor: Colors.white.withAlpha(12),
                      valueColor:
                          const AlwaysStoppedAnimation(AccentColor.rose),
                      minHeight: 6,
                      borderRadius: BorderRadius.circular(3),
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

// ── Business Stress / Technical Unemployment Card ─────────────

class _BusinessStressCard extends StatelessWidget {
  final dynamic data;
  const _BusinessStressCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final techByCsp = (data['techByCsp'] as Map?) ?? {};
    final technicalTotal = safeInt(data['technicalTotal']);
    final stressIndex = safeDouble(data['techShare']);
    final stressLabel = stressIndex > 0.05
        ? 'ÉLEVÉ'
        : stressIndex > 0.02
            ? 'MODÉRÉ'
            : 'FAIBLE';
    final stressColor = stressIndex > 0.05
        ? AccentColor.rose
        : stressIndex > 0.02
            ? AccentColor.gold
            : AccentColor.teal;

    final cspRows = techByCsp.entries.toList()
      ..sort((a, b) => safeInt(b.value).compareTo(safeInt(a.value)));

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('INDICE DE STRESS ÉCONOMIQUE',
                        style: textMono(9, color: TextColor.muted)),
                    const SizedBox(height: 4),
                    Text('${(stressIndex * 100).toStringAsFixed(2)}%',
                        style: textMono(24,
                            color: stressColor, weight: FontWeight.bold)),
                    Text('Chômage technique / (Chômage technique + licenciements)',
                        style: textMono(10, color: TextColor.muted)),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: stressColor.withAlpha(20),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: stressColor.withAlpha(60)),
                ),
                child: Text(
                  stressLabel,
                  style:
                      textMono(11, color: stressColor, weight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: InkColor.border, height: 1),
          const SizedBox(height: 12),
          Text('RÉPARTITION PAR CSP',
              style: textMono(9, color: TextColor.muted)),
          const SizedBox(height: 8),
          if (cspRows.isEmpty)
            emptyState('Aucune donnée')
          else
            ...cspRows.map((entry) {
              final csp = entry.key.toString();
              final count = entry.value as int;
              final pct = technicalTotal > 0 ? count / technicalTotal : 0.0;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    SizedBox(
                      width: 120,
                      child: Text(csp,
                          style: textMono(10, color: TextColor.secondary),
                          overflow: TextOverflow.ellipsis),
                    ),
                    Expanded(
                      child: LinearProgressIndicator(
                        value: pct,
                        backgroundColor: Colors.white.withAlpha(12),
                        valueColor:
                            const AlwaysStoppedAnimation(AccentColor.gold),
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 70,
                      child: Text(formatNumber(count),
                          style: textMono(10,
                              color: AccentColor.gold, weight: FontWeight.bold),
                          textAlign: TextAlign.right),
                    ),
                  ],
                ),
              );
            }),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AccentColor.rose.withAlpha(10),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AccentColor.rose.withAlpha(30)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline,
                    size: 16, color: AccentColor.rose),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Un indice > 5% signale une détresse économique significative dans l\'échantillon.',
                    style: textMono(9, color: AccentColor.rose),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
