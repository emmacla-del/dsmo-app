// lib/core/focus/renderers/shared/text_field.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../unified_focus_manager_v2.dart';
import '../grid_theme.dart';

class FormTextField extends StatefulWidget {
  final String fieldId;
  final String value;
  final void Function(String) onChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final double width;
  final double height;
  final String? hintText;
  final List<String>? allCells;
  final int? rowWidth;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  // NEW: optional external controller (for hybridController integration)
  final TextEditingController? externalController;

  const FormTextField({
    super.key,
    required this.fieldId,
    required this.value,
    required this.onChanged,
    required this.focusManager,
    required this.tableId,
    required this.width,
    required this.height,
    this.hintText,
    this.allCells,
    this.rowWidth,
    this.onExitTable,
    this.onExitPrevious,
    this.externalController,
  });

  @override
  State<FormTextField> createState() => _FormTextFieldState();
}

class _FormTextFieldState extends State<FormTextField> {
  late TextEditingController _ctrl;
  FocusNode get _node => widget.focusManager.node(widget.fieldId);

  @override
  void initState() {
    super.initState();
    // ← USE externalController IF PROVIDED
    _ctrl =
        widget.externalController ?? TextEditingController(text: widget.value);
    _node.onKeyEvent = _handleKey;
    _node.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(FormTextField old) {
    super.didUpdateWidget(old);
    if (old.tableId != widget.tableId ||
        old.focusManager != widget.focusManager) {
      old.focusManager.node(old.fieldId).removeListener(_onFocusChange);
      _node.onKeyEvent = _handleKey;
      _node.addListener(_onFocusChange);
    }
    // ← ONLY SYNC FROM WIDGET IF NOT USING EXTERNAL CONTROLLER
    if (widget.externalController == null &&
        old.value != widget.value &&
        _ctrl.text != widget.value) {
      _ctrl.text = widget.value;
    }
  }

  @override
  void dispose() {
    _node.onKeyEvent = null;
    _node.removeListener(_onFocusChange);
    // ← ONLY DISPOSE IF WE CREATED IT
    if (widget.externalController == null) {
      _ctrl.dispose();
    }
    super.dispose();
  }

  // Enter/Next moves focus straight to the next cell (see _handleKey), which
  // can land well outside the viewport in a long table — without this the
  // field would gain keyboard focus while sitting behind/above the visible
  // area. Mirrors HighlightBlock's scroll-into-view for simple fields.
  void _onFocusChange() {
    if (!_node.hasFocus) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Scrollable.ensureVisible(
          context,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
        );
      }
    });
  }

  KeyEventResult _handleKey(FocusNode n, KeyEvent e) {
    // ... existing key handling unchanged ...
    if (e is! KeyDownEvent) return KeyEventResult.ignored;

    final cells = widget.allCells;
    final rw = widget.rowWidth;
    if (cells == null || rw == null || rw <= 0) {
      return widget.focusManager.handleKey(n, e, gridId: widget.tableId);
    }

    final idx = cells.indexOf(widget.fieldId);
    if (idx < 0) {
      return widget.focusManager.handleKey(n, e, gridId: widget.tableId);
    }

    final kb = HardwareKeyboard.instance;
    final row = idx ~/ rw;
    final col = idx % rw;
    final totalRows = (cells.length / rw).ceil();

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
      if (col < rw - 1 && idx < cells.length - 1) {
        widget.focusManager.focus(cells[idx + 1]);
      } else if (row < totalRows - 1) {
        final nextRowStart = (row + 1) * rw;
        if (nextRowStart < cells.length) {
          widget.focusManager.focus(cells[nextRowStart]);
        } else {
          widget.onExitTable?.call();
        }
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
      if (col > 0) {
        widget.focusManager.focus(cells[idx - 1]);
      } else if (row > 0) {
        final prevRowEnd = row * rw - 1;
        widget.focusManager.focus(cells[prevRowEnd]);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      final nextIdx = (row + 1) * rw + col;
      if (nextIdx < cells.length) {
        widget.focusManager.focus(cells[nextIdx]);
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      final prevIdx = (row - 1) * rw + col;
      if (prevIdx >= 0) {
        widget.focusManager.focus(cells[prevIdx]);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter) ||
        kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      if (kb.isShiftPressed) {
        if (idx > 0) {
          widget.focusManager.focus(cells[idx - 1]);
        } else {
          widget.onExitPrevious?.call();
        }
      } else {
        if (idx < cells.length - 1) {
          widget.focusManager.focus(cells[idx + 1]);
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
          child: SizedBox(
            width: widget.width,
            height: widget.height,
            child: TextField(
              controller: _ctrl,
              focusNode: _node,
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.next,
              // See the matching comment in number_field.dart: Flutter's
              // default onTapOutside would unfocus (closing the keyboard)
              // on the touch that starts a scroll gesture when running as
              // mobile web. No-op keeps focus through scrolling, matching
              // native-app mobile behavior.
              onTapOutside: (_) {},
              textAlign: TextAlign.left,
              textAlignVertical: TextAlignVertical.center,
              style: GridTheme.dataStyle,
              decoration: InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 9),
                hintText: widget.hintText,
                hintStyle: const TextStyle(
                  fontSize: 13,
                  color: Color(0xFFCBD5E1),
                ),
              ),
              onChanged: widget.onChanged,
              onSubmitted: (_) => _handleKey(
                _node,
                const KeyDownEvent(
                  physicalKey: PhysicalKeyboardKey.enter,
                  logicalKey: LogicalKeyboardKey.enter,
                  timeStamp: Duration.zero,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
