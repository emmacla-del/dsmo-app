// lib/core/focus/renderers/generic_spreadsheet_table.dart
//
// ══════════════════════════════════════════════════════════════
// GENERIC SPREADSHEET TABLE  — pixel-perfect ONEFOP renderer
//
// ARCHITECTURE:
//   • Header rows → GridLayoutEngine (fixed height, handles colSpan/rowSpan)
//   • Data rows   → Column + IntrinsicHeight (auto-height, no clipping)
//
// FIX: leading-group column cells (e.g. "Permanent / Temporaire") are now
//      rendered as a single merged cell spanning all their sub-rows, matching
//      the PDF reference layout.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'grid_layout_engine.dart';
import 'grid_render_spec.dart';
import '../unified_focus_manager_v2.dart';
import 'shared/number_field.dart';
import 'shared/text_field.dart';
import 'grid_theme.dart';

class GenericSpreadsheetTable extends StatelessWidget {
  final GridRenderSpec spec;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  final double horizontalPagePadding;
  // ← ADD: hybrid controller for text/label cells
  final TextEditingController Function(String)? hybridController;

  const GenericSpreadsheetTable({
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
    this.horizontalPagePadding = 0,
    this.hybridController, // ← ADD THIS
  });

  // ── Editable cell list (recomputed every build) ───────────────
  List<String> get allCells {
    final cells = <String>[];

    if (spec.rowLabelCellIds != null) {
      for (final id in spec.rowLabelCellIds!) {
        if (id.isNotEmpty) cells.add(id);
      }
    }

    if (spec.isMatrixLayout) {
      for (final row in spec.matrix) {
        for (final cellId in row) {
          final cs = spec.cellSpec?.call(cellId);
          if (cs?.editable ?? false) cells.add(cellId);
        }
      }
    } else {
      for (int r = 0; r < spec.rowLabels.length; r++) {
        for (int c = 0; c < spec.colCount; c++) {
          final cellId = spec.cellId(r, c);
          final cs = spec.cellSpec?.call(cellId);
          if (cs?.editable ?? false) cells.add(cellId);
        }
      }
    }
    return cells;
  }

  int get rowWidth {
    if (spec.isMatrixLayout) {
      return spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
    }
    return spec.colCount;
  }

  // ── Header depth ──────────────────────────────────────────────
  int get _headerDepth {
    int depth(HeaderNode n) => n.children.isEmpty
        ? 1
        : 1 + n.children.map(depth).reduce((a, b) => a > b ? a : b);
    if (spec.headers.isEmpty) return 1;
    return spec.headers.map(depth).reduce((a, b) => a > b ? a : b);
  }

  int _leafCount(HeaderNode n) {
    if (n.children.isEmpty) return 1;
    return n.children.map(_leafCount).reduce((a, b) => a + b);
  }

  int get _cornerCol => spec.hasLeadingGroup ? 1 : 0;
  int get _dataColStart => spec.hasLeadingGroup ? 2 : 1;

  int get _totalCols {
    if (spec.isMatrixLayout) {
      return spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
    }
    return _dataColStart + spec.colCount;
  }

  // ── Column widths ─────────────────────────────────────────────
  List<double> _buildColWidths(double availableWidth) {
    if (spec.isMatrixLayout) {
      final n = spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
      return List.filled(n, GridTheme.colWidth);
    }

    final dataCols = List.filled(spec.colCount, GridTheme.colWidth);
    final labelColW = spec.effectiveFirstColWidth;

    List<double> widths;
    if (spec.hasLeadingGroup) {
      widths = [spec.effectiveLeadingGroupColWidth, labelColW, ...dataCols];
    } else {
      widths = [labelColW, ...dataCols];
    }

    const borderOverhead = 3.0;
    final usableWidth =
        (availableWidth - borderOverhead).clamp(0.0, double.infinity);
    final naturalW = widths.reduce((a, b) => a + b);
    if (naturalW < usableWidth && usableWidth > 0) {
      final extra = usableWidth - naturalW;
      final extraPerCol = extra / widths.length;
      widths = widths.map((w) => w + extraPerCol).toList();
    }
    return widths;
  }

  // ── Header cells ──────────────────────────────────────────────
  List<GridCell> _buildHeaderCells() {
    final cells = <GridCell>[];
    final depth = _headerDepth;

    if (!spec.isMatrixLayout) {
      if (spec.hasLeadingGroup) {
        cells.add(GridCell(
          id: '__leading_header__',
          row: 0,
          col: 0,
          rowSpan: depth,
          colSpan: 1,
          backgroundColor: GridTheme.headerBg,
          alignment: Alignment.center,
          child: Padding(
            padding: GridTheme.headerCellPadding,
            child: Text(spec.leadingGroupHeader!,
                style: GridTheme.headerStyle,
                textAlign: TextAlign.center,
                softWrap: true,
                overflow: TextOverflow.visible),
          ),
        ));
      }

      if (spec.cornerLabel2 != null && depth >= 2) {
        cells.add(GridCell(
          id: '__corner_top__',
          row: 0,
          col: _cornerCol,
          rowSpan: 1,
          colSpan: 1,
          backgroundColor: GridTheme.headerBg,
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: GridTheme.labelCellPadding,
            child: Text(spec.cornerLabel,
                style: GridTheme.headerStyle,
                overflow: TextOverflow.ellipsis,
                maxLines: 1),
          ),
        ));
        cells.add(GridCell(
          id: '__corner_bottom__',
          row: 1,
          col: _cornerCol,
          rowSpan: depth - 1,
          colSpan: 1,
          backgroundColor: GridTheme.headerBg,
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: GridTheme.labelCellPadding,
            child: Text(spec.cornerLabel2!,
                style: GridTheme.headerStyle,
                overflow: TextOverflow.ellipsis,
                maxLines: 2),
          ),
        ));
      } else {
        cells.add(GridCell(
          id: '__corner__',
          row: 0,
          col: _cornerCol,
          rowSpan: depth,
          colSpan: 1,
          backgroundColor: GridTheme.headerBg,
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: GridTheme.labelCellPadding,
            child: Text(spec.cornerLabel,
                style: GridTheme.headerStyle,
                overflow: TextOverflow.ellipsis,
                maxLines: 2),
          ),
        ));
      }
    }

    int col = _dataColStart;
    for (final node in spec.headers) {
      col = _placeHeaderNode(node, 0, col, depth, cells);
    }
    return cells;
  }

  int _placeHeaderNode(
      HeaderNode node, int row, int col, int maxDepth, List<GridCell> cells) {
    final span = _leafCount(node);
    final isLeaf = node.children.isEmpty;
    cells.add(GridCell(
      id: 'hdr_${node.title}_r${row}_c$col',
      row: row,
      col: col,
      colSpan: span,
      rowSpan: isLeaf ? (maxDepth - row) : 1,
      backgroundColor:
          node.highlight ? const Color(0xFFBDD7EE) : GridTheme.headerBg,
      alignment: Alignment.center,
      child: Padding(
        padding: GridTheme.headerCellPadding,
        child: Text(node.title,
            style: GridTheme.headerStyle,
            textAlign: TextAlign.center,
            softWrap: true,
            overflow: TextOverflow.visible),
      ),
    ));
    if (isLeaf) return col + 1;
    int nextCol = col;
    for (final child in node.children) {
      nextCol = _placeHeaderNode(child, row + 1, nextCol, maxDepth, cells);
    }
    return nextCol;
  }

  // ── Label data cells ──────────────────────────────────────────
  List<GridCell> _buildLabelDataCells(List<double> colWidths) {
    final cells = <GridCell>[];
    final dataStart = _headerDepth;
    debugPrint('TABLE: ${spec.id} | rowLabelCellIds: ${spec.rowLabelCellIds}');
    if (spec.hasLeadingGroup) {
      final labels = spec.leadingGroupLabels!;
      final counts = spec.leadingGroupRowCounts!;
      int currentDataRow = 0;
      for (int gi = 0; gi < labels.length; gi++) {
        cells.add(GridCell(
          id: '__leading_group_$gi',
          row: dataStart + currentDataRow,
          col: 0,
          rowSpan: counts[gi],
          colSpan: 1,
          backgroundColor: GridTheme.headerBg,
          alignment: Alignment.center,
          child: Padding(
            padding: GridTheme.labelCellPadding,
            child: Text(labels[gi],
                style: GridTheme.headerStyle,
                textAlign: TextAlign.center,
                softWrap: true,
                overflow: TextOverflow.visible),
          ),
        ));
        currentDataRow += counts[gi];
      }
    }

    for (int r = 0; r < spec.rowLabels.length; r++) {
      final label = spec.rowLabels[r];
      final isTotalRow = spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false;
      final isEven = r % 2 == 0;
      final rowBg = isTotalRow
          ? GridTheme.totalBg
          : isEven
              ? GridTheme.rowEven
              : GridTheme.rowOdd;
      final labelStyle =
          isTotalRow ? GridTheme.totalStyle : GridTheme.labelStyle;

      final labelCellId =
          (spec.rowLabelCellIds != null && r < spec.rowLabelCellIds!.length)
              ? spec.rowLabelCellIds![r]
              : '';
      final labelCs =
          labelCellId.isNotEmpty ? spec.cellSpec?.call(labelCellId) : null;

      cells.add(GridCell(
        id: labelCellId.isNotEmpty ? labelCellId : 'lbl_${r}_$label',
        row: dataStart + r,
        col: _cornerCol,
        backgroundColor: rowBg,
        alignment: Alignment.centerLeft,
        child: (labelCs?.editable ?? false)
            ? _buildCellWidget(
                cellId: labelCellId,
                cs: labelCs,
                isTotalRow: isTotalRow,
                isGrandTotal: false,
                width: colWidths[_cornerCol])
            : Padding(
                padding: GridTheme.labelCellPadding,
                child: Text(label,
                    style: labelStyle,
                    softWrap: true,
                    maxLines: null,
                    overflow: TextOverflow.visible),
              ),
      ));

      for (int c = 0; c < spec.colCount; c++) {
        final cellId = spec.cellId(r, c);
        final cs = spec.cellSpec?.call(cellId);
        final resolvedBg = spec.resolvedCellColor(cellId) ?? rowBg;
        cells.add(GridCell(
          id: cellId,
          row: dataStart + r,
          col: _dataColStart + c,
          backgroundColor: resolvedBg,
          alignment: Alignment.center,
          child: _buildCellWidget(
              cellId: cellId,
              cs: cs,
              isTotalRow: isTotalRow,
              isGrandTotal: false),
        ));
      }
    }
    return cells;
  }

  // ── Matrix data cells ─────────────────────────────────────────
  List<GridCell> _buildMatrixDataCells() {
    final cells = <GridCell>[];
    final dataStart = _headerDepth;
    for (int r = 0; r < spec.matrix.length; r++) {
      final row = spec.matrix[r];
      final isEven = r % 2 == 0;
      for (int c = 0; c < row.length; c++) {
        final cellId = row[c];
        final cs = spec.cellSpec?.call(cellId);
        final resolvedBg = spec.resolvedCellColor(cellId) ??
            (isEven ? GridTheme.rowEven : GridTheme.rowOdd);
        cells.add(GridCell(
          id: cellId,
          row: dataStart + r,
          col: c,
          backgroundColor: resolvedBg,
          alignment: Alignment.centerLeft,
          child: _buildCellWidget(
              cellId: cellId, cs: cs, isTotalRow: false, isGrandTotal: false),
        ));
      }
    }
    return cells;
  }

  // ── Build leading-group data block (merged first column) ───────
  //
  // FIX: instead of drawing the leading-group cell once per row (which
  // just repeated the label), we now wrap each group's sub-rows in an
  // IntrinsicHeight Row so the merged label cell stretches to cover all
  // its sub-rows in a single container — matching the PDF reference.
  Widget _buildLeadingGroupDataBlock(List<double> colWidths) {
    final labels = spec.leadingGroupLabels!;
    final counts = spec.leadingGroupRowCounts!;
    final groupColW = colWidths[0];

    // Width of all columns EXCEPT the leading-group column.
    // Used to give the sub-rows Column a fixed width so it works
    // inside IntrinsicHeight without needing Expanded (which is
    // incompatible with IntrinsicHeight and causes zero-size errors).
    final subRowsW = colWidths.skip(1).fold(0.0, (a, b) => a + b);

    final allDataCells = _buildLabelDataCells(colWidths); // ← ADD colWidths
    final dataStart = _headerDepth;

    int globalRow = 0;
    final groupWidgets = <Widget>[];

    for (int gi = 0; gi < labels.length; gi++) {
      final rowCount = counts[gi];
      final subRowWidgets = <Widget>[];

      for (int ri = 0; ri < rowCount; ri++) {
        final r = globalRow + ri;
        final isTotalRow = !spec.isMatrixLayout &&
            r < spec.rowLabels.length &&
            (spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false);
        final isEven = r % 2 == 0;
        final rowBg = isTotalRow
            ? GridTheme.totalBg
            : isEven
                ? GridTheme.rowEven
                : GridTheme.rowOdd;

        // Collect cells for this row — skip col 0 (merged leading-group cell)
        final rowCells = allDataCells
            .where((cell) => cell.row == dataStart + r && cell.col != 0)
            .toList()
          ..sort((a, b) => a.col.compareTo(b.col));

        final children = <Widget>[];
        int colIdx = _cornerCol; // starts at 1 (col 0 = leading-group)

        for (final cell in rowCells) {
          if (cell.col > colIdx) {
            double gapW = 0;
            for (int i = colIdx; i < cell.col && i < colWidths.length; i++) {
              gapW += colWidths[i];
            }
            if (gapW > 0) {
              children.add(_cellContainer(
                  width: gapW,
                  bg: rowBg,
                  alignment: Alignment.center,
                  child: const SizedBox.shrink()));
            }
            colIdx = cell.col;
          }

          double w = 0;
          for (int i = 0; i < cell.colSpan; i++) {
            final idx = colIdx + i;
            if (idx < colWidths.length) w += colWidths[idx];
          }

          children.add(_cellContainer(
              width: w,
              bg: cell.backgroundColor ?? rowBg,
              alignment: cell.alignment,
              child: cell.child));
          colIdx += cell.colSpan;
        }

        // Fill any remaining columns
        if (colIdx < colWidths.length) {
          double rem = 0;
          for (int i = colIdx; i < colWidths.length; i++) {
            rem += colWidths[i];
          }
          if (rem > 0) {
            children.add(_cellContainer(
                width: rem,
                bg: rowBg,
                alignment: Alignment.center,
                child: const SizedBox.shrink()));
          }
        }

        subRowWidgets.add(IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ));
      }

      // ── Merged leading-group label + sub-rows side by side ────
      // We use fixed widths for both children so IntrinsicHeight can
      // measure the group without any Expanded widget (Expanded inside
      // IntrinsicHeight gives each child zero size).
      groupWidgets.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Merged status cell — spans full height of the group
              Container(
                width: groupColW,
                decoration: const BoxDecoration(
                  color: GridTheme.headerBg,
                  border: Border(
                    right: BorderSide(
                        color: GridTheme.borderColor,
                        width: GridTheme.borderWidth),
                    bottom: BorderSide(
                        color: GridTheme.borderColor,
                        width: GridTheme.borderWidth),
                  ),
                ),
                alignment: Alignment.center,
                padding: GridTheme.labelCellPadding,
                child: Text(
                  labels[gi],
                  style: GridTheme.headerStyle,
                  textAlign: TextAlign.center,
                  softWrap: true,
                  overflow: TextOverflow.visible,
                ),
              ),
              // Sub-rows — fixed width, no Expanded
              SizedBox(
                width: subRowsW,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: subRowWidgets,
                ),
              ),
            ],
          ),
        ),
      );

      globalRow += rowCount;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: groupWidgets,
    );
  }

  // ── Single data row (auto-height, non-leading-group tables) ───
  Widget _buildDataRow(
      int r, List<double> colWidths, List<GridCell> allDataCells) {
    final dataStart = _headerDepth;
    final rowCells = allDataCells
        .where((cell) => cell.row == dataStart + r)
        .toList()
      ..sort((a, b) => a.col.compareTo(b.col));

    final isTotalRow = !spec.isMatrixLayout &&
        r < spec.rowLabels.length &&
        (spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false);
    final isEven = r % 2 == 0;
    final rowBg = isTotalRow
        ? GridTheme.totalBg
        : isEven
            ? GridTheme.rowEven
            : GridTheme.rowOdd;

    final children = <Widget>[];
    int colIdx = 0;

    for (final cell in rowCells) {
      if (cell.col > colIdx) {
        double gapW = 0;
        for (int i = colIdx; i < cell.col && i < colWidths.length; i++) {
          gapW += colWidths[i];
        }
        if (gapW > 0) {
          children.add(_cellContainer(
              width: gapW,
              bg: rowBg,
              alignment: Alignment.center,
              child: const SizedBox.shrink()));
        }
        colIdx = cell.col;
      }

      double w = 0;
      for (int i = 0; i < cell.colSpan; i++) {
        final idx = colIdx + i;
        if (idx < colWidths.length) w += colWidths[idx];
      }

      children.add(_cellContainer(
          width: w,
          bg: cell.backgroundColor ?? rowBg,
          alignment: cell.alignment,
          child: cell.child));
      colIdx += cell.colSpan;
    }

    if (colIdx < colWidths.length) {
      double rem = 0;
      for (int i = colIdx; i < colWidths.length; i++) {
        rem += colWidths[i];
      }
      if (rem > 0) {
        children.add(_cellContainer(
            width: rem,
            bg: rowBg,
            alignment: Alignment.center,
            child: const SizedBox.shrink()));
      }
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    );
  }

  // ── Cell container (right + bottom border) ────────────────────
  Widget _cellContainer({
    required double width,
    required Color? bg,
    required Alignment alignment,
    required Widget child,
  }) {
    return Container(
      width: width,
      constraints: const BoxConstraints(minHeight: GridTheme.rowHeight),
      decoration: BoxDecoration(
        color: bg,
        border: const Border(
          right: BorderSide(
              color: GridTheme.borderColor, width: GridTheme.borderWidth),
          bottom: BorderSide(
              color: GridTheme.borderColor, width: GridTheme.borderWidth),
        ),
      ),
      alignment: alignment,
      child: child,
    );
  }

  // ── Cell widget dispatcher ────────────────────────────────────
  Widget _buildCellWidget({
    required String cellId,
    required CellSpec? cs,
    required bool isTotalRow,
    required bool isGrandTotal,
    double? width,
  }) {
    final type = cs?.type ?? CellType.number;
    final editable = cs?.editable ?? false;
    final hint = cs?.hint;
    final options = cs?.options ?? [];

    switch (type) {
      case CellType.number:
        if (!editable) {
          final v = numberValues[cellId] ?? 0;
          return Padding(
            padding: GridTheme.cellPadding,
            child: Text(
              v == 0 ? '—' : '$v',
              style: isGrandTotal
                  ? GridTheme.grandTotalStyle
                  : GridTheme.totalStyle,
              textAlign: TextAlign.center,
            ),
          );
        }
        return NumberField(
          fieldId: cellId,
          value: numberValues[cellId] ?? 0,
          onChanged: onNumberChanged,
          focusManager: focusManager,
          tableId: tableId,
          width: GridTheme.colWidth,
          height: GridTheme.rowHeight - 2,
          allCells: allCells,
          rowWidth: rowWidth,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
        );

      case CellType.text:
        final value = spec.textValue?.call(cellId) ?? textValues[cellId] ?? '';
        if (!editable) {
          return Padding(
            padding: GridTheme.cellPadding,
            child: Text(value, style: GridTheme.dataStyle),
          );
        }
        // Local variable for promotion
        final hc = hybridController;
        final externalCtrl = hc != null ? hc(cellId) : null;
        return FormTextField(
          fieldId: cellId,
          value: externalCtrl?.text ?? value,
          onChanged: (v) {
            onTextChanged(cellId, v);
            spec.onTextChanged?.call(cellId, v);
          },
          focusManager: focusManager,
          tableId: tableId,
          width: width ?? GridTheme.colWidth, // ← CHANGE THIS
          height: GridTheme.rowHeight - 2,
          hintText: hint,
          allCells: allCells,
          rowWidth: rowWidth,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
          externalController: externalCtrl,
        );
      case CellType.radio:
        final currentValue = spec.radioValue?.call(cellId) ??
            spec.textValue?.call(cellId) ??
            textValues[cellId] ??
            '';
        if (options.isEmpty) return const SizedBox.shrink();
        return _dropdownCell(
          cellId: cellId,
          currentValue: currentValue,
          options: options,
          onChanged: (v) {
            spec.onRadioChanged?.call(cellId, v);
            spec.onTextChanged?.call(cellId, v);
            onTextChanged(cellId, v);
          },
        );

      case CellType.select:
        final currentValue = spec.selectedValue?.call(cellId) ??
            spec.textValue?.call(cellId) ??
            textValues[cellId] ??
            '';
        if (options.isEmpty) return const SizedBox.shrink();
        return _dropdownCell(
          cellId: cellId,
          currentValue: currentValue,
          options: options,
          onChanged: (v) {
            spec.onSelectChanged?.call(cellId, v);
            spec.onTextChanged?.call(cellId, v);
            onTextChanged(cellId, v);
          },
        );

      case CellType.readOnly:
        final v = numberValues[cellId] ?? 0;
        return Padding(
          padding: GridTheme.cellPadding,
          child: Text(
            v == 0 ? '—' : '$v',
            style:
                isGrandTotal ? GridTheme.grandTotalStyle : GridTheme.totalStyle,
            textAlign: TextAlign.center,
          ),
        );

      case CellType.label:
        return Padding(
          padding: GridTheme.labelCellPadding,
          child: Text(cs?.label ?? '', style: GridTheme.labelStyle),
        );
    }
  }

  Widget _dropdownCell({
    required String cellId,
    required String currentValue,
    required List<String> options,
    required ValueChanged<String> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: DropdownButton<String>(
        value: currentValue.isEmpty ? null : currentValue,
        hint: const Text('—',
            style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
        isExpanded: true,
        underline: const SizedBox(),
        style: GridTheme.dataStyle,
        iconSize: 14,
        items: options
            .map((o) => DropdownMenuItem(
                  value: o,
                  child: Text(o,
                      style: GridTheme.dataStyle,
                      overflow: TextOverflow.ellipsis),
                ))
            .toList(),
        onChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final colWidths = _buildColWidths(availableWidth);
        final dataRows =
            spec.isMatrixLayout ? spec.matrix.length : spec.rowLabels.length;

        // Header cells (deduped)
        final seenIds = <String>{};
        final headerCells = <GridCell>[];
        for (final cell in _buildHeaderCells()) {
          if (seenIds.add(cell.id)) headerCells.add(cell);
        }

        final naturalW = colWidths.reduce((a, b) => a + b);
        const borderOverhead = 3.0;
        final needsScroll = naturalW > (availableWidth - borderOverhead);

        // Header block — GridLayoutEngine handles colSpan/rowSpan
        final headerBlock = GridLayoutEngine(
          cells: headerCells,
          rowCount: _headerDepth,
          colCount: _totalCols,
          colWidths: colWidths,
          rowHeights: List.filled(_headerDepth, GridTheme.rowHeight * 1.5),
          borderColor: GridTheme.borderColor,
          borderWidth: GridTheme.borderWidth,
          backgroundColor: GridTheme.headerBg,
        );

        // Data block — leading-group tables use merged first column,
        // all others use the per-row builder.
        final Widget dataBlock;
        if (spec.hasLeadingGroup && !spec.isMatrixLayout) {
          dataBlock = _buildLeadingGroupDataBlock(colWidths);
        } else {
          final allDataCells = spec.isMatrixLayout
              ? _buildMatrixDataCells()
              : _buildLabelDataCells(colWidths); // ← PASS colWidths

          dataBlock = Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (int r = 0; r < dataRows; r++)
                _buildDataRow(r, colWidths, allDataCells),
            ],
          );
        }

        // Left border wraps both blocks
        final tableContent = Container(
          decoration: const BoxDecoration(
            border: Border(
              left: BorderSide(
                  color: GridTheme.borderColor, width: GridTheme.borderWidth),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [headerBlock, dataBlock],
          ),
        );

        final tableWidget = ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
            ),
            child: needsScroll
                ? SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: tableContent,
                  )
                : tableContent,
          ),
        );

        return Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPagePadding),
          child: tableWidget,
        );
      },
    );
  }
}
