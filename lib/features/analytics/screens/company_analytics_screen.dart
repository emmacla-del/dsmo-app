// lib/features/analytics/screens/company_analytics_screen.dart
//
// HYBRID — merges v1 + v2 completely:
//
// Structure  : TabController (v2) — 3 tabs: Bilan RH · Benchmarking · Opportunités
// Tab 1      : BilanRh (bilanRhProvider, v2 widgets) + CompanySummary cards
//              (companySummaryProvider, v1 widgets) stacked in one scrollable view
// Tab 2      : Real benchmarking via companyBenchmarksProvider (v1 logic) when
//              hasBenchmarking=true; _ComingSoonView (v2) otherwise
// Tab 3      : _ComingSoonView (v2)
// Shimmer    : Animated _ShimmerLoading with AnimationController (v1)
// Data models: All v1 models (CompanySummary, GenderBreakdown, MovementSummary,
//              BenchmarkData) + v2 BilanRh models via bilan_rh.dart
// Providers  : companySummaryProvider + companyBenchmarksProvider (v1) +
//              bilanRhProvider (v2) — all present
// Widgets    : Every widget from both versions preserved

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../providers/auth_provider.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';
import '../data/bilan_rh.dart';

// ═══════════════════════════════════════════════════════════
// DATA MODELS  (v1)
// ═══════════════════════════════════════════════════════════

class CompanySummary {
  final int year;
  final int totalEmployees;
  final GenderBreakdown gender;
  final Map<String, int> categories;
  final MovementSummary movements;
  final double growthRate;

  CompanySummary({
    required this.year,
    required this.totalEmployees,
    required this.gender,
    required this.categories,
    required this.movements,
    required this.growthRate,
  });

  factory CompanySummary.fromJson(Map<String, dynamic> json) => CompanySummary(
        year: json['year'] as int,
        totalEmployees: json['totalEmployees'] as int,
        gender:
            GenderBreakdown.fromJson(json['gender'] as Map<String, dynamic>),
        categories: (json['categories'] as Map<String, dynamic>).map(
          (k, v) => MapEntry(k, v as int),
        ),
        movements:
            MovementSummary.fromJson(json['movements'] as Map<String, dynamic>),
        growthRate: (json['growthRate'] as num).toDouble(),
      );
}

class GenderBreakdown {
  final int male;
  final int female;
  final double malePct;
  final double femalePct;

  GenderBreakdown({
    required this.male,
    required this.female,
    required this.malePct,
    required this.femalePct,
  });

  factory GenderBreakdown.fromJson(Map<String, dynamic> json) =>
      GenderBreakdown(
        male: json['male'] as int,
        female: json['female'] as int,
        malePct: (json['malePct'] as num).toDouble(),
        femalePct: (json['femalePct'] as num).toDouble(),
      );
}

class MovementSummary {
  final int recruitments;
  final int dismissals;
  final int retirements;
  final int netChange;

  MovementSummary({
    required this.recruitments,
    required this.dismissals,
    required this.retirements,
    required this.netChange,
  });

  factory MovementSummary.fromJson(Map<String, dynamic> json) =>
      MovementSummary(
        recruitments: json['recruitments'] as int,
        dismissals: json['dismissals'] as int,
        retirements: json['retirements'] as int,
        netChange: json['netChange'] as int,
      );
}

class BenchmarkData {
  final bool available;
  final String? reason;
  final int? peerCount;
  final String groupBy;
  final Map<String, dynamic>? metrics;

  BenchmarkData({
    required this.available,
    this.reason,
    this.peerCount,
    required this.groupBy,
    this.metrics,
  });

  factory BenchmarkData.fromJson(Map<String, dynamic> json) => BenchmarkData(
        available: json['available'] as bool,
        reason: json['reason'] as String?,
        peerCount: json['peerCount'] as int?,
        groupBy: json['groupBy'] as String? ?? 'sector',
        metrics: json['metrics'] as Map<String, dynamic>?,
      );
}

// ═══════════════════════════════════════════════════════════
// PROVIDERS  (v1 + v2 — all kept)
// ═══════════════════════════════════════════════════════════

/// v1 — company overview aggregated from DSMO
final companySummaryProvider =
    FutureProvider.family<CompanySummary?, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  try {
    final response = await api.get('/dsmo/analytics/company-summary',
        queryParameters: {'year': year});
    return CompanySummary.fromJson(response.data as Map<String, dynamic>);
  } on DioException catch (e) {
    if (e.response?.statusCode == 403) return null;
    rethrow;
  }
});

/// v1 — sectoral benchmarks (gated behind feature flag)
final companyBenchmarksProvider =
    FutureProvider.family<BenchmarkData?, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  try {
    final response = await api.get(
      '/dsmo/analytics/company-benchmarks',
      queryParameters: {'year': year, 'groupBy': 'sector'},
    );
    return BenchmarkData.fromJson(response.data as Map<String, dynamic>);
  } on DioException catch (e) {
    if (e.response?.statusCode == 403) return null;
    rethrow;
  }
});

// bilanRhProvider is defined in ../data/bilan_rh.dart (v2)

// ═══════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════

class CompanyAnalyticsScreen extends ConsumerStatefulWidget {
  const CompanyAnalyticsScreen({super.key});

  @override
  ConsumerState<CompanyAnalyticsScreen> createState() =>
      _CompanyAnalyticsScreenState();
}

class _CompanyAnalyticsScreenState extends ConsumerState<CompanyAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final int _currentYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final hasBenchmarking = user?.features?.onefopBenchmarking ?? false;
    final submissionStatus = user?.features?.onefopSubmissionStatus;

    final bilanAsync = ref.watch(bilanRhProvider(_currentYear));
    final summaryAsync = ref.watch(companySummaryProvider(_currentYear));
    final benchmarksAsync = hasBenchmarking
        ? ref.watch(companyBenchmarksProvider(_currentYear))
        : const AsyncValue<BenchmarkData?>.data(null);

    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: Column(
        children: [
          // ── Tab Bar ──────────────────────────────────────
          Container(
            color: UltraTheme.surface,
            child: TabBar(
              controller: _tabs,
              labelColor: UltraTheme.primary,
              unselectedLabelColor: UltraTheme.textMuted,
              indicatorColor: UltraTheme.primary,
              indicatorWeight: 2,
              labelStyle:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              unselectedLabelStyle: const TextStyle(fontSize: 13),
              tabs: [
                const Tab(text: 'Bilan RH'),
                Tab(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Benchmarking'),
                      if (hasBenchmarking) ...[
                        const SizedBox(width: 6),
                        _ActiveBadge(
                            label: 'Actif', color: Colors.green, mini: true),
                      ],
                    ],
                  ),
                ),
                const Tab(text: 'Opportunités'),
              ],
            ),
          ),

          // ── Tab Views ─────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                // ── Tab 1: Bilan RH (v2 BilanRh + v1 CompanySummary) ──
                RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(bilanRhProvider(_currentYear));
                    ref.invalidate(companySummaryProvider(_currentYear));
                  },
                  child: _BilanTabContent(
                    bilanAsync: bilanAsync,
                    summaryAsync: summaryAsync,
                    submissionStatus: submissionStatus,
                    currentYear: _currentYear,
                  ),
                ),

                // ── Tab 2: Benchmarking ────────────────────
                RefreshIndicator(
                  onRefresh: () async {
                    if (hasBenchmarking) {
                      ref.invalidate(companyBenchmarksProvider(_currentYear));
                    }
                  },
                  child: _BenchmarkingTabContent(
                    hasBenchmarking: hasBenchmarking,
                    benchmarksAsync: benchmarksAsync,
                    submissionStatus: submissionStatus,
                  ),
                ),

                // ── Tab 3: Opportunités ────────────────────
                const _ComingSoonView(
                  icon: Icons.lightbulb_outline,
                  title: 'Opportunités actionnables',
                  description:
                      'Formations éligibles à des subventions, candidats correspondant à vos postes vacants, '
                      'et incitatifs fiscaux détectés à partir de vos données.',
                  badgeLabel: 'Bientôt disponible',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// TAB 1 — BILAN RH  (v2 BilanRh stacked above v1 CompanySummary)
// ═══════════════════════════════════════════════════════════

class _BilanTabContent extends StatelessWidget {
  final AsyncValue<BilanRh?> bilanAsync;
  final AsyncValue<CompanySummary?> summaryAsync;
  final String? submissionStatus;
  final int currentYear;

  const _BilanTabContent({
    required this.bilanAsync,
    required this.summaryAsync,
    required this.submissionStatus,
    required this.currentYear,
  });

  @override
  Widget build(BuildContext context) {
    // If both are still loading, show unified shimmer
    if (bilanAsync.isLoading && summaryAsync.isLoading) {
      return const _ShimmerBilan();
    }

    // If BilanRh returned null (not unlocked yet), show locked state
    final bilan = bilanAsync.valueOrNull;
    final summary = summaryAsync.valueOrNull;

    if (bilanAsync.hasError) {
      return _ErrorView(message: bilanAsync.error.toString());
    }

    if (bilan == null && summary == null) {
      return _LockedBilanView(status: submissionStatus);
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // ── Header ────────────────────────────────────────
        Text(
          'Analytique $currentYear',
          style: UltraTheme.displayMedium.copyWith(fontSize: 24),
        ),
        const SizedBox(height: 4),
        Text(
          'Données issues de vos déclarations ONEFOP approuvées',
          style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
        ),
        const SizedBox(height: 24),

        // ── v1 CompanySummary section ─────────────────────
        _SectionTitle('Ma Situation'),
        summaryAsync.when(
          data: (s) {
            if (s == null)
              return _LockedAnalyticsCard(status: submissionStatus);
            return _SummaryCards(summary: s);
          },
          loading: () => const _ShimmerSummary(),
          error: (e, _) => _ErrorCard(message: 'Erreur chargement: $e'),
        ),
        const SizedBox(height: 32),

        // ── v2 BilanRh section ────────────────────────────
        if (bilan != null) ...[
          _SectionTitle('Bilan RH Détaillé'),
          _BilanRhView(bilan: bilan, year: currentYear),
        ] else if (bilanAsync.isLoading) ...[
          const _ShimmerBenchmark(),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — BENCHMARKING  (real data if unlocked, teaser otherwise)
// ═══════════════════════════════════════════════════════════

class _BenchmarkingTabContent extends StatelessWidget {
  final bool hasBenchmarking;
  final AsyncValue<BenchmarkData?> benchmarksAsync;
  final String? submissionStatus;

  const _BenchmarkingTabContent({
    required this.hasBenchmarking,
    required this.benchmarksAsync,
    required this.submissionStatus,
  });

  @override
  Widget build(BuildContext context) {
    if (!hasBenchmarking) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _SectionTitle(
            'Benchmarking Sectoriel',
            trailing:
                _ActiveBadge(label: 'En attente', color: UltraTheme.warning),
          ),
          _LockedBenchmarkCard(status: submissionStatus),
          const SizedBox(height: 32),
          const _ComingSoonView(
            icon: Icons.bar_chart_outlined,
            title: 'Benchmarking sectoriel',
            description:
                'Comparez vos indicateurs RH avec les entreprises de votre secteur et région. '
                'Disponible dès que votre dossier est approuvé et que suffisamment '
                'd\'entreprises ont soumis leur déclaration.',
            badgeLabel: 'Bientôt disponible',
          ),
        ],
      );
    }

    return benchmarksAsync.when(
      data: (benchmarks) {
        if (benchmarks == null) return const SizedBox.shrink();
        if (!benchmarks.available) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _SectionTitle(
                'Benchmarking Sectoriel',
                trailing: _ActiveBadge(label: 'Actif', color: Colors.green),
              ),
              _InsufficientDataCard(
                peerCount: benchmarks.peerCount ?? 0,
                minRequired: 5,
              ),
            ],
          );
        }
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _SectionTitle(
              'Benchmarking Sectoriel',
              trailing: _ActiveBadge(label: 'Actif', color: Colors.green),
            ),
            Text(
              '${benchmarks.peerCount ?? '—'} entreprises dans votre groupe de comparaison',
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            _BenchmarkCards(benchmarks: benchmarks),
          ],
        );
      },
      loading: () => const _ShimmerBenchmarkFull(),
      error: (e, _) => _ErrorView(message: 'Erreur benchmarking: $e'),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v1 SUMMARY CARDS  (extracted into own widget)
// ═══════════════════════════════════════════════════════════

class _SummaryCards extends StatelessWidget {
  final CompanySummary summary;
  const _SummaryCards({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _StatCard(
          title: 'Effectif total',
          value: summary.totalEmployees.toString(),
          subtitle: summary.growthRate >= 0
              ? '+${summary.growthRate.toStringAsFixed(1)}% vs N-1'
              : '${summary.growthRate.toStringAsFixed(1)}% vs N-1',
          subtitleColor: summary.growthRate >= 0 ? Colors.green : Colors.red,
          icon: Icons.people_outline,
        ),
        _StatCard(
          title: 'Femmes',
          value: '${summary.gender.femalePct.toStringAsFixed(0)}%',
          subtitle: '${summary.gender.female} employées',
          icon: Icons.woman,
          color: Colors.pink,
        ),
        _StatCard(
          title: 'Hommes',
          value: '${summary.gender.malePct.toStringAsFixed(0)}%',
          subtitle: '${summary.gender.male} employés',
          icon: Icons.man,
          color: Colors.blue,
        ),
        _StatCard(
          title: 'Recrutements',
          value: summary.movements.recruitments.toString(),
          subtitle:
              'Net: ${summary.movements.netChange > 0 ? '+' : ''}${summary.movements.netChange}',
          subtitleColor:
              summary.movements.netChange >= 0 ? Colors.green : Colors.red,
          icon: Icons.person_add_alt,
        ),
        _StatCard(
          title: 'Départs',
          value: (summary.movements.dismissals + summary.movements.retirements)
              .toString(),
          subtitle:
              '${summary.movements.dismissals} licenciements · ${summary.movements.retirements} retraites',
          icon: Icons.person_remove,
        ),
        _CategoryBreakdown(categories: summary.categories),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v1 BENCHMARK CARDS  (extracted into own widget)
// ═══════════════════════════════════════════════════════════

class _BenchmarkCards extends StatelessWidget {
  final BenchmarkData benchmarks;
  const _BenchmarkCards({required this.benchmarks});

  @override
  Widget build(BuildContext context) {
    final metrics = benchmarks.metrics;
    if (metrics == null) return const SizedBox.shrink();

    final empMetrics = metrics['totalEmployees'] as Map<String, dynamic>?;
    final genderMetrics = metrics['femalePercentage'] as Map<String, dynamic>?;

    return Column(
      children: [
        if (empMetrics != null)
          _BenchmarkRow(
            label: 'Effectif total',
            mine: (empMetrics['mine'] as num).toInt(),
            median: (empMetrics['median'] as num).toInt(),
            percentile: (empMetrics['percentile'] as num).toInt(),
            unit: 'employés',
          ),
        if (genderMetrics != null)
          _BenchmarkRow(
            label: 'Taux de féminisation',
            mine: (genderMetrics['mine'] as num).toDouble(),
            median: (genderMetrics['median'] as num).toDouble(),
            percentile: (genderMetrics['percentile'] as num).toInt(),
            unit: '%',
            isPercentage: true,
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v2 BILAN RH VIEW  (unchanged from v2)
// ═══════════════════════════════════════════════════════════

class _BilanRhView extends StatelessWidget {
  final BilanRh bilan;
  final int year;
  const _BilanRhView({required this.bilan, required this.year});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Données issues de votre déclaration ONEFOP approuvée',
            style: UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
        const SizedBox(height: 20),
        _SectionLabel('Effectifs'),
        _MetricRow(children: [
          _MetricCard(
            label: 'Employés permanents',
            value: bilan.permanentWorkers.toString(),
            icon: Icons.people_outline,
            color: UltraTheme.primary,
          ),
          _MetricCard(
            label: 'Postes vacants',
            value: bilan.vacancies.toString(),
            badge: '${bilan.vacancyRate.toStringAsFixed(1)}%',
            badgeColor: bilan.vacancyRate > 10 ? Colors.orange : Colors.green,
            icon: Icons.work_outline,
          ),
        ]),
        const SizedBox(height: 8),
        _MetricRow(children: [
          _MetricCard(
            label: 'Recrutements',
            value: bilan.totalRecruitments.toString(),
            icon: Icons.person_add_alt_outlined,
            color: Colors.green,
          ),
          _MetricCard(
            label: 'Taux de rotation',
            value: '${bilan.turnoverRate.toStringAsFixed(1)}%',
            badge: bilan.turnoverRate > 10 ? 'Élevé' : 'Normal',
            badgeColor: bilan.turnoverRate > 10 ? Colors.orange : Colors.green,
            icon: Icons.swap_horiz,
          ),
        ]),
        const SizedBox(height: 24),
        _SectionLabel('Recrutements par catégorie'),
        _CspRecruitmentCard(breakdown: bilan.recruitments.combined),
        const SizedBox(height: 24),
        _SectionLabel('Départs'),
        _DeparturesCard(departures: bilan.departures),
        const SizedBox(height: 24),
        if (bilan.internships.total > 0) ...[
          _SectionLabel('Stagiaires'),
          _InternshipCard(internships: bilan.internships),
          const SizedBox(height: 24),
        ],
        if (bilan.skillNeeds.isNotEmpty || bilan.trainingNeeds.isNotEmpty) ...[
          _SectionLabel('Compétences & Formation'),
          _SkillsTrainingCard(
              skillNeeds: bilan.skillNeeds, trainingNeeds: bilan.trainingNeeds),
          const SizedBox(height: 24),
        ],
        if (bilan.vulnerableWorkers.total > 0 ||
            bilan.disabledRecruitments.total > 0)
          _InclusionInsightCard(
            vulnerable: bilan.vulnerableWorkers,
            disabled: bilan.disabledRecruitments,
            totalRecruitments: bilan.totalRecruitments,
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED SECTION HEADERS
// ═══════════════════════════════════════════════════════════

/// v1-style section title (used at ListView level, with accent bar + optional trailing badge)
class _SectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const _SectionTitle(this.title, {this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, top: 8),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 20,
            decoration: BoxDecoration(
              color: UltraTheme.primary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text(title, style: UltraTheme.titleLarge),
          const Spacer(),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// v2-style section label (used inline within card columns)
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Container(
            width: 3,
            height: 16,
            decoration: BoxDecoration(
                color: UltraTheme.primary,
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 8),
        Text(text, style: UltraTheme.titleMedium),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v1 WIDGETS
// ═══════════════════════════════════════════════════════════

class _ActiveBadge extends StatelessWidget {
  final String label;
  final Color color;
  final bool mini;
  const _ActiveBadge(
      {required this.label, required this.color, this.mini = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: mini ? 6 : 10, vertical: mini ? 2 : 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: mini ? 6 : 8, color: color),
          SizedBox(width: mini ? 3 : 4),
          Text(label,
              style: TextStyle(
                  fontSize: mini ? 10 : 11,
                  fontWeight: FontWeight.w600,
                  color: color)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subtitle;
  final Color? subtitleColor;
  final IconData icon;
  final Color? color;

  const _StatCard({
    required this.title,
    required this.value,
    this.subtitle,
    this.subtitleColor,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: (color ?? UltraTheme.primary).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color ?? UltraTheme.primary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: UltraTheme.bodyMedium
                          .copyWith(color: UltraTheme.textMuted)),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: UltraTheme.titleLarge
                        .copyWith(fontWeight: FontWeight.bold, fontSize: 22),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style:
                          UltraTheme.bodyMedium.copyWith(fontSize: 12).copyWith(
                                color: subtitleColor ?? UltraTheme.textMuted,
                                fontWeight: FontWeight.w500,
                              ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryBreakdown extends StatelessWidget {
  final Map<String, int> categories;
  const _CategoryBreakdown({required this.categories});

  @override
  Widget build(BuildContext context) {
    final total = categories.values.fold(0, (a, b) => a + b);
    if (total == 0) return const SizedBox.shrink();

    final entries = [
      _CatEntry('Cadres (1-3)', categories['cat1_3'] ?? 0, UltraTheme.primary),
      _CatEntry('Maîtrise (4-6)', categories['cat4_6'] ?? 0, Colors.orange),
      _CatEntry('Ouvriers (7-9)', categories['cat7_9'] ?? 0, Colors.teal),
      _CatEntry('Autres (10-12)', categories['cat10_12'] ?? 0, Colors.purple),
      _CatEntry('Non-déclaré', categories['nonDeclared'] ?? 0, Colors.grey),
    ].where((e) => e.count > 0).toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Répartition par catégorie',
                style: UltraTheme.bodyMedium
                    .copyWith(color: UltraTheme.textMuted)),
            const SizedBox(height: 12),
            ...entries.map((e) => _CategoryBar(entry: e, total: total)),
          ],
        ),
      ),
    );
  }
}

class _CatEntry {
  final String label;
  final int count;
  final Color color;
  _CatEntry(this.label, this.count, this.color);
}

class _CategoryBar extends StatelessWidget {
  final _CatEntry entry;
  final int total;
  const _CategoryBar({required this.entry, required this.total});

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (entry.count / total) * 100 : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(entry.label,
                style: UltraTheme.bodyMedium.copyWith(fontSize: 12),
                overflow: TextOverflow.ellipsis),
          ),
          Expanded(
            child: Stack(
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                FractionallySizedBox(
                  widthFactor: pct / 100,
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      color: entry.color,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 40,
            child: Text(
              '${pct.toStringAsFixed(0)}%',
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 12)
                  .copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _BenchmarkRow extends StatelessWidget {
  final String label;
  final num mine;
  final num median;
  final int percentile;
  final String unit;
  final bool isPercentage;

  const _BenchmarkRow({
    required this.label,
    required this.mine,
    required this.median,
    required this.percentile,
    required this.unit,
    this.isPercentage = false,
  });

  @override
  Widget build(BuildContext context) {
    final mineStr = isPercentage ? mine.toStringAsFixed(1) : mine.toString();
    final medianStr =
        isPercentage ? median.toStringAsFixed(1) : median.toString();

    Color percentileColor;
    String percentileText;
    if (percentile >= 75) {
      percentileColor = Colors.green;
      percentileText = 'Top $percentile%';
    } else if (percentile >= 50) {
      percentileColor = Colors.orange;
      percentileText = 'Médian+';
    } else {
      percentileColor = Colors.red;
      percentileText = 'Bottom ${100 - percentile}%';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(label,
                      style: UltraTheme.bodyMedium
                          .copyWith(color: UltraTheme.textMuted)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: percentileColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    percentileText,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: percentileColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _BenchmarkValue(
                    label: 'Votre entreprise',
                    value: '$mineStr $unit',
                    isHighlighted: true,
                  ),
                ),
                Container(height: 40, width: 1, color: Colors.grey.shade300),
                Expanded(
                  child: _BenchmarkValue(
                    label: 'Médiane secteur',
                    value: '$medianStr $unit',
                    isHighlighted: false,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BenchmarkValue extends StatelessWidget {
  final String label;
  final String value;
  final bool isHighlighted;

  const _BenchmarkValue({
    required this.label,
    required this.value,
    required this.isHighlighted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label,
            style: UltraTheme.bodyMedium
                .copyWith(fontSize: 12)
                .copyWith(color: UltraTheme.textMuted)),
        const SizedBox(height: 4),
        Text(
          value,
          style: UltraTheme.titleMedium.copyWith(
            fontWeight: isHighlighted ? FontWeight.bold : FontWeight.w500,
            color: isHighlighted ? UltraTheme.primary : UltraTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════
// v2 BILAN WIDGETS
// ═══════════════════════════════════════════════════════════

class _MetricRow extends StatelessWidget {
  final List<Widget> children;
  const _MetricRow({required this.children});

  @override
  Widget build(BuildContext context) => Row(
        children: children
            .map((c) => Expanded(child: c))
            .toList()
            .expand((w) => [w, const SizedBox(width: 10)])
            .toList()
          ..removeLast(),
      );
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final String? badge;
  final Color? badgeColor;
  final IconData icon;
  final Color? color;

  const _MetricCard({
    required this.label,
    required this.value,
    this.badge,
    this.badgeColor,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? UltraTheme.textPrimary;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 18, color: c),
            const Spacer(),
            if (badge != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: (badgeColor ?? Colors.grey).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(badge!,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: badgeColor ?? Colors.grey)),
              ),
          ]),
          const SizedBox(height: 10),
          Text(value,
              style: UltraTheme.titleLarge
                  .copyWith(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label,
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, fontSize: 12)),
        ]),
      ),
    );
  }
}

class _CspRecruitmentCard extends StatelessWidget {
  final CspBreakdown breakdown;
  const _CspRecruitmentCard({required this.breakdown});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Cadres', breakdown.executives),
      ('Agents de maîtrise', breakdown.foremen),
      ('Ouvriers / terrain', breakdown.workers),
    ];
    final grandTotal = breakdown.total.total;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                  child: Text('Catégorie',
                      style: UltraTheme.bodyMedium.copyWith(
                          color: UltraTheme.textMuted, fontSize: 12))),
              SizedBox(
                  width: 48,
                  child: Text('H',
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: Colors.blue,
                          fontSize: 12,
                          fontWeight: FontWeight.w600))),
              SizedBox(
                  width: 48,
                  child: Text('F',
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: Colors.pink,
                          fontSize: 12,
                          fontWeight: FontWeight.w600))),
              SizedBox(
                  width: 48,
                  child: Text('Total',
                      textAlign: TextAlign.center,
                      style: UltraTheme.bodyMedium.copyWith(
                          color: UltraTheme.textMuted, fontSize: 12))),
            ]),
            const Divider(height: 12),
            ...rows.map((r) =>
                _CspRow(label: r.$1, counts: r.$2, grandTotal: grandTotal)),
            const Divider(height: 12),
            Row(children: [
              Expanded(
                  child: Text('Total',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontWeight: FontWeight.w700))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.male.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.female.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14))),
              SizedBox(
                  width: 48,
                  child: Text(breakdown.total.total.toString(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: UltraTheme.primary))),
            ]),
          ],
        ),
      ),
    );
  }
}

class _CspRow extends StatelessWidget {
  final String label;
  final CspGenderCount counts;
  final int grandTotal;
  const _CspRow(
      {required this.label, required this.counts, required this.grandTotal});

  @override
  Widget build(BuildContext context) {
    final pct = grandTotal > 0
        ? (counts.total / grandTotal * 100).toStringAsFixed(0)
        : '0';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
          Text('$pct% du total',
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 11, color: UltraTheme.textMuted)),
        ])),
        SizedBox(
            width: 48,
            child: Text(counts.male.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13))),
        SizedBox(
            width: 48,
            child: Text(counts.female.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13))),
        SizedBox(
            width: 48,
            child: Text(counts.total.toString(),
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600))),
      ]),
    );
  }
}

class _DeparturesCard extends StatelessWidget {
  final BilanDepartures departures;
  const _DeparturesCard({required this.departures});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Licenciements', departures.dismissals, Colors.red),
      ('Démissions', departures.resignations, Colors.orange),
      ('Retraites', departures.retirements, Colors.teal),
      ('Autres', departures.others, Colors.grey),
    ].where((r) => r.$2.total > 0).toList();

    if (rows.isEmpty) {
      return Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
          side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text('Aucun départ enregistré sur la période.',
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted)),
        ),
      );
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          ...rows.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  Container(
                      width: 8,
                      height: 8,
                      decoration:
                          BoxDecoration(color: r.$3, shape: BoxShape.circle)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(r.$1,
                          style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
                  Text('H: ${r.$2.male}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 12, color: UltraTheme.textMuted)),
                  const SizedBox(width: 12),
                  Text('F: ${r.$2.female}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 12, color: UltraTheme.textMuted)),
                  const SizedBox(width: 12),
                  Text('Total: ${r.$2.total}',
                      style: UltraTheme.bodyMedium
                          .copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
                ]),
              )),
          const Divider(),
          Row(children: [
            Expanded(
                child: Text('Total départs',
                    style: UltraTheme.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600))),
            Text(departures.total.total.toString(),
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: UltraTheme.primary)),
          ]),
        ]),
      ),
    );
  }
}

class _InternshipCard extends StatelessWidget {
  final BilanInternships internships;
  const _InternshipCard({required this.internships});

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Stage de vacances', internships.holiday),
      ('Stage académique', internships.academic),
      ('Stage professionnel', internships.professional),
      ('Stage pré-emploi', internships.preWork),
    ].where((r) => r.$2 > 0).toList();

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          ...rows.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Expanded(
                      child: Text(r.$1,
                          style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
                  Text(r.$2.toString(),
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                ]),
              )),
          const Divider(),
          Row(children: [
            Expanded(
                child: Text('Total stagiaires',
                    style: UltraTheme.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600))),
            Text(internships.total.toString(),
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: UltraTheme.primary)),
          ]),
        ]),
      ),
    );
  }
}

class _SkillsTrainingCard extends StatelessWidget {
  final List<SkillNeed> skillNeeds;
  final List<TrainingNeed> trainingNeeds;
  const _SkillsTrainingCard(
      {required this.skillNeeds, required this.trainingNeeds});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        side: BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (skillNeeds.isNotEmpty) ...[
              Text('Besoins en compétences',
                  style: UltraTheme.bodyMedium.copyWith(
                      color: UltraTheme.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...skillNeeds.map((s) => _SkillRow(
                  index: s.index,
                  label: s.description,
                  color: UltraTheme.primary)),
            ],
            if (skillNeeds.isNotEmpty && trainingNeeds.isNotEmpty)
              const Divider(height: 20),
            if (trainingNeeds.isNotEmpty) ...[
              Text('Besoins en formation',
                  style: UltraTheme.bodyMedium.copyWith(
                      color: UltraTheme.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...trainingNeeds.map((t) => _SkillRow(
                  index: t.index, label: t.domain, color: Colors.indigo)),
            ],
          ],
        ),
      ),
    );
  }
}

class _SkillRow extends StatelessWidget {
  final int index;
  final String label;
  final Color color;
  const _SkillRow(
      {required this.index, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6)),
          child: Center(
              child: Text(index.toString(),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: color))),
        ),
        const SizedBox(width: 10),
        Expanded(
            child: Text(label,
                style: UltraTheme.bodyMedium.copyWith(fontSize: 13))),
      ]),
    );
  }
}

class _InclusionInsightCard extends StatelessWidget {
  final BilanVulnerable vulnerable;
  final SimpleCount disabled;
  final int totalRecruitments;

  const _InclusionInsightCard({
    required this.vulnerable,
    required this.disabled,
    required this.totalRecruitments,
  });

  @override
  Widget build(BuildContext context) {
    final inclPct = totalRecruitments > 0
        ? ((vulnerable.total + disabled.total) / totalRecruitments * 100)
            .toStringAsFixed(1)
        : '0';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.teal.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        border: Border.all(color: Colors.teal.withValues(alpha: 0.2)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.verified_outlined, color: Colors.teal.shade600, size: 22),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Impact social',
              style: UltraTheme.bodyMedium.copyWith(
                  fontWeight: FontWeight.w700, color: Colors.teal.shade700)),
          const SizedBox(height: 4),
          if (vulnerable.total > 0)
            Text(
                '${vulnerable.total} travailleur(s) vulnérable(s) recruté(s) '
                '(${vulnerable.internalDisplaced.total} déplacés, '
                '${vulnerable.refugees.total} réfugiés, '
                '${vulnerable.orphans.total} orphelins)',
                style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
          if (disabled.total > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                  '${disabled.total} personne(s) en situation de handicap recrutée(s)',
                  style: UltraTheme.bodyMedium.copyWith(fontSize: 13)),
            ),
          const SizedBox(height: 4),
          Text(
              '$inclPct% de vos recrutements concernent des profils prioritaires.',
              style: UltraTheme.bodyMedium.copyWith(
                  fontSize: 12,
                  color: Colors.teal.shade600,
                  fontWeight: FontWeight.w500)),
        ])),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// LOCKED / ERROR / COMING SOON STATES  (both versions)
// ═══════════════════════════════════════════════════════════

class _LockedAnalyticsCard extends StatelessWidget {
  final String? status;
  const _LockedAnalyticsCard({this.status});

  @override
  Widget build(BuildContext context) {
    String message;
    IconData icon;
    Color color;

    switch (status) {
      case 'SUBMITTED':
      case 'PENDING_REVIEW':
        message =
            'Votre questionnaire ONEFOP est en cours de révision. Les analyses seront disponibles après approbation.';
        icon = Icons.hourglass_top;
        color = UltraTheme.warning;
        break;
      case 'DRAFT':
        message =
            'Vous avez un brouillon ONEFOP en cours. Finalisez et soumettez pour accéder à vos analyses.';
        icon = Icons.edit_note;
        color = UltraTheme.info;
        break;
      default:
        message =
            'Soumettez le questionnaire ONEFOP pour accéder à vos analyses personnelles.';
        icon = Icons.lock_outline;
        color = UltraTheme.textMuted;
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: color),
          const SizedBox(height: 16),
          Text(message,
              textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _LockedBenchmarkCard extends StatelessWidget {
  final String? status;
  const _LockedBenchmarkCard({this.status});

  @override
  Widget build(BuildContext context) {
    String message;
    IconData icon;

    switch (status) {
      case 'SUBMITTED':
        message =
            'Votre questionnaire est en cours de révision par MINEFOP. Les comparaisons sectorielles seront débloquées après approbation.';
        icon = Icons.hourglass_top;
      case 'UNDER_REVIEW':
        message =
            'Votre questionnaire est en cours d\'analyse. Les benchmarks arrivent bientôt.';
        icon = Icons.reviews_outlined;
      default:
        message =
            'Soumettez le questionnaire ONEFOP pour accéder aux analyses comparatives.';
        icon = Icons.lock_outline;
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(message,
              textAlign: TextAlign.center, style: UltraTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _LockedBilanView extends StatelessWidget {
  final String? status;
  const _LockedBilanView({this.status});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    String message;
    Color color;

    switch (status) {
      case 'SUBMITTED':
      case 'PENDING_REVIEW':
        icon = Icons.hourglass_top;
        message =
            'Votre déclaration ONEFOP est en cours de révision. Votre bilan RH sera disponible après approbation.';
        color = UltraTheme.warning;
        break;
      case 'DRAFT':
        icon = Icons.edit_note;
        message =
            'Vous avez un brouillon en cours. Finalisez et soumettez votre déclaration pour accéder à votre bilan.';
        color = UltraTheme.info;
        break;
      default:
        icon = Icons.lock_outline;
        message =
            'Soumettez votre déclaration ONEFOP pour accéder à votre bilan RH personnalisé.';
        color = UltraTheme.textMuted;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 56, color: color),
          const SizedBox(height: 16),
          Text(message,
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium.copyWith(height: 1.5)),
        ]),
      ),
    );
  }
}

class _InsufficientDataCard extends StatelessWidget {
  final int peerCount;
  final int minRequired;
  const _InsufficientDataCard(
      {required this.peerCount, required this.minRequired});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: UltraTheme.surface,
        borderRadius: BorderRadius.circular(UltraTheme.radiusLarge),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        children: [
          Icon(Icons.bar_chart, size: 40, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text('Données insuffisantes pour le benchmarking',
              textAlign: TextAlign.center,
              style:
                  UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
              '$peerCount entreprise(s) dans votre groupe (minimum $minRequired requis).',
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium
                  .copyWith(fontSize: 12)
                  .copyWith(color: UltraTheme.textMuted)),
        ],
      ),
    );
  }
}

class _ComingSoonView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final String badgeLabel;

  const _ComingSoonView({
    required this.icon,
    required this.title,
    required this.description,
    required this.badgeLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: UltraTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(badgeLabel,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: UltraTheme.primary)),
          ),
          const SizedBox(height: 16),
          Icon(icon, size: 48, color: UltraTheme.textMuted),
          const SizedBox(height: 12),
          Text(title,
              style:
                  UltraTheme.titleMedium.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(description,
              textAlign: TextAlign.center,
              style: UltraTheme.bodyMedium
                  .copyWith(color: UltraTheme.textMuted, height: 1.5)),
        ]),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  final String message;
  const _ErrorCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: UltraTheme.error.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
        border: Border.all(color: UltraTheme.error.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: UltraTheme.error),
          const SizedBox(width: 12),
          Expanded(
              child: Text(message,
                  style: TextStyle(color: UltraTheme.error, fontSize: 13))),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Row(children: [
          Icon(Icons.error_outline, color: UltraTheme.error),
          const SizedBox(width: 12),
          Expanded(
              child: Text(message,
                  style: TextStyle(color: UltraTheme.error, fontSize: 13))),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SHIMMER PLACEHOLDERS  (v1 animated + v2 static, both kept)
// ═══════════════════════════════════════════════════════════

class _ShimmerSummary extends StatelessWidget {
  const _ShimmerSummary();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
          5,
          (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 80, borderRadius: 16),
              )),
    );
  }
}

class _ShimmerBenchmark extends StatelessWidget {
  const _ShimmerBenchmark();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
          2,
          (i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 120, borderRadius: 16),
              )),
    );
  }
}

class _ShimmerBenchmarkFull extends StatelessWidget {
  const _ShimmerBenchmarkFull();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: List.generate(
          3,
          (_) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 120, borderRadius: 16),
              )),
    );
  }
}

class _ShimmerBilan extends StatelessWidget {
  const _ShimmerBilan();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: List.generate(
          5,
          (_) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ShimmerCard(height: 80, borderRadius: 12),
              )),
    );
  }
}

/// v1 animated shimmer card
class _ShimmerCard extends StatelessWidget {
  final double height;
  final double borderRadius;
  const _ShimmerCard({required this.height, required this.borderRadius});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: UltraTheme.softShadow,
      ),
      child: const _ShimmerLoading(),
    );
  }
}

class _ShimmerLoading extends StatefulWidget {
  const _ShimmerLoading();

  @override
  State<_ShimmerLoading> createState() => __ShimmerLoadingState();
}

class __ShimmerLoadingState extends State<_ShimmerLoading>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Colors.grey.shade200,
                Colors.grey.shade50,
                Colors.grey.shade200,
              ],
              stops: [0.0, _animation.value, 1.0],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        );
      },
    );
  }
}
