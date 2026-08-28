// lib/core/focus/renderers/age_band_switch_table.dart
//
// Desktop-only rendering for GridRenderSpec.ageBandSwitcher (S22Q03) — a
// segmented age-band control (15–24/25–34/35+/Total) picks which 3 of
// the 12 gender×age columns are shown as Male/Female/Total, for every
// diploma row at once, instead of one wide 12-column sheet. The
// diploma-name (row-label) column never changes — effectively "sticky"
// since there's no horizontal scroll left once the table is down to 4
// columns total.
//
// Same cell IDs throughout — this only ever picks which 3 of the 12
// already-existing columns per row are currently visible, reusing
// GenericSpreadsheetTable entirely rather than a parallel table system.
//
// Mobile doesn't use this — see TableRenderer.renderTable's dispatch;
// mobile instead reuses categoryGridGroups' per-diploma expandable
// cards, the same mechanism Phase 1 built for CSP categories.

import 'package:flutter/material.dart';

import '../../i18n/l10n_ext.dart';
import '../../i18n/localized_text.dart';
import '../unified_focus_manager_v2.dart';
import 'category_mini_grids.dart' show SegmentButton;
import 'generic_spreadsheet_table.dart';
import 'grid_render_spec.dart';

class AgeBandSwitchTable extends StatefulWidget {
  final GridRenderSpec spec;
  final AgeBandSwitcherConfig config;
  final Map<String, int> numberValues;
  final void Function(String, int?) onNumberChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  // When provided, the active age band is driven by the caller (typically
  // onefop_section_units.dart, backed by OnefopFormController.tabCursor)
  // instead of local widget state — so the section's own Suivant button
  // can step through age bands before advancing to the next table, and
  // position survives navigating away and back. controlledPeak is the
  // furthest band ever reached, used to mark earlier bands done (✓)
  // regardless of where the cursor currently sits.
  final int? controlledIndex;
  final int controlledPeak;
  final void Function(int)? onIndexChanged;
  // Per-row "Aucun cas à signaler" toggle (see RowSkipToggle /
  // GridRenderSpec.rowKeys) — built once by the caller against the full,
  // unsliced [spec] (not the age-band-sliced one this widget renders
  // internally), so tapping it clears the row's cells across *every* age
  // band, not just the one currently visible. Null when the caller didn't
  // wire skip state through at all.
  final Widget Function(int rowIndex, String rowKey)? rowAccessoryBuilder;

  const AgeBandSwitchTable({
    super.key,
    required this.spec,
    required this.config,
    required this.numberValues,
    required this.onNumberChanged,
    required this.focusManager,
    required this.tableId,
    this.onExitTable,
    this.onExitPrevious,
    this.controlledIndex,
    this.controlledPeak = 0,
    this.onIndexChanged,
    this.rowAccessoryBuilder,
  });

  @override
  State<AgeBandSwitchTable> createState() => _AgeBandSwitchTableState();
}

class _AgeBandSwitchTableState extends State<AgeBandSwitchTable> {
  int _localAgeIdx = 0;
  int _localPeak = 0;

  int get _ageIdx => widget.controlledIndex ?? _localAgeIdx;
  int get _peak => widget.controlledIndex != null ? widget.controlledPeak : _localPeak;

  void _selectAgeIdx(int i) {
    final onChanged = widget.onIndexChanged;
    if (onChanged != null) {
      onChanged(i);
    } else {
      setState(() {
        _localAgeIdx = i;
        if (i > _localPeak) _localPeak = i;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final spec = widget.spec;
    // _genderAgeRow's fixed column layout is [male×4 ages, female×4
    // ages, total×4 ages] — the selected age index picks column `a`
    // from each gender's group of 4, in that same order.
    final cols = [_ageIdx, 4 + _ageIdx, 8 + _ageIdx];
    final slicedMatrix = [
      for (final row in spec.matrix) [for (final c in cols) row[c]],
    ];

    final sliced = GridRenderSpec(
      id: '${spec.id}_age$_ageIdx',
      rowLabels: spec.rowLabels,
      matrix: slicedMatrix,
      headers: [
        HeaderNode(const LocalizedText(fr: 'Homme', en: 'Male').of(locale)),
        HeaderNode(const LocalizedText(fr: 'Femme', en: 'Female').of(locale)),
        HeaderNode(const LocalizedText.same('Total').of(locale)),
      ],
      cornerLabel: spec.cornerLabel,
      cellSpec: spec.cellSpec,
      isTotalCell: spec.isTotalCell,
      // Rows aren't reordered by the age-band column slice, so the outer
      // spec's rowKeys line up 1:1 — GenericSpreadsheetTable needs these
      // to know which rows get an accessory at all.
      rowKeys: spec.rowKeys,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Row+Expanded, not Wrap — Wrap sizes each pill to its own label
        // width and drops to a new line once they no longer fit side by
        // side, which for 4 labels this long (esp. "Total (tous âges)")
        // stacked them one per row and burned a few hundred px of vertical
        // space above the actual table. Splitting the row's width evenly
        // instead keeps all 4 on one line — same treatment
        // CategoryGridGroupsView already uses for its own outer-group
        // switch (Permanent/Temporaire).
        Row(
          children: [
            for (int i = 0; i < widget.config.labels.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: SegmentButton(
                  label: widget.config.labels[i],
                  selected: i == _ageIdx,
                  done: i <= _peak && i != _ageIdx,
                  onTap: () => _selectAgeIdx(i),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        // Re-keyed per selected age band so GenericSpreadsheetTable
        // mounts fresh rather than trying to diff two differently-keyed
        // cell sets under one Element.
        Center(
          child: GenericSpreadsheetTable(
            key: ValueKey(_ageIdx),
            spec: sliced,
            numberValues: widget.numberValues,
            textValues: const {},
            onNumberChanged: widget.onNumberChanged,
            onTextChanged: (_, __) {},
            focusManager: widget.focusManager,
            tableId: widget.tableId,
            onExitTable: widget.onExitTable,
            onExitPrevious: widget.onExitPrevious,
            rowAccessoryBuilder: widget.rowAccessoryBuilder,
          ),
        ),
      ],
    );
  }
}
