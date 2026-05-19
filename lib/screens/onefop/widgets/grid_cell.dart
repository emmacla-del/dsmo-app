// lib/screens/onefop/widgets/grid_cell.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/focus/renderers/grid_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// EDITABLE CELL
// ─────────────────────────────────────────────────────────────────────────────

class GridEditCell extends StatefulWidget {
  final int value;
  final ValueChanged<int> onChanged;
  final FocusNode? focusNode;
  final String? cellId;
  final Color? backgroundColor;

  const GridEditCell({
    super.key,
    required this.value,
    required this.onChanged,
    this.focusNode,
    this.cellId,
    this.backgroundColor,
  });

  @override
  State<GridEditCell> createState() => _GridEditCellState();
}

class _GridEditCellState extends State<GridEditCell> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  bool _owned = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _displayValue(widget.value));

    if (widget.focusNode != null) {
      _focusNode = widget.focusNode!;
    } else {
      _focusNode = FocusNode();
      _owned = true;
    }
  }

  @override
  void didUpdateWidget(GridEditCell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && !_focusNode.hasFocus) {
      _controller.text = _displayValue(widget.value);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    if (_owned) _focusNode.dispose();
    super.dispose();
  }

  String _displayValue(int v) => v == 0 ? '' : v.toString();

  void _commit() {
    final value = int.tryParse(_controller.text) ?? 0;
    if (value != widget.value) widget.onChanged(value);
    if (value == 0 && _controller.text.isNotEmpty) _controller.text = '';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: widget.backgroundColor ?? GridTheme.inputBg,
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: GridTheme.dataStyle,
        decoration: const InputDecoration(
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          isDense: true,
          contentPadding: EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        ),
        onChanged: (text) {
          final value = int.tryParse(text) ?? 0;
          widget.onChanged(value);
        },
        onSubmitted: (_) => _commit(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ-ONLY CELL (TOTALS)
// ─────────────────────────────────────────────────────────────────────────────

class GridReadCell extends StatelessWidget {
  final int value;
  final bool totalRow;
  final Color? backgroundColor;

  const GridReadCell({
    super.key,
    required this.value,
    this.totalRow = false,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      color: backgroundColor ??
          (totalRow ? GridTheme.totalBg : GridTheme.readOnlyBg),
      child: Text(
        value == 0 ? '' : value.toString(),
        style: totalRow ? GridTheme.totalStyle : GridTheme.dataStyle,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER CELL
// ─────────────────────────────────────────────────────────────────────────────

class GridHeaderCell extends StatelessWidget {
  final String text;
  final bool isSubHeader;
  final bool isTotalGroup;
  final Color? backgroundColor;

  const GridHeaderCell({
    super.key,
    required this.text,
    this.isSubHeader = false,
    this.isTotalGroup = false,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      padding: GridTheme.headerCellPadding,
      color: backgroundColor ?? GridTheme.headerBg,
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: isSubHeader ? GridTheme.labelStyle : GridTheme.headerStyle,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL CELL (Row Headers)
// ─────────────────────────────────────────────────────────────────────────────

class GridLabelCell extends StatelessWidget {
  final String text;
  final bool totalRow;
  final bool indent;
  final Color? backgroundColor;

  const GridLabelCell({
    super.key,
    required this.text,
    this.totalRow = false,
    this.indent = false,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerLeft,
      padding: EdgeInsets.only(
        left: indent ? 20 : 12,
        right: 12,
        top: 8,
        bottom: 8,
      ),
      color: backgroundColor ?? (totalRow ? GridTheme.totalBg : Colors.white),
      child: Text(
        text,
        style: totalRow ? GridTheme.totalStyle : GridTheme.labelStyle,
      ),
    );
  }
}
