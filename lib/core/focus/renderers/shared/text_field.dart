// lib/core/focus/renderers/shared/text_field.dart
//
// Pixel-perfect editable text cell for ONEFOP spreadsheet tables.
// Used in hybrid reason / skill / domain rows (text description cols).
//
// MODERNIZED:
//   • Font size: 9 → 13 px (unified with rest of form)
//   • Hint style: 9 → 13 px, softer grey
//   • Padding: uses updated OL.cellPadH (= 6)
//   • Row height: 22 → 36 px (via GridTheme/OL updates)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../unified_focus_manager_v2.dart';
import '../grid_theme.dart';
import '../onefop_layout_constants.dart';

class TextFieldCell extends StatefulWidget {
  final String fieldId;
  final String value;
  final void Function(String, String) onChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final double width;
  final double height;
  final String? hintText;
  final List<String> allCells;
  final int rowWidth;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const TextFieldCell({
    super.key,
    required this.fieldId,
    required this.value,
    required this.onChanged,
    required this.focusManager,
    required this.tableId,
    required this.width,
    required this.height,
    this.hintText,
    required this.allCells,
    required this.rowWidth,
    this.onExitTable,
    this.onExitPrevious,
  });

  @override
  State<TextFieldCell> createState() => _TextFieldCellState();
}

class _TextFieldCellState extends State<TextFieldCell> {
  late final TextEditingController _ctrl;
  FocusNode get _node => widget.focusManager.node(widget.fieldId);

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.value);
    _node.onKeyEvent = _handleKey;
  }

  @override
  void didUpdateWidget(TextFieldCell old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && _ctrl.text != widget.value) {
      _ctrl.value = _ctrl.value.copyWith(text: widget.value);
    }
    if (old.tableId != widget.tableId ||
        old.focusManager != widget.focusManager) {
      _node.onKeyEvent = _handleKey;
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

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      final nextIdx = (row + 1) * widget.rowWidth + col;
      if (nextIdx < widget.allCells.length) {
        widget.focusManager.focus(widget.allCells[nextIdx]);
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      final prevIdx = (row - 1) * widget.rowWidth + col;
      if (prevIdx >= 0) {
        widget.focusManager.focus(widget.allCells[prevIdx]);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
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
        return SizedBox(
          width: widget.width,
          height: widget.height,
          child: TextFormField(
            controller: _ctrl,
            focusNode: _node,
            style: GridTheme.dataStyle,
            textAlignVertical: TextAlignVertical.center,
            decoration: InputDecoration(
              hintText: widget.hintText,
              hintStyle:
                  const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              filled: true,
              fillColor: focused ? OL.inputCellBgFocus : OL.inputCellBg,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: OL.cellPadH, vertical: 0),
              border: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide:
                    BorderSide(color: OL.borderColor, width: OL.borderWidth),
              ),
              enabledBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide:
                    BorderSide(color: OL.borderColor, width: OL.borderWidth),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.zero,
                borderSide: BorderSide(color: Color(0xFF4472C4), width: 2.0),
              ),
            ),
            onChanged: (v) => widget.onChanged(widget.fieldId, v),
          ),
        );
      },
    );
  }
}
