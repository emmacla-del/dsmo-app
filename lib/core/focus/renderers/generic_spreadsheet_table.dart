// lib/core/focus/renderers/generic_spreadsheet_table.dart
//
// ══════════════════════════════════════════════════════════════
// GENERIC SPREADSHEET TABLE  — pixel-perfect ONEFOP renderer
//
// FIXES:
//   • RESPONSIVE: tables stretch to fill available width when narrow,
//     or scroll horizontally when wide.
//   • LayoutBuilder measures parent width and adjusts colWidths.
//   • No FittedBox distortion — proportional column stretching.
//   • Modern container: 12px radius, soft border, subtle shadow.
//   • All fonts 13px via GridTheme.
//   • Row height 36px — no clipped text.
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

  GenericSpreadsheetTable({
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
  });

  late final List<String> allCells = _computeAllCells();
  late final int rowWidth = _computeRowWidth();

  List<String> _computeAllCells() {
    final cells = <String>[];
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

  int _computeRowWidth() {
    if (spec.isMatrixLayout) {
      return spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
    }
    return spec.colCount;
  }

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

  // ── Build col widths — responsive stretching ─────────────────
  List<double> _buildColWidths(double availableWidth) {
    if (spec.isMatrixLayout) {
      final n = spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
      return List.filled(n, GridTheme.colWidth);
    }

    final dataCols = List.filled(spec.colCount, GridTheme.colWidth);
    final labelColW = spec.effectiveFirstColWidth;

    List<double> widths;
    if (spec.hasLeadingGroup) {
      widths = [
        spec.effectiveLeadingGroupColWidth,
        labelColW,
        ...dataCols,
      ];
    } else {
      widths = [labelColW, ...dataCols];
    }

    final naturalW = widths.reduce((a, b) => a + b);

    // Stretch proportionally if we have extra space
    if (naturalW < availableWidth && availableWidth > 0) {
      final extra = availableWidth - naturalW;
      final stretchableCount = widths.length;
      final extraPerCol = extra / stretchableCount;
      widths = widths.map((w) => w + extraPerCol).toList();
    }

    return widths;
  }

  List<double> _buildRowHeights() {
    final dataRows =
        spec.isMatrixLayout ? spec.matrix.length : spec.rowLabels.length;
    return List.filled(_headerDepth + dataRows, GridTheme.rowHeight);
  }

  int get _cornerCol => spec.hasLeadingGroup ? 1 : 0;
  int get _dataColStart => spec.hasLeadingGroup ? 2 : 1;

  int get _totalCols {
    if (spec.isMatrixLayout) {
      return spec.matrix.isEmpty ? 1 : spec.matrix.first.length;
    }
    return _dataColStart + spec.colCount;
  }

  // ── Header cells ─────────────────────────────────────────────
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
            child: Text(
              spec.leadingGroupHeader!,
              style: GridTheme.headerStyle,
              textAlign: TextAlign.center,
              softWrap: true,
              overflow: TextOverflow.visible,
            ),
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
            child: Text(
              spec.cornerLabel,
              style: GridTheme.headerStyle,
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
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
            child: Text(
              spec.cornerLabel2!,
              style: GridTheme.headerStyle,
              overflow: TextOverflow.ellipsis,
              maxLines: 2,
            ),
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
            child: Text(
              spec.cornerLabel,
              style: GridTheme.headerStyle,
              overflow: TextOverflow.ellipsis,
              maxLines: 2,
            ),
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
    HeaderNode node,
    int row,
    int col,
    int maxDepth,
    List<GridCell> cells,
  ) {
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
        child: Text(
          node.title,
          style: GridTheme.headerStyle,
          textAlign: TextAlign.center,
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
        ),
      ),
    ));

    if (isLeaf) return col + 1;
    int nextCol = col;
    for (final child in node.children) {
      nextCol = _placeHeaderNode(child, row + 1, nextCol, maxDepth, cells);
    }
    return nextCol;
  }

  // ── Label data cells ─────────────────────────────────────────
  List<GridCell> _buildLabelDataCells() {
    final cells = <GridCell>[];
    final dataStart = _headerDepth;
    final totalRows = spec.rowLabels.length;

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
            child: Text(
              labels[gi],
              style: GridTheme.headerStyle,
              textAlign: TextAlign.center,
              softWrap: true,
              overflow: TextOverflow.visible,
            ),
          ),
        ));
        currentDataRow += counts[gi];
      }
    }

    for (int r = 0; r < totalRows; r++) {
      final label = spec.rowLabels[r];
      final isTotalRow = spec.isTotalCell?.call(label) ?? false;
      const isGrandTotal = false;
      final isEven = r % 2 == 0;

      final rowBg = isTotalRow
          ? GridTheme.totalBg
          : isEven
              ? GridTheme.rowEven
              : GridTheme.rowOdd;

      final labelStyle =
          isTotalRow ? GridTheme.totalStyle : GridTheme.labelStyle;

      cells.add(GridCell(
        id: 'lbl_${r}_$label',
        row: dataStart + r,
        col: _cornerCol,
        backgroundColor: rowBg,
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: GridTheme.labelCellPadding,
          child: Text(
            label,
            style: labelStyle,
            softWrap: true,
            overflow: TextOverflow.visible,
          ),
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
            isGrandTotal: isGrandTotal,
          ),
        ));
      }
    }
    return cells;
  }

  // ── Matrix data cells ────────────────────────────────────────
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
            cellId: cellId,
            cs: cs,
            isTotalRow: false,
            isGrandTotal: false,
          ),
        ));
      }
    }
    return cells;
  }

  // ── Cell widget dispatcher ───────────────────────────────────
  Widget _buildCellWidget({
    required String cellId,
    required CellSpec? cs,
    required bool isTotalRow,
    required bool isGrandTotal,
  }) {
    final type = cs?.type ?? CellType.number;
    final editable = cs?.editable ?? false;
    final hint = cs?.hint;
    final options = cs?.options ?? [];

    switch (type) {
      case CellType.number:
        if (!editable) {
          final v = numberValues[cellId] ?? 0;
          final style =
              isGrandTotal ? GridTheme.grandTotalStyle : GridTheme.totalStyle;
          return Container(
            constraints: const BoxConstraints.expand(),
            alignment: Alignment.center,
            padding: GridTheme.cellPadding,
            child: Text(
              v == 0 ? '—' : '$v',
              style: style,
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
          return Container(
            constraints: const BoxConstraints.expand(),
            alignment: Alignment.centerLeft,
            padding: GridTheme.cellPadding,
            child: Text(value, style: GridTheme.dataStyle),
          );
        }
        return TextFieldCell(
          fieldId: cellId,
          value: value,
          onChanged: (fid, v) {
            onTextChanged(fid, v);
            spec.onTextChanged?.call(fid, v);
          },
          focusManager: focusManager,
          tableId: tableId,
          width: GridTheme.colWidth,
          height: GridTheme.rowHeight - 2,
          hintText: hint,
          allCells: allCells,
          rowWidth: rowWidth,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
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
        return Container(
          constraints: const BoxConstraints.expand(),
          alignment: Alignment.center,
          padding: GridTheme.cellPadding,
          child: Text(
            v == 0 ? '—' : '$v',
            style:
                isGrandTotal ? GridTheme.grandTotalStyle : GridTheme.totalStyle,
            textAlign: TextAlign.center,
          ),
        );

      case CellType.label:
        return Container(
          constraints: const BoxConstraints.expand(),
          alignment: Alignment.centerLeft,
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
    return Container(
      constraints: const BoxConstraints.expand(),
      alignment: Alignment.center,
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

  // ── Build ────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final colWidths = _buildColWidths(availableWidth);
        final rowHeights = _buildRowHeights();
        final dataRows =
            spec.isMatrixLayout ? spec.matrix.length : spec.rowLabels.length;

        final seenIds = <String>{};
        final uniqueCells = <GridCell>[];

        void addCells(List<GridCell> src) {
          for (final cell in src) {
            if (seenIds.add(cell.id)) uniqueCells.add(cell);
          }
        }

        addCells(_buildHeaderCells());
        addCells(spec.isMatrixLayout
            ? _buildMatrixDataCells()
            : _buildLabelDataCells());

        final engine = GridLayoutEngine(
          cells: uniqueCells,
          rowCount: _headerDepth + dataRows,
          colCount: _totalCols,
          colWidths: colWidths,
          rowHeights: rowHeights,
          borderColor: GridTheme.borderColor,
          borderWidth: GridTheme.borderWidth,
        );

        final naturalW = colWidths.reduce((a, b) => a + b);
        final needsScroll = naturalW > availableWidth;

        final tableWidget = ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
              boxShadow: const [],
            ),
            child: needsScroll
                ? SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: engine,
                  )
                : engine,
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
