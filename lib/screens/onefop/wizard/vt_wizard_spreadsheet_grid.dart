// lib/screens/onefop/wizard/vt_wizard_spreadsheet_grid.dart
//
// VT WIZARD "Mode Tableur" — the wizard's own spreadsheet grid, pixel-matched
// against Figma's "excel-grid" node (row-number column, zebra-striped rows,
// a per-row completion checkmark, a Σ TOTAL footer), NOT the shared
// VtSpreadsheetTable used by Excel/Simple Mode in core/focus/renderers/
// vt_spreadsheet_table.dart.
//
// Why a second, near-identical grid widget? VtSpreadsheetTable deliberately
// renders the barest possible chrome (no paperCode/title row, no card border,
// no header fill) because ExcelShellBody already pins the table's header
// above the scroll for every table — a VT table would otherwise read as a
// boxed SaaS-style card floating on an otherwise flat spreadsheet page (see
// vt_spreadsheet_table.dart's own header comment). VtWizardSpreadsheetGrid has
// different parent chrome: _VtWizardTableauCard already draws the paperCode +
// title via VtWizardGuidedHeaderBox, so this widget owns the grid-specific
// Figma details instead: a row-number column in the label slot, alternating
// zebra row fills (Excel-shell's grid deliberately uses flat white), a green
// checkmark on filled rows, and a Σ TOTAL footer row summing each numeric
// column.
//
// Same data model, same read/write plumbing as VtRowEditor/VtSpreadsheetTable
// — VtTableDef/VtRowDef/VtCellDef, ctrl.data/onGridCellChanged/setRawValue,
// hybridController/gridNumberController, vtRowLabel/vtCellVisible/vtRowFilled/
// vtVisibleRows/vtRowStatus (all shared, not duplicated) — only the layout
// chrome changes.
//
// Rendered through GridLayoutEngine (grid_layout_engine.dart) — the same
// engine every other desktop table uses — so gridlines match exactly; wrapped
// in GridHorizontalScrollTable (grid_horizontal_scroll.dart) for the wide
// tables (4.8/4.9's 3-flow x 3-column layout) the same way VtSpreadsheetTable
// does.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/focus/renderers/grid_horizontal_scroll.dart';
import '../../../core/focus/renderers/grid_layout_engine.dart';
import '../../../core/focus/renderers/grid_theme.dart';
import '../../../core/focus/renderers/onefop_layout_constants.dart';
import '../../../core/focus/renderers/vt_row_editor.dart';
import '../../../core/i18n/localized_text.dart';
import '../onefop_form_constants.dart'
    show kSurface, kFieldFill, kAccent, kAccentSoft;
import '../onefop_form_controller.dart';
import 'vt_wizard_constants.dart';
import '../onefop_form_widgets.dart' show RadioOption;

const _vtWizardMonoStyle = TextStyle(
  fontFamily: kVtWizardFontFamily,
  fontFamilyFallback: ['Courier New', 'monospace'],
);

/// VT Wizard's spreadsheet grid — Mode Tableur rendering of a [VtTableDef].
///
/// Pixel-matched against Figma's "excel-grid" node. Unlike
/// [VtSpreadsheetTable] (which lives in core/focus/renderers and is the
/// flat Excel-shell grid), this widget is wizard-only chrome:
///  - a row-number column in the leading label slot,
///  - alternating zebra row fills,
///  - a green checkmark on each filled row's leading cell,
///  - a right-aligned Σ TOTAL footer summing each numeric column.
class VtWizardSpreadsheetGrid extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardSpreadsheetGrid({super.key, required this.ctrl, required this.def});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (context, _, __) => _VtWizardSpreadsheetGridBody(ctrl: ctrl, def: def),
    );
  }
}

class _VtWizardSpreadsheetGridBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const _VtWizardSpreadsheetGridBody({required this.ctrl, required this.def});

  static const double _rowLabelColW = 220;
  static const double _rowNumberColW = 56;
  static const double _numColW = 100;
  static const double _textColW = 200;
  static const double _boolColW = 160;
  static const double _computedColW = 120;
  static const _cellPad = EdgeInsets.symmetric(horizontal: 8, vertical: 6);

  double _colWidth(VtCellDef c, Locale locale) {
    switch (c.kind) {
      case VtCellKind.number:
        return _numColW;
      case VtCellKind.text:
        return _textColW;
      case VtCellKind.boolean:
        return _boolColW;
      case VtCellKind.computed:
        return _computedColW;
      case VtCellKind.radioCode:
        final maxLen = (c.options ?? const <VtOption>[])
            .map((o) => o.label.of(locale).length)
            .fold(0, (a, b) => a > b ? a : b);
        if (maxLen > 25) return 320;
        if (maxLen > 12) return 200;
        return 150;
    }
  }

  double _measureHeight(String text, double maxWidth, TextStyle style, TextScaler scaler) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: null,
      textScaler: scaler,
    )..layout(maxWidth: maxWidth > 0 ? maxWidth : 0);
    return tp.height;
  }

  bool _isEmpty(VtCellDef c, String id) {
    switch (c.kind) {
      case VtCellKind.number:
      case VtCellKind.radioCode:
        final v = ctrl.data[id];
        return v == null || v == 0;
      case VtCellKind.text:
        return (ctrl.data[id]?.toString().trim().isEmpty) ?? true;
      case VtCellKind.boolean:
        final decoded =
            c.decodeBoolean != null ? c.decodeBoolean!(ctrl.data[id]) : ctrl.data[id] as bool?;
        return decoded == null;
      case VtCellKind.computed:
        return false;
    }
  }

  bool _rowComplete(VtRowDef row) => vtRowStatus(ctrl, def, row) == VtRowStatus.complete;

  Widget _withErrorBorder(Widget child, bool hasError) {
    if (!hasError) return child;
    return Container(
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: kVtWizardRed, width: 2)),
      ),
      child: child,
    );
  }

  Widget _numberCell(String id) {
    return TextField(
      controller: ctrl.gridNumberController(id),
      focusNode: ctrl.fm.getNode(id),
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      style: _vtWizardMonoStyle.copyWith(fontSize: 13, color: kVtWizardInk),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: _cellPad,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
      onTapOutside: (_) => ctrl.onBlur(id),
    );
  }

  Widget _textCell(String id) {
    return TextField(
      controller: ctrl.hybridController(id),
      focusNode: ctrl.fm.getNode(id),
      style: TextStyle(fontSize: 13, color: kVtWizardInk, fontFamily: kVtWizardFontFamily),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: _cellPad,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
      onTapOutside: (_) => ctrl.onBlur(id),
    );
  }

  Widget _boolCell(String id, VtCellDef c, Locale locale) {
    final decoded =
        c.decodeBoolean != null ? c.decodeBoolean!(ctrl.data[id]) : ctrl.data[id] as bool?;
    return Container(
      color: kSurface,
      alignment: Alignment.center,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          RadioOption(
            label: const LocalizedText(fr: 'Oui', en: 'Yes').of(locale),
            isSelected: decoded == true,
            onTap: () {
              final stored = c.encodeBoolean != null ? c.encodeBoolean!(true) : true;
              ctrl.setRawValue(id, stored);
            },
          ),
          const SizedBox(width: 12),
          RadioOption(
            label: const LocalizedText(fr: 'Non', en: 'No').of(locale),
            isSelected: decoded == false,
            onTap: () {
              final stored = c.encodeBoolean != null ? c.encodeBoolean!(false) : false;
              ctrl.setRawValue(id, stored);
            },
          ),
        ],
      ),
    );
  }

  Widget _radioCell(String id, VtCellDef c, Locale locale) {
    final opts = c.options ?? const <VtOption>[];
    final cur = ctrl.data[id] as String?;
    return Container(
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: opts.any((o) => o.value == cur) ? cur : null,
          isExpanded: true,
          isDense: true,
          hint: const Text('—', style: TextStyle(fontSize: 12.5, color: kVtWizardInkFaint)),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: kVtWizardInkFaint),
          style: const TextStyle(fontSize: 12.5, color: kVtWizardInk),
          items: [
            for (final o in opts)
              DropdownMenuItem(
                value: o.value,
                child: Text('${o.code} — ${o.label.of(locale)}', overflow: TextOverflow.ellipsis),
              ),
          ],
          onChanged: (v) {
            if (v != null) ctrl.setRawValue(id, v);
          },
        ),
      ),
    );
  }

  Widget _computedCell(VtCellDef c, VtRowDef row) {
    final v = c.computeValue!(row.id, ctrl.data);
    return Container(
      color: kAccentSoft,
      alignment: Alignment.center,
      child: Text('$v',
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kAccent)),
    );
  }

  Widget _naCell() => Container(color: kFieldFill);

  Widget _dataCell(VtRowDef row, VtCellDef c, Locale locale) {
    final id = def.cellId(row, c);
    if (c.kind == VtCellKind.computed) return _computedCell(c, row);
    if (!vtCellVisible(ctrl, def, row, c)) return _naCell();

    final hasError = c.required && _isEmpty(c, id);
    final input = switch (c.kind) {
      VtCellKind.number => _numberCell(id),
      VtCellKind.text => _textCell(id),
      VtCellKind.boolean => _boolCell(id, c, locale),
      VtCellKind.radioCode => _radioCell(id, c, locale),
      VtCellKind.computed =>
          throw StateError('computed cells are handled above, before visibility is checked'),
    };
    return _withErrorBorder(input, hasError);
  }

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final textScaler = MediaQuery.textScalerOf(context);
    final rows = vtVisibleRows(ctrl, def);
    final filledCount = def.rows.where((r) => vtRowFilled(ctrl, def, r)).length;

    final colWidths = [_rowNumberColW, _rowLabelColW, for (final c in def.cells) _colWidth(c, locale)];
    const maxLabelTextW = _rowLabelColW - 24;

    final headerHeight = def.cells.fold<double>(GridTheme.rowHeight * 1.6, (h, c) {
      final w = _colWidth(c, locale) - 16;
      return [h, _measureHeight(c.label.of(locale), w, GridTheme.headerStyle, textScaler) + 12]
          .reduce((a, b) => a > b ? a : b);
    });

    final rowHeights = <double>[
      headerHeight,
      for (final row in rows)
        () {
          final label = vtRowLabel(ctrl, row, locale);
          final text = label.isEmpty ? '${rows.indexOf(row) + 1}' : label;
          final h = _measureHeight(text, maxLabelTextW, GridTheme.labelStyle, textScaler) + 8;
          return h > GridTheme.rowHeight ? h.ceilToDouble() : GridTheme.rowHeight;
        }(),
    ];

    final cells = <GridCell>[
      // Row 0: header row (row-number column + blank, then cell headers)
      const GridCell(
        id: 'h_rownum',
        row: 0,
        col: 0,
        backgroundColor: kAccent,
        child: SizedBox.shrink(),
      ),
      GridCell(
        id: 'h_lbl',
        row: 0,
        col: 1,
        backgroundColor: kAccent,
        child: SizedBox.shrink(),
      ),
      for (final entry in def.cells.asMap().entries)
        GridCell(
          id: 'h_${entry.value.key}',
          row: 0,
          col: entry.key + 2,
          backgroundColor: kAccent,
          child: Padding(
            padding: GridTheme.headerCellPadding,
            child: Text(
              entry.value.label.of(locale),
              textAlign: TextAlign.center,
              style: GridTheme.polishedHeaderStyle,
            ),
          ),
        ),
      // Row 0: Σ TOTAL footer row (numeric columns summed)
    ];

    // Σ TOTAL footer calculation
    for (final entry in def.cells.asMap().entries) {
      final c = entry.value;
      double total = 0;
      bool hasAny = false;
      if (c.kind == VtCellKind.number) {
        for (final row in rows) {
          final v = ctrl.data[def.cellId(row, c)];
          if (v is num) {
            total += v.toDouble();
            hasAny = true;
          }
        }
        cells.add(GridCell(
          id: 'total_${c.key}',
          row: rows.length + 1,
          col: entry.key + 2,
          backgroundColor: kAccentSoft,
          alignment: Alignment.center,
          child: Padding(
            padding: GridTheme.cellPadding,
            child: Text(
              hasAny ? total.truncateToDouble() == total ? '${total.toInt()}' : '$total' : '',
              textAlign: TextAlign.center,
              style: GridTheme.polishedTotalStyle,
            ),
          ),
        ));
      } else {
        cells.add(GridCell(
          id: 'total_${c.key}',
          row: rows.length + 1,
          col: entry.key + 2,
          backgroundColor: kAccentSoft,
          child: SizedBox.shrink(),
        ));
      }
    }

    // Data rows
    for (final entry in rows.asMap().entries) {
      final r = entry.key + 1;
      final row = entry.value;
      final label = vtRowLabel(ctrl, row, locale);
      final placeholder = row.fixedLabel == null && label.isEmpty;
      final complete = _rowComplete(row);

      // Row-number column
      cells.add(GridCell(
        id: 'r${row.id}_num',
        row: r,
        col: 0,
        backgroundColor: r % 2 == 0 ? kVtWizardBackground : kSurface,
        alignment: Alignment.center,
        child: Semantics(
          label: 'Ligne ${entry.key + 1}',
          child: Text(
            '${entry.key + 1}',
            style: TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontSize: 13,
              fontWeight: complete ? FontWeight.w700 : FontWeight.w500,
              color: complete ? kAccent : kVtWizardInkSoft,
            ),
          ),
        ),
      ));

      // Row label column
      cells.add(GridCell(
        id: 'r${row.id}_lbl',
        row: r,
        col: 1,
        backgroundColor: r % 2 == 0 ? kVtWizardBackground : kSurface,
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: GridTheme.labelCellPadding,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (complete)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Semantics(
                    label: 'Ligne ${entry.key + 1} terminée',
                    child: const Icon(
                      Icons.check_circle,
                      size: 14,
                      color: kAccent,
                    ),
                  ),
                ),
              Expanded(
                child: Text(
                  placeholder
                      ? '${const LocalizedText(fr: "Ligne", en: "Row").of(locale)} ${entry.key + 1}'
                      : label,
                  softWrap: true,
                  style: placeholder
                      ? GridTheme.polishedLabelStyle.copyWith(color: kVtWizardInkFaint, fontStyle: FontStyle.italic)
                      : GridTheme.polishedLabelStyle,
                ),
              ),
            ],
          ),
        ),
      ));

      // Data cells
      for (final centry in def.cells.asMap().entries) {
        cells.add(GridCell(
          id: def.cellId(row, centry.value),
          row: r,
          col: centry.key + 2,
          backgroundColor: r % 2 == 0 ? kVtWizardBackground : kSurface,
          alignment: Alignment.center,
          child: _dataCell(row, centry.value, locale),
        ));
      }
    }

    // Footer row background (Σ TOTAL row + "N / M filled" row)
    final footerBg = kAccent;
    cells.add(GridCell(
      id: 'summary_label',
      row: rows.length + 1,
      col: 0,
      backgroundColor: footerBg,
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: GridTheme.labelCellPadding,
        child: Text(
          '$filledCount / ${def.rows.length}',
          style: GridTheme.polishedDataStyle.copyWith(color: Colors.white),
        ),
      ),
    ));

    cells.add(GridCell(
      id: 'summary_lbl2',
      row: rows.length + 1,
      col: 1,
      backgroundColor: footerBg,
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: GridTheme.labelCellPadding,
        child: Text(
          '${def.progressNoun.of(locale)}',
          style: GridTheme.polishedDataStyle.copyWith(color: Colors.white),
        ),
      ),
    ));

    // Σ TOTAL row label cell
    cells.add(GridCell(
      id: 'total_label',
      row: rows.length + 2,
      col: 0,
      backgroundColor: kVtWizardBackground,
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: GridTheme.labelCellPadding,
        child: Text(
          'Σ TOTAL',
          style: GridTheme.polishedTotalStyle,
        ),
      ),
    ));

    // Σ TOTAL row label column (col 1) - blank
    cells.add(GridCell(
      id: 'total_lbl2',
      row: rows.length + 2,
      col: 1,
      backgroundColor: kVtWizardBackground,
      child: SizedBox.shrink(),
    ));

    final grid = GridLayoutEngine(
      cells: cells,
      rowCount: rows.length + 3,
      colCount: def.cells.length + 2,
      colWidths: colWidths,
      rowHeights: rowHeights,
      borderColor: GridTheme.borderColor,
      borderWidth: GridTheme.borderWidth,
      backgroundColor: kSurface,
    );

    final naturalW = colWidths.reduce((a, b) => a + b);

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$filledCount / ${def.rows.length} ${def.progressNoun.of(locale)} '
            '${const LocalizedText(fr: "renseignés", en: "filled in").of(locale)}',
            style: TextStyle(fontSize: 12, color: kVtWizardInkSoft, fontFamily: kVtWizardFontFamily),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(builder: (context, constraints) {
            final needsScroll = naturalW > constraints.maxWidth;
            return needsScroll ? GridHorizontalScrollTable(grid: grid) : grid;
          }),
          if ((def.isRoster || def.progressiveRows) && rows.length < def.rows.length)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                const LocalizedText(
                        fr: 'Renseignez cette ligne pour en ajouter une nouvelle.',
                        en: 'Fill this row to reveal another one.')
                    .of(locale),
                style: TextStyle(fontSize: 11, color: kVtWizardInkFaint, fontStyle: FontStyle.italic, fontFamily: kVtWizardFontFamily),
              ),
            ),
        ],
      ),
    );
  }
}
