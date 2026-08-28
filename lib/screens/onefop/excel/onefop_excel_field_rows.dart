// lib/screens/onefop/excel/onefop_excel_field_rows.dart
//
// Excel/spreadsheet-style row primitives for simple (non-table) ONEFOP
// fields — used only by the desktop Excel shell (onefop_excel_shell.dart).
// Mobile is untouched; this file has no mobile code path.
//
// Colors are the ONEFOP form's own existing design tokens
// (onefop_form_constants.dart: kAccent, kCanvas, kBorder, kInk, ...) —
// the same deep-emerald palette used everywhere else in this app, not a
// separate Excel-green theme.
//
// The simple-fields grid (_SimpleFieldsTable below) renders through the
// same GridLayoutEngine/GridTheme single-pass gridline painter as the
// table-type fields (see core/focus/renderers/generic_spreadsheet_table
// .dart) — same borderColor, same row-height model, same rendering
// mechanism — so this section matches the table sections in both look
// and gridline quality instead of drawing its own per-cell borders.
//
// Writes go through the SAME OnefopFormController mutation API the
// existing SimpleField/SelectField/RadioField widgets already use
// (onFieldChanged/onSelectChanged/setRadioValue) — no new state, no
// duplicated validation/autosave logic. Table-type fields are not
// handled here at all; the section walker below hands them to the
// existing TableRenderer.renderTable(mobile: false, ...), which already
// produces a desktop-shaped spreadsheet grid.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/focus/schema/field_schema.dart';
import '../../../core/focus/schema/section_schema.dart';
import '../../../core/focus/renderers/grid_layout_engine.dart';
import '../../../core/focus/renderers/grid_theme.dart';
import '../onefop_form_constants.dart';
import '../onefop_form_controller.dart';
import '../onefop_form_widgets.dart' show keyboardType;
import '../onefop_section_units.dart';

const _monoStyle = TextStyle(
  fontFamily: 'Consolas',
  fontFamilyFallback: ['Courier New', 'monospace'],
);

// ── Value cell ───────────────────────────────────────────────────

/// The value cell — dispatches to a text input, a numeric input, or a
/// dropdown depending on the field's type, all wired to the SAME
/// controller mutation methods the existing card-style widgets use.
class ExcelValueCell extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const ExcelValueCell({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final hasError = ctrl.hasError(field);
    late final Widget input;

    if (field.type == 'select' || field.type == 'radio') {
      input = _ExcelSelectInput(ctrl: ctrl, field: field, locale: locale);
    } else {
      input = _ExcelTextInput(ctrl: ctrl, field: field);
    }

    // The left red bar is a validation accent, not a gridline — grid
    // borders themselves come from GridLayoutEngine's single-pass
    // painter (see _SimpleFieldsTable), so this only ever adds the
    // extra error indicator, never a competing border.
    if (!hasError) return input;
    return Container(
      decoration: const BoxDecoration(
        border: Border(left: BorderSide(color: kDanger, width: 2)),
      ),
      child: input,
    );
  }
}

class _ExcelTextInput extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const _ExcelTextInput({required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id];
    final fn = ctrl.fm.getNode(field.id);
    final isNumeric = field.type == 'number';
    if (c == null) return const SizedBox.shrink();

    return TextField(
      controller: c,
      focusNode: fn,
      keyboardType: keyboardType(field.type),
      textAlign: isNumeric ? TextAlign.right : TextAlign.left,
      inputFormatters: [
        if (field.type == 'number') FilteringTextInputFormatter.digitsOnly,
        if (field.type == 'tel') ...[
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(9),
        ],
      ],
      style: isNumeric
          ? _monoStyle.copyWith(fontSize: 12.5, color: kInk)
          : const TextStyle(fontSize: 12.5, color: kInk),
      decoration: const InputDecoration(
        isDense: true,
        filled: true,
        fillColor: kSurface,
        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        border: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
      onTapOutside: (_) => ctrl.onBlur(field.id),
      onSubmitted: (_) {
        ctrl.onBlur(field.id);
        ctrl.focusFieldOffset(1);
      },
    );
  }
}

class _ExcelSelectInput extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final Locale locale;
  const _ExcelSelectInput({required this.ctrl, required this.field, required this.locale});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? [];
    final cur = ctrl.data[field.id] as String?;

    return Container(
      color: kSurface,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: opts.any((o) => o.value == cur) ? cur : null,
          isExpanded: true,
          isDense: true,
          hint: const Text('— sélectionner —',
              style: TextStyle(fontSize: 12.5, color: kInkFaint)),
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: kInkFaint),
          style: const TextStyle(fontSize: 12.5, color: kInk),
          items: [
            for (final o in opts)
              DropdownMenuItem(value: o.value, child: Text(o.text.of(locale))),
          ],
          onChanged: (v) {
            if (v == null) return;
            if (field.type == 'radio') {
              ctrl.setRadioValue(field, v);
            } else {
              ctrl.onSelectChanged(field, v);
            }
          },
        ),
      ),
    );
  }
}

// ── Section walker ───────────────────────────────────────────────

/// Renders one full section as a single active unit — a spreadsheet-style
/// grid of rows for a run of simple fields, or one reused desktop table
/// grid for a table field — grouped by subsection exactly the way the
/// shared unit model groups them (see buildTableGroupUnits in
/// onefop_section_units.dart). Only the current unit is ever mounted;
/// advancing/retreating swaps it via UnitTransition and scrolls the new
/// one into view top-first (OnefopFormController.scrollToUnit) — no
/// manual scrolling needed to reach a freshly-revealed table.
class ExcelSectionBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final SectionSchema section;
  final EntityType entityType;
  final Future<void> Function() onPreviewSubmit;
  const ExcelSectionBody({
    super.key,
    required this.ctrl,
    required this.section,
    required this.entityType,
    required this.onPreviewSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final units = buildTableGroupUnits(
      ctrl,
      section,
      locale,
      entityType: entityType,
      simpleFieldsBuilder: (fields, startRow) =>
          _SimpleFieldsTable(ctrl: ctrl, fields: fields, startRow: startRow),
      mobile: false,
      // Pin the current table's paperCode/question-text banner above the
      // scroll (see the Column below) instead of letting it scroll away
      // with a tall matrix under it — same reasoning as SimpleModeShell's
      // _UnitBody, which already does this for the card-based platforms.
      separateHeader: true,
    );
    if (units.isEmpty) return const SizedBox.shrink();

    final currentIdx =
        (ctrl.unitCursor(section.id) ?? currentUnitIndex(ctrl, units))
            .clamp(0, units.length - 1);
    final unit = units[currentIdx];
    final isFirst = currentIdx == 0;
    final isLast = currentIdx == units.length - 1;
    final hasMoreForward = unit.hasMoreInternalSteps?.call(ctrl) ?? false;
    final hasMoreBackward = unit.hasMoreInternalStepsBack?.call(ctrl) ?? false;
    // True end of the whole form — see UnitNavRow.isSubmit doc comment for
    // why this is the only place left to offer Submit.
    final isFormEnd =
        isLast && !hasMoreForward && ctrl.currentPage == ctrl.pageCount - 1;

    // Keep Tab/Enter navigation (computeVisibleFieldIds) from trying to
    // focus a field in a unit that isn't rendered — a plain field write on
    // the controller, not a notification, so it's safe to do from within
    // build(). The boundary hooks let Tab/Enter off the unit's last field
    // advance to the next unit (or, for a tabbed unit, the next tab first
    // — see nextWithinUnit) before crossing into the next/previous section
    // (advanceToNextSection/retreatToPreviousSection) — Suivant/Précédent
    // reads as one continuous "next" across the whole form, not just
    // within the current section.
    ctrl.setRevealedFieldIds(unit.fieldIds);
    ctrl.setRevealBoundaryActions(
      forward: isFormEnd
          ? () => onPreviewSubmit()
          : (isLast && !hasMoreForward)
              ? () => advanceToNextSection(ctrl)
              : () => nextWithinUnit(ctrl, section, units, currentIdx),
      backward: (isFirst && !hasMoreBackward)
          ? () => retreatToPreviousSection(ctrl)
          : () => prevWithinUnit(ctrl, section, units, currentIdx),
    );

    // Fixed chrome (header, nav row); the table area in between scrolls
    // on its own (vertical — GenericSpreadsheetTable already wraps itself
    // in a horizontal scroll when a row of columns doesn't fit, see its
    // _HorizontalScrollTable) rather than the whole header+table+nav
    // stack scrolling together as one page. Précédent/Suivant stay
    // reachable without scrolling past a tall table to find them.
    //
    // Pinch/pan zoom used to live here (ZoomableTable) instead of plain
    // scroll, specifically so a table wider or taller than the canvas
    // could be zoomed out to see the whole thing at once — removed since
    // it turned out to fight the browser/OS's own gesture handling more
    // than it helped (see conversation history); GenericSpreadsheetTable's
    // uniform cell resize (TableSizeScope, still in effect here — see
    // OnefopExcelShell) is what covers "make a cramped table easier to
    // read" now instead.
    return KeyedSubtree(
      key: ctrl.keyForUnit(unit.key),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (unit.header != null) ...[
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                  child: unit.header!(),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Expanded(
              child: UnitTransition(
                child: KeyedSubtree(
                  key: ValueKey(unit.key),
                  child: SingleChildScrollView(
                    controller: ctrl.mainScroll,
                    child: unit.content(),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: GridTheme.tableTargetWidth),
                // showNext is unconditional now — this row is the only
                // Précédent/Suivant/Soumettre control left in Spreadsheet
                // Mode.
                child: UnitNavRow(
                  showBack: !isFirst || hasMoreBackward || ctrl.currentPage > 0,
                  onBack: () => (isFirst && !hasMoreBackward)
                      ? retreatToPreviousSection(ctrl)
                      : prevWithinUnit(ctrl, section, units, currentIdx),
                  showNext: true,
                  isSubmit: isFormEnd,
                  nextEnabled:
                      isFormEnd ? ctrl.validateAllPages() : unit.canAdvance(ctrl),
                  onNext: () => isFormEnd
                      ? onPreviewSubmit()
                      : (isLast && !hasMoreForward)
                          ? advanceToNextSection(ctrl)
                          : nextWithinUnit(ctrl, section, units, currentIdx),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One bordered mini spreadsheet — RowNum | Code+Libellé | Valeur — for a
/// consecutive run of non-table fields, mirroring the reference's
/// SpreadsheetTable/LabelCell/TextCell pattern.
///
/// Renders through GridLayoutEngine (the same engine the table-type
/// fields use via GenericSpreadsheetTable) rather than a plain Flutter
/// Table with per-cell borders — every gridline is one continuous
/// stroke from a single painter, same as the CSP/SPC-style tables, so
/// this section doesn't draw its own, potentially-seamed, borders.
class _SimpleFieldsTable extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<FieldSchema> fields;
  final int startRow;
  const _SimpleFieldsTable({required this.ctrl, required this.fields, required this.startRow});

  static const double _rowNumColW = 32;
  // Fixed, not derived from the available page width — sized to what
  // each control actually needs (a phone number and a company address
  // don't need the same box). Previously this column stretched to 3/5
  // of the full ~940px table width for every row regardless of type,
  // leaving a large empty click-target next to short answers (a 6-digit
  // phone number in a ~545px-wide cell). The mini-grid tables elsewhere
  // in this shell already size columns to their content rather than to
  // the page, so this brings simple-field rows in line with them.
  static const double _labelColW = 360;
  static const _labelPad = EdgeInsets.symmetric(horizontal: 12, vertical: 3);

  static double _valueColWidth(FieldSchema field) {
    switch (field.type) {
      case 'number':
      case 'tel':
        return 150;
      case 'select':
      case 'radio':
        return 260;
      default:
        return 300;
    }
  }

  TextSpan _labelSpan(FieldSchema field, String label) {
    return TextSpan(
      style: const TextStyle(fontSize: 12.5, color: kInk),
      children: [
        if (field.paperCode != null && field.paperCode!.isNotEmpty)
          TextSpan(
            text: '${field.paperCode}  ',
            style: _monoStyle.copyWith(
                color: kAccent, fontWeight: FontWeight.w700, fontSize: 11.5),
          ),
        TextSpan(text: label, style: const TextStyle(fontWeight: FontWeight.w500)),
        if (field.required) const TextSpan(text: ' *', style: TextStyle(color: kDanger)),
      ],
    );
  }

  // Row heights are fixed (GridLayoutEngine positions everything
  // absolutely, no runtime auto-sizing pass) — so a wrapped long label
  // needs to be measured ahead of time with the same layout engine
  // Flutter's own Text/RichText widgets use internally, the same
  // approach generic_spreadsheet_table.dart uses for its row labels.
  double _measureLabelHeight(
      FieldSchema field, String label, double maxWidth, TextScaler scaler) {
    final tp = TextPainter(
      text: _labelSpan(field, label),
      textDirection: TextDirection.ltr,
      maxLines: null,
      textScaler: scaler,
    )..layout(maxWidth: maxWidth > 0 ? maxWidth : 0);
    return tp.height;
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    // One value-column width for the whole run — the widest any field in
    // it actually needs, so a text field sharing a table with a select
    // doesn't leave the select's cell oversized (or vice versa).
    final valueW = fields.map(_valueColWidth).fold(0.0, (a, b) => a > b ? a : b);
    final colWidths = [_rowNumColW, _labelColW, valueW];
    final maxLabelTextW = _labelColW - _labelPad.horizontal;
    final textScaler = MediaQuery.textScalerOf(context);

    final rowHeights = <double>[
      for (final f in fields)
        () {
          final h = _measureLabelHeight(f, ctrl.fieldLabel(f, locale), maxLabelTextW, textScaler) +
              _labelPad.vertical;
          return h > GridTheme.rowHeight ? h.ceilToDouble() : GridTheme.rowHeight;
        }(),
    ];

    final cells = <GridCell>[];
    for (final entry in fields.asMap().entries) {
      final i = entry.key;
      final f = entry.value;

      cells.add(GridCell(
        id: 'rownum_${f.id}',
        row: i,
        col: 0,
        backgroundColor: kSurface,
        alignment: Alignment.centerRight,
        child: Padding(
          padding: const EdgeInsets.only(right: 6),
          child: Text('${startRow + i}',
              style: _monoStyle.copyWith(fontSize: 11, color: kInkFaint)),
        ),
      ));

      cells.add(GridCell(
        id: 'label_${f.id}',
        row: i,
        col: 1,
        backgroundColor: kSurface,
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: _labelPad,
          child: RichText(
            text: _labelSpan(f, ctrl.fieldLabel(f, locale)),
            softWrap: true,
            overflow: TextOverflow.visible,
          ),
        ),
      ));

      cells.add(GridCell(
        id: f.id,
        row: i,
        col: 2,
        backgroundColor: kSurface,
        alignment: Alignment.center,
        child: ExcelValueCell(ctrl: ctrl, field: f),
      ));
    }

    return GridLayoutEngine(
      cells: cells,
      rowCount: fields.length,
      colCount: 3,
      colWidths: colWidths,
      rowHeights: rowHeights,
      borderColor: GridTheme.borderColor,
      borderWidth: GridTheme.borderWidth,
      backgroundColor: kSurface,
    );
  }
}
