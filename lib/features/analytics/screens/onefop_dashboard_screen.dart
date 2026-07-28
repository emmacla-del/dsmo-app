// lib/features/analytics/screens/onefop_dashboard_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/analytics_filter_bar.dart';
import '../widgets/tab_bar_widget.dart' show TabContent;
import '../widgets/common_cards.dart';
import '../providers/onefop_dashboard_providers.dart';
import '../models/dashboard_bundle.dart';
import '../../../widgets/responsive_helpers.dart' show NotificationBell;

/// Client-side "last updated" — there's no backend timestamp on the
/// dashboard bundle, so this just records when the bundle last resolved
/// successfully, for the hero header.
final lastUpdatedAtProvider = StateProvider<DateTime?>((ref) => null);

class OnefopDashboardScreen extends ConsumerWidget {
  const OnefopDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(dashboardFilterProvider);
    final bundleAsync = ref.watch(onefopDashboardBundleProvider);
    const tabCount = 8; // Matches the 8 sections in AnalyticsFilterBar's _SectionPicker

    ref.listen(onefopDashboardBundleProvider, (previous, next) {
      if (next.hasValue) {
        ref.read(lastUpdatedAtProvider.notifier).state = DateTime.now();
      }
    });

    return DefaultTabController(
      length: tabCount,
      child: Scaffold(
        backgroundColor: InkColor.surface,
        body: Column(
          children: [
            _DashboardHeader(bundleAsync: bundleAsync),
            const AnalyticsFilterBar(),
            Expanded(
              child: bundleAsync.when(
                // A filter change (period/region/granularity/...) makes this
                // provider *reload*, not just refresh — without this flag the
                // default behavior blanks the whole tab on every filter tap.
                skipLoadingOnReload: true,
                loading: () => const Center(
                    child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AccentColor.teal))),
                error: (err, _) => Center(child: Text('Erreur: $err')),
                data: (bundle) => Stack(
                  children: [
                    Positioned.fill(
                      child: TabContent(
                        dashboard: bundle.dashboard,
                        previous: bundle.previous,
                        trends: bundle.trends,
                        sectors: bundle.sectors,
                        gender: bundle.gender,
                        employmentBalance: bundle.employmentBalance,
                        cardAnimations: const [],
                        granularity: filter.granularity,
                        onGranularityChanged: (newGranularity) {
                          ref.read(dashboardFilterProvider.notifier).state =
                              filter.copyWith(granularity: newGranularity);
                          onefopRefreshAll(ref);
                        },
                      ),
                    ),
                    // Stale data stays fully visible underneath — this is
                    // the only signal that a reload is in flight.
                    if (bundleAsync.isLoading)
                      const Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: LinearProgressIndicator(
                          minHeight: 2,
                          color: AccentColor.teal,
                          backgroundColor: Colors.transparent,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Observatory hero header ──────────────────────────────────────
// Flat, institutional banner (no gradient/glass) carrying the title,
// reporting period, last-updated timestamp, and a one-line labour-market
// status derived from the already-computed net change.
class _DashboardHeader extends ConsumerWidget {
  final AsyncValue<DashboardBundle> bundleAsync;

  const _DashboardHeader({required this.bundleAsync});

  String _formatTime(DateTime d) =>
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final lastUpdated = ref.watch(lastUpdatedAtProvider);
    final netChange = bundleAsync.valueOrNull?.dashboard.netChange;

    final statusText = netChange == null
        ? null
        : netChange > 0
            ? 'Marché de l\'emploi en expansion'
            : netChange < 0
                ? 'Marché de l\'emploi en contraction'
                : 'Marché de l\'emploi stable';
    final statusColor =
        netChange == null ? TextColor.muted : SemanticColor.trend(netChange);

    return Container(
      padding: const EdgeInsets.fromLTRB(Gap.lg, 16, Gap.lg, 16),
      decoration: const BoxDecoration(
        color: InkColor.card,
        border: Border(bottom: BorderSide(color: InkColor.border, width: 2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AccentColor.teal.withAlpha(15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AccentColor.teal.withAlpha(40)),
            ),
            child: const Icon(Icons.account_balance_rounded,
                color: AccentColor.teal, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Observatoire de l\'Emploi — DSMO & ONEFOP',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: TextColor.primary,
                    letterSpacing: -0.2,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
                const SizedBox(height: 3),
                Wrap(
                  spacing: 10,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('Période : ${period.displayText}',
                        style:
                            textMono(TextSize.caption, color: TextColor.secondary)),
                    Text('·', style: textMono(TextSize.caption, color: TextColor.muted)),
                    Text(
                      lastUpdated == null
                          ? 'Mise à jour en cours…'
                          : 'Mis à jour à ${_formatTime(lastUpdated)}',
                      style: textMono(TextSize.caption, color: TextColor.secondary),
                    ),
                    if (statusText != null) ...[
                      Text('·', style: textMono(TextSize.caption, color: TextColor.muted)),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 7, color: statusColor),
                          const SizedBox(width: 4),
                          Text(statusText,
                              style: textMono(TextSize.caption,
                                  color: statusColor, weight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: Gap.sm),
          const NotificationBell(),
        ],
      ),
    );
  }
}
