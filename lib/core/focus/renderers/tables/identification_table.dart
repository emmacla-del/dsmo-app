import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../schema/field_schema.dart';
import '../../schema/grid_schema.dart';
import '../../unified_focus_manager_v2.dart';

class IdentificationTable extends StatefulWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final List<FieldSchema> childFields;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const IdentificationTable({
    super.key,
    required this.field,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
    required this.focusManager,
    required this.tableId,
    this.childFields = const [],
    this.onExitTable,
    this.onExitPrevious,
  });

  static GridSchema buildGridSchema({
    required String tableId,
    required List<String> inputFieldIds,
  }) {
    return GridSchema(
      id: tableId,
      matrix: inputFieldIds.map((id) => [id]).toList(),
    );
  }

  @override
  State<IdentificationTable> createState() => _IdentificationTableState();
}

class _IdentificationTableState extends State<IdentificationTable> {
  final Map<String, TextEditingController> _controllers = {};

  static const double _labelColWidth = 200.0;
  static const double _inputColWidth = 340.0;
  static const double _rowHeight = 44.0;
  static const double _headerHeight = 36.0;

  @override
  void initState() {
    super.initState();
    _initControllers();
    _registerFocusHandlers();
  }

  @override
  void didUpdateWidget(IdentificationTable oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.childFields != widget.childFields) {
      _disposeControllers();
      _initControllers();
      _registerFocusHandlers();
      return;
    }

    for (final field in widget.childFields) {
      final ctrl = _controllers[field.id];
      if (ctrl == null) continue;
      final ext = _externalValue(field);
      if (ctrl.text != ext) {
        final sel = ctrl.selection;
        ctrl.text = ext;
        if (sel.isValid && sel.end <= ext.length) ctrl.selection = sel;
      }
    }
  }

  @override
  void dispose() {
    _disposeControllers();
    for (final field in widget.childFields) {
      widget.focusManager.node(field.id).onKeyEvent = null;
    }
    super.dispose();
  }

  void _initControllers() {
    for (final field in widget.childFields) {
      _controllers[field.id] = TextEditingController(
        text: _externalValue(field),
      );
    }
  }

  void _disposeControllers() {
    for (final ctrl in _controllers.values) {
      ctrl.dispose();
    }
    _controllers.clear();
  }

  void _registerFocusHandlers() {
    for (int i = 0; i < widget.childFields.length; i++) {
      final field = widget.childFields[i];
      final node = widget.focusManager.node(field.id);
      node.onKeyEvent = (n, event) => _handleKey(n, event, i);
    }
  }

  KeyEventResult _handleKey(FocusNode n, KeyEvent event, int index) {
    if (event is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      if (index < widget.childFields.length - 1) {
        widget.focusManager.focus(widget.childFields[index + 1].id);
      } else {
        widget.onExitTable?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      if (index > 0) {
        widget.focusManager.focus(widget.childFields[index - 1].id);
      } else {
        widget.onExitPrevious?.call();
      }
      return KeyEventResult.handled;
    }

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter) ||
        kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      if (kb.isShiftPressed) {
        if (index > 0) {
          widget.focusManager.focus(widget.childFields[index - 1].id);
        } else {
          widget.onExitPrevious?.call();
        }
      } else {
        if (index < widget.childFields.length - 1) {
          widget.focusManager.focus(widget.childFields[index + 1].id);
        } else {
          widget.onExitTable?.call();
        }
      }
      return KeyEventResult.handled;
    }

    return widget.focusManager.handleKey(n, event, gridId: widget.tableId);
  }

  String _externalValue(FieldSchema field) {
    if (field.type == 'number') {
      final v = widget.numberValues[field.id] ?? 0;
      return v == 0 ? '' : v.toString();
    }
    return widget.textValues[field.id] ?? '';
  }

  void _onChanged(FieldSchema field, String value) {
    if (field.type == 'number') {
      widget.onNumberChanged(field.id, int.tryParse(value) ?? 0);
    } else {
      widget.onTextChanged(field.id, value);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.childFields.isEmpty) return const SizedBox.shrink();

    const totalWidth = _labelColWidth + _inputColWidth;
    final totalHeight = _headerHeight + widget.childFields.length * _rowHeight;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SizedBox(
        width: totalWidth,
        height: totalHeight,
        child: Stack(
          children: [
            _buildHeaderCell(
              left: 0,
              width: _labelColWidth,
              label: 'Champ',
              addLeftBorder: true,
            ),
            _buildHeaderCell(
              left: _labelColWidth,
              width: _inputColWidth,
              label: 'Valeur',
              addLeftBorder: false,
            ),
            for (int i = 0; i < widget.childFields.length; i++) ...[
              _buildLabelCell(
                field: widget.childFields[i],
                top: _headerHeight + i * _rowHeight,
                rowIndex: i,
              ),
              _buildInputCell(
                field: widget.childFields[i],
                top: _headerHeight + i * _rowHeight,
                rowIndex: i,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderCell({
    required double left,
    required double width,
    required String label,
    required bool addLeftBorder,
  }) {
    return Positioned(
      left: left,
      top: 0,
      width: width,
      height: _headerHeight,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFD9D9D9),
          border: Border(
            top: const BorderSide(color: Colors.black, width: 1),
            left: addLeftBorder
                ? const BorderSide(color: Colors.black, width: 1)
                : BorderSide.none,
            right: const BorderSide(color: Colors.black, width: 1),
            bottom: const BorderSide(color: Colors.black, width: 1),
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _buildLabelCell({
    required FieldSchema field,
    required double top,
    required int rowIndex,
  }) {
    final bg =
        rowIndex.isEven ? const Color(0xFFF5F5F5) : const Color(0xFFFFFFFF);

    return Positioned(
      left: 0,
      top: top,
      width: _labelColWidth,
      height: _rowHeight,
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          border: const Border(
            left: BorderSide(color: Colors.black, width: 1),
            right: BorderSide(color: Colors.black, width: 1),
            bottom: BorderSide(color: Colors.black, width: 1),
          ),
        ),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            Expanded(
              child: Text(
                field.label ?? field.id,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 2,
              ),
            ),
            if (field.required == true)
              Text(
                '*',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.red.shade600,
                  fontWeight: FontWeight.bold,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputCell({
    required FieldSchema field,
    required double top,
    required int rowIndex,
  }) {
    final bg =
        rowIndex.isEven ? const Color(0xFFFFFFFF) : const Color(0xFFFAFAFA);

    return Positioned(
      left: _labelColWidth,
      top: top,
      width: _inputColWidth,
      height: _rowHeight,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(
            right: BorderSide(color: Colors.black, width: 1),
            bottom: BorderSide(color: Colors.black, width: 1),
          ),
        ),
        child: _buildInput(field, bg),
      ),
    );
  }

  Widget _buildInput(FieldSchema field, Color bgColor) {
    switch (field.type) {
      case 'radio':
        return _buildRadioInput(field, bgColor);
      case 'select':
        return _buildSelectInput(field, bgColor);
      case 'number':
        return _buildTextInput(
          field: field,
          bgColor: bgColor,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        );
      default:
        return _buildTextInput(field: field, bgColor: bgColor);
    }
  }

  Widget _buildTextInput({
    required FieldSchema field,
    required Color bgColor,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters,
  }) {
    final focusNode = widget.focusManager.node(field.id);
    final ctrl = _controllers[field.id]!;

    return AnimatedBuilder(
      animation: focusNode,
      builder: (context, _) {
        final isFocused = focusNode.hasFocus;
        return TextFormField(
          key: ValueKey(field.id),
          controller: ctrl,
          focusNode: focusNode,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters,
          decoration: InputDecoration(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.zero,
              borderSide: BorderSide(
                color: Colors.blue.shade500,
                width: 2,
              ),
            ),
            hintText: field.hint ?? _defaultHint(field),
            hintStyle: TextStyle(
              color: Colors.grey.shade400,
              fontSize: 12,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 0,
            ),
            isDense: true,
            filled: true,
            fillColor: isFocused ? Colors.blue.shade50 : bgColor,
          ),
          style: const TextStyle(fontSize: 13, color: Colors.black87),
          onChanged: (v) => _onChanged(field, v),
          onFieldSubmitted: (_) => _handleKey(
            focusNode,
            const KeyDownEvent(
              physicalKey: PhysicalKeyboardKey.enter,
              logicalKey: LogicalKeyboardKey.enter,
              timeStamp: Duration.zero,
            ),
            widget.childFields.indexOf(field),
          ),
        );
      },
    );
  }

  Widget _buildSelectInput(FieldSchema field, Color bgColor) {
    final options = field.options ?? [];
    final current = widget.textValues[field.id] ?? '';
    final focusNode = widget.focusManager.node(field.id);

    return AnimatedBuilder(
      animation: focusNode,
      builder: (context, _) {
        final isFocused = focusNode.hasFocus;
        return Container(
          color: isFocused ? Colors.blue.shade50 : bgColor,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: current.isEmpty ? null : current,
              hint: Text(
                _defaultHint(field),
                style: TextStyle(
                  color: Colors.grey.shade400,
                  fontSize: 12,
                ),
              ),
              isExpanded: true,
              isDense: true,
              icon: Icon(
                Icons.keyboard_arrow_down,
                size: 16,
                color: Colors.grey.shade500,
              ),
              style: const TextStyle(fontSize: 13, color: Colors.black87),
              items: options
                  .map((opt) => DropdownMenuItem(
                        value: opt,
                        child: Text(opt),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v != null) {
                  widget.onTextChanged(field.id, v);
                  widget.focusManager.focusNext();
                }
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildRadioInput(FieldSchema field, Color bgColor) {
    final options = field.options ?? [];
    final current = widget.textValues[field.id] ?? '';
    final focusNode = widget.focusManager.node(field.id);

    return AnimatedBuilder(
      animation: focusNode,
      builder: (context, _) {
        final isFocused = focusNode.hasFocus;
        return Container(
          color: isFocused ? Colors.blue.shade50 : bgColor,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Row(
            children: options.map((opt) {
              final selected = current == opt;
              return Padding(
                padding: const EdgeInsets.only(right: 12),
                child: GestureDetector(
                  onTap: () {
                    widget.onTextChanged(field.id, opt);
                    widget.focusManager.focusNext();
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        selected
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        size: 15,
                        color: selected
                            ? Colors.blue.shade600
                            : Colors.grey.shade400,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        opt,
                        style: TextStyle(
                          fontSize: 12,
                          color: selected
                              ? Colors.blue.shade700
                              : Colors.grey.shade700,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }

  String _defaultHint(FieldSchema field) {
    switch (field.type) {
      case 'number':
        return '0';
      case 'select':
        return 'Choisir...';
      default:
        return field.hint ?? 'Saisir...';
    }
  }
}
