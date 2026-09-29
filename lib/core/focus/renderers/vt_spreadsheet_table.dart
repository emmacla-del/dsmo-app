// lib/core/focus/renderers/vt_spreadsheet_table.dart
//
// Desktop-only, real spreadsheet-grid rendering of a VtTableDef — the
// Excel-shell counterpart to VtRowEditor's mobile-first tappable-row-list
// (vt_row_editor.dart). Every VT table (diploma, specialty, roster, ...)
// used to fall back to VtRowEditor even on desktop (see that file's own
// doc comment: "there is no second, wider table for desktop"), which broke
// the spreadsheet illusion in the middle of an otherwise all-grid desktop
// form — this widget is that missing wider table.
//
// Same data model, same read/write plumbing as VtRowEditor — VtTableDef/
// VtRowDef/VtCellDef, ctrl.data/onGridCellChanged/setRawValue/
// hybridController, vtRowLabel/vtCellVisible/vtRowFilled/vtVisibleRows
// (all shared with vt_row_editor.dart, not duplicated) — only the layout
// changes: one GridLayoutEngine grid (row label column + one column per
// VtCellDef) instead of a tap-to-open-a-sheet row list. A `dependsOnKey`
// cell that isn't visible for a given row (e.g. 5.2's isApproved before
// hasCurriculum is Oui) still occupies its column — a grid can't vary its
// column count per row — but renders as a plain greyed-out cell instead of
// an input, reading as "not applicable to this row" rather than a blank
// answerable field.
//
// Rendered through GridLayoutEngine (grid_layout_engine.dart) — the same
// engine every other desktop table in the Excel shell uses — so gridlines,
// resize handles (TableSizeScope), and general look match exactly; wrapped
// in GridHorizontalScrollTable (grid_horizontal_scroll.dart) for the wide
// tables (4.8/4.9's 3-flow x 3-column layout runs to 9 data columns) the
// same way GenericSpreadsheetTable already handles overflow.
//
// This widget shows no paperCode/title of its own and no card chrome
// (border/background/rounded corners) — ExcelSectionBody already pins the
// table's own question header above the scroll for every table, VT
// included (see onefop_section_units.dart's addSimpleUnit `vtTableHeader`
// param). Drawing it a second time inside a boxed card here (VtRowEditor's
// own look, which this widget originally copied) is what made a VT
// section read as a SaaS-style card floating on an otherwise flat
// spreadsheet page — see conversation history.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../i18n/localized_text.dart';
import '../../../screens/onefop/onefop_form_constants.dart';
import '../../../screens/onefop/onefop_form_controller.dart';
import 'grid_horizontal_scroll.dart';
import 'grid_layout_engine.dart';
import 'grid_theme.dart';
import 'onefop_layout_constants.dart';
import 'vt_row_editor.dart';
import '../../../screens/onefop/onefop_form_widgets.dart' show RadioOption;

const _vtMonoStyle = TextStyle(
  fontFamily: 'Consolas',
  fontFamilyFallback: ['Courier New', 'monospace'],
);

class VtSpreadsheetTable extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtSpreadsheetTable({super.key, required this.ctrl, required this.def});

  @override
  Widget build(BuildContext context) {
    // Rebuilds this whole table whenever any cell in it changes — needed
    // for computed cells (Total columns) to reflect a sibling cell's new
    // value immediately, and for the roster/progressiveRows reveal rule to
    // add its next blank row as soon as the current last one gets typed
    // into. Same mechanism VtRowEditor already uses for the same reasons.
    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (context, _, __) => _VtSpreadsheetTableBody(ctrl: ctrl, def: def),
    );
  }
}

class _VtSpreadsheetTableBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const _VtSpreadsheetTableBody({required this.ctrl, required this.def});

  static const double _rowLabelColW = 260;
  static const double _numColW = 90;
  static const double _textColW = 220;
  // RadioOption lays out two full "◯ Oui" / "◯ Non" labels side by side
  // (two RadioOption buttons) — live-reported: 100 clipped it into a
  // RenderFlex overflow on every boolean VT cell (roster's
  // isAdminPersonnel, 5.2's hasCurriculum/isApproved).
  static const double _boolColW = 150;
  static const double _computedColW = 130;
  static const _cellPad = EdgeInsets.symmetric(horizontal: 8, vertical: 3);

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
        // academicDiploma/professionalDiploma options print a full
        // diploma name (e.g. "Doctorat/PhD") — wide enough that the
        // roster's own fixed default would clip every option in the
        // closed dropdown down to a few characters.
        final maxLen = (c.options ?? const <VtOption>[])
            .map((o) => o.label.of(locale).length)
            .fold(0, (a, b) => a > b ? a : b);
        if (maxLen > 25) return 320;
        if (maxLen > 12) return 200;
        return 130;
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
        return ctrl.data[id] == null;
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

  Widget _withErrorBorder(Widget child, bool hasError) {
    if (!hasError) return child;
    return Container(
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: kDanger, width: 2)),
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
      style: _vtMonoStyle.copyWith(fontSize: 13, color: kInk),
      decoration: const InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: _cellPad,
        border: InputBorder.none,
        // The app's global InputDecorationTheme (app_theme.dart) sets a
        // rounded OutlineInputBorder as its own `enabledBorder` — since
        // InputDecoration.applyDefaults only fills in whichever specific
        // border variant is still null, overriding `border` alone (the
        // fallback) leaves the *resting*, unfocused state — what this
        // cell shows almost all the time — picking up that theme default
        // instead, rendering as a rounded pill floating inside an
        // otherwise square grid cell. `focusedBorder` alone already
        // covered the focused state; `enabledBorder` is what closes the
        // gap for every other cell in the table at rest.
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
      style: const TextStyle(fontSize: 13, color: kInk),
      decoration: const InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: _cellPad,
        border: InputBorder.none,
        // The app's global InputDecorationTheme (app_theme.dart) sets a
        // rounded OutlineInputBorder as its own `enabledBorder` — since
        // InputDecoration.applyDefaults only fills in whichever specific
        // border variant is still null, overriding `border` alone (the
        // fallback) leaves the *resting*, unfocused state — what this
        // cell shows almost all the time — picking up that theme default
        // instead, rendering as a rounded pill floating inside an
        // otherwise square grid cell. `focusedBorder` alone already
        // covered the focused state; `enabledBorder` is what closes the
        // gap for every other cell in the table at rest.
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
          hint: const Text('—', style: TextStyle(fontSize: 12.5, color: kInkFaint)),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: kInkFaint),
          style: const TextStyle(fontSize: 12.5, color: kInk),
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
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kAccentDeep)),
    );
  }

  // A dependsOnKey cell not currently satisfied for this row (e.g. 5.2's
  // isApproved before hasCurriculum is Oui) — a grid can't vary its column
  // count per row the way the bottom-sheet editor hides the field
  // entirely, so this reads as "not applicable to this row" instead.
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

    final colWidths = [_rowLabelColW, for (final c in def.cells) _colWidth(c, locale)];
    const maxLabelTextW = _rowLabelColW - 24;

    final headerHeight = def.cells.fold<double>(GridTheme.rowHeight * 1.4, (h, c) {
      final w = _colWidth(c, locale) - 16;
      return [h, _measureHeight(c.label.of(locale), w, GridTheme.headerStyle, textScaler) + 12]
          .reduce((a, b) => a > b ? a : b);
    });

    final rowHeights = <double>[
      headerHeight,
      for (final row in rows)
        () {
          final label = vtRowLabel(ctrl, row, locale);
          final text =
              label.isEmpty ? '${rows.indexOf(row) + 1}' : label; // placeholder rows still need a height
          final h = _measureHeight(text, maxLabelTextW, GridTheme.labelStyle, textScaler) + 6;
          return h > GridTheme.rowHeight ? h.ceilToDouble() : GridTheme.rowHeight;
        }(),
    ];

    final cells = <GridCell>[
      const GridCell(
        id: 'h_row',
        row: 0,
        col: 0,
        backgroundColor: GridTheme.headerBg,
        child: SizedBox.shrink(),
      ),
      for (final entry in def.cells.asMap().entries)
        GridCell(
          id: 'h_${entry.value.key}',
          row: 0,
          col: entry.key + 1,
          backgroundColor: GridTheme.headerBg,
          child: Padding(
            padding: GridTheme.headerCellPadding,
            child: Text(
              entry.value.label.of(locale),
              textAlign: TextAlign.center,
              style: GridTheme.headerStyle,
            ),
          ),
        ),
    ];

    for (final entry in rows.asMap().entries) {
      final r = entry.key + 1;
      final row = entry.value;
      final label = vtRowLabel(ctrl, row, locale);
      final placeholder = row.fixedLabel == null && label.isEmpty;

      cells.add(GridCell(
        id: 'lbl_${row.id}',
        row: r,
        col: 0,
        backgroundColor: kSurface,
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: GridTheme.labelCellPadding,
          child: Text(
            placeholder
                ? '${const LocalizedText(fr: "Ligne", en: "Row").of(locale)} ${entry.key + 1}'
                : label,
            softWrap: true,
            style: placeholder
                ? GridTheme.labelStyle.copyWith(color: kInkFaint, fontStyle: FontStyle.italic)
                : GridTheme.labelStyle,
          ),
        ),
      ));

      for (final centry in def.cells.asMap().entries) {
        cells.add(GridCell(
          id: def.cellId(row, centry.value),
          row: r,
          col: centry.key + 1,
          backgroundColor: kSurface,
          alignment: Alignment.center,
          child: _dataCell(row, centry.value, locale),
        ));
      }
    }

    final grid = GridLayoutEngine(
      cells: cells,
      rowCount: rows.length + 1,
      colCount: def.cells.length + 1,
      colWidths: colWidths,
      rowHeights: rowHeights,
      borderColor: GridTheme.borderColor,
      borderWidth: GridTheme.borderWidth,
      backgroundColor: kSurface,
    );

    final naturalW = colWidths.reduce((a, b) => a + b);

    // No paperCode/title row and no bordered card here — ExcelSectionBody
    // already pins this table's own question header above the scroll (see
    // onefop_section_units.dart's addSimpleUnit `vtTableHeader` param,
    // wired from the same FormQuestionAst label/paperCode TableRenderer.
    // buildHeader shows for every non-VT table), so this widget would
    // otherwise be showing the exact same paperCode+title twice — once
    // pinned above, once again inside its own boxed card. Dropping the
    // card (kSurface/border/borderRadius Container) also matches every
    // other desktop table's flat, borderless look — a VT table was
    // previously the one section that read as a boxed SaaS-style card
    // sitting on top of an otherwise plain spreadsheet page.
    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$filledCount / ${def.rows.length} ${def.progressNoun.of(locale)} '
            '${const LocalizedText(fr: "renseignés", en: "filled in").of(locale)}',
            style: const TextStyle(fontSize: 12, color: kInkSoft),
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
                style: const TextStyle(fontSize: 11, color: kInkFaint, fontStyle: FontStyle.italic),
              ),
            ),
        ],
      ),
    );
  }
}
