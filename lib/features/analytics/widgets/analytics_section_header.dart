// lib/features/analytics/widgets/analytics_section_header.dart
//
// Two-line "executive" header used at the top of every analytics tab: a
// static, uppercase section title, with a subtitle underneath that always
// reflects the currently active year / location / entity-type filters so
// users never lose track of what scope the numbers below it represent.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/filter_state.dart';
import '../providers/dashboard_providers.dart';
import 'common_cards.dart';

/// Plural/executive-sounding entity labels for the subtitle — distinct from
/// the singular labels the filter dropdown itself uses (e.g. "Coopérative").
const _subtitleEntityLabels = {
  'ENTREPRISE': 'Entreprises privées',
  'COOPERATIVE': 'Coopératives',
  'CTD': 'CTD',
  'ONG': 'ONG',
};

class AnalyticsSectionHeader extends ConsumerWidget {
  final String title;

  const AnalyticsSectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final period = ref.watch(dashboardFilterProvider).period;
    final region = ref.watch(effectiveRegionProvider);
    final department = ref.watch(effectiveDepartmentProvider);
    final subdivision = ref.watch(subdivisionIdProvider);
    final entityType = ref.watch(entityTypeProvider);

    final location = [region, department, subdivision]
        .where((v) => v != null)
        .join(' > ');

    final entityLabel = entityType != null
        ? (_subtitleEntityLabels[entityType] ?? entityType)
        : 'Toutes les entités';

    final subtitle = [
      period.displayText,
      location.isEmpty ? 'National' : location,
      entityLabel,
    ].join(' • ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            fontSize: TextSize.section,
            fontWeight: FontWeight.bold,
            color: TextColor.secondary,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: textMono(TextSize.caption, color: TextColor.muted),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
