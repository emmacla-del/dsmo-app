// lib/core/focus/renderers/grid_calculation_engine.dart

import 'grid_render_spec.dart';

/// ─────────────────────────────────────────────────────────────
/// GRID CALCULATION ENGINE
/// Handles totals, aggregation, and recomputation logic
/// ─────────────────────────────────────────────────────────────

class GridCalculationEngine {
  final GridRenderSpec spec;

  /// Current numeric state of the grid
  final Map<String, int> values;

  GridCalculationEngine({
    required this.spec,
    required this.values,
  });

  // ─────────────────────────────────────────────────────────────
  // PUBLIC ENTRY POINT
  // ─────────────────────────────────────────────────────────────

  void recalculate() {
    _recalculateRowTotals();
    _recalculateColumnTotals();
  }

  // ─────────────────────────────────────────────────────────────
  // ROW TOTALS
  // ─────────────────────────────────────────────────────────────

  void _recalculateRowTotals() {
    for (int r = 0; r < spec.matrix.length; r++) {
      int sum = 0;

      for (int c = 0; c < spec.matrix[r].length; c++) {
        final id = spec.matrix[r][c];

        if (_isTotalCell(id)) continue;

        sum += values[id] ?? 0;
      }

      final totalCell = _findRowTotalCell(r);
      if (totalCell != null) {
        values[totalCell] = sum;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // COLUMN TOTALS
  // ─────────────────────────────────────────────────────────────

  void _recalculateColumnTotals() {
    if (spec.matrix.isEmpty) return;

    final cols = spec.matrix.first.length;

    for (int c = 0; c < cols; c++) {
      int sum = 0;

      for (int r = 0; r < spec.matrix.length; r++) {
        final id = spec.matrix[r][c];

        if (_isTotalCell(id)) continue;

        sum += values[id] ?? 0;
      }

      final totalCell = _findColumnTotalCell(c);
      if (totalCell != null) {
        values[totalCell] = sum;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  bool _isTotalCell(String id) {
    return id.toLowerCase().contains('total');
  }

  String? _findRowTotalCell(int row) {
    for (final id in spec.matrix[row]) {
      if (_isTotalCell(id)) return id;
    }
    return null;
  }

  String? _findColumnTotalCell(int col) {
    for (int r = 0; r < spec.matrix.length; r++) {
      final id = spec.matrix[r][col];
      if (_isTotalCell(id)) return id;
    }
    return null;
  }
}
