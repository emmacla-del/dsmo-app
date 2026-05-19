import 'csp_cell_ref.dart';

class CspFastCursor {
  final List<CspCellRef> cells;
  int index = 0;

  CspFastCursor(this.cells);

  CspCellRef get current => cells[index];

  bool next() {
    if (index < cells.length - 1) {
      index++;
      return true;
    }
    return false;
  }

  bool previous() {
    if (index > 0) {
      index--;
      return true;
    }
    return false;
  }

  bool get isLast => index == cells.length - 1;
  bool get isFirst => index == 0;

  int get position => index;
  int get length => cells.length;

  /// Move right (next column in gender/age sequence)
  bool moveRight() {
    if (index % 6 < 5) {
      // 6 cells per row (3 age fields × 2 genders)
      index++;
      return true;
    }
    return false;
  }

  /// Move left (previous column in gender/age sequence)
  bool moveLeft() {
    if (index % 6 > 0) {
      index--;
      return true;
    }
    return false;
  }

  /// Move down (next CSP row)
  bool moveDown() {
    if (index < cells.length - 6) {
      index += 6;
      return true;
    }
    return false;
  }

  /// Move up (previous CSP row)
  bool moveUp() {
    if (index >= 6) {
      index -= 6;
      return true;
    }
    return false;
  }
}
