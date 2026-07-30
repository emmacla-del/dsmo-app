// lib/core/focus/renderers/shared/grid_cell_dispatch.dart
//
// ══════════════════════════════════════════════════════════════
// GRID CELL DISPATCH — shared cell-widget builder
//
// Extracted from GenericSpreadsheetTable so both the desktop
// spreadsheet grid and the mobile card-per-row table can build
// the exact same cell widgets (number/text/radio/select/readOnly/
// label) from a GridRenderSpec, just with different width/height.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../unified_focus_manager_v2.dart';
import '../grid_render_spec.dart';
import '../grid_theme.dart';
import 'number_field.dart';
import 'text_field.dart';

Widget buildGridCellWidget({
  required String cellId,
  required CellSpec? cs,
  required bool isTotalRow,
  required bool isGrandTotal,
  required GridRenderSpec spec,
  required Map<String, int> numberValues,
  required Map<String, String> textValues,
  required Function(String, int) onNumberChanged,
  required Function(String, String) onTextChanged,
  required UnifiedFocusManagerV2 focusManager,
  required String tableId,
  required List<String> allCells,
  required int rowWidth,
  VoidCallback? onExitTable,
  VoidCallback? onExitPrevious,
  TextEditingController Function(String)? hybridController,
  double? width,
  double? height,
}) {
  final type = cs?.type ?? CellType.number;
  final editable = cs?.editable ?? false;
  final hint = cs?.hint;
  final options = cs?.options ?? [];
  final w = width ?? GridTheme.colWidth;
  final h = height ?? (GridTheme.rowHeight - 2);

  switch (type) {
    case CellType.number:
      if (!editable) {
        final v = numberValues[cellId] ?? 0;
        return Padding(
          padding: GridTheme.cellPadding,
          child: Text(
            v == 0 ? '—' : '$v',
            style: isGrandTotal ? GridTheme.grandTotalStyle : GridTheme.totalStyle,
            textAlign: TextAlign.center,
          ),
        );
      }
      return NumberField(
        fieldId: cellId,
        value: numberValues[cellId] ?? 0,
        onChanged: onNumberChanged,
        focusManager: focusManager,
        tableId: tableId,
        width: w,
        height: h,
        allCells: allCells,
        rowWidth: rowWidth,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
      );

    case CellType.text:
      final value = spec.textValue?.call(cellId) ?? textValues[cellId] ?? '';
      if (!editable) {
        return Padding(
          padding: GridTheme.cellPadding,
          child: Text(value, style: GridTheme.dataStyle),
        );
      }
      final hc = hybridController;
      final externalCtrl = hc != null ? hc(cellId) : null;
      return FormTextField(
        fieldId: cellId,
        value: externalCtrl?.text ?? value,
        onChanged: (v) {
          onTextChanged(cellId, v);
          spec.onTextChanged?.call(cellId, v);
        },
        focusManager: focusManager,
        tableId: tableId,
        width: w,
        height: h,
        hintText: hint,
        allCells: allCells,
        rowWidth: rowWidth,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        externalController: externalCtrl,
      );

    case CellType.radio:
      final currentValue = spec.radioValue?.call(cellId) ??
          spec.textValue?.call(cellId) ??
          textValues[cellId] ??
          '';
      if (options.isEmpty) return const SizedBox.shrink();
      return _dropdownCell(
        cellId: cellId,
        currentValue: currentValue,
        options: options,
        onChanged: (v) {
          spec.onRadioChanged?.call(cellId, v);
          spec.onTextChanged?.call(cellId, v);
          onTextChanged(cellId, v);
        },
      );

    case CellType.select:
      final currentValue = spec.selectedValue?.call(cellId) ??
          spec.textValue?.call(cellId) ??
          textValues[cellId] ??
          '';
      if (options.isEmpty) return const SizedBox.shrink();
      return _dropdownCell(
        cellId: cellId,
        currentValue: currentValue,
        options: options,
        onChanged: (v) {
          spec.onSelectChanged?.call(cellId, v);
          spec.onTextChanged?.call(cellId, v);
          onTextChanged(cellId, v);
        },
      );

    case CellType.readOnly:
      final v = numberValues[cellId] ?? 0;
      return Padding(
        padding: GridTheme.cellPadding,
        child: Text(
          v == 0 ? '—' : '$v',
          style: isGrandTotal ? GridTheme.grandTotalStyle : GridTheme.totalStyle,
          textAlign: TextAlign.center,
        ),
      );

    case CellType.label:
      return Padding(
        padding: GridTheme.labelCellPadding,
        child: Text(cs?.label ?? '', style: GridTheme.labelStyle),
      );
  }
}

Widget _dropdownCell({
  required String cellId,
  required String currentValue,
  required List<String> options,
  required ValueChanged<String> onChanged,
}) {
  return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 4),
    child: DropdownButton<String>(
      value: currentValue.isEmpty ? null : currentValue,
      hint: const Text('—', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
      isExpanded: true,
      underline: const SizedBox(),
      style: GridTheme.dataStyle,
      iconSize: 14,
      items: options
          .map((o) => DropdownMenuItem(
                value: o,
                child: Text(o, style: GridTheme.dataStyle, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    ),
  );
}
