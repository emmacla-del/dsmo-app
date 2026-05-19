// lib/core/focus/schema/grid_schema.dart

import 'types.dart'; // Import Direction from here

class GridSchema {
  final String id;
  final List<List<String>> matrix;

  const GridSchema({
    required this.id,
    required this.matrix,
  });

  int get rowCount => matrix.length;
  int get colCount => matrix.isNotEmpty ? matrix[0].length : 0;

  String cell(int row, int col) => matrix[row][col];

  // ✅ ADD THIS METHOD - finds row and column of a field ID
  GridPosition? positionOf(String fieldId) {
    for (int r = 0; r < matrix.length; r++) {
      for (int c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] == fieldId) {
          return GridPosition(row: r, col: c);
        }
      }
    }
    return null;
  }

  // Check if grid contains a field ID
  bool contains(String fieldId) {
    return positionOf(fieldId) != null;
  }

  // Get neighbors for a specific cell
  Map<Direction, String?> getNeighbors(String fieldId) {
    final result = <Direction, String?>{};
    final pos = positionOf(fieldId);
    if (pos == null) return result;

    if (pos.row > 0) result[Direction.up] = matrix[pos.row - 1][pos.col];
    if (pos.row + 1 < matrix.length) {
      result[Direction.down] = matrix[pos.row + 1][pos.col];
    }
    if (pos.col > 0) result[Direction.left] = matrix[pos.row][pos.col - 1];
    if (pos.col + 1 < matrix[pos.row].length) {
      result[Direction.right] = matrix[pos.row][pos.col + 1];
    }

    return result;
  }

  // Get all neighbors (if needed by schema_builder)
  Map<String, Map<Direction, String?>> get neighbors {
    final result = <String, Map<Direction, String?>>{};

    for (int r = 0; r < matrix.length; r++) {
      for (int c = 0; c < matrix[r].length; c++) {
        final cellId = matrix[r][c];
        final neighbors = <Direction, String?>{};

        if (r > 0) neighbors[Direction.up] = matrix[r - 1][c];
        if (r + 1 < matrix.length) neighbors[Direction.down] = matrix[r + 1][c];
        if (c > 0) neighbors[Direction.left] = matrix[r][c - 1];
        if (c + 1 < matrix[r].length) {
          neighbors[Direction.right] = matrix[r][c + 1];
        }

        result[cellId] = neighbors;
      }
    }

    return result;
  }
}

// ✅ ADD THIS CLASS
class GridPosition {
  final int row;
  final int col;

  const GridPosition({required this.row, required this.col});
}
