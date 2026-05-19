import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'schema/navigation_engine.dart';
import 'schema/types.dart';

class UnifiedFocusManagerV2 extends ChangeNotifier {
  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  final Map<String, FocusNode> _nodes = {};

  String? _activeId;

  final NavigationEngine _engine;

  NavigationEngine get engine => _engine;

  UnifiedFocusManagerV2(this._engine);

  // ─────────────────────────────────────────────
  // NODE MANAGEMENT
  // ─────────────────────────────────────────────

  FocusNode node(String id) {
    return _nodes.putIfAbsent(id, () {
      final n = FocusNode(debugLabel: id);

      n.addListener(() {
        if (n.hasFocus) {
          _activeId = id;
          notifyListeners();
        }
      });

      return n;
    });
  }

  FocusNode getNode(String id) => node(id);

  String? get activeId => _activeId;

  // ─────────────────────────────────────────────
  // FOCUS CONTROL
  // ─────────────────────────────────────────────

  void focus(String id) {
    final nodeRef = node(id);
    _activeId = id;
    notifyListeners();

    if (nodeRef.context != null) {
      nodeRef.requestFocus();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_activeId == id && nodeRef.context != null) {
          nodeRef.requestFocus();
        }
      });
    }
  }

  void focusNext() {
    final current = _activeId;
    if (current == null) return;

    final next = _engine.next(current);
    if (next != null) focus(next);
  }

  void focusPrevious() {
    final current = _activeId;
    if (current == null) return;

    final prev = _engine.prev(current);
    if (prev != null) focus(prev);
  }

  void focusGridDirection(Direction direction) {
    final current = _activeId;
    if (current == null) return;

    final neighbor = _engine.gridNext(current, direction);
    if (neighbor != null) focus(neighbor);
  }

  void focusNextSection() {
    final current = _activeId;
    if (current == null) return;

    final target = _engine.jumpToNextSection(current);
    if (target != null) focus(target);
  }

  void focusPrevSection() {
    final current = _activeId;
    if (current == null) return;

    final target = _engine.jumpToPrevSection(current);
    if (target != null) focus(target);
  }

  // ─────────────────────────────────────────────
  // KEY HANDLING
  // ─────────────────────────────────────────────

  KeyEventResult handleKey(
    FocusNode focusNode,
    KeyEvent event, {
    String? gridId,
  }) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;

    final key = event.logicalKey;
    final isShift = HardwareKeyboard.instance.isShiftPressed;

    // Grid navigation
    if (gridId != null) {
      if (key == LogicalKeyboardKey.arrowUp) {
        focusGridDirection(Direction.up);
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.arrowDown) {
        focusGridDirection(Direction.down);
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.arrowLeft) {
        focusGridDirection(Direction.left);
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.arrowRight) {
        focusGridDirection(Direction.right);
        return KeyEventResult.handled;
      }
    }

    // Tab / Enter navigation
    if (key == LogicalKeyboardKey.tab || key == LogicalKeyboardKey.enter) {
      if (isShift) {
        focusPrevious();
      } else {
        focusNext();
      }
      return KeyEventResult.handled;
    }

    // Section navigation
    if (HardwareKeyboard.instance.isAltPressed) {
      if (key == LogicalKeyboardKey.arrowDown) {
        focusNextSection();
        return KeyEventResult.handled;
      }
      if (key == LogicalKeyboardKey.arrowUp) {
        focusPrevSection();
        return KeyEventResult.handled;
      }
    }

    return KeyEventResult.ignored;
  }

  // ─────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────

  @override
  void dispose() {
    for (final n in _nodes.values) {
      n.dispose();
    }
    _nodes.clear();
    _activeId = null;
    super.dispose();
  }
}
