// lib/core/focus/renderers/leading_group_switch_table.dart
//
// Desktop-only rendering for a row-grouped GridRenderSpec (S23Q02's
// Permanent/Temporaire split) — the row-axis mirror of AgeBandSwitchTable
// (which slices columns) and StatusSwitchTable (which slices a contiguous
// column block): here the outer axis groups whole ROWS instead, since
// Permanent and Temporaire don't share any cells the way age bands or
// statuses share the same CSP rows — each status has its own complete set
// of category rows (see GridRenderSpec.splitByLeadingGroup). A segmented
// tab strip picks one status's rows at a time, rendered as one flat
// GenericSpreadsheetTable — same cell IDs throughout, this only ever
// picks which pre-sliced row range is currently visible.
//
// Mobile doesn't use this — see TableRenderer.renderTable's dispatch;
// mobile instead reuses categoryGridGroups' per-category expandable cards.

import 'package:flutter/material.dart';

import '../unified_focus_manager_v2.dart';
import 'category_mini_grids.dart' show SegmentButton, RowSkipToggle;
import 'generic_spreadsheet_table.dart';
import 'grid_render_spec.dart';

class LeadingGroupSwitchTable extends StatefulWidget {
  final GridRenderSpec spec; // full, unsliced; spec.hasLeadingGroup must be true
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
  // "None to report" per row — see OnefopFormController.isCategorySkipped/
  // setCategorySkipped, threaded the same way CategoryGridGroupsView
  // already receives them.
  final bool Function(String categoryKey)? isCategorySkipped;
  final void Function(String categoryKey, bool value, List<String> cellIds)? onCategorySkipChanged;

  const LeadingGroupSwitchTable({
    super.key,
    required this.spec,
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
  State<LeadingGroupSwitchTable> createState() => _LeadingGroupSwitchTableState();
}

class _LeadingGroupSwitchTableState extends State<LeadingGroupSwitchTable> {
  int _localIdx = 0;
  int _localPeak = 0;

  int get _idx => widget.controlledIndex ?? _localIdx;
  int get _peak => widget.controlledIndex != null ? widget.controlledPeak : _localPeak;

  void _select(int i) {
    final onChanged = widget.onIndexChanged;
    if (onChanged != null) {
      onChanged(i);
    } else {
      setState(() {
        _localIdx = i;
        if (i > _localPeak) _localPeak = i;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.spec.splitByLeadingGroup();
    final labels = widget.spec.leadingGroupLabels ?? const <String>[];
    final i = _idx.clamp(0, groups.length - 1);
    final slice = groups[i].spec;

    Widget Function(int, String)? rowAccessory;
    final isSkipped = widget.isCategorySkipped;
    final onSkipChanged = widget.onCategorySkipChanged;
    if (isSkipped != null && onSkipChanged != null) {
      rowAccessory = (r, rowKey) {
        final skipped = isSkipped(rowKey);
        final cellIds =
            slice.matrix[r].where((id) => slice.cellSpec?.call(id).editable ?? false).toList();
        return RowSkipToggle(
          skipped: skipped,
          onTap: () => onSkipChanged(rowKey, !skipped, cellIds),
        );
      };
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Row+Expanded — same standard as AgeBandSwitchTable/
        // StatusSwitchTable's tab strip, not CategoryGridGroupsView's
        // natural-width segment row (that one stays mobile/Simple-Mode-
        // only; Spreadsheet Mode's matrix questions all share this one
        // tab-strip treatment now).
        Row(
          children: [
            for (int k = 0; k < labels.length; k++) ...[
              if (k > 0) const SizedBox(width: 8),
              Expanded(
                child: SegmentButton(
                  label: labels[k],
                  selected: k == i,
                  done: k <= _peak && k != i,
                  onTap: () => _select(k),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        // Re-keyed per selected group so GenericSpreadsheetTable mounts
        // fresh rather than trying to diff two differently-keyed cell
        // sets under one Element.
        Center(
          child: GenericSpreadsheetTable(
            key: ValueKey(i),
            spec: slice,
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
