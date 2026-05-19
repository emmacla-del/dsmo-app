// lib/core/focus/renderers/shared/number_field.dart
//
// ══════════════════════════════════════════════════════════════
// NUMBER FIELD — plain cell, no visible input-box decoration
//
// FIXES vs previous version:
//   • Removed all InputDecoration borders, fill colour, and
//     container backgrounds so the cell looks like a bare
//     spreadsheet cell — centred value, no box artefact.
//   • Focus highlight is applied to the *parent* GridCell
//     background (via GridTheme.inputBgFocus) rather than
//     re-boxing the field inside the cell.
//   • Hint text ("0") shown only when focused and empty.
//   • MODERNIZED: hint font 9→13 px, softer grey color.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../unified_focus_manager_v2.dart';
import '../grid_theme.dart';

class NumberField extends StatefulWidget {
  final String fieldId;
  final int value;
  final void Function(String, int) onChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final double width;
  final double height;
  final List<String> allCells;
  final int rowWidth;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const NumberField({
    super.key,
    required this.fieldId,
    required this.value,
    required this.onChanged,
    required this.focusManager,
    required this.tableId,
    required this.width,
    required this.height,
    required this.allCells,
    required this.rowWidth,
    this.onExitTable,
    this.onExitPrevious,
  });

  @override
  State<NumberField> createState() => _NumberFieldState();
}

class _NumberFieldState extends State<NumberField> {
  late final TextEditingController _ctrl;
  FocusNode get _node => widget.focusManager.node(widget.fieldId);

  String _display(int v) => v == 0 ? '' : '$v';

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: _display(widget.value));
    _node.onKeyEvent = _handleKey;
  }

  @override
  void didUpdateWidget(NumberField old) {
    super.didUpdateWidget(old);
    if (old.tableId != widget.tableId ||
        old.focusManager != widget.focusManager) {
      _node.onKeyEvent = _handleKey;
    }
    if (old.value != widget.value) {
      final t = _display(widget.value);
      if (_ctrl.text != t) _ctrl.text = t;
    }
  }

  @override
  void dispose() {
    _node.onKeyEvent = null;
    _ctrl.dispose();
    super.dispose();
  }

  KeyEventResult _handleKey(FocusNode n, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;

    final idx = widget.allCells.indexOf(widget.fieldId);
    if (idx < 0) {
      return widget.focusManager.handleKey(n, e, gridId: widget.tableId);
    }

    final row = idx ~/ widget.rowWidth;
    final col = idx % widget.rowWidth;
    final totalRows = (widget.allCells.length / widget.rowWidth).ceil();

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
      if (col < widget.rowWidth - 1 && idx < widget.allCells.length - 1) {
        widget.focusManager.focus(widget.allCells[idx + 1]);
      } else if (row < totalRows - 1) {
        widget.focusManager.focus(widget.allCells[(row + 1) * widget.rowWidth]);
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
      if (col > 0) {
        widget.focusManager.focus(widget.allCells[idx - 1]);
      } else if (row > 0) {
        widget.focusManager.focus(widget.allCells[row * widget.rowWidth - 1]);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      final ni = (row + 1) * widget.rowWidth + col;
      if (ni < widget.allCells.length) {
        widget.focusManager.focus(widget.allCells[ni]);
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      final pi = (row - 1) * widget.rowWidth + col;
      if (pi >= 0) {
        widget.focusManager.focus(widget.allCells[pi]);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter) ||
        kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      if (kb.isShiftPressed) {
        if (idx > 0) {
          widget.focusManager.focus(widget.allCells[idx - 1]);
        } else {
          widget.onExitPrevious?.call();
        }
      } else {
        if (idx < widget.allCells.length - 1) {
          widget.focusManager.focus(widget.allCells[idx + 1]);
        } else {
          widget.onExitTable?.call();
        }
      }
      return KeyEventResult.handled;
    }
    return widget.focusManager.handleKey(n, e, gridId: widget.tableId);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _node,
      builder: (ctx, _) {
        final focused = _node.hasFocus;
        return ColoredBox(
          color: focused ? GridTheme.inputBgFocus : Colors.transparent,
          child: TextField(
            controller: _ctrl,
            focusNode: _node,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            textAlignVertical: TextAlignVertical.center,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: GridTheme.dataStyle,
            decoration: InputDecoration(
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
              hintText: focused ? '0' : null,
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFFCBD5E1),
              ),
            ),
            onChanged: (v) =>
                widget.onChanged(widget.fieldId, int.tryParse(v) ?? 0),
            onSubmitted: (_) => _handleKey(
              _node,
              const KeyDownEvent(
                physicalKey: PhysicalKeyboardKey.enter,
                logicalKey: LogicalKeyboardKey.enter,
                timeStamp: Duration.zero,
              ),
            ),
          ),
        );
      },
    );
  }
}
