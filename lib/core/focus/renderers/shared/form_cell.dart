// lib/core/focus/renderers/shared/form_cell.dart
//
// Unified cell dispatcher used by schema_renderer and other callers
// that need a single widget entry-point for number / text / readOnly cells.
//
// All callback signatures match NumberField and TextFieldCell exactly:
//   NumberField  : onChanged(String fieldId, int  value)
//   TextFieldCell: onChanged(String fieldId, String value)

import 'package:flutter/material.dart';
import 'number_field.dart';
import 'text_field.dart';
import '../../unified_focus_manager_v2.dart';
import '../onefop_layout_constants.dart';

enum FormCellType { number, text, readOnly }

class FormCell extends StatelessWidget {
  final String id;
  final FormCellType type;
  final dynamic value;

  // Typed callbacks — callers must supply the correct variant.
  // Only one of these is used, determined by [type].
  final void Function(String fieldId, int value)? onNumberChanged;
  final void Function(String fieldId, String value)? onTextChanged;

  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final double width;
  final double height;
  final String? hintText;

  // Navigation grid — required for NumberField / TextFieldCell
  final List<String> allCells;
  final int rowWidth;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const FormCell({
    super.key,
    required this.id,
    required this.type,
    required this.value,
    this.onNumberChanged,
    this.onTextChanged,
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
  Widget build(BuildContext context) {
    switch (type) {
      // ── Numeric input ──────────────────────────────────────
      case FormCellType.number:
        return NumberField(
          fieldId: id,
          value: value is int ? value as int : 0,
          onChanged: onNumberChanged ?? (_, __) {},
          focusManager: focusManager,
          tableId: tableId,
          width: width,
          height: height,
          allCells: allCells,
          rowWidth: rowWidth,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
        );

      // ── Text input ─────────────────────────────────────────
      case FormCellType.text:
        return TextFieldCell(
          fieldId: id,
          value: value is String ? value as String : '',
          onChanged: onTextChanged ?? (_, __) {},
          focusManager: focusManager,
          tableId: tableId,
          width: width,
          height: height,
          hintText: hintText,
          allCells: allCells,
          rowWidth: rowWidth,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
        );

      // ── Read-only computed cell ────────────────────────────
      case FormCellType.readOnly:
        final display = value?.toString() ?? '';
        return Container(
          width: width,
          height: height,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: OL.inputCellBgTotal,
            border: Border(
              top: BorderSide(color: OL.borderColor, width: OL.borderWidth),
              left: BorderSide(color: OL.borderColor, width: OL.borderWidth),
              right: BorderSide(color: OL.borderColor, width: OL.borderWidth),
              bottom: BorderSide(color: OL.borderColor, width: OL.borderWidth),
            ),
          ),
          padding: const EdgeInsets.symmetric(
              horizontal: OL.cellPadH, vertical: OL.cellPadV),
          child: Text(
            display.isEmpty || display == '0' ? '—' : display,
            style: const TextStyle(
              fontSize: OL.tdFontSize,
              fontWeight: FontWeight.w700,
              color: Color(0xFF000000),
            ),
            textAlign: TextAlign.center,
          ),
        );
    }
  }
}
