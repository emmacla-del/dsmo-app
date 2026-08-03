// lib/features/analytics/widgets/inclusion_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/dashboard_models.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_type_utils.dart';
import 'analytics_section_header.dart';

class InclusionTab extends ConsumerWidget {
  final List<GenderRegion> gender;
  final DashboardSummary dashboard;
  final List<Animation<double>>? cardAnimations;

  const InclusionTab({
    super.key,
    required this.gender,
    required this.dashboard,
    this.cardAnimations,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final inclusionAsync = ref.watch(onefopInclusionProvider(period));
    // NEW: dedicated gender parity + youth employment providers
    final parityAsync = ref.watch(onefopGenderDistributionProvider(period));
    final firstTimeAsync = ref.watch(onefopFirstTimeEmploymentProvider(period));

    final anims = cardAnimations;
    final hasAnims = anims != null && anims.isNotEmpty;

    Widget donutCard =
        GenderDonut(genderDistribution: dashboard.genderDistribution);
    Widget tableCard = GenderTable(rows: gender);
    if (hasAnims) {
      donutCard =
          AnimatedCard(animation: anims[0 % anims.length], child: donutCard);
      tableCard =
          AnimatedCard(animation: anims[1 % anims.length], child: tableCard);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Parité H/F ─────────────────────────────────────
          const AnalyticsSectionHeader(title: 'Inclusion & Égalité des chances'),
          subtitleLabel('Parité des demandes d\'emploi (S21Q01) — ne reflète pas l\'effectif en poste'),
          const SizedBox(height: 10),
          donutCard,
          const SizedBox(height: 16),

          // ── Parité régionale enrichie ──────────────────────
          sectionLabel('Répartition régionale'),
          const SizedBox(height: 10),
          tableCard,
          const SizedBox(height: 20),

          // ── NEW: Parité dédiée (provider enrichi) ──────────
          sectionLabel('Parité H/F — détail'),
          subtitleLabel('Parité des demandes d\'emploi (S21Q01)'),
          const SizedBox(height: 10),
          parityAsync.when(
            loading: () => const Shimmer(height: 120),
            error: (_, __) => emptyState('Données parité indisponibles'),
            data: (regions) => _ParityDetailCard(regions: regions),
          ),
          const SizedBox(height: 20),

          // ── NEW: Emploi jeunes ─────────────────────────────
          sectionLabel('Emploi jeunes'),
          const SizedBox(height: 10),
          firstTimeAsync.when(
            loading: () => const Shimmer(height: 100),
            error: (_, __) => emptyState('Données jeunes indisponibles'),
            data: (data) => _YouthEmploymentCard(data: data),
          ),
          const SizedBox(height: 20),

          // ── Inclusion & Handicap (enrichi) ─────────────────
          sectionLabel('Inclusion & Handicap'),
          const SizedBox(height: 10),
          inclusionAsync.when(
            loading: () => const Shimmer(height: 200),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _InclusionContent(data: data),
          ),
        ],
      ),
    );
  }
}

// ── NEW: Parité detail card ─────────────────────────────────────

class _ParityDetailCard extends StatelessWidget {
  final List<GenderRegion> regions;
  const _ParityDetailCard({required this.regions});

  @override
  Widget build(BuildContext context) {
    if (regions.isEmpty) return emptyState('Aucune donnée de parité');

    final totalMale = regions.fold<int>(0, (s, r) => s + r.male);
    final totalFemale = regions.fold<int>(0, (s, r) => s + r.female);
    final total = totalMale + totalFemale;
    final malePct = total > 0 ? totalMale / total * 100 : 0.0;
    final femalePct = total > 0 ? totalFemale / total * 100 : 0.0;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary bar
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('HOMMES', style: textMono(9, color: AccentColor.blue)),
                  const SizedBox(height: 2),
                  Text('${malePct.toStringAsFixed(1)}%',
                      style: textMono(22,
                          color: AccentColor.blue, weight: FontWeight.bold)),
                  Text(formatNumber(totalMale),
                      style: textMono(10, color: TextColor.muted)),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('FEMMES', style: textMono(9, color: AccentColor.rose)),
                  const SizedBox(height: 2),
                  Text('${femalePct.toStringAsFixed(1)}%',
                      style: textMono(22,
                          color: AccentColor.rose, weight: FontWeight.bold)),
                  Text(formatNumber(totalFemale),
                      style: textMono(10, color: TextColor.muted)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          // Split bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Row(
              children: [
                Flexible(
                  flex: totalMale,
                  child: Container(height: 8, color: AccentColor.blue),
                ),
                Flexible(
                  flex: totalFemale,
                  child: Container(height: 8, color: AccentColor.rose),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: InkColor.border, height: 1),
          const SizedBox(height: 12),
          Text('TOP 5 RÉGIONS PAR EFFECTIF',
              style: textMono(9, color: TextColor.muted)),
          const SizedBox(height: 8),
          ...([...regions]..sort((a, b) => b.total.compareTo(a.total)))
              .take(5)
              .map((r) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(children: [
                      Expanded(
                          flex: 3,
                          child: Text(r.region,
                              style: textMono(10, color: TextColor.secondary),
                              overflow: TextOverflow.ellipsis)),
                      Expanded(
                          flex: 2,
                          child: Text(formatNumber(r.male),
                              textAlign: TextAlign.center,
                              style: textMono(10, color: AccentColor.blue))),
                      Expanded(
                          flex: 2,
                          child: Text(formatNumber(r.female),
                              textAlign: TextAlign.center,
                              style: textMono(10, color: AccentColor.rose))),
                      Expanded(
                          flex: 2,
                          child: Text(formatNumber(r.total),
                              textAlign: TextAlign.right,
                              style: textMono(10,
                                  color: TextColor.primary,
                                  weight: FontWeight.bold))),
                    ]),
                  )),
        ],
      ),
    );
  }
}

// ── NEW: Youth employment card ──────────────────────────────────

class _YouthEmploymentCard extends StatelessWidget {
  final dynamic data;
  const _YouthEmploymentCard({required this.data});

  @override
  Widget build(BuildContext context) {
    // Pull youth fields; fall back gracefully if provider doesn't expose them
    final recruitsTotal = safeInt(data.recruitsTotal);
    final conversionRate = safeDouble(data.conversionRate);

    final age15 = safeInt(data.recruitsAge15_24);
    final age25 = safeInt(data.recruitsAge25_34);
    final age35 = safeInt(data.recruitsAge35Plus);

    final youthHires = age15 + age25; // 15–34 = "jeunes"
    final youthPct = recruitsTotal > 0
        ? (youthHires / recruitsTotal * 100).toStringAsFixed(1)
        : '0.0';

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header stats
          Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('EMBAUCHES JEUNES (15-34)',
                      style: textMono(9, color: AccentColor.teal)),
                  const SizedBox(height: 4),
                  Text(formatNumber(youthHires),
                      style: textMono(24,
                          color: AccentColor.teal, weight: FontWeight.bold)),
                  Text('$youthPct% des recrutements',
                      style: textMono(10, color: TextColor.muted)),
                ],
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('TAUX DE CONVERSION',
                      style: textMono(9, color: AccentColor.gold)),
                  const SizedBox(height: 4),
                  Text('${conversionRate.toStringAsFixed(1)}%',
                      style: textMono(24,
                          color: AccentColor.gold, weight: FontWeight.bold)),
                  Text('demandes → emplois',
                      style: textMono(10, color: TextColor.muted)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 16),
          const Divider(color: InkColor.border, height: 1),
          const SizedBox(height: 12),
          Text('RÉPARTITION PAR TRANCHE D\'ÂGE',
              style: textMono(9, color: TextColor.muted)),
          const SizedBox(height: 10),
          _buildAgeRow('15 – 24 ans', age15, recruitsTotal, AccentColor.teal),
          const SizedBox(height: 8),
          _buildAgeRow('25 – 34 ans', age25, recruitsTotal, AccentColor.blue),
          const SizedBox(height: 8),
          _buildAgeRow('35 ans et +', age35, recruitsTotal, AccentColor.gold),
        ],
      ),
    );
  }

  Widget _buildAgeRow(String label, int value, int total, Color color) {
    final pct = total > 0 ? value / total : 0.0;
    final pctStr = (pct * 100).toStringAsFixed(0);
    return Row(children: [
      SizedBox(
          width: 80,
          child: Text(label, style: textMono(10, color: TextColor.secondary))),
      const SizedBox(width: 8),
      Expanded(
        child: LinearProgressIndicator(
          value: pct,
          backgroundColor: Colors.white.withAlpha(12),
          valueColor: AlwaysStoppedAnimation(color),
          minHeight: 6,
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      const SizedBox(width: 8),
      SizedBox(
        width: 70,
        child: Text('${formatNumber(value)} ($pctStr%)',
            style: textMono(10, color: color, weight: FontWeight.bold),
            textAlign: TextAlign.right),
      ),
    ]);
  }
}

// ── Enriched _InclusionContent ──────────────────────────────────

class _InclusionContent extends StatelessWidget {
  final dynamic data;
  const _InclusionContent({required this.data});

  @override
  Widget build(BuildContext context) {
    final handicapTotal = safeInt(data.byCsp['CADRES']) +
        safeInt(data.byCsp['FOREMEN']) +
        safeInt(data.byCsp['WORKERS']);

    return Column(
      children: [
        // Totals row
        Row(
          children: [
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Icon(Icons.accessible_forward,
                          size: 16, color: AccentColor.blue),
                      const SizedBox(width: 6),
                      Text('Personnes handicapées',
                          style: textMono(10, color: AccentColor.blue)),
                    ]),
                    const SizedBox(height: 8),
                    Text(formatNumber(handicapTotal),
                        style: textMono(24,
                            color: AccentColor.blue, weight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      const Icon(Icons.people_outline,
                          size: 16, color: AccentColor.teal),
                      const SizedBox(width: 6),
                      Text('Personnes vulnérables',
                          style: textMono(10, color: AccentColor.teal)),
                    ]),
                    const SizedBox(height: 8),
                    Text(formatNumber(safeInt(data.total)),
                        style: textMono(24,
                            color: AccentColor.teal, weight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Handicap by CSP
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.accessible_forward,
                    size: 14, color: AccentColor.blue),
                const SizedBox(width: 6),
                Text('Handicap par CSP',
                    style: textMono(10, color: AccentColor.blue)),
              ]),
              const SizedBox(height: 10),
              _buildProgressRow('Cadres', safeInt(data.byCsp['CADRES']),
                  handicapTotal, AccentColor.blue),
              _buildProgressRow(
                  'Agents de maîtrise',
                  safeInt(data.byCsp['FOREMEN']),
                  handicapTotal,
                  AccentColor.blue),
              _buildProgressRow('Ouvriers', safeInt(data.byCsp['WORKERS']),
                  handicapTotal, AccentColor.blue),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Vulnerable by type
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.people_outline, size: 14, color: AccentColor.teal),
                const SizedBox(width: 6),
                Text('Nature de la vulnérabilité',
                    style: textMono(10, color: AccentColor.teal)),
              ]),
              const SizedBox(height: 10),
              _buildProgressRow('Déplacés internes',
                  safeInt(data.internalDisplaced), safeInt(data.total), AccentColor.teal),
              _buildProgressRow('Réfugiés', safeInt(data.refugees), safeInt(data.total),
                  AccentColor.teal),
              _buildProgressRow('Orphelins', safeInt(data.orphans), safeInt(data.total),
                  AccentColor.teal),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildProgressRow(String label, int value, int total, Color color) {
    final pct = total > 0 ? value / total : 0.0;
    final pctStr = (pct * 100).toStringAsFixed(0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(
            width: 120,
            child: Text(label,
                style: textMono(10, color: TextColor.secondary),
                overflow: TextOverflow.ellipsis)),
        Expanded(
          child: LinearProgressIndicator(
            value: pct,
            backgroundColor: Colors.white.withAlpha(12),
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 70,
          child: Text('$value ($pctStr%)',
              style: textMono(10, color: color, weight: FontWeight.bold),
              textAlign: TextAlign.right),
        ),
      ]),
    );
  }
}

// ── Unchanged widgets ───────────────────────────────────────────

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
