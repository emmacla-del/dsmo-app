// lib/core/focus/renderers/grid_layout_engine.dart
//
// ══════════════════════════════════════════════════════════════
// PIXEL-PERFECT GRID LAYOUT ENGINE  (v5 — single-pass gridlines)
//
// v4 had every cell paint its own right+bottom BoxDecoration border,
// with the outer frame drawing the remaining top+left edges once.
// That still meant a "straight line" running across several cells
// (e.g. one header row's bottom edge, or a column divider running
// through several data rows) was actually several independently
// anti-aliased Container borders abutting end-to-end. Where two such
// edges were meant to be one continuous line, Skia compositing the
// two independently-drawn hairlines could leave a sub-pixel gap or
// read thinner right at the joint — worst exactly at row/column
// intersections, which is where the joints are most concentrated.
//
// v5 removes ALL per-cell border painting — cells only paint their
// background color. Every grid line (each row boundary, each column
// boundary) is computed once from the same cell-occupancy data used
// for positioning, merged into the longest possible contiguous run
// (skipping the interior of merged/rowSpan/colSpan cells, where no
// line should appear), and painted as one canvas.drawRect per run in
// a single CustomPainter pass. A line that's conceptually "one
// straight line" is now always literally one paint call — never
// several abutting pieces that could show a seam.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/gestures.dart' show DragStartBehavior;
import 'package:flutter/material.dart';
import 'grid_theme.dart';
import 'table_size_scope.dart';

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

  // ── Geometry ──────────────────────────────────────────────────
  // Resolved once per build() into a _ResolvedGeometry (see below) that
  // carries the effective TableSizeScope heightScale/widthScale (1.0
  // when there's no scope in effect, i.e. everywhere except a resizable
  // Spreadsheet Mode table) — every position/size in this widget goes
  // through it instead of reading rowHeight/colWidth/etc directly, so a
  // scope's resize takes effect uniformly everywhere at once.
  _ResolvedGeometry _resolveGeometry(BuildContext context) {
    final sizeController = TableSizeScope.maybeOf(context);
    return _ResolvedGeometry(
      rowHeights: rowHeights,
      colWidths: colWidths,
      rowHeight: rowHeight,
      colWidth: colWidth,
      firstColWidth: firstColWidth,
      heightScale: sizeController?.heightScale ?? 1.0,
      widthScale: sizeController?.widthScale ?? 1.0,
    );
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

  // ── Occupancy grid: which cell id owns each logical (row,col) ──
  // Drives which grid-line segments are internal to a merged cell
  // (skip — no line inside a merge) vs a real seam (draw).
  List<List<String?>> _occupancy(List<GridCell> normalized) {
    final occ =
        List.generate(rowCount, (_) => List<String?>.filled(colCount, null));
    for (final cell in normalized) {
      for (int r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (int c = cell.col; c < cell.col + cell.colSpan; c++) {
          occ[r][c] = cell.id;
        }
      }
    }
    return occ;
  }

  // ── Line segments: longest contiguous runs, one draw call each ──
  // Each rect is inset toward the interior of the grid (never sitting
  // exactly on the outer 0/rowCount/colCount boundary) so it's never
  // clipped away by the outer Container's Clip.hardEdge.
  List<Rect> _horizontalRuns(List<List<String?>> occ, _ResolvedGeometry geo, double totalH) {
    final rects = <Rect>[];
    for (int b = 0; b <= rowCount; b++) {
      int? runStart;
      for (int c = 0; c <= colCount; c++) {
        final needed = c < colCount &&
            (b == 0 || b == rowCount || occ[b - 1][c] != occ[b][c]);
        if (needed) {
          runStart ??= c;
        } else if (runStart != null) {
          final y =
              (geo.rowTop(b) - borderWidth).clamp(0.0, totalH - borderWidth);
          rects.add(Rect.fromLTWH(
            geo.colLeft(runStart),
            y,
            geo.colLeft(c) - geo.colLeft(runStart),
            borderWidth,
          ));
          runStart = null;
        }
      }
    }
    return rects;
  }

  List<Rect> _verticalRuns(List<List<String?>> occ, _ResolvedGeometry geo, double totalW) {
    final rects = <Rect>[];
    for (int b = 0; b <= colCount; b++) {
      int? runStart;
      for (int r = 0; r <= rowCount; r++) {
        final needed = r < rowCount &&
            (b == 0 || b == colCount || occ[r][b - 1] != occ[r][b]);
        if (needed) {
          runStart ??= r;
        } else if (runStart != null) {
          final x =
              (geo.colLeft(b) - borderWidth).clamp(0.0, totalW - borderWidth);
          rects.add(Rect.fromLTWH(
            x,
            geo.rowTop(runStart),
            borderWidth,
            geo.rowTop(r) - geo.rowTop(runStart),
          ));
          runStart = null;
        }
      }
    }
    return rects;
  }

  @override
  Widget build(BuildContext context) {
    final geo = _resolveGeometry(context);
    final resizeController = TableSizeScope.maybeOf(context);
    final normalized = _normalize(cells);
    final totalW = geo.totalWidth(colCount);
    final totalH = geo.totalHeight(rowCount);
    final occ = _occupancy(normalized);

    return Container(
      width: totalW,
      height: totalH,
      // Container requires an explicit `decoration:` (not just `color:`)
      // whenever clipBehavior != Clip.none — color alone leaves
      // `decoration` null and Container's own constructor assertion
      // (decoration != null || clipBehavior == Clip.none) fails on
      // every build.
      decoration: BoxDecoration(color: backgroundColor),
      // Clip so merged cells that span the outer edge don't paint
      // their content outside the grid frame.
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          for (final cell in normalized)
            Positioned(
              // Without this, Stack matches children by list position, not
              // identity — a caller whose cell list changes composition
              // between rebuilds without also changing its own length (see
              // MiniCategoryGrid's row-by-row reveal) would have Flutter
              // silently reuse one cell's Element for a completely
              // different cell id at the same position. Harmless for pure
              // layout/paint (every visual property is prop-driven and
              // updates correctly either way), but a StatefulWidget cell
              // that wires anything imperative in initState/didUpdateWidget
              // keyed off its own id (NumberField's FocusNode.onKeyEvent,
              // for one) would keep the *old* cell's wiring under the new
              // cell's identity. A stable per-id key forces a fresh mount
              // whenever the id at a position actually changes.
              key: ValueKey(cell.id),
              left: geo.colLeft(cell.col),
              top: geo.rowTop(cell.row),
              width: geo.cellWidth(cell.col, cell.colSpan),
              height: geo.cellHeight(cell.row, cell.rowSpan),
              child: Container(
                color: cell.backgroundColor,
                // Content re-centers itself for free here — cell.alignment
                // is unchanged by a resize, so growing/shrinking width or
                // height (the Positioned above) just gives Align more or
                // less room to center the same content within.
                alignment: cell.alignment,
                // Child paints no border of its own — every line in the
                // grid comes from the single _GridLinesPainter below.
                child: cell.child,
              ),
            ),
          // IgnorePointer: this paints the gridlines only — it sits on top
          // of every cell (so lines are never occluded by cell content),
          // but without this it also intercepts every tap/click meant for
          // the TextField/DropdownButton in the cells underneath it, since
          // it fully covers the grid via Positioned.fill.
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _GridLinesPainter(
                  horizontal: _horizontalRuns(occ, geo, totalH),
                  vertical: _verticalRuns(occ, geo, totalW),
                  color: borderColor,
                ),
              ),
            ),
          ),
          // Resize handles — only when a TableSizeScope ancestor actually
          // wants this table resizable (Spreadsheet Mode; see
          // onefop_excel_shell.dart). One thin strip per row boundary
          // (including the outermost bottom edge) and one per column
          // boundary, each covering the *entire* table's width/height so
          // there's no need to hunt for a specific cell's own edge.
          if (resizeController != null) ...[
            for (int b = 0; b < rowCount; b++)
              _RowResizeHandle(
                top: geo.rowTop(b + 1),
                width: totalW,
                totalHeight: totalH,
                onDragDelta: resizeController.dragHeight,
              ),
            for (int b = 0; b < colCount; b++)
              _ColumnResizeHandle(
                left: geo.colLeft(b + 1),
                height: totalH,
                totalWidth: totalW,
                onDragDelta: resizeController.dragWidth,
              ),
          ],
        ],
      ),
    );
  }
}

// ── Resolved geometry ────────────────────────────────────────────
// Every raw size GridLayoutEngine was constructed with (rowHeight,
// colWidth, firstColWidth, and the optional per-row/per-column override
// lists), scaled once by whatever TableSizeScope is (or isn't) in effect.
// A plain object rather than instance methods on GridLayoutEngine itself
// so the scale factors can be threaded through without needing mutable
// widget state — GridLayoutEngine stays a StatelessWidget, this is just a
// local value built fresh each build().
class _ResolvedGeometry {
  final List<double>? rowHeights;
  final List<double>? colWidths;
  final double rowHeight;
  final double colWidth;
  final double firstColWidth;
  final double heightScale;
  final double widthScale;

  _ResolvedGeometry({
    required this.rowHeights,
    required this.colWidths,
    required this.rowHeight,
    required this.colWidth,
    required this.firstColWidth,
    required this.heightScale,
    required this.widthScale,
  });

  double cw(int col) {
    final base = (colWidths != null && col < colWidths!.length)
        ? colWidths![col]
        : (col == 0 ? firstColWidth : colWidth);
    return base * widthScale;
  }

  double rh(int row) {
    final base =
        (rowHeights != null && row < rowHeights!.length) ? rowHeights![row] : rowHeight;
    return base * heightScale;
  }

  double colLeft(int col) {
    double x = 0;
    for (int c = 0; c < col; c++) {
      x += cw(c);
    }
    return x;
  }

  double rowTop(int row) {
    double y = 0;
    for (int r = 0; r < row; r++) {
      y += rh(r);
    }
    return y;
  }

  double cellWidth(int col, int colSpan) {
    double w = 0;
    for (int c = col; c < col + colSpan; c++) {
      w += cw(c);
    }
    return w;
  }

  double cellHeight(int row, int rowSpan) {
    double h = 0;
    for (int r = row; r < row + rowSpan; r++) {
      h += rh(r);
    }
    return h;
  }

  double totalWidth(int colCount) {
    double w = 0;
    for (int c = 0; c < colCount; c++) {
      w += cw(c);
    }
    return w;
  }

  double totalHeight(int rowCount) {
    double h = 0;
    for (int r = 0; r < rowCount; r++) {
      h += rh(r);
    }
    return h;
  }
}

// ── Resize handles ───────────────────────────────────────────────
// GestureDetector with an axis-locked drag recognizer, not a raw
// Listener — this needs to *exclude* whatever gesture a table's ancestor
// recognizes on the exact same pointer (ExcelSectionBody wraps the table
// in a vertically-scrolling SingleChildScrollView — see
// onefop_excel_field_rows.dart), not just additionally react alongside
// it, or dragging a row handle would resize the table *and* scroll the
// page at once. A bare Listener can't do that (it never enters the
// gesture arena, so it has no way to make a competing recognizer lose),
// but a GestureDetector does: every pointer-down is routed to *every*
// hit-tested recognizer along the tree, innermost first, and Flutter's
// gesture arena resolves ties among same-axis recognizers (this handle's
// VerticalDragGestureRecognizer vs. the ancestor Scrollable's own) in
// that same innermost-first order — see table_resize_test.dart's own
// "...without also scrolling the page" test for this verified directly.
// Once any recognizer accepts, the arena guarantees every other
// recognizer sharing that pointer is rejected — that mutual exclusion is
// the whole reason this needs to be a real recognizer in the arena
// instead of a Listener beside it.
//
// GestureDetector behavior: translucent, not opaque — these strips sit on
// *top* of every cell in the same Stack (painted/hit-tested last, so
// they're reachable at all), and opaque doesn't just mean "this widget can
// be hit", it also stops the hit-test walk from reaching whatever's
// painted *behind* it at that position. translucent still lets this
// widget's own recognizer enter the arena (so an actual drag is still
// claimed correctly — same mutual-exclusion guarantee as above), but also
// lets the hit continue through to the cell beneath for anything this
// drag recognizer doesn't accept (a plain tap with no movement).
//
// MouseRegion(opaque: false) — this is the part that actually matters, and
// GestureDetector's behavior alone does NOT fix a blocked tap: RenderMouseRegion
// hardcodes its own hit-test behavior to opaque independent of whatever
// HitTestBehavior the child GestureDetector requests, so with the default
// opaque:true, MouseRegion.hitTest returns true for any position inside
// its bounds regardless of the child — which stops the Stack's own
// hit-test walk from ever trying the sibling cell painted behind this
// strip, so a plain tap within 4px of a boundary never reached the
// NumberField/FormTextField underneath at all. opaque: false makes
// MouseRegion.hitTest AND its result with false, so the pointer event
// still routes down to the GestureDetector/cursor as normal, but the
// Stack is told "not fully handled" and keeps walking to the cell behind
// it. Verified directly by table_resize_test.dart's "a plain tap right
// next to a row boundary still focuses the cell" test.
class _RowResizeHandle extends StatelessWidget {
  final double top;
  final double width;
  final double totalHeight;
  final ValueChanged<double> onDragDelta;
  const _RowResizeHandle(
      {required this.top,
      required this.width,
      required this.totalHeight,
      required this.onDragDelta});

  // Handle strip is centered on the boundary line, at the requested
  // 6-8px *total* hit width (not per side — GridTheme.rowHeight is only
  // 24px, so per-side would eat well over half of every row's own
  // height from its top and bottom edges alone, on top of whatever the
  // row above/below it also contributes at the far ends).
  static const double _thickness = 8.0;

  @override
  Widget build(BuildContext context) {
    // The outer grid Container clips to exactly [0, totalHeight] (see
    // GridLayoutEngine.build's clipBehavior: Clip.hardEdge, needed so
    // spanned cells don't paint outside the frame). A strip simply
    // centered on the boundary would have half its hit area silently
    // clipped away for the very last row, where the boundary line sits
    // exactly on that outer edge — clamp so the whole strip stays inside
    // the clip rect instead of straddling it.
    final clampedTop = (top - _thickness / 2).clamp(0.0, totalHeight - _thickness);
    return Positioned(
      left: 0,
      top: clampedTop,
      width: width,
      height: _thickness,
      child: MouseRegion(
        cursor: SystemMouseCursors.resizeUpDown,
        opaque: false,
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          dragStartBehavior: DragStartBehavior.down,
          onVerticalDragUpdate: (details) => onDragDelta(details.delta.dy),
        ),
      ),
    );
  }
}

class _ColumnResizeHandle extends StatelessWidget {
  final double left;
  final double height;
  final double totalWidth;
  final ValueChanged<double> onDragDelta;
  const _ColumnResizeHandle(
      {required this.left,
      required this.height,
      required this.totalWidth,
      required this.onDragDelta});

  // Same ~6-8px *total* hit width as _RowResizeHandle — see its own
  // comment. (Previously left at 14.0 here while only the row handle was
  // corrected — a leftover from the same misreading of the spec.)
  static const double _thickness = 8.0;

  @override
  Widget build(BuildContext context) {
    // Same trailing-edge clip clamp as _RowResizeHandle, for the last
    // column's boundary sitting exactly on the grid's own right edge.
    final clampedLeft = (left - _thickness / 2).clamp(0.0, totalWidth - _thickness);
    return Positioned(
      left: clampedLeft,
      top: 0,
      width: _thickness,
      height: height,
      child: MouseRegion(
        cursor: SystemMouseCursors.resizeLeftRight,
        opaque: false,
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          dragStartBehavior: DragStartBehavior.down,
          onHorizontalDragUpdate: (details) => onDragDelta(details.delta.dx),
        ),
      ),
    );
  }
}

class _GridLinesPainter extends CustomPainter {
  final List<Rect> horizontal;
  final List<Rect> vertical;
  final Color color;

  _GridLinesPainter({
    required this.horizontal,
    required this.vertical,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    for (final r in horizontal) {
      canvas.drawRect(r, paint);
    }
    for (final r in vertical) {
      canvas.drawRect(r, paint);
    }
  }

  // RenderCustomPaint.hitTestSelf treats a null return here as "claim the
  // hit" (`_painter!.hitTest(position) ?? true`), so without this override
  // this decorative overlay — painted last, i.e. on top of every cell in
  // the Stack — silently absorbs every tap/click meant for the cells
  // beneath it (text fields, dropdowns, ...) before they ever see it.
  @override
  bool? hitTest(Offset position) => false;

  @override
  bool shouldRepaint(covariant _GridLinesPainter oldDelegate) {
    return color != oldDelegate.color ||
        !_rectListEquals(horizontal, oldDelegate.horizontal) ||
        !_rectListEquals(vertical, oldDelegate.vertical);
  }

  static bool _rectListEquals(List<Rect> a, List<Rect> b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
