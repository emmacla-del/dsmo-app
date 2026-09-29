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

/// User-typed table values, including explicit zeros. Absence means the
/// cell was never filled (missing), which is distinct from 0.
class TableEnteredScope extends InheritedWidget {
  final Map<String, int> values;
  const TableEnteredScope({
    super.key,
    required this.values,
    required super.child,
  });

  static Map<String, int>? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<TableEnteredScope>()?.values;

  @override
  bool updateShouldNotify(TableEnteredScope old) => !identical(old.values, values);
}

Widget buildGridCellWidget({
  required BuildContext context,
  required String cellId,
  required CellSpec? cs,
  required bool isTotalRow,
  required bool isGrandTotal,
  required GridRenderSpec spec,
  required Map<String, int> numberValues,
  required Map<String, String> textValues,
  required Function(String, int?) onNumberChanged,
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
  // Simple Mode's Enterprise/Cooperative/CTD/ONG table cards only (see
  // table_renderer.dart's own `polished` doc comment for where this is
  // computed/threaded from) — swaps typography for the Wizard-matched
  // GridTheme.polished* styles below. Every other caller (Spreadsheet
  // Mode, every other entity) omits this and keeps the plain GridTheme
  // styles, unchanged.
  bool polished = false,
}) {
  final type = cs?.type ?? CellType.number;
  final editable = cs?.editable ?? false;
  final hint = cs?.hint;
  final options = cs?.options ?? [];
  final w = width ?? GridTheme.colWidth;
  final h = height ?? (GridTheme.rowHeight - 2);
  final dataStyle = polished ? GridTheme.polishedDataStyle : GridTheme.dataStyle;
  final labelStyle = polished ? GridTheme.polishedLabelStyle : GridTheme.labelStyle;
  final totalStyle = polished ? GridTheme.polishedTotalStyle : GridTheme.totalStyle;
  final grandTotalStyle =
      polished ? GridTheme.polishedGrandTotalStyle : GridTheme.grandTotalStyle;

  switch (type) {
    case CellType.number:
      if (!editable) {
        final v = numberValues[cellId] ?? 0;
        return Padding(
          padding: GridTheme.cellPadding,
          child: Text(
            v == 0 ? '—' : '$v',
            style: isGrandTotal ? grandTotalStyle : totalStyle,
            textAlign: TextAlign.center,
          ),
        );
      }
      final entered = TableEnteredScope.maybeOf(context);
      final int? enteredValue = entered != null
          ? (entered.containsKey(cellId) ? entered[cellId] : null)
          : (numberValues.containsKey(cellId) ? numberValues[cellId] : null);
      return NumberField(
        fieldId: cellId,
        value: enteredValue,
        onChanged: onNumberChanged,
        focusManager: focusManager,
        tableId: tableId,
        width: w,
        height: h,
        allCells: allCells,
        rowWidth: rowWidth,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        polished: polished,
      );

    case CellType.text:
      final value = spec.textValue?.call(cellId) ?? textValues[cellId] ?? '';
      if (!editable) {
        return Padding(
          padding: GridTheme.cellPadding,
          child: Text(value, style: dataStyle),
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
        polished: polished,
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
        style: dataStyle,
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
        style: dataStyle,
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
          style: isGrandTotal ? grandTotalStyle : totalStyle,
          textAlign: TextAlign.center,
        ),
      );

    case CellType.label:
      return Padding(
        padding: GridTheme.labelCellPadding,
        child: Text(cs?.label ?? '', style: labelStyle),
      );
  }
}

Widget _dropdownCell({
  required String cellId,
  required String currentValue,
  required List<String> options,
  required ValueChanged<String> onChanged,
  required TextStyle style,
}) {
  return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 4),
    child: DropdownButton<String>(
      value: currentValue.isEmpty ? null : currentValue,
      hint: const Text('—', style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
      isExpanded: true,
      underline: const SizedBox(),
      style: style,
      iconSize: 14,
      items: options
          .map((o) => DropdownMenuItem(
                value: o,
                child: Text(o, style: style, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    ),
  );
}
