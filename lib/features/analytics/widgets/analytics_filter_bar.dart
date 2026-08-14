// lib/features/analytics/widgets/analytics_filter_bar.dart
import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../l10n/generated/app_localizations.dart';
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

final _exportSectionTitles = {
  DashboardExportSection.filters: (AppLocalizations l) => l.exportSectionFilters,
  DashboardExportSection.summary: (AppLocalizations l) => l.exportSectionSummary,
  DashboardExportSection.benchmarking: (AppLocalizations l) =>
      l.exportSectionBenchmarking,
  DashboardExportSection.laborMarket: (AppLocalizations l) =>
      l.exportSectionLaborMarket,
  DashboardExportSection.workforceStructure: (AppLocalizations l) =>
      l.exportSectionWorkforceStructure,
  DashboardExportSection.recruitmentInsertion: (AppLocalizations l) =>
      l.exportSectionRecruitmentInsertion,
  DashboardExportSection.mobilityRetention: (AppLocalizations l) =>
      l.exportSectionMobilityRetention,
  DashboardExportSection.inclusion: (AppLocalizations l) => l.exportSectionInclusion,
  DashboardExportSection.competencesFormation: (AppLocalizations l) =>
      l.exportSectionCompetencesFormation,
};

final _exportSectionDescriptions = {
  DashboardExportSection.filters: (AppLocalizations l) => l.exportDescFilters,
  DashboardExportSection.summary: (AppLocalizations l) => l.exportDescSummary,
  DashboardExportSection.benchmarking: (AppLocalizations l) =>
      l.exportDescBenchmarking,
  DashboardExportSection.laborMarket: (AppLocalizations l) =>
      l.exportDescLaborMarket,
  DashboardExportSection.workforceStructure: (AppLocalizations l) =>
      l.exportDescWorkforceStructure,
  DashboardExportSection.recruitmentInsertion: (AppLocalizations l) =>
      l.exportDescRecruitmentInsertion,
  DashboardExportSection.mobilityRetention: (AppLocalizations l) =>
      l.exportDescMobilityRetention,
  DashboardExportSection.inclusion: (AppLocalizations l) => l.exportDescInclusion,
  DashboardExportSection.competencesFormation: (AppLocalizations l) =>
      l.exportDescCompetencesFormation,
};

/// A single chart/table unit a user can toggle independently within a
/// section — e.g. "Synthèse" bundles five of these (trend, sector,
/// balance, gender, YoY) instead of being all-or-nothing.
class _ChartItem {
  final String id;
  final String Function(AppLocalizations) label;
  const _ChartItem(this.id, this.label);
}

final _sectionCharts = <DashboardExportSection, List<_ChartItem>>{
  DashboardExportSection.filters: [
    _ChartItem('filters', (l) => l.chartFiltersApplied),
  ],
  DashboardExportSection.summary: [
    _ChartItem('summary_kpis', (l) => l.chartSummaryKpis),
    _ChartItem('summary_trend', (l) => l.chartSummaryTrend),
    _ChartItem('summary_sector', (l) => l.chartSummarySector),
    _ChartItem('summary_balance', (l) => l.chartSummaryBalance),
    _ChartItem('summary_gender', (l) => l.chartSummaryGender),
    _ChartItem('summary_yoy', (l) => l.chartSummaryYoy),
  ],
  DashboardExportSection.benchmarking: [
    _ChartItem('benchmarking_table', (l) => l.chartBenchmarkingTable),
  ],
  DashboardExportSection.laborMarket: [
    _ChartItem('labor_indicators', (l) => l.chartLaborIndicators),
    _ChartItem('labor_csp', (l) => l.chartLaborCsp),
  ],
  DashboardExportSection.workforceStructure: [
    _ChartItem('structure_entity', (l) => l.chartStructureEntity),
    _ChartItem('structure_size', (l) => l.chartStructureSize),
    _ChartItem('structure_csp', (l) => l.chartStructureCsp),
    _ChartItem('structure_diploma', (l) => l.chartStructureDiploma),
    _ChartItem('structure_sector', (l) => l.chartStructureSector),
  ],
  DashboardExportSection.recruitmentInsertion: [
    _ChartItem('recruitment_indicators', (l) => l.chartRecruitmentIndicators),
    _ChartItem('recruitment_age', (l) => l.chartRecruitmentAge),
  ],
  DashboardExportSection.mobilityRetention: [
    _ChartItem('mobility_chart', (l) => l.chartMobility),
  ],
  DashboardExportSection.inclusion: [
    _ChartItem('inclusion_gender', (l) => l.chartSummaryGender),
    _ChartItem('inclusion_region', (l) => l.chartInclusionRegion),
    _ChartItem('inclusion_vulnerable', (l) => l.chartInclusionVulnerable),
    _ChartItem('inclusion_youth', (l) => l.chartInclusionYouth),
  ],
  DashboardExportSection.competencesFormation: [
    _ChartItem('competences_skills', (l) => l.chartCompetencesSkills),
    _ChartItem('competences_training', (l) => l.chartCompetencesTraining),
  ],
};

// ── Filters popover button (header) ─────────────────────────────
// Section is page navigation (switches the 8 dashboard views) and Export
// is a primary action — neither is a data filter, so both stay as their
// own controls in the header. Only the 4 real filters (Période,
// Localisation, Entité, Secteur) collapse behind this single trigger.

class FiltersPopoverButton extends ConsumerStatefulWidget {
  const FiltersPopoverButton({super.key});

  @override
  ConsumerState<FiltersPopoverButton> createState() =>
      _FiltersPopoverButtonState();
}

class _FiltersPopoverButtonState extends ConsumerState<FiltersPopoverButton> {
  final MenuController _menuController = MenuController();

  @override
  Widget build(BuildContext context) {
    final isLocked = ref.watch(isScopeLockedProvider);
    final period = ref.watch(dashboardFilterProvider).period;
    final region = ref.watch(regionIdProvider);
    final department = ref.watch(departmentIdProvider);
    final subdivision = ref.watch(subdivisionIdProvider);
    final entityType = ref.watch(entityTypeProvider);
    final sector = ref.watch(sectorProvider);

    final activeCount = (!isLocked && region != null ? 1 : 0) +
        (!isLocked && department != null ? 1 : 0) +
        (!isLocked && subdivision != null ? 1 : 0) +
        (entityType != null ? 1 : 0) +
        (sector != null ? 1 : 0);

    return MenuAnchor(
      controller: _menuController,
      alignmentOffset: const Offset(0, 8),
      style: MenuStyle(
        padding: WidgetStateProperty.all(EdgeInsets.zero),
        backgroundColor: WidgetStateProperty.all(InkColor.card),
        surfaceTintColor: WidgetStateProperty.all(Colors.transparent),
        elevation: WidgetStateProperty.all(6),
        shape: WidgetStateProperty.all(const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          side: BorderSide(color: InkColor.border),
        )),
      ),
      menuChildren: [
        _FiltersPopoverContent(period: period, isLocked: isLocked),
      ],
      builder: (context, controller, _) {
        return _FiltersTriggerButton(
          activeCount: activeCount,
          isOpen: controller.isOpen,
          onTap: () =>
              controller.isOpen ? controller.close() : controller.open(),
        );
      },
    );
  }
}

class _FiltersTriggerButton extends StatelessWidget {
  final int activeCount;
  final bool isOpen;
  final VoidCallback onTap;

  const _FiltersTriggerButton({
    required this.activeCount,
    required this.isOpen,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = activeCount > 0;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: active ? AccentColor.teal.withAlpha(15) : InkColor.surface,
          border: Border.all(
              color: active ? AccentColor.teal.withAlpha(60) : InkColor.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.filter_list_rounded,
                size: 16, color: active ? AccentColor.teal : TextColor.secondary),
            const SizedBox(width: 6),
            Text('Filtres',
                style: textMono(TextSize.section,
                    color: active ? AccentColor.teal : TextColor.primary,
                    weight: FontWeight.w600)),
            if (active) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: AccentColor.teal,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('$activeCount',
                    style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ],
            const SizedBox(width: 4),
            Icon(isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                size: 16, color: TextColor.muted),
          ],
        ),
      ),
    );
  }
}

class _FiltersPopoverContent extends StatelessWidget {
  final PeriodConfig period;
  final bool isLocked;

  const _FiltersPopoverContent({required this.period, required this.isLocked});

  static const _contentWidth = 260.0;
  static const _fieldWidth = _contentWidth - Gap.md * 2;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _contentWidth,
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _PeriodPicker(period: period, width: _fieldWidth),
          const SizedBox(height: 10),
          if (isLocked)
            const _ScopeLockedChip()
          else
            const _LocationPicker(width: _fieldWidth),
          const SizedBox(height: 10),
          const _EntityTypePicker(width: _fieldWidth),
          const SizedBox(height: 10),
          const _SectorPicker(width: _fieldWidth),
          const SizedBox(height: 10),
          const _ActiveFilterChips(),
        ],
      ),
    );
  }
}

// ── Section picker ───────────────────────────────────────────────
// Page navigation, not a filter — switches which of the 8 dashboard
// sections is showing, driven by the same DefaultTabController TabBarView
// (in TabContent) already relies on. Lives in the header, not the filters
// popover, since hiding it there would bury the primary way to move
// between dashboard views.

class SectionPicker extends StatelessWidget {
  final double width;

  const SectionPicker({super.key, required this.width});

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

  // Same compact single-line pill shape as the Filtres/Export buttons next
  // to it (12/8 padding, 10 radius, InkColor.border) — it used to be built
  // from _FilterDropdown, which stacks a "Section" caption above the
  // value, making it visibly taller than its two neighbors.
  @override
  Widget build(BuildContext context) {
    final controller = DefaultTabController.of(context);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        return SizedBox(
          width: width,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: InkColor.surface,
              border: Border.all(color: InkColor.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: controller.index,
                isDense: true,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded,
                    size: 16, color: TextColor.muted),
                style: textMono(TextSize.section,
                    color: TextColor.primary, weight: FontWeight.w600),
                dropdownColor: InkColor.card,
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
              ),
            ),
          ),
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
            child: Text(ctx.l10n.cancelButton),
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

class ExportButton extends ConsumerStatefulWidget {
  const ExportButton({super.key});

  @override
  ConsumerState<ExportButton> createState() => _ExportButtonState();
}

class _ExportButtonState extends ConsumerState<ExportButton> {
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
      label: Text(context.l10n.exportButtonLabel,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
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
            final l10n = context.l10n;
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
              title: Text(l10n.exportDialogTitle),
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
                          title: Text(_exportSectionTitles[section]!(l10n)),
                          subtitle:
                              Text(_exportSectionDescriptions[section]!(l10n)),
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
                          title: Text(_exportSectionTitles[section]!(l10n)),
                          subtitle:
                              Text(_exportSectionDescriptions[section]!(l10n)),
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
                              title: Text(chart.label(l10n)),
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
                  child: Text(context.l10n.cancelButton),
                ),
                ElevatedButton(
                  onPressed: selectedCharts.isEmpty
                      ? null
                      : () => Navigator.of(context).pop(selectedCharts),
                  child: Text(l10n.exportDialogButton),
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
    final l10n = context.l10n;

    try {
      final document = pw.Document();
      bool has(String id) => selectedCharts.contains(id);
      final rows = [
        [l10n.pdfPeriodLabel, filter.period.displayText],
        [l10n.pdfRegionLabel, filter.region ?? l10n.pdfNationalFallback],
        [l10n.pdfDepartmentLabel, filter.department ?? l10n.allMasculine],
        [l10n.pdfSubdivisionLabel, filter.subdivision ?? l10n.allFilter],
        [l10n.pdfEntityTypeLabel, filter.entityType ?? l10n.allFilter],
        [l10n.pdfSectorLabel, filter.sector ?? l10n.allMasculine],
      ];

      final dashboard = bundle.dashboard;
      final summaryRows = [
        [l10n.pdfDeclarationsLabel, dashboard.totalDeclarations.toString()],
        [l10n.pdfTotalWorkforceLabel, dashboard.totalEmployees.toString()],
        [l10n.pdfRecruitmentsLabel, dashboard.totalRecruitments.toString()],
        [l10n.pdfDeparturesLabel, (dashboard.totalDismissals + dashboard.totalRetirements).toString()],
        [l10n.pdfNetChangeLabel, dashboard.netChange.toString()],
        [l10n.pdfGrowthLabel, '${dashboard.employmentGrowthRate.toStringAsFixed(1)}%'],
        [l10n.pdfLeadingSectorLabel, dashboard.topSectors.isNotEmpty ? dashboard.topSectors.first.sector : l10n.pdfNotApplicable],
      ];

      const borderColor = pdf.PdfColor.fromInt(0xffdddddd);
      const headerColor = pdf.PdfColor.fromInt(0xfff1f1f1);

      final content = <pw.Widget>[
        pw.Header(
          level: 0,
          child: pw.Text(l10n.pdfExportTitle,
              style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
        ),
        pw.Paragraph(text: l10n.pdfExportDate('${DateTime.now().toLocal()}')),
        pw.SizedBox(height: 10),
      ];

      if (has('filters')) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionFilters),
          pw.TableHelper.fromTextArray(
            border: pw.TableBorder.all(color: borderColor),
            cellStyle: const pw.TextStyle(fontSize: 10),
            headerDecoration: const pw.BoxDecoration(color: headerColor),
            headers: [l10n.pdfFieldHeader, l10n.pdfValueHeader],
            data: rows,
          ),
          pw.SizedBox(height: 16),
        ]);
      }

      final summaryChartIds = _sectionCharts[DashboardExportSection.summary]!
          .map((c) => c.id);
      if (summaryChartIds.any(has)) {
        content.add(pw.Header(level: 1, text: l10n.exportSectionSummary));
        if (has('summary_kpis')) {
          content.addAll([
            pw.Text(l10n.chartSummaryKpis,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            pw.TableHelper.fromTextArray(
              border: pw.TableBorder.all(color: borderColor),
              cellStyle: const pw.TextStyle(fontSize: 10),
              headerDecoration: const pw.BoxDecoration(color: headerColor),
              headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
              data: summaryRows,
            ),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_trend')) {
          content.addAll([
            pw.Text(l10n.chartSummaryTrend,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildTrendSection(bundle.trends, l10n),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_sector')) {
          content.addAll([
            pw.Text(l10n.chartSummarySector,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildSectorSection(bundle.sectors.take(8).toList(), l10n),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_balance')) {
          content.addAll([
            pw.Text(l10n.chartSummaryBalance,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildEmploymentBalanceSection(bundle.employmentBalance, l10n),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_gender')) {
          content.addAll([
            pw.Text(l10n.chartSummaryGender,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildGenderSection(dashboard.genderDistribution, l10n),
            pw.SizedBox(height: 16),
          ]);
        }
        if (has('summary_yoy')) {
          content.addAll([
            pw.Text(l10n.chartSummaryYoy,
                style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            _buildYoySection(dashboard, bundle.previous, l10n),
            pw.SizedBox(height: 16),
          ]);
        }
      }

      if (has('benchmarking_table')) {
        content.addAll([
          pw.Header(level: 1, text: l10n.pdfBenchmarkingTitle),
          _buildBenchmarkingSection(bundle, filter, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      final laborMarketIds =
          _sectionCharts[DashboardExportSection.laborMarket]!.map((c) => c.id);
      if (laborMarketIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionLaborMarket),
          _buildLaborMarketSection(bundle.laborMarketGap, selectedCharts, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      final structureIds = _sectionCharts[DashboardExportSection.workforceStructure]!
          .map((c) => c.id);
      if (structureIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionWorkforceStructure),
          _buildWorkforceStructureSection(bundle, selectedCharts, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      final recruitmentIds =
          _sectionCharts[DashboardExportSection.recruitmentInsertion]!
              .map((c) => c.id);
      if (recruitmentIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionRecruitmentInsertion),
          _buildRecruitmentInsertionSection(
              bundle.firstTimeEmployment, selectedCharts, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      if (has('mobility_chart')) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionMobilityRetention),
          _buildMobilityRetentionSection(bundle.departuresMobility, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      final inclusionIds =
          _sectionCharts[DashboardExportSection.inclusion]!.map((c) => c.id);
      if (inclusionIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionInclusion),
          _buildInclusionSection(bundle, filter, selectedCharts, l10n),
          pw.SizedBox(height: 16),
        ]);
      }

      final competencesIds =
          _sectionCharts[DashboardExportSection.competencesFormation]!
              .map((c) => c.id);
      if (competencesIds.any(has)) {
        content.addAll([
          pw.Header(level: 1, text: l10n.exportSectionCompetencesFormation),
          _buildCompetencesFormationSection(bundle, selectedCharts, l10n),
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
        SnackBar(content: Text(l10n.pdfExportError('$error'))),
      );
    }
  }

  pw.Widget _buildTrendSection(List<TimeSeriesData> trends, AppLocalizations l10n) {
    if (trends.isEmpty) {
      return _buildEmptySection(l10n.chartSummaryTrend, null, l10n);
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
            border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
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
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfPeriodLabel, l10n.pdfWorkforceHeader],
          data: [
            for (final trend in trends)
              [trend.shortLabel, trend.totalEmployees.toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildSectorSection(List<Sector> sectors, AppLocalizations l10n) {
    if (sectors.isEmpty) {
      return _buildEmptySection(l10n.chartSummarySector, null, l10n);
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
            border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
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
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfSectorLabel, l10n.pdfEmployeesCountHeader],
          data: [
            for (final sector in sectors)
              [sector.sector, sector.employees.toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildEmploymentBalanceSection(
      EmploymentBalance? balance, AppLocalizations l10n) {
    if (balance == null) {
      return _buildEmptySection(l10n.chartSummaryBalance, null, l10n);
    }

    final breakdown = [
      [l10n.pdfDismissalsLabel, balance.dismissals.toString()],
      [l10n.pdfResignationsLabel, balance.resignations.toString()],
      [l10n.pdfRetirementsLabel, balance.retirements.toString()],
    ];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
          data: [
            [l10n.pdfJobsCreatedLabel, balance.jobsCreated.toString()],
            [l10n.pdfJobsLostLabel, balance.jobsLost.toString()],
          ],
        ),
        pw.SizedBox(height: 10),
        pw.Text(l10n.pdfDepartureDetailTitle,
            style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration:
              const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfReasonHeader, l10n.pdfDeparturesLabel],
          data: breakdown,
        ),
        if (balance.technicalUnemployment > 0) ...[
          pw.SizedBox(height: 6),
          pw.Text(
              l10n.pdfTechnicalUnemploymentNote(balance.technicalUnemployment),
              style: const pw.TextStyle(fontSize: 9, color: pdf.PdfColors.grey700)),
        ],
      ],
    );
  }

  pw.Widget _buildYoySection(
      DashboardSummary cur, DashboardSummary? prev, AppLocalizations l10n) {
    final rows = [
      [l10n.pdfWorkforceHeader, prev?.totalEmployees.toString() ?? '—', cur.totalEmployees.toString()],
      [l10n.pdfRecruitmentsLabel, prev?.totalRecruitments.toString() ?? '—', cur.totalRecruitments.toString()],
      [
        l10n.pdfDeparturesLabel,
        prev != null ? (prev.totalDismissals + prev.totalRetirements).toString() : '—',
        (cur.totalDismissals + cur.totalRetirements).toString(),
      ],
      [l10n.pdfNetBalanceLabel, prev?.netChange.toString() ?? '—', cur.netChange.toString()],
    ];

    return pw.TableHelper.fromTextArray(
      border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
      cellStyle: const pw.TextStyle(fontSize: 10),
      headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
      headers: [l10n.pdfIndicatorHeader, '${cur.year - 1}', '${cur.year}'],
      data: rows,
    );
  }

  pw.Widget _buildGenderSection(
      GenderDistribution distribution, AppLocalizations l10n) {
    final total = distribution.male + distribution.female;
    if (total == 0) {
      return _buildEmptySection(l10n.pdfGenderDistributionTitle, null, l10n);
    }
    final malePct = distribution.male / total * 100;
    final femalePct = distribution.female / total * 100;

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 200,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          ),
          padding: const pw.EdgeInsets.all(8),
          child: pw.Chart(
            grid: pw.PieGrid(startAngle: -math.pi / 2),
            datasets: [
              pw.PieDataSet(
                value: distribution.male,
                legend: l10n.menLabel,
                color: pdf.PdfColors.blue,
                legendPosition: pw.PieLegendPosition.outside,
                legendStyle: const pw.TextStyle(fontSize: 9),
              ),
              pw.PieDataSet(
                value: distribution.female,
                legend: l10n.womenLabel,
                color: pdf.PdfColors.pink,
                legendPosition: pw.PieLegendPosition.outside,
                legendStyle: const pw.TextStyle(fontSize: 9),
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
        pw.Text(l10n.pdfMenCountLine(distribution.male, malePct.toStringAsFixed(1)), style: const pw.TextStyle(fontSize: 10)),
        pw.Text(l10n.pdfWomenCountLine(distribution.female, femalePct.toStringAsFixed(1)), style: const pw.TextStyle(fontSize: 10)),
      ],
    );
  }

  pw.Widget _buildBenchmarkingSection(DashboardBundle bundle,
      AnalyticsFilterState filter, AppLocalizations l10n) {
    final hasGeography = filter.region != null || filter.department != null || filter.subdivision != null;
    if (!hasGeography) {
      return _buildEmptySection(
        l10n.pdfBenchmarkingTitle,
        l10n.pdfBenchmarkingEmptyHint,
        l10n,
      );
    }

    final dashboard = bundle.dashboard;
    final data = [
      [l10n.pdfIndicatorHeader, l10n.pdfLocalValueHeader, ''],
      [l10n.pdfDeclaringCompaniesLabel, dashboard.totalDeclarations.toString(), ''],
      [l10n.pdfTotalWorkforceLabel, dashboard.totalEmployees.toString(), ''],
      [l10n.pdfRecruitmentsLabel, dashboard.totalRecruitments.toString(), ''],
      [l10n.pdfDeparturesLabel, (dashboard.totalDismissals + dashboard.totalRetirements).toString(), ''],
    ];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(l10n.pdfBenchmarkingTitle, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.Paragraph(text: l10n.pdfNationalComparisonNote),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfLocalValueHeader, l10n.pdfRemarkHeader],
          data: data,
        ),
      ],
    );
  }

  pw.Widget _buildLaborMarketSection(LaborMarketTension? laborMarketGap,
      Set<String> selected, AppLocalizations l10n) {
    if (laborMarketGap == null) {
      return _buildEmptySection(l10n.exportSectionLaborMarket, null, l10n);
    }

    final rows = [
      [l10n.pdfVacanciesLabel, laborMarketGap.totalVacancies.toString()],
      [l10n.pdfRecruitmentsLabel, laborMarketGap.totalRecruitments.toString()],
      [l10n.pdfGapLabel, laborMarketGap.gap.toString()],
      [l10n.pdfAbsorptionRateLabel, laborMarketGap.absorptionRate != null
          ? '${laborMarketGap.absorptionRate!.toStringAsFixed(1)}%'
          : l10n.pdfNotApplicable],
    ];

    final cspRows = laborMarketGap.byCsp
        .map((row) => [row.cspCategory, row.hires.toString(), '${row.hireSharePct.toStringAsFixed(1)}%'])
        .toList();

    final children = <pw.Widget>[];
    if (selected.contains('labor_indicators')) {
      children.addAll([
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
          data: rows,
        ),
        pw.SizedBox(height: 12),
      ]);
    }
    if (selected.contains('labor_csp')) {
      children.addAll([
        pw.Text(l10n.chartLaborCsp, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfCspHeader, l10n.pdfRecruitmentsLabel, l10n.pdfShareHeader],
          data: cspRows,
        ),
      ]);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildWorkforceStructureSection(DashboardBundle bundle,
      Set<String> selected, AppLocalizations l10n) {
    if (bundle.entityBreakdown == null &&
        bundle.entitySize == null &&
        bundle.diplomaBreakdown.isEmpty &&
        bundle.cspProfile == null) {
      return _buildEmptySection(
          l10n.exportSectionWorkforceStructure, null, l10n);
    }

    final sections = <pw.Widget>[];
    if (selected.contains('structure_entity') && bundle.entityBreakdown != null) {
      final breakdown = bundle.entityBreakdown!;
      sections.addAll([
        pw.Text(l10n.chartStructureEntity, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfTypeHeader, l10n.pdfDeclarantsHeader],
          data: [
            [l10n.pdfEnterprisesLabel, breakdown.enterprises.toString()],
            [l10n.pdfCooperativesLabel, breakdown.cooperatives.toString()],
            [l10n.pdfCtdLabel, breakdown.ctds.toString()],
            [l10n.pdfOngLabel, breakdown.ongs.toString()],
          ],
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_size') && bundle.entitySize != null) {
      final size = bundle.entitySize!;
      sections.addAll([
        pw.Text(l10n.chartStructureSize, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfSizeHeader, l10n.pdfCountHeader],
          data: [
            [l10n.pdfVerySmallEnterprise, size.tpe.toString()],
            [l10n.pdfSmallEnterprise, size.pe.toString()],
            [l10n.pdfMediumEnterprise, size.me.toString()],
            [l10n.pdfLargeEnterprise, size.ge.toString()],
          ],
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_csp') && bundle.cspProfile != null) {
      sections.addAll([
        pw.Text(l10n.chartStructureCsp, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildCspPyramidSection(bundle.cspProfile!, l10n),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('structure_diploma') && bundle.diplomaBreakdown.isNotEmpty) {
      sections.addAll([
        pw.Text(l10n.chartStructureDiploma, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfLevelHeader, l10n.pdfEmployeesCountHeader],
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
        pw.Text(l10n.chartStructureSector, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildSectorSection(bundle.sectors.take(8).toList(), l10n),
      ]);
    }

    if (sections.isEmpty) {
      return _buildEmptySection(
          l10n.exportSectionWorkforceStructure, null, l10n);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: sections);
  }

  pw.Widget _buildCspPyramidSection(
      ({int totalHires, int cadres, int foremen, int workers}) cspProfile,
      AppLocalizations l10n) {
    if (cspProfile.totalHires == 0) {
      return _buildEmptySection(l10n.chartStructureCsp, null, l10n);
    }

    final labels = [l10n.pdfExecutivesLabel, l10n.pdfForemenLabel, l10n.pdfWorkersLabel];
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
            border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
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
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfCspHeader, l10n.pdfRecruitmentsLabel, l10n.pdfShareHeader],
          data: [
            for (var i = 0; i < labels.length; i++)
              [labels[i], values[i].toString(), '${pcts[i].toStringAsFixed(1)}%'],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildRecruitmentInsertionSection(
      FirstTimeEmployment? firstTimeEmployment, Set<String> selected,
      AppLocalizations l10n) {
    if (firstTimeEmployment == null) {
      return _buildEmptySection(l10n.exportSectionRecruitmentInsertion, null, l10n);
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
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
          data: [
            [l10n.pdfSeekersRegisteredLabel, firstTimeEmployment.seekersTotal.toString()],
            [l10n.pdfFirstRecruitsLabel, firstTimeEmployment.recruitsTotal.toString()],
            [l10n.pdfConversionRateLabel, '${firstTimeEmployment.conversionRate.toStringAsFixed(1)}%'],
            [l10n.pdfPermanentLabel, firstTimeEmployment.recruitsPermanent.toString()],
            [l10n.pdfTemporaryLabel, firstTimeEmployment.recruitsTemporary.toString()],
          ],
        ),
        pw.SizedBox(height: 12),
      ]);
    }
    if (selected.contains('recruitment_age')) {
      children.addAll([
        pw.Text(l10n.chartRecruitmentAge, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfAgeRangeHeader, l10n.pdfEmployeesCountHeader],
          data: ageRows,
        ),
      ]);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildMobilityRetentionSection(
      DeparturesMobility? departuresMobility, AppLocalizations l10n) {
    if (departuresMobility == null) {
      return _buildEmptySection(l10n.exportSectionMobilityRetention, null, l10n);
    }

    final values = [
      departuresMobility.dismissals,
      departuresMobility.resignations,
      departuresMobility.retirements,
      departuresMobility.other,
    ];
    final labels = [l10n.pdfDismissalsLabel, l10n.pdfResignationsLabel, l10n.pdfRetirementsLabel, l10n.pdfOtherLabel];

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 210,
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
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
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfTypeHeader, l10n.pdfDeparturesLabel],
          data: [
            for (var i = 0; i < labels.length; i++)
              [labels[i], values[i].toString()],
          ],
        ),
      ],
    );
  }

  pw.Widget _buildInclusionSection(DashboardBundle bundle,
      AnalyticsFilterState filter, Set<String> selected, AppLocalizations l10n) {
    final regionRows = bundle.gender
        .map((region) => [region.region, region.male.toString(), region.female.toString(), region.total.toString()])
        .toList();
    final inclusion = bundle.vulnerableInclusion;
    final List<List<String>> inclusionRows = inclusion != null
        ? <List<String>>[
            [l10n.pdfVulnerablePeopleLabel, inclusion.total.toString()],
            [l10n.pdfTotalRecruitmentsLabel, inclusion.totalHires.toString()],
            [l10n.pdfShareHeader, inclusion.totalHires > 0 ? '${(inclusion.total / inclusion.totalHires * 100).toStringAsFixed(1)}%' : l10n.pdfNotApplicable],
          ]
        : <List<String>>[];
    final firstTime = bundle.firstTimeEmployment;

    final children = <pw.Widget>[];

    if (selected.contains('inclusion_gender')) {
      children.addAll([
        pw.Text(l10n.chartSummaryGender, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        _buildGenderSection(bundle.dashboard.genderDistribution, l10n),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_region') && regionRows.isNotEmpty) {
      children.addAll([
        pw.Text(l10n.chartInclusionRegion, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfRegionLabel, l10n.menLabel, l10n.womenLabel, l10n.total],
          data: regionRows,
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_vulnerable') && inclusionRows.isNotEmpty) {
      children.addAll([
        pw.Text(l10n.chartInclusionVulnerable, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
          data: inclusionRows,
        ),
        pw.SizedBox(height: 16),
      ]);
    }

    if (selected.contains('inclusion_youth') && firstTime != null) {
      children.addAll([
        pw.Text(l10n.chartInclusionYouth, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfIndicatorHeader, l10n.pdfValueHeader],
          data: [
            [l10n.pdfRecruits1534Label, (firstTime.recruitsAge15_24 + firstTime.recruitsAge25_34).toString()],
            [l10n.pdfTotalRecruitmentsLabel2, firstTime.recruitsTotal.toString()],
            [l10n.pdfConversionRateLabel, '${firstTime.conversionRate.toStringAsFixed(1)}%'],
          ],
        ),
      ]);
    }

    if (children.isEmpty) {
      return _buildEmptySection(l10n.exportSectionInclusion, null, l10n);
    }

    return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: children);
  }

  pw.Widget _buildCompetencesFormationSection(
      DashboardBundle bundle, Set<String> selected, AppLocalizations l10n) {
    final skills = bundle.topSkills ?? [];
    final domains = bundle.topTraining ?? [];
    if (skills.isEmpty && domains.isEmpty) {
      return _buildEmptySection(l10n.exportSectionCompetencesFormation, null, l10n);
    }

    final children = <pw.Widget>[];
    if (selected.contains('competences_skills') && skills.isNotEmpty) {
      children.addAll([
        pw.Text(l10n.chartCompetencesSkills, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfSkillHeader, l10n.pdfDemandHeader, l10n.pdfSupplyHeader, l10n.pdfGapLabel],
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
        pw.Text(l10n.chartCompetencesTraining, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 8),
        pw.TableHelper.fromTextArray(
          border: pw.TableBorder.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          cellStyle: const pw.TextStyle(fontSize: 10),
          headerDecoration: const pw.BoxDecoration(color: pdf.PdfColor.fromInt(0xfff1f1f1)),
          headers: [l10n.pdfTrainingHeader, l10n.pdfDemandHeader, l10n.pdfSupplyHeader, l10n.pdfGapLabel],
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

  pw.Widget _buildEmptySection(String title, String? subtitle, AppLocalizations l10n) {
    final children = <pw.Widget>[
      pw.Text(title, style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 4),
    ];

    if (subtitle != null) {
      children.addAll([
        pw.Text(subtitle, style: const pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey)),
        pw.SizedBox(height: 8),
      ]);
    }

    children.addAll([
      pw.Container(
        height: 210,
        alignment: pw.Alignment.center,
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: const pdf.PdfColor.fromInt(0xffdddddd)),
          color: const pdf.PdfColor.fromInt(0xfffafafa),
        ),
        child: pw.Text(
          l10n.pdfNoDataAvailable,
          style: const pw.TextStyle(fontSize: 12, color: pdf.PdfColors.grey),
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
