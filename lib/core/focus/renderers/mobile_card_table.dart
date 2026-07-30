// lib/core/focus/renderers/mobile_card_table.dart
//
// ══════════════════════════════════════════════════════════════
// MOBILE CARD TABLE — phone-friendly alternative to
// GenericSpreadsheetTable's spreadsheet grid.
//
// The desktop grid (60×36px cells, 9+ numeric columns per table)
// forces horizontal scrolling and sub-44px touch targets on a
// 375-414px phone. This widget renders the same GridRenderSpec as
// one card per row instead: the row label as a header, then each
// leaf data column as its own full-width labeled input — no
// horizontal scrolling, ≥48px tall tap targets.
//
// Only covers the "labelGrid" shape (spec.rowLabels non-empty).
// Matrix-layout tables (spec.isMatrixLayout) have no uniform
// row/column shape to card-ize and stay on GenericSpreadsheetTable
// — see TableRenderer.renderTable's mobile branch.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../unified_focus_manager_v2.dart';
import 'grid_render_spec.dart';
import 'grid_theme.dart';
import 'shared/grid_cell_dispatch.dart';

class MobileCardTable extends StatelessWidget {
  final GridRenderSpec spec;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  final TextEditingController Function(String)? hybridController;

  const MobileCardTable({
    super.key,
    required this.spec,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
    required this.focusManager,
    required this.tableId,
    this.onExitTable,
    this.onExitPrevious,
    this.hybridController,
  });

  // Same flattened editable-cell list GenericSpreadsheetTable exposes,
  // so arrow/tab navigation between cards follows the same row-major
  // order as the desktop grid.
  List<String> get _allCells {
    final cells = <String>[];
    if (spec.rowLabelCellIds != null) {
      for (final id in spec.rowLabelCellIds!) {
        if (id.isNotEmpty) cells.add(id);
      }
    }
    for (int r = 0; r < spec.rowLabels.length; r++) {
      for (int c = 0; c < spec.colCount; c++) {
        final cellId = spec.cellId(r, c);
        final cs = spec.cellSpec?.call(cellId);
        if (cs?.editable ?? false) cells.add(cellId);
      }
    }
    return cells;
  }

  int get _rowWidth => spec.colCount == 0 ? 1 : spec.colCount;

  // Walks the header tree, joining ancestor titles for each leaf so a
  // 2-level header (e.g. Homme/Femme/Total × 0-15/16-25/26+) becomes
  // "Homme · 0-15 ans" — one label per leaf column, in the same
  // left-to-right order spec.cellId(r, c)'s `c` iterates.
  List<String> _leafColumnLabels() {
    final labels = <String>[];
    void walk(HeaderNode n, String prefix) {
      final path = prefix.isEmpty ? n.title : '$prefix · ${n.title}';
      if (n.children.isEmpty) {
        labels.add(path);
      } else {
        for (final child in n.children) {
          walk(child, path);
        }
      }
    }

    for (final h in spec.headers) {
      walk(h, '');
    }
    return labels;
  }

  @override
  Widget build(BuildContext context) {
    final colLabels = _leafColumnLabels();
    final cells = _allCells;

    if (spec.hasLeadingGroup) {
      final groupLabels = spec.leadingGroupLabels!;
      final counts = spec.leadingGroupRowCounts!;
      final sections = <Widget>[];
      int rowStart = 0;
      for (int gi = 0; gi < groupLabels.length; gi++) {
        final rows = <Widget>[
          for (int ri = 0; ri < counts[gi]; ri++)
            _rowCard(rowStart + ri, colLabels, cells),
        ];
        sections.add(_groupSection(groupLabels[gi], rows));
        rowStart += counts[gi];
      }
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sections,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int r = 0; r < spec.rowLabels.length; r++)
          _rowCard(r, colLabels, cells),
      ],
    );
  }

  Widget _groupSection(String label, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 4, 2, 8),
            child: Text(label,
                style: GridTheme.headerStyle.copyWith(
                    color: AppColors.deepEmerald, fontSize: 14)),
          ),
          ...rows,
        ],
      ),
    );
  }

  Widget _rowCard(int r, List<String> colLabels, List<String> cells) {
    final rowLabel = r < spec.rowLabels.length ? spec.rowLabels[r] : '';
    final isTotalRow = spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false;

    final labelCellId =
        (spec.rowLabelCellIds != null && r < spec.rowLabelCellIds!.length)
            ? spec.rowLabelCellIds![r]
            : '';
    final labelCs =
        labelCellId.isNotEmpty ? spec.cellSpec?.call(labelCellId) : null;

    final headerWidget = (labelCs?.editable ?? false)
        ? _inputBox(
            buildGridCellWidget(
              cellId: labelCellId,
              cs: labelCs,
              isTotalRow: isTotalRow,
              isGrandTotal: false,
              spec: spec,
              numberValues: numberValues,
              textValues: textValues,
              onNumberChanged: onNumberChanged,
              onTextChanged: onTextChanged,
              focusManager: focusManager,
              tableId: tableId,
              allCells: cells,
              rowWidth: _rowWidth,
              onExitTable: onExitTable,
              onExitPrevious: onExitPrevious,
              hybridController: hybridController,
              width: double.infinity,
              height: 48,
            ),
          )
        : Text(rowLabel,
            style: isTotalRow ? GridTheme.totalStyle : GridTheme.headerStyle);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isTotalRow ? GridTheme.totalBg : AppColors.cardWhite,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GridTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          headerWidget,
          const SizedBox(height: 10),
          for (int c = 0; c < spec.colCount; c++)
            _fieldRow(
              c < colLabels.length ? colLabels[c] : 'Col ${c + 1}',
              spec.cellId(r, c),
              spec.cellSpec?.call(spec.cellId(r, c)),
              isTotalRow,
              cells,
            ),
        ],
      ),
    );
  }

  Widget _fieldRow(String label, String cellId, CellSpec? cs, bool isTotalRow,
      List<String> cells) {
    final cellWidget = buildGridCellWidget(
      cellId: cellId,
      cs: cs,
      isTotalRow: isTotalRow,
      isGrandTotal: false,
      spec: spec,
      numberValues: numberValues,
      textValues: textValues,
      onNumberChanged: onNumberChanged,
      onTextChanged: onTextChanged,
      focusManager: focusManager,
      tableId: tableId,
      allCells: cells,
      rowWidth: _rowWidth,
      onExitTable: onExitTable,
      onExitPrevious: onExitPrevious,
      hybridController: hybridController,
      width: double.infinity,
      height: 48,
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 5,
            child: Text(label, style: GridTheme.labelStyle),
          ),
          const SizedBox(width: 10),
          Expanded(flex: 4, child: _inputBox(cellWidget)),
        ],
      ),
    );
  }

  // Tight-sizes the child to exactly 48px tall (not just loosely aligned
  // within a taller box) so the actual focusable/tappable area of the
  // field — not just its decoration — meets the touch-target minimum.
  Widget _inputBox(Widget child) => Container(
        decoration: BoxDecoration(
          color: GridTheme.inputBg,
          border: Border.all(color: GridTheme.borderColor),
          borderRadius: BorderRadius.circular(8),
        ),
        child: SizedBox(
          height: 48,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: child,
          ),
        ),
      );
}
