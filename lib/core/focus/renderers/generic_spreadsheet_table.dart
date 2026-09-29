// lib/core/focus/renderers/generic_spreadsheet_table.dart
//
// ══════════════════════════════════════════════════════════════
// GENERIC SPREADSHEET TABLE  — pixel-perfect ONEFOP renderer
//
// ARCHITECTURE (v2 — unified single grid):
//   Header cells and data cells are both plain GridCell objects (row/
//   col/rowSpan/colSpan), fed into ONE GridLayoutEngine call. That
//   engine positions every cell absolutely and paints every gridline
//   — including the header/data boundary — as a single continuous
//   stroke per line (see grid_layout_engine.dart), so there's no seam
//   at the header/data boundary and no per-cell double-bordering.
//
//   Row heights: header rows use a fixed height. Data rows are sized
//   analytically — via TextPainter, the same layout engine Flutter's
//   own Text widgets use internally — so a wrapped row label (or a
//   long leading-group label spanning several sub-rows) still gets a
//   tall enough row without needing runtime IntrinsicHeight/auto-size
//   passes, which is what the old per-row Row+IntrinsicHeight builder
//   used to provide (and which is what made the header and data rows
//   two independently-laid-out systems in the first place).
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'grid_layout_engine.dart';
import 'grid_render_spec.dart';
import '../unified_focus_manager_v2.dart';
import 'shared/grid_cell_dispatch.dart';
import 'grid_theme.dart';
import '../../i18n/localized_text.dart';
import '../../i18n/l10n_ext.dart';

class GenericSpreadsheetTable extends StatelessWidget {
  final GridRenderSpec spec;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int?) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  final double horizontalPagePadding;
  // ← ADD: hybrid controller for text/label cells
  final TextEditingController Function(String)? hybridController;
  // Optional leading widget inside a data row's label cell — Spreadsheet
  // Mode's flat matrix-question tables use this for the per-row "Aucun
  // cas à signaler" toggle (see category_mini_grids.dart's
  // RowSkipToggle). Only called for a row whose spec.rowKeys entry is
  // non-empty (a computed "Total" row has none) — every other table
  // (S4Q01, reasons/skills/training, identification grids, ...) leaves
  // spec.rowKeys null and never triggers this at all.
  final Widget Function(int rowIndex, String rowKey)? rowAccessoryBuilder;
  final bool polished;

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
    this.rowAccessoryBuilder,
    this.polished = false,
  });

  // ── Editable cell list (recomputed every build) ───────────────
  List<String> get allCells {
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
        final labelId =
            spec.rowLabelCellIds != null && r < spec.rowLabelCellIds!.length
                ? spec.rowLabelCellIds![r]
                : '';
        if (labelId.isNotEmpty &&
            (spec.cellSpec?.call(labelId).editable ?? false)) {
          cells.add(labelId);
        }
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
    final hasEditableRowLabel = spec.rowLabelCellIds?.any((id) =>
            id.isNotEmpty && (spec.cellSpec?.call(id).editable ?? false)) ??
        false;
    return spec.colCount + (hasEditableRowLabel ? 1 : 0);
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

    return _snapToPixels(widths);
  }

  // Distributing leftover width evenly (extraPerCol above) leaves every
  // column boundary at a fractional logical pixel (e.g. x=117.5,
  // x=352.83…). Snapping each cumulative boundary to a whole pixel
  // (rather than each width) keeps the running total exact, so every
  // seam lands on one physical pixel.
  List<double> _snapToPixels(List<double> widths) {
    final snapped = <double>[];
    var cursor = 0.0;
    var prevRounded = 0.0;
    for (final w in widths) {
      cursor += w;
      final rounded = cursor.roundToDouble();
      snapped.add(rounded - prevRounded);
      prevRounded = rounded;
    }
    return snapped;
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
      backgroundColor: GridTheme.headerBg,
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
  List<GridCell> _buildLabelDataCells(
      List<double> colWidths, BuildContext context) {
    final cells = <GridCell>[];
    final dataStart = _headerDepth;
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

      final rowKey = (spec.rowKeys != null && r < spec.rowKeys!.length)
          ? spec.rowKeys![r]
          : '';
      final accessory = (rowKey.isNotEmpty && rowAccessoryBuilder != null)
          ? rowAccessoryBuilder!(r, rowKey)
          : null;
      final labelText = Text(label,
          style: labelStyle,
          softWrap: true,
          maxLines: null,
          overflow: TextOverflow.visible);

      cells.add(GridCell(
        id: labelCellId.isNotEmpty ? labelCellId : 'lbl_${r}_$label',
        row: dataStart + r,
        col: _cornerCol,
        backgroundColor: rowBg,
        alignment: Alignment.centerLeft,
        child: (labelCs?.editable ?? false)
            ? _buildCellWidget(
              context: context,
                cellId: labelCellId,
                cs: labelCs,
                isTotalRow: isTotalRow,
                isGrandTotal: false,
                width: colWidths[_cornerCol])
            : Padding(
                padding: GridTheme.labelCellPadding,
                child: accessory == null
                    ? labelText
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          accessory,
                          const SizedBox(width: 7),
                          Flexible(child: labelText),
                        ],
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
              context: context,
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
  List<GridCell> _buildMatrixDataCells(BuildContext context) {
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
              context: context,
              cellId: cellId, cs: cs, isTotalRow: false, isGrandTotal: false),
        ));
      }
    }
    return cells;
  }

  // ── Analytic row heights ────────────────────────────────────────
  // GridLayoutEngine positions every row at a fixed, known height (no
  // runtime IntrinsicHeight pass) — so a data row that needs to be
  // taller than GridTheme.rowHeight (a wrapped row label, or a long
  // leading-group label spread over several sub-rows) has to be
  // measured analytically, ahead of layout. TextPainter runs the same
  // line-breaking engine Flutter's own Text widget uses internally,
  // so this matches actual rendered height rather than estimating it.
  double _measureTextHeight(
      String text, TextStyle style, double maxWidth, TextScaler scaler) {
    if (text.isEmpty) return 0;
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: null,
      textScaler: scaler,
    )..layout(maxWidth: maxWidth > 0 ? maxWidth : 0);
    return tp.height;
  }

  List<double> _computeDataRowHeights(
      List<double> colWidths, TextScaler textScaler) {
    if (spec.isMatrixLayout) {
      final heights =
          List<double>.filled(spec.matrix.length, GridTheme.rowHeight);
      for (int r = 0; r < spec.matrix.length; r++) {
        var tallest = GridTheme.rowHeight;
        for (int c = 0; c < spec.matrix[r].length; c++) {
          final cellId = spec.matrix[r][c];
          final cs = spec.cellSpec?.call(cellId);
          if (cs?.editable ?? false) continue; // fixed-height input widget
          if (cs?.type != CellType.text && cs?.type != CellType.label) {
            continue;
          }
          final value = spec.textValue?.call(cellId) ?? cs?.label ?? '';
          final w = (c < colWidths.length ? colWidths[c] : GridTheme.colWidth) -
              GridTheme.cellPadding.horizontal;
          final h =
              _measureTextHeight(value, GridTheme.dataStyle, w, textScaler) +
                  GridTheme.cellPadding.vertical;
          if (h > tallest) tallest = h;
        }
        heights[r] = tallest.ceilToDouble();
      }
      return heights;
    }

    final heights =
        List<double>.filled(spec.rowLabels.length, GridTheme.rowHeight);
    for (int r = 0; r < spec.rowLabels.length; r++) {
      final isTotalRow = spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false;
      final style = isTotalRow ? GridTheme.totalStyle : GridTheme.labelStyle;
      final labelW =
          colWidths[_cornerCol] - GridTheme.labelCellPadding.horizontal;
      final labelH =
          _measureTextHeight(spec.rowLabels[r], style, labelW, textScaler) +
              GridTheme.labelCellPadding.vertical;
      heights[r] = labelH > GridTheme.rowHeight
          ? labelH.ceilToDouble()
          : GridTheme.rowHeight;
    }

    // A leading-group label spans several sub-rows merged into one
    // cell — make sure the group's own label still fits within the
    // sum of its sub-rows' heights, growing the last sub-row if not.
    if (spec.hasLeadingGroup) {
      final labels = spec.leadingGroupLabels!;
      final counts = spec.leadingGroupRowCounts!;
      final groupW = colWidths[0] - GridTheme.labelCellPadding.horizontal;
      var start = 0;
      for (int gi = 0; gi < labels.length; gi++) {
        final count = counts[gi];
        if (count <= 0) continue;
        final neededH = _measureTextHeight(
                labels[gi], GridTheme.headerStyle, groupW, textScaler) +
            GridTheme.labelCellPadding.vertical;
        final sum = heights.skip(start).take(count).fold(0.0, (a, b) => a + b);
        if (neededH > sum) {
          heights[start + count - 1] += (neededH - sum).ceilToDouble();
        }
        start += count;
      }
    }

    return heights;
  }

  // ── Cell widget dispatcher ────────────────────────────────────
  // Delegates to the shared builder (grid_cell_dispatch.dart) so the
  // mobile card-per-row table can build identical cell widgets.
  Widget _buildCellWidget({
    required BuildContext context,
    required String cellId,
    required CellSpec? cs,
    required bool isTotalRow,
    required bool isGrandTotal,
    double? width,
  }) {
    return buildGridCellWidget(
      context: context,
      cellId: cellId,
      cs: cs,
      isTotalRow: isTotalRow,
      isGrandTotal: isGrandTotal,
      spec: spec,
      numberValues: numberValues,
      textValues: textValues,
      onNumberChanged: onNumberChanged,
      onTextChanged: onTextChanged,
      focusManager: focusManager,
      tableId: tableId,
      allCells: allCells,
      rowWidth: rowWidth,
      onExitTable: onExitTable,
      onExitPrevious: onExitPrevious,
      hybridController: hybridController,
      width: width ?? GridTheme.colWidth,
      height: GridTheme.rowHeight - 2,
      polished: polished,
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

        final allDataCells = spec.isMatrixLayout
          ? _buildMatrixDataCells(context)
          : _buildLabelDataCells(colWidths, context);

        final dataRowHeights =
            _computeDataRowHeights(colWidths, MediaQuery.textScalerOf(context));

        // One grid, header rows + data rows together — this is what
        // lets GridLayoutEngine draw the header/data boundary (and
        // every other line) as a single continuous stroke instead of
        // two independently-laid-out blocks meeting at a seam.
        final grid = GridLayoutEngine(
          cells: [...headerCells, ...allDataCells],
          rowCount: _headerDepth + dataRows,
          colCount: _totalCols,
          colWidths: colWidths,
          rowHeights: [
            ...List.filled(_headerDepth, GridTheme.rowHeight * 1.5),
            ...dataRowHeights,
          ],
          borderColor: GridTheme.borderColor,
          borderWidth: GridTheme.borderWidth,
          backgroundColor: GridTheme.headerBg,
        );

        final tableWidget = Container(
          color: Colors.white,
          child: needsScroll ? _HorizontalScrollTable(grid: grid) : grid,
        );

        return Padding(
          padding: EdgeInsets.symmetric(horizontal: horizontalPagePadding),
          child: tableWidget,
        );
      },
    );
  }
}

// Wraps a table too wide for its available space in a horizontal scroll —
// without this, the hard cut mid-header (e.g. "Total" clipped to "T" on a
// narrow phone) reads as a rendering bug rather than "scroll for more".
// Stateful only to track scroll position for the fade/hint below, which
// hide themselves once the user has actually scrolled to the true right
// edge.
class _HorizontalScrollTable extends StatefulWidget {
  final Widget grid;
  const _HorizontalScrollTable({required this.grid});

  @override
  State<_HorizontalScrollTable> createState() => _HorizontalScrollTableState();
}

class _HorizontalScrollTableState extends State<_HorizontalScrollTable> {
  final _controller = ScrollController();
  bool _hasMoreToScroll = true;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateHasMoreToScroll);
    // The controller has no attached position until after the first
    // layout pass, so the real extent isn't known synchronously here.
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _updateHasMoreToScroll());
  }

  void _updateHasMoreToScroll() {
    if (!_controller.hasClients) return;
    final remaining =
        _controller.position.maxScrollExtent - _controller.position.pixels;
    final hasMore = remaining > 1;
    if (hasMore != _hasMoreToScroll) {
      setState(() => _hasMoreToScroll = hasMore);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_updateHasMoreToScroll);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          children: [
            SingleChildScrollView(
              controller: _controller,
              scrollDirection: Axis.horizontal,
              child: widget.grid,
            ),
            if (_hasMoreToScroll)
              Positioned(
                top: 0,
                right: 0,
                bottom: 0,
                child: IgnorePointer(
                  child: Container(
                    width: 28,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [
                          Colors.white.withValues(alpha: 0),
                          Colors.white.withValues(alpha: 0.95),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        if (_hasMoreToScroll)
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.swipe_left_alt_rounded,
                    size: 14, color: GridTheme.borderColor),
                const SizedBox(width: 4),
                Text(
                  const LocalizedText(
                    fr: 'Faites glisser pour voir plus',
                    en: 'Swipe to see more',
                  ).of(context.loc),
                  style: const TextStyle(
                      fontSize: 11, color: GridTheme.borderColor),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
