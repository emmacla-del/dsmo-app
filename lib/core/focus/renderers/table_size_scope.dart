// lib/core/focus/renderers/table_size_scope.dart
//
// Uniform, independent-axis resize for every GridLayoutEngine table
// beneath a TableSizeScope — dragging a row's bottom border scales every
// row's height together (heightScale), dragging a column's right border
// scales every column's width together (widthScale), and the two never
// touch each other. A *scale factor* rather than an absolute pixel
// override so a table's own relative column-width design (e.g. a wider
// first/label column than its data columns — see GridTheme.firstColWidth)
// stays proportionally correct as the whole table grows or shrinks,
// instead of every column being forced to one identical absolute width.
//
// Scoped to OnefopExcelShell's own lifetime (see its _controller field,
// created once in initState — not per section/table navigation), so a
// resize made on one question's table stays in effect when the user
// moves on to the next one, the same way a spreadsheet app remembers a
// zoom/row-height preference for the rest of the session rather than
// resetting it per sheet.
import 'package:flutter/widgets.dart';

class TableSizeController extends ChangeNotifier {
  static const double minScale = 0.5;
  static const double maxScale = 2.5;

  double _heightScale = 1.0;
  double _widthScale = 1.0;

  double get heightScale => _heightScale;
  double get widthScale => _widthScale;

  // Divisors tuned so a natural-length drag (a couple hundred pixels)
  // sweeps roughly the full min/maxScale range without the resize
  // feeling twitchy on a small drag or requiring an unreasonably long
  // one to matter.
  void dragHeight(double pixelDelta) => _adjustHeight(pixelDelta / 120.0);
  void dragWidth(double pixelDelta) => _adjustWidth(pixelDelta / 160.0);

  void _adjustHeight(double scaleDelta) {
    final next = (_heightScale + scaleDelta).clamp(minScale, maxScale);
    if (next != _heightScale) {
      _heightScale = next;
      notifyListeners();
    }
  }

  void _adjustWidth(double scaleDelta) {
    final next = (_widthScale + scaleDelta).clamp(minScale, maxScale);
    if (next != _widthScale) {
      _widthScale = next;
      notifyListeners();
    }
  }
}

class TableSizeScope extends InheritedNotifier<TableSizeController> {
  const TableSizeScope({
    super.key,
    required TableSizeController controller,
    required super.child,
  }) : super(notifier: controller);

  TableSizeController get controller => notifier!;

  /// Null when no scope is in effect (e.g. mobile/Simple Mode, or a
  /// standalone widget test) — every GridLayoutEngine caller treats that
  /// as "not resizable, render at this table's own configured size",
  /// which is exactly today's pre-existing behavior.
  static TableSizeController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<TableSizeScope>()?.controller;
}
