// lib/features/analytics/widgets/analytics_filter_bar.dart
import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../widgets/period_selector.dart';
import '../models/dashboard_bundle.dart';
import '../models/dashboard_models.dart';
import '../models/labor_market_tension.dart';
import '../providers/dashboard_providers.dart';
import '../providers/onefop_dashboard_providers.dart';
import 'location_filter_dialog.dart';
import 'common_cards.dart';

/// Raw `entityType` values match `OnefopSubmission.formType` exactly —
/// these are the French display labels for the Entity Type picker.
const _entityTypeLabels = {
  'ENTREPRISE': 'Entreprise',
  'COOPERATIVE': 'Coopérative',
  'CTD': 'CTD',
  'ONG': 'ONG',
};

enum DashboardExportSection {
  filters,
  summary,
  benchmarking,
  laborMarket,
  workforceStructure,
  recruitmentInsertion,
  mobilityRetention,
  inclusion,
  competencesFormation,
}

const _exportSectionTitles = {
  DashboardExportSection.filters: 'Filtres',
  DashboardExportSection.summary: 'Synthèse',
  DashboardExportSection.benchmarking: 'Benchmarking',
  DashboardExportSection.laborMarket: 'Marché du travail',
  DashboardExportSection.workforceStructure: 'Structure des recrutements',
  DashboardExportSection.recruitmentInsertion: 'Recrutement & Insertion',
  DashboardExportSection.mobilityRetention: 'Mobilité & Rétention',
  DashboardExportSection.inclusion: 'Inclusion',
  DashboardExportSection.competencesFormation: 'Compétences & Formation',
};

const _exportSectionDescriptions = {
  DashboardExportSection.filters: 'Inclut les paramètres de période, région et secteur.',
  DashboardExportSection.summary: 'Inclut les principaux indicateurs et graphiques du tableau de bord Synthèse.',
  DashboardExportSection.benchmarking: 'Export du tableau de bord Benchmarking régional / national.',
  DashboardExportSection.laborMarket: 'Export des tensions et des recrutements sur le marché du travail.',
  DashboardExportSection.workforceStructure: 'Export de la structure des recrutements et des types d\'entités.',
  DashboardExportSection.recruitmentInsertion: 'Export des premiers recrutements et du taux de conversion.',
  DashboardExportSection.mobilityRetention: 'Export des départs, des motifs et des taux de rétention.',
  DashboardExportSection.inclusion: 'Export des indicateurs d\'inclusion et de parité.',
  DashboardExportSection.competencesFormation: 'Export des compétences recherchées et du pipeline de formation.',
};

/// A single chart/table unit a user can toggle independently within a
/// section — e.g. "Synthèse" bundles five of these (trend, sector,
/// balance, gender, YoY) instead of being all-or-nothing.
class _ChartItem {
  final String id;
  final String label;
  const _ChartItem(this.id, this.label);
}

const _sectionCharts = <DashboardExportSection, List<_ChartItem>>{
  DashboardExportSection.filters: [
    _ChartItem('filters', 'Filtres appliqués'),
  ],
  DashboardExportSection.summary: [
    _ChartItem('summary_kpis', 'Indicateurs clés'),
    _ChartItem('summary_trend', 'Évolution de l\'emploi'),
    _ChartItem('summary_sector', 'Performance sectorielle'),
    _ChartItem('summary_balance', 'Dynamique du travail'),
    _ChartItem('summary_gender', 'Genre (candidatures)'),
    _ChartItem('summary_yoy', 'Évolution annuelle'),
  ],
  DashboardExportSection.benchmarking: [
    _ChartItem('benchmarking_table', 'Comparatif régional'),
  ],
  DashboardExportSection.laborMarket: [
    _ChartItem('labor_indicators', 'Indicateurs du marché du travail'),
    _ChartItem('labor_csp', 'Recrutements par CSP'),
  ],
  DashboardExportSection.workforceStructure: [
    _ChartItem('structure_entity', 'Répartition des types d\'entité'),
    _ChartItem('structure_size', 'Répartition par taille d\'entreprise'),
    _ChartItem('structure_csp', 'Pyramide des CSP des recrutements'),
    _ChartItem('structure_diploma', 'Diplômes des recrutements'),
    _ChartItem('structure_sector', 'Postes vacants par secteur'),
  ],
  DashboardExportSection.recruitmentInsertion: [
    _ChartItem('recruitment_indicators', 'Indicateurs de recrutement'),
    _ChartItem('recruitment_age', 'Âge des recrutés'),
  ],
  DashboardExportSection.mobilityRetention: [
    _ChartItem('mobility_chart', 'Motifs de départ'),
  ],
  DashboardExportSection.inclusion: [
    _ChartItem('inclusion_gender', 'Genre (candidatures)'),
    _ChartItem('inclusion_region', 'Répartition régionale'),
    _ChartItem('inclusion_vulnerable', 'Inclusion vulnérable'),
    _ChartItem('inclusion_youth', 'Emploi jeunes'),
  ],
  DashboardExportSection.competencesFormation: [
    _ChartItem('competences_skills', 'Compétences recherchées'),
    _ChartItem('competences_training', 'Formations demandées'),
  ],
};

class AnalyticsFilterBar extends ConsumerWidget {
  const AnalyticsFilterBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLocked = ref.watch(isScopeLockedProvider);
    final period = ref.watch(dashboardFilterProvider).period;
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 1200;
    final isTablet = screenWidth >= 800 && screenWidth < 1200;
    final filterWidth = isDesktop ? 180.0 : (isTablet ? 160.0 : 140.0);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: Gap.sm),
      decoration: BoxDecoration(
        color: InkColor.card,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: isDesktop
          ? _DesktopLayout(
              period: period,
              isLocked: isLocked,
              filterWidth: filterWidth,
            )
          : _MobileLayout(
              period: period,
              isLocked: isLocked,
              filterWidth: filterWidth,
            ),
    );
  }
}

// ── Desktop layout ──────────────────────────────────────────────

class _DesktopLayout extends ConsumerWidget {
  final PeriodConfig period;
  final bool isLocked;
  final double filterWidth;

  const _DesktopLayout({
    required this.period,
    required this.isLocked,
    required this.filterWidth,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _SectionPicker(width: filterWidth),
          const SizedBox(width: 12),
          _PeriodPicker(period: period, width: filterWidth),
          const SizedBox(width: 12),
          if (!isLocked) ...[
            _LocationPicker(width: filterWidth),
            const SizedBox(width: 12),
          ],
          if (isLocked) ...[
            const _ScopeLockedChip(),
            const SizedBox(width: 12),
          ],
          _EntityTypePicker(width: filterWidth),
          const SizedBox(width: 12),
          _SectorPicker(width: filterWidth),
          const SizedBox(width: 12),
          const _ActiveFilterChips(),
          const SizedBox(width: 12),
          const _ExportButton(),
        ],
      ),
    );
  }
}

// ── Mobile layout ───────────────────────────────────────────────

class _MobileLayout extends ConsumerWidget {
  final PeriodConfig period;
  final bool isLocked;
  final double filterWidth;

  const _MobileLayout({
    required this.period,
    required this.isLocked,
    required this.filterWidth,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasFilters = ref.watch(regionIdProvider) != null ||
        ref.watch(departmentIdProvider) != null ||
        ref.watch(subdivisionIdProvider) != null ||
        ref.watch(entityTypeProvider) != null ||
        ref.watch(sectorProvider) != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _SectionPicker(width: filterWidth),
              const SizedBox(width: 12),
              _PeriodPicker(period: period, width: filterWidth),
              const SizedBox(width: 12),
              if (!isLocked) ...[
                _LocationPicker(width: filterWidth),
                const SizedBox(width: 12),
              ],
              if (isLocked) ...[
                const _ScopeLockedChip(),
                const SizedBox(width: 12),
              ],
              _EntityTypePicker(width: filterWidth),
              const SizedBox(width: 12),
              _SectorPicker(width: filterWidth),
              const SizedBox(width: 12),
              const _ExportButton(),
            ],
          ),
        ),
        if (!isLocked && hasFilters) ...[
          const SizedBox(height: 8),
          const _ActiveFilterChips(),
        ],
      ],
    );
  }
}

// ── Section picker ───────────────────────────────────────────────
// Replaces the old standalone TabBar row: the 8 analytics sections are
// now a dropdown in this same bar, driven by the same DefaultTabController
// TabBarView (in TabContent) already relies on — selecting an item here
// just calls controller.animateTo, no separate navigation state needed.

class _SectionPicker extends StatelessWidget {
  final double width;

  const _SectionPicker({required this.width});

  static const _sections = [
    (Icons.dashboard_outlined, 'Synthèse'),
    (Icons.compare_arrows_rounded, 'Benchmarking'),
    (Icons.work_outline, 'Marché du travail'),
    (Icons.account_tree_outlined, 'Structure des recrutements'),
    (Icons.how_to_reg_outlined, 'Recrutement & Insertion'),
    (Icons.sync_alt_rounded, 'Mobilité & Rétention'),
    (Icons.diversity_3_outlined, 'Inclusion'),
    (Icons.school_outlined, 'Compétences & Formation'),
  ];

  @override
  Widget build(BuildContext context) {
    final controller = DefaultTabController.of(context);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        return _FilterDropdown<int>(
          label: 'Section',
          value: controller.index,
          width: width,
          items: [
            for (final entry in _sections.asMap().entries)
              DropdownMenuItem(
                value: entry.key,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(entry.value.$1, size: 14, color: AccentColor.teal),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        entry.value.$2,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                  ],
                ),
              ),
          ],
          onChanged: (i) {
            if (i != null) controller.animateTo(i);
          },
        );
      },
    );
  }
}

// ── Period picker ───────────────────────────────────────────────

class _PeriodPicker extends ConsumerWidget {
  final PeriodConfig period;
  final double width;

  const _PeriodPicker({required this.period, required this.width});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showLabel = MediaQuery.of(context).size.width >= 600;

    return SizedBox(
      width: width,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => _openPicker(context, ref),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.xs),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: AccentColor.teal.withAlpha(12),
            border: Border.all(color: AccentColor.teal.withAlpha(40)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showLabel)
                Text(
                  'Période',
                  style: textMono(TextSize.caption,
                      color: TextColor.secondary, weight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              if (showLabel) const SizedBox(height: 2),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      period.displayText,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: textMono(TextSize.section,
                          color: TextColor.primary, weight: FontWeight.w600),
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_down,
                      size: 16, color: TextColor.muted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openPicker(BuildContext context, WidgetRef ref) async {
    PeriodConfig selected = period;
    final applied = await showDialog<PeriodConfig>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Période d\'analyse'),
        contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        content: SizedBox(
          width: 360,
          child: PeriodSelector(
            initialType: period.type,
            initialYear: period.year,
            initialQuarter: period.quarter,
            initialSemester: period.semester,
            initialCustomRange: period.customRange,
            onChanged: (p) => selected = p,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, selected),
            child: const Text('Appliquer'),
          ),
        ],
      ),
    );
    if (applied != null) {
      final filter = ref.read(dashboardFilterProvider);
      ref.read(dashboardFilterProvider.notifier).state =
          filter.withPeriod(applied);
    }
  }
}

// ── Location picker ───────────────────────────────────────────────
//
// Région / Département / Arrondissement are nested (each level depends on
// the previous), so they're collapsed into a single button that opens
// showLocationFilterDialog (location_filter_dialog.dart) instead of three
// side-by-side dropdowns.
//
// Values are region/department/subdivision NAMES, not database IDs.
// The analytics backend matches OnefopSubmission.region/department/
// subdivision — denormalized name strings — via a `contains` filter, so
// sending a Region.id UUID here would never match anything.

class _LocationPicker extends ConsumerWidget {
  final double width;

  const _LocationPicker({required this.width});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showLabel = MediaQuery.of(context).size.width >= 600;
    final region = ref.watch(regionIdProvider);
    final department = ref.watch(departmentIdProvider);
    final subdivision = ref.watch(subdivisionIdProvider);

    final summary =
        [region, department, subdivision].where((v) => v != null).join(' > ');

    return SizedBox(
      width: width,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => _openDialog(context, ref, region, department, subdivision),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.xs),
          decoration: BoxDecoration(
            border: Border.all(color: InkColor.border),
            borderRadius: BorderRadius.circular(10),
            color: InkColor.surface,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showLabel)
                Text(
                  'Localisation',
                  style: textMono(TextSize.caption,
                      color: TextColor.secondary, weight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              if (showLabel) const SizedBox(height: 2),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      summary.isEmpty ? 'Toutes' : summary,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: textMono(TextSize.section,
                          color: TextColor.primary, weight: FontWeight.w600),
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_down,
                      size: 16, color: TextColor.muted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openDialog(
    BuildContext context,
    WidgetRef ref,
    String? region,
    String? department,
    String? subdivision,
  ) async {
    final result = await showLocationFilterDialog(
      context,
      ref,
      initialRegion: region,
      initialDepartment: department,
      initialSubdivision: subdivision,
    );
    if (result != null) {
      ref.read(regionIdProvider.notifier).state = result.$1;
      ref.read(departmentIdProvider.notifier).state = result.$2;
      ref.read(subdivisionIdProvider.notifier).state = result.$3;
    }
  }
}

// ── Entity type picker ──────────────────────────────────────────

class _EntityTypePicker extends ConsumerWidget {
  final double width;

  const _EntityTypePicker({required this.width});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(entityTypeProvider);

    return _FilterDropdown<String?>(
      label: 'Entité',
      value: selected,
      width: width,
      items: [
        const DropdownMenuItem<String?>(value: null, child: Text('Toutes')),
        ..._entityTypeLabels.entries.map((e) => DropdownMenuItem<String?>(
              value: e.key,
              child: Text(
                e.value,
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            )),
      ],
      onChanged: (v) => ref.read(entityTypeProvider.notifier).state = v,
    );
  }
}

// ── Sector picker ───────────────────────────────────────────────

class _SectorPicker extends ConsumerWidget {
  final double width;

  const _SectorPicker({required this.width});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sectorsAsync = ref.watch(sectorFilterOptionsProvider);
    final selected = ref.watch(sectorProvider);

    return sectorsAsync.when(
      data: (sectors) => _FilterDropdown<String?>(
        label: 'Secteur',
        value: selected,
        width: width,
        items: [
          const DropdownMenuItem<String?>(value: null, child: Text('Tous')),
          ...sectors.map((name) => DropdownMenuItem<String?>(
                value: name,
                child: Text(
                  name,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              )),
        ],
        onChanged: (v) => ref.read(sectorProvider.notifier).state = v,
      ),
      loading: () => _FilterDropdown<String?>(
        label: 'Secteur',
        value: selected,
        width: width,
        items: const [],
        onChanged: (_) {},
        isLoading: true,
      ),
      error: (_, __) => _FilterDropdown<String?>(
        label: 'Secteur',
        value: null,
        width: width,
        items: const [],
        onChanged: (_) {},
        hasError: true,
      ),
    );
  }
}

// ── Generic dropdown wrapper — overflow-safe ────────────────────
//
// KEY FIX: We no longer put a Text label + DropdownButton in the same Row
// and then wrap the dropdown in Expanded. Instead:
//
//   • The label lives ABOVE the dropdown (or is omitted on mobile) using
//     a Column so it never competes for horizontal space.
//   • The DropdownButton is given the full SizedBox width and uses
//     isDense + isExpanded so its internal Row never exceeds the container.
//   • iconSize is explicit (16) and the icon widget uses SizedBox so Flutter
//     can measure it accurately before laying out the value text.

class _FilterDropdown<T> extends StatelessWidget {
  final String label;
  final T? value;
  final String? hint;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final double width;
  final bool isLoading;
  final bool hasError;
  final bool isDisabled;

  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.width,
    this.hint,
    required this.items,
    required this.onChanged,
    this.isLoading = false,
    this.hasError = false,
    this.isDisabled = false,
  });

  @override
  Widget build(BuildContext context) {
    final showLabel = MediaQuery.of(context).size.width >= 600;
    final effectiveOnChanged = (isDisabled || isLoading) ? null : onChanged;

    // Decide what to show inside the box when not in normal state
    Widget dropdownOrStatus;
    if (isLoading) {
      dropdownOrStatus = const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    } else if (hasError) {
      dropdownOrStatus = const Icon(
        Icons.error_outline,
        size: 16,
        color: AccentColor.rose,
      );
    } else {
      dropdownOrStatus = DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          // --- overflow fixes ---
          isExpanded:
              true, // fills the Expanded; prevents internal row overflow
          isDense: true, // reduces intrinsic height so icon fits
          iconSize: 16,
          icon: const Icon(Icons.keyboard_arrow_down, size: 16),
          // ----------------------
          value: value,
          hint: Text(
            hint ?? label,
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
            style: textMono(TextSize.body, color: TextColor.muted),
          ),
          items: items,
          onChanged: effectiveOnChanged,
          style: textMono(TextSize.section,
              color: TextColor.primary, weight: FontWeight.w600),
          dropdownColor: InkColor.card,
          borderRadius: BorderRadius.circular(8),
        ),
      );
    }

    return SizedBox(
      width: width,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.xs),
        decoration: BoxDecoration(
          border: Border.all(
            color: hasError
                ? AccentColor.rose
                : isDisabled
                    ? InkColor.border.withAlpha(128)
                    : InkColor.border,
          ),
          borderRadius: BorderRadius.circular(10),
          color:
              isDisabled ? InkColor.surface.withAlpha(128) : InkColor.surface,
        ),
        child: showLabel
            // ── Tablet / Desktop: label on top, dropdown below ──
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: textMono(TextSize.caption,
                        color:
                            isDisabled ? TextColor.muted : TextColor.secondary,
                        weight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                  const SizedBox(height: 2),
                  dropdownOrStatus,
                ],
              )
            // ── Mobile: just the dropdown, no label ──
            : dropdownOrStatus,
      ),
    );
  }
}

// ── Scope locked indicator ──────────────────────────────────────

class _ScopeLockedChip extends ConsumerWidget {
  const _ScopeLockedChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scope = ref.watch(userScopeProvider);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: Gap.xs),
      decoration: BoxDecoration(
        color: AccentColor.gold.withAlpha(26),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AccentColor.gold.withAlpha(77)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_outline, size: 12, color: AccentColor.gold),
          const SizedBox(width: Gap.xs),
          Flexible(
            child: Text(
              scope.region != null ? 'Scope: ${scope.region}' : 'Verrouillé',
              style: textMono(TextSize.label, color: AccentColor.gold),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Active filter chips ─────────────────────────────────────────

class _ActiveFilterChips extends ConsumerWidget {
  const _ActiveFilterChips();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final region = ref.watch(regionIdProvider);
    final dept = ref.watch(departmentIdProvider);
    final subdiv = ref.watch(subdivisionIdProvider);
    final entityType = ref.watch(entityTypeProvider);
    final sector = ref.watch(sectorProvider);
    final chips = <Widget>[];

    if (region != null) {
      chips.add(_FilterChip(
        label: region,
        onRemove: () {
          ref.read(regionIdProvider.notifier).state = null;
          ref.read(departmentIdProvider.notifier).state = null;
          ref.read(subdivisionIdProvider.notifier).state = null;
        },
      ));
    }
    if (dept != null) {
      chips.add(_FilterChip(
        label: dept,
        onRemove: () {
          ref.read(departmentIdProvider.notifier).state = null;
          ref.read(subdivisionIdProvider.notifier).state = null;
        },
      ));
    }
    if (subdiv != null) {
      chips.add(_FilterChip(
        label: subdiv,
        onRemove: () => ref.read(subdivisionIdProvider.notifier).state = null,
      ));
    }
    if (entityType != null) {
      chips.add(_FilterChip(
        label: _entityTypeLabels[entityType] ?? entityType,
        onRemove: () => ref.read(entityTypeProvider.notifier).state = null,
      ));
    }
    if (sector != null) {
      chips.add(_FilterChip(
        label: sector,
        onRemove: () => ref.read(sectorProvider.notifier).state = null,
      ));
    }

    if (chips.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 6, runSpacing: 6, children: chips);
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final VoidCallback onRemove;

  const _FilterChip({required this.label, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(
        label,
        overflow: TextOverflow.ellipsis,
        maxLines: 1,
        style: textMono(TextSize.label,
            color: TextColor.primary, weight: FontWeight.w500),
      ),
      deleteIcon: const Icon(Icons.close, size: 14),
      onDeleted: onRemove,
      backgroundColor: AccentColor.teal.withAlpha(20),
      side: BorderSide(color: AccentColor.teal.withAlpha(51)),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: const EdgeInsets.symmetric(horizontal: Gap.xs, vertical: 0),
    );
  }
}

// ── Export button ───────────────────────────────────────────────

class _ExportButton extends ConsumerStatefulWidget {
  const _ExportButton();

  @override
  ConsumerState<_ExportButton> createState() => _ExportButtonState();
}

class _ExportButtonState extends ConsumerState<_ExportButton> {
  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(dashboardFilterProvider);
    final bundleAsync = ref.watch(onefopDashboardBundleProvider);

    return ElevatedButton.icon(
      onPressed: bundleAsync.when(
        data: (bundle) => () => _showExportDialog(context, bundle, filter),
        loading: () => null,
        error: (_, __) => null,
      ),
      icon: const Icon(Icons.download_rounded, size: 16),
      label: const Text('Export',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      style: ElevatedButton.styleFrom(
        backgroundColor: AccentColor.teal,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        minimumSize: const Size(60, 32),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _showExportDialog(
    BuildContext context,
    DashboardBundle bundle,
    AnalyticsFilterState filter,
  ) async {
    final controller = DefaultTabController.of(context);
    final defaultSection = _sectionForTab(controller.index);
    final availableOptions = <DashboardExportSection>[
      DashboardExportSection.filters,
      DashboardExportSection.summary,
      DashboardExportSection.benchmarking,
      DashboardExportSection.laborMarket,
      DashboardExportSection.workforceStructure,
      DashboardExportSection.recruitmentInsertion,
      DashboardExportSection.mobilityRetention,
      DashboardExportSection.inclusion,
      DashboardExportSection.competencesFormation,
    ];

    // Pre-select every chart under "Filtres" and whichever section matches
    // the dashboard tab the user was looking at — everything else starts
    // unchecked so the export stays scoped to what they actually asked for.
    final selectedCharts = <String>{
      ..._sectionCharts[DashboardExportSection.filters]!.map((c) => c.id),
      ..._sectionCharts[defaultSection]!.map((c) => c.id),
    };
    final dialogContext = context;

    final result = await showDialog<Set<String>>(
      context: dialogContext,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            bool sectionAllSelected(DashboardExportSection section) =>
                _sectionCharts[section]!
                    .every((c) => selectedCharts.contains(c.id));
            bool sectionAnySelected(DashboardExportSection section) =>
                _sectionCharts[section]!
                    .any((c) => selectedCharts.contains(c.id));

            void toggleSection(DashboardExportSection section, bool select) {
              setState(() {
                for (final chart in _sectionCharts[section]!) {
                  if (select) {
                    selectedCharts.add(chart.id);
                  } else {
                    selectedCharts.remove(chart.id);
                  }
                }
              });
            }

            return AlertDialog(
              title: const Text('Exporter le tableau de bord'),
              content: SizedBox(
                width: 420,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: availableOptions.map((section) {
                      final charts = _sectionCharts[section]!;
                      final allSelected = sectionAllSelected(section);
                      final anySelected = sectionAnySelected(section);
                      // A single-item section (e.g. Filtres, Benchmarking)
                      // gains nothing from an expansion arrow over its lone
                      // chart, so it renders as a plain checkbox row.
                      if (charts.length == 1) {
                        return CheckboxListTile(
                          value: allSelected,
                          onChanged: (checked) =>
                              toggleSection(section, checked == true),
                          title: Text(_exportSectionTitles[section]!),
                          subtitle: Text(_exportSectionDescriptions[section]!),
                          controlAffinity: ListTileControlAffinity.leading,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 2),
                        );
                      }
                      return Theme(
                        data: Theme.of(context)
                            .copyWith(dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          childrenPadding:
                              const EdgeInsets.only(left: 32),
                          initiallyExpanded: anySelected,
                          leading: Checkbox(
                            value: allSelected
                                ? true
                                : (anySelected ? null : false),
                            tristate: true,
                            onChanged: (checked) =>
                                toggleSection(section, checked != false),
                          ),
                          title: Text(_exportSectionTitles[section]!),
                          subtitle: Text(_exportSectionDescriptions[section]!),
                          children: charts.map((chart) {
                            return CheckboxListTile(
                              dense: true,
                              value: selectedCharts.contains(chart.id),
                              onChanged: (checked) {
                                setState(() {
                                  if (checked == true) {
                                    selectedCharts.add(chart.id);
                                  } else {
                                    selectedCharts.remove(chart.id);
                                  }
                                });
                              },
                              title: Text(chart.label),
                              controlAffinity: ListTileControlAffinity.leading,
                              contentPadding: EdgeInsets.zero,
                            );
                          }).toList(),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Annuler'),
                ),
                ElevatedButton(
                  onPressed: selectedCharts.isEmpty
                      ? null
                      : () => Navigator.of(context).pop(selectedCharts),
                  child: const Text('Exporter'),
                ),
              ],
            );
          },
        );
      },
    );

    if (!dialogContext.mounted) return;
    if (result != null && result.isNotEmpty) {
      await _exportDashboardPdf(dialogContext, bundle, filter, result);
    }
  }

  DashboardExportSection _sectionForTab(int index) {
    switch (index) {
      case 1:
        return DashboardExportSection.benchmarking;
      case 2:
        return DashboardExportSection.laborMarket;
      case 3:
        return DashboardExportSection.workforceStructure;
      case 4:
        return DashboardExportSection.recruitmentInsertion;
      case 5:
        return DashboardExportSection.mobilityRetention;
      case 6:
        return DashboardExportSection.inclusion;
      case 7:
        return DashboardExportSection.competencesFormation;
      case 0:
      default:
        return DashboardExportSection.summary;
    }
  }

  Future<void> _exportDashboardPdf(
    BuildContext context,
    DashboardBundle bundle,
    AnalyticsFilterState filter,
    Set<String> selectedCharts,
  ) async {
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    try {
      final document = pw.Document();
      bool has(String id) => selectedCharts.contains(id);
      final rows = [
        ['Période', filter.period.displayText],
        ['Région', filter.region ?? 'National'],
        ['Département', filter.department ?? 'Tous'],
        ['Sous-division', filter.subdivision ?? 'Toutes'],
        ['Type d\'entité', filter.entityType ?? 'Toutes'],
        ['Secteur', filter.sector ?? 'Tous'],
      ];

      final dashboard = bundle.dashboard;
      final summaryRows = [
        ['Déclarations', dashboard.totalDeclarations.toString()],
        ['Effectif total', dashboard.totalEmployees.toString()],
        ['Recrutements', dashboard.totalRecruitments.toString()],
        ['Départs', (dashboard.totalDismissals + dashboard.totalRetirements).toString()],
        ['Variation nette', dashboard.netChange.toString()],
        ['Croissance', '${dashboard.employmentGrowthRate.toStringAsFixed(1)}%'],
        ['Secteur leader', dashboard.topSectors.isNotEmpty ? dashboard.topSectors.first.sector : 'N/A'],
      ];

      final borderColor = pdf.PdfColor.fromInt(0xffdddddd);
      final headerColor = pdf.PdfColor.fromInt(0xfff1f1f1);

      final content = <pw.Widget>[
        pw.Header(
          level: 0,
          child: pw.Text('Observatoire de l\'Emploi — Export',
              style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
        ),
        pw.Paragraph(text: 'Date d\'export : ${DateTime.now().toLocal()}'),
        pw.SizedBox(height: 10),
      ];

      if (has('filters')) {
        content.addAll([
          pw.Header(level: 1, text: 'Filtres'),
          pw.TableHelper.fromTextArray(
            border: pw.TableBorder.all(color: borderColor),
            cellStyle: const pw.TextStyle(fontSize: 10),
            headerDecoration: pw.BoxDecoration(color: headerColor),
            headers: ['Champ', 'Valeur'],
            data: rows,
          ),
          pw.SizedBox(height: 16),
        ]);
      }

      final summaryChartIds = _sectionCharts[DashboardExportSection.summary]!
          .map((c) => c.id);
      if (summaryChartIds.any(has)) {
        content.add(pw.Header(level: 1, text: 'Synthèse'));
        if (has('summary_kpis')) {
          content.addAll([
            pw.Text('Indicateurs clés',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            pw.TableHelper.fromTextArray(
              border: pw.TableBorder.all(color: borderColor),
              cellStyle: const pw.TextStyle(fontSize: 10),
              headerDecoration: pw.BoxDecoration(color: headerColor),
              headers: ['Indicateur', 'Valeur'],
              data: summaryRows,
            ),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_trend')) {
          content.addAll([
            pw.Text('Évolution de l\'emploi',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildTrendSection(bundle.trends),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_sector')) {
          content.addAll([
            pw.Text('Performance sectorielle',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildSectorSection(bundle.sectors.take(8).toList()),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_balance')) {
          content.addAll([
            pw.Text('Dynamique du travail',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildEmploymentBalanceSection(bundle.employmentBalance),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_gender')) {
          content.addAll([
            pw.Text('Genre (candidatures)',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildGenderSection(dashboard.genderDistribution),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_yoy')) {
          content.addAll([
            pw.Text('Évolution annuelle',
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildYoySection(dashboard, bundle.previous),
            pw.SizedBox(height: 16),
          ]);
        }
      }

      if (has('benchmarking_table')) {
        content.addAll([
          pw.Header(level: 1, text: 'Benchmarking régional'),
          _buildBenchmarkingSection(bundle, filter),
          pw.SizedBox(height: 16),
        ]);
      }

      final laborMarketIds =
          _sectionCharts[DashboardExportSection.laborMarket]!.map((c) => c.id);
      if (laborMarketIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: 'Marché du travail'),
          _buildLaborMarketSection(bundle.laborMarketGap, selectedCharts),
          pw.SizedBox(height: 16),
        ]);
      }

      final structureIds = _sectionCharts[DashboardExportSection.workforceStructure]!
          .map((c) => c.id);
      if (structureIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: 'Structure des recrutements'),
          _buildWorkforceStructureSection(bundle, selectedCharts),
          pw.SizedBox(height: 16),
        ]);
      }

      final recruitmentIds =
          _sectionCharts[DashboardExportSection.recruitmentInsertion]!
              .map((c) => c.id);
      if (recruitmentIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: 'Recrutement & Insertion'),
          _buildRecruitmentInsertionSection(
              bundle.firstTimeEmployment, selectedCharts),
          pw.SizedBox(height: 16),
        ]);
      }

      if (has('mobility_chart')) {
        content.addAll([
          pw.Header(level: 1, text: 'Mobilité & Rétention'),
          _buildMobilityRetentionSection(bundle.departuresMobility),
          pw.SizedBox(height: 16),
        ]);
      }

      final inclusionIds =
          _sectionCharts[DashboardExportSection.inclusion]!.map((c) => c.id);
      if (inclusionIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: 'Inclusion'),
          _buildInclusionSection(bundle, filter, selectedCharts),
          pw.SizedBox(height: 16),
        ]);
      }

      final competencesIds =
          _sectionCharts[DashboardExportSection.competencesFormation]!
              .map((c) => c.id);
      if (competencesIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: 'Compétences & Formation'),
          _buildCompetencesFormationSection(bundle, selectedCharts),
          pw.SizedBox(height: 16),
        ]);
      }

      document.addPage(pw.MultiPage(
        pageFormat: pdf.PdfPageFormat.a4,
        build: (context) => content,
      ));

      final bytes = await document.save();
      await Printing.layoutPdf(onLayout: (_) => bytes);
    } catch (error) {
      scaffoldMessenger.showSnackBar(
        SnackBar(content: Text('Export impossible : $error')),
      );
    }
  }

  pw.Widget _buildTrendSection(List<TimeSeriesData> trends) {
    if (trends.isEmpty) {
      return _buildEmptySection('Évolution de l\'emploi');
    }

    final labels = trends.map((trend) => trend.shortLabel).toList();
    final values = trends.map((trend) => trend.totalEmployees).toList();
    final maxY = values.isEmpty ? 1 : values.reduce((a, b) => a > b ? a : b);
    final ticks = _chartTicks(maxY);

    final xAxis = labels.length == 1
        ? pw.FixedAxis<int>(
            [0, 1],
            format: (value) => value.toInt() == 0 ? labels[0] : '',
            textStyle: const pw.TextStyle(fontSize: 8),
            margin: 8,
            ticks: true,
            axisTick: true,
            divisions: true,
            divisionsColor: pdf.PdfColors.grey,
            divisionsDashed: true,
          )
        : pw.FixedAxis.fromStrings(
            labels,
            textStyle: const pw.TextStyle(fontSize: 8),
            margin: 8,
            ticks: true,
            axisTick: true,
            divisions: true,
            divisionsColor: pdf.PdfColors.grey,
            divisionsDashed: true,
          );

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 210,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.CartesianGrid(
              xAxis: xAxis,
              yAxis: pw.FixedAxis<double>(
                ticks,
                format: (value) => _formatNumber(value.toInt()),
                textStyle: const pw.TextStyle(fontSize: 8),
                margin: 8,
                ticks: true,
                axisTick: true,
                divisions: true,
                divisionsColor: pdf.PdfColors.grey,
                divisionsDashed: true,
              ),
            ),
            datasets: [
              pw.LineDataSet(
                data: values
                    .asMap()
                    .entries
                    .map((entry) => pw.PointChartValue(entry.key.toDouble(), entry.value.toDouble()))
                    .toList(),
                color: pdf.PdfColors.blue,
                drawSurface: true,
                surfaceOpacity: 0.15,
                surfaceColor: pdf.PdfColors.blue,
                pointSize: 3,
                lineWidth: 2,
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Période', 'Effectif'],
          data: [
            for (final trend in trends)
              [trend.shortLabel, trend.totalEmployees.toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildSectorSection(List<Sector> sectors) {
    if (sectors.isEmpty) {
      return _buildEmptySection('Performance sectorielle');
    }

    final labels = sectors.map((sector) => sector.sector).toList();
    final values = sectors.map((sector) => sector.employees).toList();
    final maxY = values.isEmpty ? 1 : values.reduce((a, b) => a > b ? a : b);
    final ticks = _chartTicks(maxY);

    final xAxis = labels.length == 1
        ? pw.FixedAxis<int>(
            [0, 1],
            format: (value) => value.toInt() == 0 ? labels[0] : '',
            textStyle: const pw.TextStyle(fontSize: 8),
            margin: 8,
            ticks: true,
            axisTick: true,
            angle: -math.pi / 4,
          )
        : pw.FixedAxis.fromStrings(
            labels,
            textStyle: const pw.TextStyle(fontSize: 8),
            margin: 8,
            ticks: true,
            axisTick: true,
            angle: -math.pi / 4,
          );

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 210,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.CartesianGrid(
              xAxis: xAxis,
              yAxis: pw.FixedAxis<double>(
                ticks,
                format: (value) => _formatNumber(value.toInt()),
                textStyle: const pw.TextStyle(fontSize: 8),
                margin: 8,
                ticks: true,
                axisTick: true,
                divisions: true,
                divisionsColor: pdf.PdfColors.grey,
                divisionsDashed: true,
              ),
            ),
            datasets: [
              pw.BarDataSet(
                data: values
                    .asMap()
                    .entries
                    .map((entry) => pw.PointChartValue(entry.key.toDouble(), entry.value.toDouble()))
                    .toList(),
                color: pdf.PdfColors.green,
                width: 18,
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Secteur', 'Effectifs'],
          data: [
            for (final sector in sectors)
              [sector.sector, sector.employees.toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildEmploymentBalanceSection(EmploymentBalance? balance) {
    if (balance == null) {
      return _buildEmptySection('Dynamique du travail');
    }

    final breakdown = [
      ['Licenciements', balance.dismissals.toString()],
      ['Démissions', balance.resignations.toString()],
      ['Retraites', balance.retirements.toString()],
    ];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur'],
          data: [
            ['Emplois créés', balance.jobsCreated.toString()],
            ['Emplois supprimés', balance.jobsLost.toString()],
          ],
        ),
        pw.SizedBox(height: 10),
        pw.Text('Détail des départs',
            style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Motif', 'Départs'],
          data: breakdown,
        ),
        if (balance.technicalUnemployment > 0) ...[
          pw.SizedBox(height: 6),
          pw.Text(
              '${balance.technicalUnemployment} en chômage technique (hors total).',
              style: pw.TextStyle(fontSize: 9, color: pdf.PdfColors.grey700)),
        ],
      ],
    );
  }

  pw.Widget _buildYoySection(DashboardSummary cur, DashboardSummary? prev) {
    final rows = [
      ['Effectif', prev?.totalEmployees.toString() ?? '—', cur.totalEmployees.toString()],
      ['Recrutements', prev?.totalRecruitments.toString() ?? '—', cur.totalRecruitments.toString()],
      [
        'Départs',
        prev != null ? (prev.totalDismissals + prev.totalRetirements).toString() : '—',
        (cur.totalDismissals + cur.totalRetirements).toString(),
      ],
      ['Solde net', prev?.netChange.toString() ?? '—', cur.netChange.toString()],
    ];

    return pw.TableHelper.fromTextArray(
      border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
      cellStyle: const pw.TextStyle(fontSize: 10),
      headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
      headers: ['Indicateur', '${cur.year - 1}', '${cur.year}'],
      data: rows,
    );
  }

  pw.Widget _buildGenderSection(GenderDistribution distribution) {
    final total = distribution.male + distribution.female;
    if (total == 0) {
      return _buildEmptySection('Répartition Femmes / Hommes');
    }
    final malePct = distribution.male / total * 100;
    final femalePct = distribution.female / total * 100;

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 200,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.PieGrid(startAngle: -math.pi / 2),
            datasets: [
              pw.PieDataSet(
                value: distribution.male,
                legend: 'Hommes',
                color: pdf.PdfColors.blue,
                legendPosition: pw.PieLegendPosition.outside,
                legendStyle: const pw.TextStyle(fontSize: 9),
              ),
              pw.PieDataSet(
                value: distribution.female,
                legend: 'Femmes',
                color: pdf.PdfColors.pink,
                legendPosition: pw.PieLegendPosition.outside,
                legendStyle: const pw.TextStyle(fontSize: 9),
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.Text('Hommes : ${distribution.male} (${malePct.toStringAsFixed(1)}%)', style: const pw.TextStyle(fontSize: 10)),
        pw.Text('Femmes : ${distribution.female} (${femalePct.toStringAsFixed(1)}%)', style: const pw.TextStyle(fontSize: 10)),
      ],
    );
  }

  pw.Widget _buildBenchmarkingSection(DashboardBundle bundle, AnalyticsFilterState filter) {
    final hasGeography = filter.region != null || filter.department != null || filter.subdivision != null;
    if (!hasGeography) {
      return _buildEmptySection(
        'Benchmarking régional',
        'Sélectionnez une région, un département ou un arrondissement pour comparer au national.',
      );
    }

    final dashboard = bundle.dashboard;
    final data = [
      ['Indicateur', 'Valeur locale', ''],
      ['Entreprises déclarantes', dashboard.totalDeclarations.toString(), ''],
      ['Effectif total', dashboard.totalEmployees.toString(), ''],
      ['Recrutements', dashboard.totalRecruitments.toString(), ''],
      ['Départs', (dashboard.totalDismissals + dashboard.totalRetirements).toString(), ''],
    ];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text('Benchmarking régional', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.Paragraph(text: 'La comparaison nationale n\'est pas incluse dans l\'export actuel.'),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur locale', 'Remarque'],
          data: data,
        ),
      ],
    );
  }

  pw.Widget _buildLaborMarketSection(
      LaborMarketTension? laborMarketGap, Set<String> selected) {
    if (laborMarketGap == null) {
      return _buildEmptySection('Marché du travail');
    }

    final rows = [
      ['Postes vacants', laborMarketGap.totalVacancies.toString()],
      ['Recrutements', laborMarketGap.totalRecruitments.toString()],
      ['Écart', laborMarketGap.gap.toString()],
      ['Taux d\'absorption', laborMarketGap.absorptionRate != null
          ? '${laborMarketGap.absorptionRate!.toStringAsFixed(1)}%'
          : 'N/A'],
    ];

    final cspRows = laborMarketGap.byCsp
        .map((row) => [row.cspCategory, row.hires.toString(), '${row.hireSharePct.toStringAsFixed(1)}%'])
        .toList();

    final children = <pw.Widget>[];
    if (selected.contains('labor_indicators')) {
      children.addAll([
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur'],
          data: rows,
        ),
        pw.SizedBox(height: 12),
      ]);
    }
    if (selected.contains('labor_csp')) {
      children.addAll([
        pw.Text('Recrutements par CSP', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['CSP', 'Recrutements', 'Part'],
          data: cspRows,
        ),
      ]);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildWorkforceStructureSection(
      DashboardBundle bundle, Set<String> selected) {
    if (bundle.entityBreakdown == null &&
        bundle.entitySize == null &&
        bundle.diplomaBreakdown.isEmpty &&
        bundle.cspProfile == null) {
      return _buildEmptySection('Structure des recrutements');
    }

    final sections = <pw.Widget>[];
    if (selected.contains('structure_entity') && bundle.entityBreakdown != null) {
      final breakdown = bundle.entityBreakdown!;
      sections.addAll([
        pw.Text('Répartition des types d\'entité', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Type', 'Déclarants'],
          data: [
            ['Entreprises', breakdown.enterprises.toString()],
            ['Coopératives', breakdown.cooperatives.toString()],
            ['CTD', breakdown.ctds.toString()],
            ['ONG', breakdown.ongs.toString()],
          ],
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_size') && bundle.entitySize != null) {
      final size = bundle.entitySize!;
      sections.addAll([
        pw.Text('Répartition par taille d\'entreprise', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Taille', 'Count'],
          data: [
            ['Très petite entreprise', size.tpe.toString()],
            ['Petite entreprise', size.pe.toString()],
            ['Moyenne entreprise', size.me.toString()],
            ['Grande entreprise', size.ge.toString()],
          ],
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_csp') && bundle.cspProfile != null) {
      sections.addAll([
        pw.Text('Pyramide des CSP des recrutements', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildCspPyramidSection(bundle.cspProfile!),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_diploma') && bundle.diplomaBreakdown.isNotEmpty) {
      sections.addAll([
        pw.Text('Diplômes des recrutements', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Niveau', 'Effectif'],
          data: [
            for (final item in bundle.diplomaBreakdown.take(8))
              [item.diploma, item.count.toString()],
          ],
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_sector') && bundle.sectors.isNotEmpty) {
      sections.addAll([
        pw.Text('Postes vacants par secteur', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildSectorSection(bundle.sectors.take(8).toList()),
      ]);
    }

    if (sections.isEmpty) {
      return _buildEmptySection('Structure des recrutements');
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: sections);
  }

  pw.Widget _buildCspPyramidSection(
      ({int totalHires, int cadres, int foremen, int workers}) cspProfile) {
    if (cspProfile.totalHires == 0) {
      return _buildEmptySection('Pyramide des CSP des recrutements');
    }

    final labels = ['Cadres', 'Agents de maîtrise', 'Ouvriers'];
    final values = [cspProfile.cadres, cspProfile.foremen, cspProfile.workers];
    final colors = [pdf.PdfColors.blue, pdf.PdfColors.orange, pdf.PdfColors.pink];
    final pcts = values
        .map((v) => cspProfile.totalHires > 0 ? v / cspProfile.totalHires * 100 : 0.0)
        .toList();

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 200,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.CartesianGrid(
              xAxis: pw.FixedAxis.fromStrings(
                labels,
                textStyle: const pw.TextStyle(fontSize: 8),
                margin: 8,
                ticks: true,
                axisTick: true,
              ),
              yAxis: pw.FixedAxis<double>(
                const [0, 25, 50, 75, 100],
                format: (value) => '${value.toInt()}%',
                textStyle: const pw.TextStyle(fontSize: 8),
                margin: 8,
                ticks: true,
                axisTick: true,
                divisions: true,
                divisionsColor: pdf.PdfColors.grey,
                divisionsDashed: true,
              ),
            ),
            datasets: [
              for (var i = 0; i < labels.length; i++)
                pw.BarDataSet(
                  data: [pw.PointChartValue(i.toDouble(), pcts[i])],
                  color: colors[i],
                  width: 40,
                ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['CSP', 'Recrutements', 'Part'],
          data: [
            for (var i = 0; i < labels.length; i++)
              [labels[i], values[i].toString(), '${pcts[i].toStringAsFixed(1)}%'],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildRecruitmentInsertionSection(
      FirstTimeEmployment? firstTimeEmployment, Set<String> selected) {
    if (firstTimeEmployment == null) {
      return _buildEmptySection('Recrutement & Insertion');
    }

    final ageRows = [
      ['15-24', firstTimeEmployment.recruitsAge15_24.toString()],
      ['25-34', firstTimeEmployment.recruitsAge25_34.toString()],
      ['35+', firstTimeEmployment.recruitsAge35Plus.toString()],
    ];

    final children = <pw.Widget>[];
    if (selected.contains('recruitment_indicators')) {
      children.addAll([
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur'],
          data: [
            ['Demandes enregistrées', firstTimeEmployment.seekersTotal.toString()],
            ['Primo-recrutés', firstTimeEmployment.recruitsTotal.toString()],
            ['Taux de conversion', '${firstTimeEmployment.conversionRate.toStringAsFixed(1)}%'],
            ['CDI / permanent', firstTimeEmployment.recruitsPermanent.toString()],
            ['Temporaire', firstTimeEmployment.recruitsTemporary.toString()],
          ],
        ),
        pw.SizedBox(height: 12),
      ]);
    }
    if (selected.contains('recruitment_age')) {
      children.addAll([
        pw.Text('Âge des recrutés', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Tranche', 'Effectif'],
          data: ageRows,
        ),
      ]);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildMobilityRetentionSection(DeparturesMobility? departuresMobility) {
    if (departuresMobility == null) {
      return _buildEmptySection('Mobilité & Rétention');
    }

    final values = [
      departuresMobility.dismissals,
      departuresMobility.resignations,
      departuresMobility.retirements,
      departuresMobility.other,
    ];
    final labels = ['Licenciements', 'Démissions', 'Retraites', 'Autres'];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 210,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.PieGrid(startAngle: -math.pi / 2),
            datasets: [
              for (var i = 0; i < labels.length; i++)
                if (values[i] > 0)
                  pw.PieDataSet(
                    value: values[i],
                    legend: labels[i],
                    color: [
                      pdf.PdfColors.red,
                      pdf.PdfColors.orange,
                      pdf.PdfColors.teal,
                      pdf.PdfColors.blue,
                    ][i],
                    legendPosition: pw.PieLegendPosition.outside,
                    legendStyle: const pw.TextStyle(fontSize: 8),
                  ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Type', 'Départs'],
          data: [
            for (var i = 0; i < labels.length; i++)
              [labels[i], values[i].toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildInclusionSection(
      DashboardBundle bundle, AnalyticsFilterState filter, Set<String> selected) {
    final regionRows = bundle.gender
        .map((region) => [region.region, region.male.toString(), region.female.toString(), region.total.toString()])
        .toList();
    final inclusion = bundle.vulnerableInclusion;
    final List<List<String>> inclusionRows = inclusion != null
        ? <List<String>>[
            ['Personnes vulnérables', inclusion.total.toString()],
            ['Recrutements totaux', inclusion.totalHires.toString()],
            ['Part', inclusion.totalHires > 0 ? '${(inclusion.total / inclusion.totalHires * 100).toStringAsFixed(1)}%' : 'N/A'],
          ]
        : <List<String>>[];
    final firstTime = bundle.firstTimeEmployment;

    final children = <pw.Widget>[];

    if (selected.contains('inclusion_gender')) {
      children.addAll([
        pw.Text('Genre (candidatures)', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildGenderSection(bundle.dashboard.genderDistribution),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_region') && regionRows.isNotEmpty) {
      children.addAll([
        pw.Text('Répartition régionale', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Région', 'Hommes', 'Femmes', 'Total'],
          data: regionRows,
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_vulnerable') && inclusionRows.isNotEmpty) {
      children.addAll([
        pw.Text('Inclusion vulnérable', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur'],
          data: inclusionRows,
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_youth') && firstTime != null) {
      children.addAll([
        pw.Text('Emploi jeunes', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Indicateur', 'Valeur'],
          data: [
            ['Recrutements 15-34', (firstTime.recruitsAge15_24 + firstTime.recruitsAge25_34).toString()],
            ['Total recrutements', firstTime.recruitsTotal.toString()],
            ['Taux de conversion', '${firstTime.conversionRate.toStringAsFixed(1)}%'],
          ],
        ),
      ]);
    }

    if (children.isEmpty) {
      return _buildEmptySection('Inclusion');
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildCompetencesFormationSection(
      DashboardBundle bundle, Set<String> selected) {
    final skills = bundle.topSkills ?? [];
    final domains = bundle.topTraining ?? [];
    if (skills.isEmpty && domains.isEmpty) {
      return _buildEmptySection('Compétences & Formation');
    }

    final children = <pw.Widget>[];
    if (selected.contains('competences_skills') && skills.isNotEmpty) {
      children.addAll([
        pw.Text('Compétences recherchées', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Compétence', 'Demande', 'Offre', 'Écart'],
          data: skills.take(8).map((item) => [
                item.skill,
                item.demand.toString(),
                item.supply.toString(),
                item.gap.toString(),
              ]).toList(),
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('competences_training') && domains.isNotEmpty) {
      children.addAll([
        pw.Text('Formations demandées', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: ['Formation', 'Demande', 'Offre', 'Écart'],
          data: domains.take(8).map((item) => [
                item.skill,
                item.demand.toString(),
                item.supply.toString(),
                item.gap.toString(),
              ]).toList(),
        ),
      ]);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  List<double> _chartTicks(int max) {
    if (max <= 0) return const [0.0, 1.0];
    if (max <= 5) return List<double>.generate(max + 1, (i) => i.toDouble());
    final step = _niceStep(max);
    final ticks = <double>[];
    for (var value = 0.0; value <= max.toDouble() + 0.001; value += step) {
      ticks.add(value);
    }
    if (ticks.last < max.toDouble()) {
      ticks.add(max.toDouble());
    }
    if (ticks.length == 1) {
      return [ticks.first, ticks.first + 1.0];
    }
    return ticks;
  }

  int _niceStep(int max) {
    if (max <= 10) return 2;
    if (max <= 50) return 10;
    if (max <= 100) return 20;
    if (max <= 500) return 100;
    if (max <= 1000) return 200;
    return 500;
  }

  pw.Widget _buildEmptySection(String title, [String? subtitle]) {
    final children = <pw.Widget>[
      pw.Text(title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 4),
    ];

    if (subtitle != null) {
      children.addAll([
        pw.Text(subtitle, style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey)),
        pw.SizedBox(height: 8),
      ]);
    }

    children.addAll([
      pw.Container(
        height: 210,
        alignment: pw.Alignment.center,
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: pdf.PdfColor.fromInt(0xffdddddd)),
          color: pdf.PdfColor.fromInt(0xfffafafa),
        ),
        child: pw.Text(
          'Aucune donnée disponible',
          style: pw.TextStyle(fontSize: 12, color: pdf.PdfColors.grey),
        ),
      ),
      pw.SizedBox(height: 10),
    ]);

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: children,
    );
  }

  String _formatNumber(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}k';
    }
    return value.toString();
  }
}
