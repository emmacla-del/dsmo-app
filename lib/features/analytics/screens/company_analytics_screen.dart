// lib/features/analytics/screens/company_analytics_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/auth_provider.dart';
import 'package:dio/dio.dart';
import '../../../data/api_client.dart';
import '../../../theme/ultra_theme.dart';

// ═══════════════════════════════════════════════════════════
// DATA MODELS
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
// PROVIDERS
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════

final companySummaryProvider =
    FutureProvider.family<CompanySummary?, int>((ref, year) async {
  final api = ref.read(apiClientProvider);
  try {
    final response = await api.get('/dsmo/analytics/company-summary',
        queryParameters: {'year': year});
    return CompanySummary.fromJson(response.data as Map<String, dynamic>);
  } on DioException catch (e) {
    if (e.response?.statusCode == 403) {
      // User hasn't submitted ONEFOP yet — return null to show locked state
      return null;
    }
    rethrow; // Let other errors bubble up normally
  }
});

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
    if (e.response?.statusCode == 403) {
      return null;
    }
    rethrow;
  }
});

// ═══════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════

class CompanyAnalyticsScreen extends ConsumerWidget {
  const CompanyAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).value;
    final f = user?.features;
    final hasBenchmarking = f?.onefopBenchmarking ?? false;
    final currentYear = DateTime.now().year;

    final summaryAsync = ref.watch(companySummaryProvider(currentYear));
    final benchmarksAsync = hasBenchmarking
        ? ref.watch(companyBenchmarksProvider(currentYear))
        : const AsyncValue.data(null);

    return Scaffold(
      backgroundColor: UltraTheme.background,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(companySummaryProvider(currentYear));
          if (hasBenchmarking) {
            ref.invalidate(companyBenchmarksProvider(currentYear));
          }
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Year Header ─────────────────────────────────
            Text(
              'Analytique $currentYear',
              style: UltraTheme.displayMedium.copyWith(fontSize: 24),
            ),
            const SizedBox(height: 4),
            Text(
              'Données issues de vos déclarations DSMO',
              style:
                  UltraTheme.bodyMedium.copyWith(color: UltraTheme.textMuted),
            ),
            const SizedBox(height: 24),

            // ── Tier 1: Basic Analytics ────────────────────
            _SectionTitle('Ma Situation'),
            summaryAsync.when(
              data: (summary) {
                if (summary == null) {
                  return _LockedAnalyticsCard(
                    status: f?.onefopSubmissionStatus,
                  );
                }
                return _buildSummaryCards(summary);
              },
              loading: () => const _LoadingCards(count: 5),
              error: (e, _) => _ErrorCard(message: 'Erreur chargement: $e'),
            ),
            const SizedBox(height: 32),

            // ── Tier 2: Benchmarking ───────────────────────
            _SectionTitle(
              'Benchmarking Sectoriel',
              trailing: hasBenchmarking
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle,
                              size: 14, color: Colors.green[700]),
                          const SizedBox(width: 4),
                          Text(
                            'Actif',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.green[700],
                            ),
                          ),
                        ],
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: UltraTheme.warning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.hourglass_top,
                              size: 14, color: UltraTheme.warning),
                          const SizedBox(width: 4),
                          Text(
                            'En attente',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: UltraTheme.warning,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),

            if (hasBenchmarking) ...[
              benchmarksAsync.when(
                data: (benchmarks) {
                  if (benchmarks == null) return const SizedBox.shrink();
                  if (!benchmarks.available) {
                    return _InsufficientDataCard(
                      peerCount: benchmarks.peerCount ?? 0,
                      minRequired: 5,
                    );
                  }
                  return _buildBenchmarkCards(benchmarks);
                },
                loading: () => const _LoadingCards(count: 2),
                error: (e, _) => _ErrorCard(message: 'Erreur benchmarking: $e'),
              ),
            ] else ...[
              _LockedBenchmarkCard(
                status: f?.onefopSubmissionStatus,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCards(CompanySummary summary) {
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
        // Category breakdown mini-chart
        _CategoryBreakdown(categories: summary.categories),
      ],
    );
  }

  Widget _buildBenchmarkCards(BenchmarkData benchmarks) {
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
// WIDGETS
// ═══════════════════════════════════════════════════════════

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
                    style: UltraTheme.titleLarge.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 22,
                    ),
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
            child: Text(
              entry.label,
              style: UltraTheme.bodyMedium.copyWith(fontSize: 12),
              overflow: TextOverflow.ellipsis,
            ),
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
                      color: percentileColor,
                    ),
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
                Container(
                  height: 40,
                  width: 1,
                  color: Colors.grey.shade300,
                ),
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
        Text(
          label,
          style: UltraTheme.bodyMedium
              .copyWith(fontSize: 12)
              .copyWith(color: UltraTheme.textMuted),
        ),
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
          Text(
            message,
            textAlign: TextAlign.center,
            style: UltraTheme.bodyMedium,
          ),
        ],
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
          Text(
            'Données insuffisantes pour le benchmarking',
            textAlign: TextAlign.center,
            style: UltraTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            '$peerCount entreprise(s) dans votre groupe (minimum $minRequired requis).',
            textAlign: TextAlign.center,
            style: UltraTheme.bodyMedium
                .copyWith(fontSize: 12)
                .copyWith(color: UltraTheme.textMuted),
          ),
        ],
      ),
    );
  }
}

class _LoadingCards extends StatelessWidget {
  final int count;
  const _LoadingCards({required this.count});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (_) => Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(UltraTheme.radiusMedium),
            side:
                BorderSide(color: Colors.grey.shade300.withValues(alpha: 0.5)),
          ),
          child: const SizedBox(
            height: 80,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        ),
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
            child: Text(
              message,
              style: TextStyle(color: UltraTheme.error, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

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
      case 'DRAFT':
        message =
            'Vous avez un brouillon ONEFOP en cours. Finalisez et soumettez pour accéder à vos analyses.';
        icon = Icons.edit_note;
        color = UltraTheme.info;
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
          Text(
            message,
            textAlign: TextAlign.center,
            style: UltraTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}
