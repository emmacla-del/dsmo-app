// lib/features/analytics/widgets/benchmarking_tab.dart
//
// Region/department/subdivision vs. national comparison — a dedicated home
// for the "vs national" benchmark so it can grow beyond the handful of KPIs
// that fit on the Synthèse tab. Compares against the national total/rate
// (not a full region-vs-region ranking): with only one region currently
// holding real submissions, a ranking view would render as one bar and
// nine empty ones — exactly the "looks erroneous" problem this is meant
// to avoid.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../widgets/period_selector.dart';
import '../models/dashboard_models.dart';
import '../providers/dashboard_providers.dart' show subdivisionIdProvider;
import '../providers/onefop_dashboard_providers.dart';
import 'common_cards.dart';
import 'analytics_section_header.dart';

class BenchmarkingTab extends ConsumerWidget {
  const BenchmarkingTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final hasGeoFilter = ref.watch(effectiveRegionProvider) != null ||
        ref.watch(effectiveDepartmentProvider) != null ||
        ref.watch(subdivisionIdProvider) != null;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Benchmarking régional'),
          const SizedBox(height: Gap.sm),
          if (!hasGeoFilter)
            emptyState(
              'Sélectionnez une région, un département ou un arrondissement '
              'dans le filtre Localisation pour comparer la zone au reste '
              'du pays.',
              icon: Icons.compare_arrows_rounded,
            )
          else
            _BenchmarkContent(period: period),
        ],
      ),
    );
  }
}

class _BenchmarkContent extends ConsumerWidget {
  final PeriodConfig period;
  const _BenchmarkContent({required this.period});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final curSummary = ref.watch(onefopDashboardSummaryProvider(period));
    final natSummary = ref.watch(onefopNationalSummaryProvider(period));
    final curLabor = ref.watch(onefopLaborMarketProvider(period));
    final natLabor = ref.watch(onefopNationalLaborMarketProvider(period));
    final curMobility = ref.watch(onefopMobilityDashboardProvider(period));
    final natMobility =
        ref.watch(onefopNationalMobilityDashboardProvider(period));
    final curInclusion = ref.watch(onefopInclusionProvider(period));
    final natInclusion = ref.watch(onefopNationalInclusionProvider(period));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        sectionLabel('Effectifs & déclarations'),
        const SizedBox(height: Gap.sm),
        _section(
          cur: curSummary,
          national: natSummary,
          builder: (cur, nat) =>
              _SummaryBenchmarkCard(cur: cur, national: nat),
        ),
        const SizedBox(height: Gap.lg),
        sectionLabel('Marché du travail'),
        const SizedBox(height: Gap.sm),
        _section(
          cur: curLabor,
          national: natLabor,
          builder: (cur, nat) => GlassCard(
            child: _RateCompareBar(
              label: "Taux d'absorption",
              value: cur.absorptionRate ?? 0,
              benchmark: nat.absorptionRate ?? 0,
              color: AccentColor.blue,
            ),
          ),
        ),
        const SizedBox(height: Gap.lg),
        sectionLabel('Mobilité & rétention'),
        const SizedBox(height: Gap.sm),
        _section(
          cur: curMobility,
          national: natMobility,
          builder: (cur, nat) => GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _RateCompareBar(
                  label: 'Taux de rotation',
                  value: cur.turnoverRate,
                  benchmark: nat.turnoverRate,
                  color: AccentColor.gold,
                ),
                const SizedBox(height: Gap.md),
                const Divider(color: InkColor.border, height: 1),
                const SizedBox(height: Gap.md),
                _RateCompareBar(
                  label: 'Taux de rétention',
                  value: cur.retentionRate,
                  benchmark: nat.retentionRate,
                  color: AccentColor.teal,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: Gap.lg),
        sectionLabel('Inclusion'),
        const SizedBox(height: Gap.sm),
        _section(
          cur: curInclusion,
          national: natInclusion,
          builder: (cur, nat) {
            final curPct =
                cur.totalHires > 0 ? cur.total / cur.totalHires * 100 : 0.0;
            final natPct =
                nat.totalHires > 0 ? nat.total / nat.totalHires * 100 : 0.0;
            return GlassCard(
              child: _RateCompareBar(
                label: 'Part des personnes vulnérables (recrutements)',
                value: curPct,
                benchmark: natPct,
                color: AccentColor.rose,
              ),
            );
          },
        ),
      ],
    );
  }

  /// Renders [builder] once both [cur] and [national] have resolved;
  /// shimmer while either is loading, an error state if either failed —
  /// keeps one slow/failing domain from blocking the rest of the tab.
  Widget _section<T>({
    required AsyncValue<T> cur,
    required AsyncValue<T> national,
    required Widget Function(T cur, T national) builder,
  }) {
    if (cur.isLoading || national.isLoading) {
      return const Shimmer(height: 90);
    }
    if (cur.hasError || national.hasError) {
      return emptyState('Données indisponibles');
    }
    return builder(cur.requireValue, national.requireValue);
  }
}

// ── Effectifs & déclarations: share-of-national bars ───────────────────
class _SummaryBenchmarkCard extends StatelessWidget {
  final DashboardSummary cur;
  final DashboardSummary national;
  const _SummaryBenchmarkCard({required this.cur, required this.national});

  @override
  Widget build(BuildContext context) {
    final shareRows = [
      ('Entreprises déclarantes', cur.totalDeclarations,
          national.totalDeclarations, AccentColor.teal),
      ('Effectif total', cur.totalEmployees, national.totalEmployees,
          AccentColor.teal),
      ('Recrutements', cur.totalRecruitments, national.totalRecruitments,
          AccentColor.blue),
      (
        'Départs',
        cur.totalDismissals + cur.totalRetirements,
        national.totalDismissals + national.totalRetirements,
        AccentColor.rose,
      ),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final row in shareRows) ...[
            _ShareBar(
                label: row.$1, value: row.$2, total: row.$3, color: row.$4),
            const SizedBox(height: Gap.md),
          ],
          const Divider(color: InkColor.border, height: 1),
          const SizedBox(height: Gap.md),
          _RateCompareBar(
            label: 'Part féminine (candidatures)',
            value: cur.genderDistribution.female,
            benchmark: national.genderDistribution.female,
            color: AccentColor.rose,
          ),
        ],
      ),
    );
  }
}

/// One row: label + "share of national total" bar (filled = this scope's
/// share, remainder = rest of the nation), plus the raw values underneath
/// so a 0% reading is legible as "0 sur 0 (national)" rather than looking
/// like a broken calculation when the selected scope has no data at all.
class _ShareBar extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final Color color;

  const _ShareBar({
    required this.label,
    required this.value,
    required this.total,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final share = total > 0 ? (value / total).clamp(0.0, 1.0) : 0.0;
    final pctLabel = total > 0 ? '${(share * 100).toStringAsFixed(0)}%' : '—';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(label,
                  style: textMono(TextSize.label,
                      color: TextColor.secondary, weight: FontWeight.w600)),
            ),
            Text('$pctLabel du national',
                style: textMono(TextSize.caption,
                    color: color, weight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: Gap.xs),
        LinearProgressIndicator(
          value: share,
          backgroundColor: Colors.white.withAlpha(12),
          valueColor: AlwaysStoppedAnimation(color),
          minHeight: 6,
          borderRadius: BorderRadius.circular(3),
        ),
        const SizedBox(height: Gap.xs),
        Text(
          '${formatNumber(value)} sur ${formatNumber(total)} (national)',
          style: textMono(TextSize.micro, color: TextColor.muted),
        ),
      ],
    );
  }
}

/// One metric: two thin bars on the same 0–100 scale — the selected
/// scope's rate vs. the national rate — for KPIs that are themselves a
/// percentage (a straight rate comparison, not a share-of-total).
class _RateCompareBar extends StatelessWidget {
  final String label;
  final double value;
  final double benchmark;
  final Color color;

  const _RateCompareBar({
    required this.label,
    required this.value,
    required this.benchmark,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: textMono(TextSize.label,
                color: TextColor.secondary, weight: FontWeight.w600)),
        const SizedBox(height: Gap.sm),
        _rateRow('Zone sélectionnée', value, color),
        const SizedBox(height: Gap.sm),
        _rateRow('National', benchmark, TextColor.muted),
      ],
    );
  }

  Widget _rateRow(String rowLabel, double pct, Color color) {
    return Row(
      children: [
        SizedBox(
          width: 110,
          child: Text(rowLabel,
              style: textMono(TextSize.caption, color: TextColor.muted)),
        ),
        Expanded(
          child: LinearProgressIndicator(
            value: (pct / 100).clamp(0.0, 1.0),
            backgroundColor: Colors.white.withAlpha(12),
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 6,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: Gap.sm),
        SizedBox(
          width: 44,
          child: Text(
            '${pct.toStringAsFixed(0)}%',
            textAlign: TextAlign.right,
            style: textMono(TextSize.caption,
                color: color, weight: FontWeight.bold),
          ),
        ),
      ],
    );
  }
}
