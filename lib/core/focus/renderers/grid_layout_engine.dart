// lib/core/focus/renderers/grid_layout_engine.dart
//
// ══════════════════════════════════════════════════════════════
// PIXEL-PERFECT GRID LAYOUT ENGINE  (v4 — modern heights)
//
// Root cause of previous double lines
// ─────────────────────────────────────────────────────────────
// Two independent sources were each drawing the same edge:
//
//   1. GridLayoutEngine._cellBorder() → every cell drew top+left
//      AND right+bottom, so every shared interior edge was drawn
//      twice (once as right/bottom of one cell, once as top/left
//      of its neighbour).
//
//   2. GenericSpreadsheetTable._buildHeaderCells() wrapped each
//      child widget in TH.withBlackGridLines(BoxDecoration(...))
//      which added yet another full 4-sided border ON TOP of the
//      layout engine's border — tripling the header lines.
//
// Fix
// ─────────────────────────────────────────────────────────────
//   • The outer Container (wrapping the Stack) draws the four
//     outer edges of the whole grid exactly once.
//   • Each Positioned cell draws ONLY its right and bottom edge.
//   • No cell ever draws a top or left edge.
//   • Child widgets (header cells, label cells, number fields)
//     must NOT add their own BoxDecoration borders — see the
//     corresponding fix in generic_spreadsheet_table.dart.
//
// Result: every interior grid line is painted exactly once.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'grid_theme.dart';

// ─────────────────────────────────────────────────────────────
// GRID CELL  (unchanged public API)
// ─────────────────────────────────────────────────────────────

class GridCell {
  final String id;
  final int row;
  final int col;
  final int rowSpan;
  final int colSpan;
  final Widget child;
  final Color? backgroundColor;
  final Alignment alignment;

  const GridCell({
    required this.id,
    required this.row,
    required this.col,
    this.rowSpan = 1,
    this.colSpan = 1,
    required this.child,
    this.backgroundColor,
    this.alignment = Alignment.center,
  });
}

// ─────────────────────────────────────────────────────────────
// GRID LAYOUT ENGINE
// ─────────────────────────────────────────────────────────────

class GridLayoutEngine extends StatelessWidget {
  final List<GridCell> cells;
  final int rowCount;
  final int colCount;

  final List<double>? rowHeights;
  final List<double>? colWidths;

  final double rowHeight;
  final double colWidth;
  final double firstColWidth;
  final Color borderColor;
  final double borderWidth;
  final Color? backgroundColor;

  const GridLayoutEngine({
    super.key,
    required this.cells,
    required this.rowCount,
    required this.colCount,
    this.rowHeights,
    this.colWidths,
    this.rowHeight = GridTheme.rowHeight,
    this.colWidth = GridTheme.colWidth,
    this.firstColWidth = GridTheme.firstColWidth,
    this.borderColor = GridTheme.borderColor,
    this.borderWidth = GridTheme.borderWidth,
    this.backgroundColor,
  });

  // ── Geometry helpers ─────────────────────────────────────────

  double _cw(int col) {
    if (colWidths != null && col < colWidths!.length) return colWidths![col];
    return col == 0 ? firstColWidth : colWidth;
  }

  double _rh(int row) {
    if (rowHeights != null && row < rowHeights!.length) return rowHeights![row];
    return rowHeight;
  }

  double _colLeft(int col) {
    double x = 0;
    for (int c = 0; c < col; c++) {
      x += _cw(c);
    }
    return x;
  }

  double _rowTop(int row) {
    double y = 0;
    for (int r = 0; r < row; r++) {
      y += _rh(r);
    }
    return y;
  }

  double _cellWidth(int col, int colSpan) {
    double w = 0;
    for (int c = col; c < col + colSpan; c++) {
      w += _cw(c);
    }
    return w;
  }

  double _cellHeight(int row, int rowSpan) {
    double h = 0;
    for (int r = row; r < row + rowSpan; r++) {
      h += _rh(r);
    }
    return h;
  }

  double get _totalWidth {
    double w = 0;
    for (int c = 0; c < colCount; c++) {
      w += _cw(c);
    }
    return w;
  }

  double get _totalHeight {
    double h = 0;
    for (int r = 0; r < rowCount; r++) {
      h += _rh(r);
    }
    return h;
  }

  // ── Dedup + overlap guard ────────────────────────────────────

  List<GridCell> _normalize(List<GridCell> input) {
    final seen = <String>{};
    final occupied = <String>{};
    final result = <GridCell>[];

    final sorted = List<GridCell>.from(input)
      ..sort((a, b) {
        final diff = (b.rowSpan * b.colSpan) - (a.rowSpan * a.colSpan);
        if (diff != 0) return diff;
        if (a.row != b.row) return a.row - b.row;
        return a.col - b.col;
      });

    for (final cell in sorted) {
      if (seen.contains(cell.id)) continue;
      seen.add(cell.id);
      if (cell.row < 0 || cell.col < 0) continue;
      if (cell.row >= rowCount || cell.col >= colCount) continue;
      if (cell.row + cell.rowSpan > rowCount) continue;
      if (cell.col + cell.colSpan > colCount) continue;

      bool overlaps = false;
      outer:
      for (int r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (int c = cell.col; c < cell.col + cell.colSpan; c++) {
          if (occupied.contains('${r}_$c')) {
            overlaps = true;
            break outer;
          }
        }
      }
      if (overlaps) continue;

      for (int r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (int c = cell.col; c < cell.col + cell.colSpan; c++) {
          occupied.add('${r}_$c');
        }
      }
      result.add(cell);
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _normalize(cells);
    final totalW = _totalWidth;
    final totalH = _totalHeight;
    final side = BorderSide(color: borderColor, width: borderWidth);
    // Per-cell border: right + bottom ONLY — never top or left.
    final cellBorder = Border(right: side, bottom: side);

    return Container(
      width: totalW,
      height: totalH,
      // Outer frame: provides the top and left edges of the grid
      // so column-0 / row-0 cells do not need to draw them.
      decoration: BoxDecoration(
        color: backgroundColor,
        border: Border.fromBorderSide(side),
      ),
      // Clip so merged cells that span the outer edge don't paint
      // their right/bottom border outside the grid frame.
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          for (final cell in normalized)
            Positioned(
              left: _colLeft(cell.col),
              top: _rowTop(cell.row),
              width: _cellWidth(cell.col, cell.colSpan),
              height: _cellHeight(cell.row, cell.rowSpan),
              child: Container(
                decoration: BoxDecoration(
                  color: cell.backgroundColor,
                  border: cellBorder, // right + bottom only
                ),
                alignment: cell.alignment,
                // Child must NOT add its own border decoration.
                child: cell.child,
              ),
            ),
        ],
      ),
    );
  }
}
