// lib/features/analytics/widgets/labor_market_tab.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/onefop_dashboard_providers.dart';
import '../models/labor_market_tension.dart';
import 'common_cards.dart';
import 'analytics_widgets.dart';
import 'analytics_section_header.dart';

class LaborMarketTab extends ConsumerWidget {
  const LaborMarketTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final laborAsync = ref.watch(onefopLaborMarketProvider(period));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AnalyticsSectionHeader(title: 'Marché du travail'),
          const SizedBox(height: Gap.md),
          laborAsync.when(
            loading: () => const Shimmer(height: 300),
            error: (err, _) => emptyState('Erreur: $err'),
            data: (data) => _LaborMarketContent(data: data),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Main content — all figures come pre-computed from the backend.
// No arithmetic here.
// ─────────────────────────────────────────────────────────────
class _LaborMarketContent extends StatelessWidget {
  final LaborMarketTension data;
  const _LaborMarketContent({required this.data});

  @override
  Widget build(BuildContext context) {
    final absorptionLabel = data.absorptionRate != null
        ? '${data.absorptionRate!.toStringAsFixed(1)}%'
        : '–';

    final absorptionColor =
        data.absorptionRate != null && data.absorptionRate! >= 50
            ? ChartTheme.current
            : ChartTheme.negative;

    return Column(
      children: [
        // Three KPI cards — wraps responsively instead of a fixed 3-col Row
        ResponsiveGrid(
          spacing: Gap.sm,
          runSpacing: Gap.sm,
          children: [
            SizedBox(
              height: 88,
              child: _StatCard(
                label: 'Postes vacants déclarés',
                value: formatNumber(data.totalVacancies),
                color: ChartTheme.comparison,
              ),
            ),
            SizedBox(
              height: 88,
              child: _StatCard(
                label: 'Recrutements effectifs',
                value: formatNumber(data.totalRecruitments),
                color: ChartTheme.current,
              ),
            ),
            SizedBox(
              height: 88,
              child: _StatCard(
                label: 'Taux d\'absorption',
                value: absorptionLabel,
                color: absorptionColor,
              ),
            ),
          ],
        ),

        const SizedBox(height: Gap.md),

        // Gap banner
        GlassCard(
          child: Row(
            children: [
              Icon(
                data.gap > 0
                    ? Icons.warning_amber_outlined
                    : Icons.check_circle_outline,
                size: 18,
                color: data.gap > 0 ? ChartTheme.negative : ChartTheme.current,
              ),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(
                  data.gap > 0
                      ? '${formatNumber(data.gap)} postes non pourvus — tension sur le marché'
                      : 'Marché équilibré ou excédent de recrutements',
                  style: textMono(TextSize.body,
                      color: data.gap > 0
                          ? ChartTheme.negative
                          : ChartTheme.current),
                ),
              ),
              Text(
                data.gap >= 0
                    ? '+${formatNumber(data.gap)}'
                    : formatNumber(data.gap),
                style: textMono(TextSize.metric,
                    color: data.gap > 0 ? ChartTheme.negative : ChartTheme.current,
                    weight: FontWeight.bold),
              ),
            ],
          ),
        ),

        // Vacancy-granularity notice — honest about data limits
        if (data.totalVacancies > 0) ...[
          const SizedBox(height: Gap.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xs),
            child: Text(
              'Les postes vacants sont déclarés au niveau entreprise. '
              'La ventilation par CSP n\'est pas disponible.',
              style: textMono(TextSize.micro, color: TextColor.muted),
            ),
          ),
        ],

        const SizedBox(height: Gap.lg),

        // CSP hire breakdown
        if (data.byCsp.isNotEmpty) ...[
          sectionLabel('Recrutements effectifs par catégorie'),
          const SizedBox(height: Gap.sm),
          GlassCard(
            child: _CspHireList(
              byCsp: data.byCsp,
              totalRecruitments: data.totalRecruitments,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(Gap.sm),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            label,
            style: textMono(TextSize.label, color: color),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: Gap.xs),
          Text(
            value,
            style: textMono(TextSize.metric, color: color, weight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CSP hire share list
// backend provides hireSharePct — no division on the client
// ─────────────────────────────────────────────────────────────
class _CspHireList extends StatelessWidget {
  final List<LaborMarketCspRow> byCsp;
  final int totalRecruitments;

  const _CspHireList({
    required this.byCsp,
    required this.totalRecruitments,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: byCsp.asMap().entries.map((entry) {
        final row = entry.value;
        final isLast = entry.key == byCsp.length - 1;
        final share = row.hireSharePct / 100.0; // already a % from backend

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: Gap.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _cspLabel(row.cspCategory),
                          style: textMono(TextSize.label,
                              color: TextColor.secondary,
                              weight: FontWeight.w600),
                        ),
                      ),
                      Text(
                        '${row.hireSharePct.toStringAsFixed(1)}% des recrutements',
                        style: textMono(TextSize.micro, color: TextColor.muted),
                      ),
                    ],
                  ),
                  const SizedBox(height: Gap.xs),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Recrutements',
                                style: textMono(TextSize.caption,
                                    color: ChartTheme.current)),
                            Text(
                              formatNumber(row.hires),
                              style: textMono(TextSize.section,
                                  color: ChartTheme.current),
                            ),
                          ],
                        ),
                      ),
                      // Vacancies-by-CSP column shown only if data arrives in future
                      if (row.vacancies != null)
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Postes vacants',
                                  style: textMono(TextSize.caption,
                                      color: ChartTheme.comparison)),
                              Text(
                                formatNumber(row.vacancies!),
                                style: textMono(TextSize.section,
                                    color: ChartTheme.comparison),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: Gap.xs),
                  LinearProgressIndicator(
                    value: share.clamp(0.0, 1.0),
                    backgroundColor: ChartTheme.current.withAlpha(30),
                    valueColor: const AlwaysStoppedAnimation(ChartTheme.current),
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ],
              ),
            ),
            if (!isLast) const Divider(color: InkColor.border, height: 1),
          ],
        );
      }).toList(),
    );
  }

  String _cspLabel(String key) {
    switch (key.toUpperCase()) {
      case 'CADRES':
        return 'Cadres';
      case 'FOREMEN':
        return 'Agents de maîtrise';
      case 'WORKERS':
        return "Agents d'exécution";
      default:
        return key;
    }
  }
}
