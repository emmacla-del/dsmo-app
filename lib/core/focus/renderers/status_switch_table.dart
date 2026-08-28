// lib/core/focus/renderers/status_switch_table.dart
//
// Desktop-only rendering for GridRenderSpec.statusSwitcher (S22Q04/
// S22Q05) — the mirror image of AgeBandSwitchTable (S22Q03): a
// segmented Permanent/Temporaire/Total control picks which 3 of the 9
// status×gender columns are shown as Male/Female/Total, for every row
// (CSP category / vulnerability type) at once. The row-label column
// never changes — same "sticky" reasoning as AgeBandSwitchTable, and
// same underlying cell IDs throughout, reusing GenericSpreadsheetTable
// entirely rather than a parallel table system.
//
// Column layout differs from the age-band case: _statusGenderRow is
// status-major/gender-minor ([permanent×3, temporary×3, total×3]), so
// the visible 3 columns for a selected status are a *contiguous* block
// [3*statusIdx, 3*statusIdx+1, 3*statusIdx+2] rather than a strided pick
// across groups.
//
// Mobile doesn't use this — see TableRenderer.renderTable's dispatch;
// mobile instead reuses categoryGridGroups' per-row expandable cards
// (status as the outer segmented axis, same as S23Q02).

import 'package:flutter/material.dart';

import '../../i18n/l10n_ext.dart';
import '../../i18n/localized_text.dart';
import '../unified_focus_manager_v2.dart';
import 'category_mini_grids.dart' show SegmentButton, RowSkipToggle;
import 'generic_spreadsheet_table.dart';
import 'grid_render_spec.dart';

class StatusSwitchTable extends StatefulWidget {
  final GridRenderSpec spec;
  final StatusSwitcherConfig config;
  final Map<String, int> numberValues;
  final void Function(String, int?) onNumberChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  // See AgeBandSwitchTable's identical trio — externally-driven tab
  // position/peak so the section's own Suivant button can step through
  // statuses before advancing to the next table.
  final int? controlledIndex;
  final int controlledPeak;
  final void Function(int)? onIndexChanged;
  // "None to report" state (see OnefopFormController.isCategorySkipped/
  // setCategorySkipped) — unlike AgeBandSwitchTable, this can't be a
  // ready-made accessory built once by the caller: the skip key has to
  // include *which status is currently selected* (e.g.
  // '${prefix}_cadres_permanent'), matching the per-(row, status)
  // granularity mobile's categoryGridGroups fallback already uses (see
  // TableSpecBuilder._middleAxisCategoryGroups) — a row skipped for
  // Permanent shouldn't read as skipped when the user switches to
  // Temporaire. So the key can only be composed here, where _statusIdx
  // is known. Null when the caller didn't wire skip state through.
  final bool Function(String categoryKey)? isCategorySkipped;
  final void Function(String categoryKey, bool value, List<String> cellIds)?
      onCategorySkipChanged;

  const StatusSwitchTable({
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
    this.isCategorySkipped,
    this.onCategorySkipChanged,
  });

  @override
  State<StatusSwitchTable> createState() => _StatusSwitchTableState();
}

class _StatusSwitchTableState extends State<StatusSwitchTable> {
  int _localStatusIdx = 0;
  int _localPeak = 0;

  int get _statusIdx => widget.controlledIndex ?? _localStatusIdx;
  int get _peak => widget.controlledIndex != null ? widget.controlledPeak : _localPeak;

  void _selectStatusIdx(int i) {
    final onChanged = widget.onIndexChanged;
    if (onChanged != null) {
      onChanged(i);
    } else {
      setState(() {
        _localStatusIdx = i;
        if (i > _localPeak) _localPeak = i;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final spec = widget.spec;
    // _statusGenderRow's fixed column layout is [permanent×3, temporary
    // ×3, total×3] — the selected status index picks a contiguous block
    // of 3 columns (male, female, total) for that status.
    final base = _statusIdx * 3;
    final cols = [base, base + 1, base + 2];
    final slicedMatrix = [
      for (final row in spec.matrix) [for (final c in cols) row[c]],
    ];

    final sliced = GridRenderSpec(
      id: '${spec.id}_status$_statusIdx',
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
      // Rows aren't reordered by the status column slice, so the outer
      // spec's rowKeys line up 1:1.
      rowKeys: spec.rowKeys,
    );

    final skippedCb = widget.isCategorySkipped;
    final skipChangedCb = widget.onCategorySkipChanged;
    Widget Function(int, String)? rowAccessory;
    if (skippedCb != null && skipChangedCb != null) {
      rowAccessory = (r, rowKey) {
        final categoryKey = '${rowKey}_${widget.config.keys[_statusIdx]}';
        final skipped = skippedCb(categoryKey);
        final cellIds = sliced.matrix[r]
            .where((id) => sliced.cellSpec?.call(id).editable ?? false)
            .toList();
        return RowSkipToggle(
          skipped: skipped,
          onTap: () => skipChangedCb(categoryKey, !skipped, cellIds),
        );
      };
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Row+Expanded, not Wrap — see AgeBandSwitchTable's identical fix:
        // Wrap dropped these pills to one per line once labels no longer
        // fit side by side (up to 5 for S3Q01's departure reasons),
        // burning vertical space above the table for no reason. Same
        // even-split treatment CategoryGridGroupsView already uses for
        // its own outer-group switch.
        Row(
          children: [
            for (int i = 0; i < widget.config.labels.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: SegmentButton(
                  label: widget.config.labels[i],
                  selected: i == _statusIdx,
                  done: i <= _peak && i != _statusIdx,
                  onTap: () => _selectStatusIdx(i),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Center(
          child: GenericSpreadsheetTable(
            key: ValueKey(_statusIdx),
            spec: sliced,
            numberValues: widget.numberValues,
            textValues: const {},
            onNumberChanged: widget.onNumberChanged,
            onTextChanged: (_, __) {},
            focusManager: widget.focusManager,
            tableId: widget.tableId,
            onExitTable: widget.onExitTable,
            onExitPrevious: widget.onExitPrevious,
            rowAccessoryBuilder: rowAccessory,
          ),
        ),
      ],
    );
  }
}
