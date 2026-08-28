// Smoke test for GridLayoutEngine's uniform, axis-independent cell
// resize (see table_size_scope.dart's own doc comment): dragging a row's
// bottom border grows/shrinks every row together without touching column
// widths, dragging a column's right border does the reverse, and cell
// content stays centered within its (possibly resized) cell throughout.
//
// Drives the resize by dragging at the exact pixel position of a row/
// column boundary (computed from GridTheme's own known defaults) rather
// than trying to locate _RowResizeHandle/_ColumnResizeHandle directly —
// they're private to grid_layout_engine.dart, unreachable by type from a
// test in a different library.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/grid_layout_engine.dart';
import 'package:dsmo_app/core/focus/renderers/grid_theme.dart';
import 'package:dsmo_app/core/focus/renderers/table_size_scope.dart';

// 2x2 grid, one Text cell each — real dimensions come from
// GridTheme.firstColWidth (col 0)/colWidth (col 1) and GridTheme.rowHeight
// (both rows), exactly the defaults GridLayoutEngine falls back to
// without an explicit colWidths/rowHeights override.
Widget _grid(Key gridKey) => GridLayoutEngine(
      key: gridKey,
      cells: const [
        GridCell(id: 'r0c0', row: 0, col: 0, child: Text('a')),
        GridCell(id: 'r0c1', row: 0, col: 1, child: Text('b')),
        GridCell(id: 'r1c0', row: 1, col: 0, child: Text('c')),
        GridCell(id: 'r1c1', row: 1, col: 1, child: Text('d')),
      ],
      rowCount: 2,
      colCount: 2,
    );

void main() {
  testWidgets('dragging a row boundary grows every row, leaves columns untouched',
      (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(
          controller: controller,
          child: _grid(gridKey),
        ),
      ),
    ));

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    // The boundary between row 0 and row 1 — GridTheme.rowHeight below
    // the grid's own top edge.
    final rowBoundary = gridTopLeft + const Offset(40, GridTheme.rowHeight);

    final gesture = await tester.startGesture(rowBoundary);
    await tester.pump();
    await gesture.moveBy(const Offset(0, 60)); // drag downward — grow
    await tester.pump();
    await gesture.up();

    expect(controller.heightScale, greaterThan(1.0),
        reason: 'dragging a row boundary down should grow row height');
    expect(controller.widthScale, 1.0,
        reason: 'a vertical-only drag should never touch column width');

    // The whole grid's rendered height grew along with it (2 rows).
    final newSize = tester.getSize(find.byKey(gridKey));
    expect(newSize.height, greaterThan(GridTheme.rowHeight * 2));
    expect(newSize.width, GridTheme.firstColWidth + GridTheme.colWidth,
        reason: 'width should be exactly unchanged, not just unscaled');
  });

  testWidgets('dragging a column boundary grows every column, leaves rows untouched',
      (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(
          controller: controller,
          child: _grid(gridKey),
        ),
      ),
    ));

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    // The boundary between col 0 and col 1 — GridTheme.firstColWidth to
    // the right of the grid's own left edge.
    final colBoundary = gridTopLeft + const Offset(GridTheme.firstColWidth, 20);

    final gesture = await tester.startGesture(colBoundary);
    await tester.pump();
    await gesture.moveBy(const Offset(80, 0)); // drag rightward — widen
    await tester.pump();
    await gesture.up();

    expect(controller.widthScale, greaterThan(1.0),
        reason: 'dragging a column boundary right should widen columns');
    expect(controller.heightScale, 1.0,
        reason: 'a horizontal-only drag should never touch row height');

    final newSize = tester.getSize(find.byKey(gridKey));
    expect(newSize.width, greaterThan(GridTheme.firstColWidth + GridTheme.colWidth));
    expect(newSize.height, GridTheme.rowHeight * 2,
        reason: 'height should be exactly unchanged, not just unscaled');
  });

  testWidgets('resize is clamped to TableSizeController.minScale/maxScale',
      (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(controller: controller, child: _grid(gridKey)),
      ),
    ));

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    final rowBoundary = gridTopLeft + const Offset(40, GridTheme.rowHeight);

    // A single enormous drag should still only reach maxScale, not blow
    // past it.
    final gesture = await tester.startGesture(rowBoundary);
    await tester.pump();
    await gesture.moveBy(const Offset(0, 5000));
    await tester.pump();
    await gesture.up();

    expect(controller.heightScale, TableSizeController.maxScale);
  });

  testWidgets('cell content stays centered in its cell after a resize', (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(controller: controller, child: _grid(gridKey)),
      ),
    ));

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    final rowBoundary = gridTopLeft + const Offset(40, GridTheme.rowHeight);
    final gesture = await tester.startGesture(rowBoundary);
    await tester.pump();
    await gesture.moveBy(const Offset(0, 60));
    await tester.pump();
    await gesture.up();

    // Cell r0c0 grew taller (heightScale > 1) — its "a" text should sit
    // at the vertical midpoint of the *new*, taller cell box, not pinned
    // to the top the way it would if the cell had simply grown downward
    // with the content stuck at its original position.
    final cellTop = tester.getTopLeft(find.byKey(gridKey)).dy;
    final cellHeight = GridTheme.rowHeight * controller.heightScale;
    final textCenter = tester.getCenter(find.text('a')).dy;
    expect(textCenter, closeTo(cellTop + cellHeight / 2, 1.0));
  });

  testWidgets(
      'dragging a row boundary resizes even inside a vertically-scrolling '
      'ancestor, without also scrolling the page', (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();
    final scrollController = ScrollController();
    addTearDown(scrollController.dispose);

    // The exact nesting ExcelSectionBody uses in production: a vertically
    // scrolling ancestor (so a table taller than the canvas can still be
    // reached) wraps the table, TableSizeScope sits above both (see
    // OnefopExcelShell) — deliberately risker than a Scale/pan gesture to
    // win against (see grid_layout_engine.dart's own _RowResizeHandle
    // comment): both this and the resize handle recognize the *same*
    // vertical axis, unlike ZoomableTable's old omnidirectional one.
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 400,
          height: 100, // shorter than the grid, so it's genuinely scrollable
          child: TableSizeScope(
            controller: controller,
            child: SingleChildScrollView(
              controller: scrollController,
              child: _grid(gridKey),
            ),
          ),
        ),
      ),
    ));

    expect(scrollController.offset, 0.0);

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    final rowBoundary = gridTopLeft + const Offset(40, GridTheme.rowHeight);
    final gesture = await tester.startGesture(rowBoundary);
    await tester.pump();
    await gesture.moveBy(const Offset(0, 60));
    await tester.pump();
    await gesture.up();

    // The resize took effect...
    expect(controller.heightScale, greaterThan(1.0));
    // ...and the ancestor Scrollable never moved — the drag drove the
    // resize handle exclusively, not both at once.
    expect(scrollController.offset, 0.0);
  });

  testWidgets(
      'a plain tap right next to a row boundary still focuses the cell, '
      'not the resize handle', (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();
    final focusNode = FocusNode();
    addTearDown(focusNode.dispose);

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(
          controller: controller,
          child: GridLayoutEngine(
            key: gridKey,
            cells: [
              GridCell(id: 'r0c0', row: 0, col: 0, child: TextField(focusNode: focusNode)),
              const GridCell(id: 'r0c1', row: 0, col: 1, child: Text('b')),
              const GridCell(id: 'r1c0', row: 1, col: 0, child: Text('c')),
              const GridCell(id: 'r1c1', row: 1, col: 1, child: Text('d')),
            ],
            rowCount: 2,
            colCount: 2,
          ),
        ),
      ),
    ));

    expect(focusNode.hasFocus, isFalse);

    final gridTopLeft = tester.getTopLeft(find.byKey(gridKey));
    // 3px above the row 0/row 1 boundary — inside the resize handle's own
    // 8px-thick hit region (see _RowResizeHandle), but this is a plain
    // tap (no drag), which VerticalDragGestureRecognizer never accepts —
    // it only "wins" the gesture arena against the field's own tap
    // recognizer once there's been enough movement to actually be a drag.
    final nearBoundary = gridTopLeft + const Offset(40, GridTheme.rowHeight - 3);
    await tester.tapAt(nearBoundary);
    await tester.pump();

    expect(focusNode.hasFocus, isTrue,
        reason: 'a plain tap should still reach and focus the field this close to a '
            'resize handle — only an actual drag should be claimed by the handle');
  });

  testWidgets(
      'dragging right at the table\'s own trailing bottom/right edge still '
      'resizes, despite the outer Container clipping to exactly that edge',
      (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(controller: controller, child: _grid(gridKey)),
      ),
    ));

    final gridRect = tester.getRect(find.byKey(gridKey));
    // 2px inside the grid's own bottom edge — within the last row's
    // resize-handle strip, but on the side that a naive boundary-centered
    // strip would have clipped away (see _RowResizeHandle's totalHeight
    // clamp).
    final nearBottomEdge = Offset(gridRect.left + 40, gridRect.bottom - 2);
    final gesture = await tester.startGesture(nearBottomEdge);
    await tester.pump();
    await gesture.moveBy(const Offset(0, 60));
    await tester.pump();
    await gesture.up();

    expect(controller.heightScale, greaterThan(1.0),
        reason: 'the last row boundary sits exactly on the clipped outer edge — its '
            'handle must stay clamped inside the clip rect to remain draggable there');
  });

  testWidgets(
      'dragging right at the table\'s own trailing right edge still resizes columns',
      (tester) async {
    final controller = TableSizeController();
    addTearDown(controller.dispose);
    final gridKey = GlobalKey();

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: TableSizeScope(controller: controller, child: _grid(gridKey)),
      ),
    ));

    final gridRect = tester.getRect(find.byKey(gridKey));
    final nearRightEdge = Offset(gridRect.right - 2, gridRect.top + 20);
    final gesture = await tester.startGesture(nearRightEdge);
    await tester.pump();
    await gesture.moveBy(const Offset(80, 0));
    await tester.pump();
    await gesture.up();

    expect(controller.widthScale, greaterThan(1.0),
        reason: 'the last column boundary sits exactly on the clipped outer edge — its '
            'handle must stay clamped inside the clip rect to remain draggable there');
  });
}
