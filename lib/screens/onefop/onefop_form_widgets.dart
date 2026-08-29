// lib/screens/onefop/onefop_form_widgets.dart
// ══════════════════════════════════════════════════════════════
// UI WIDGETS — Fields, Sidebar, NavBar, Skeletons, etc.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/i18n/localized_text.dart';
import '../../core/focus/schema/field_schema.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/renderers/table_renderer.dart';
import '../../core/focus/renderers/activities_table.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';
import '../../core/focus/utils/field_validator.dart';
import '../../core/focus/utils/table_response_status.dart';
import '../../providers/onefop_mode_provider.dart';
import '../../widgets/responsive_helpers.dart';

import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_section_units.dart'
    show
        OnefopSectionMap,
        SectionUnit,
        buildTableGroupUnits,
        currentUnitIndex,
        jumpToLocation,
        jumpToUnit,
        navigateToSection;

// ══════════════════════════════════════════════════════════════
// DATA MODELS
// ══════════════════════════════════════════════════════════════

class FieldGroup {
  final LocalizedText? sub;
  final List<FieldSchema> fields;
  const FieldGroup({required this.sub, required this.fields});
}

List<FieldGroup> groupFields(List<FieldSchema> fields) {
  final groups = <FieldGroup>[];
  LocalizedText? cSub;
  final cF = <FieldSchema>[];
  for (final f in fields) {
    final sub = f.type == 'table'
        ? f.subsection
        : (f.subsection ?? cSub);
    if (sub != cSub) {
      if (cF.isNotEmpty) {
        groups.add(FieldGroup(sub: cSub, fields: List.from(cF)));
        cF.clear();
      }
      cSub = sub;
    }
    cF.add(f);
  }
  if (cF.isNotEmpty) groups.add(FieldGroup(sub: cSub, fields: List.from(cF)));
  return groups;
}

// ══════════════════════════════════════════════════════════════
// LABEL / DECORATION HELPERS
// ══════════════════════════════════════════════════════════════

String buildFieldLabel(OnefopFormController ctrl, FieldSchema f, Locale locale) {
  String label = ctrl.fieldLabel(f, locale);
  final currentSectionId = ctrl.primarySection(ctrl.currentPage)?.id ?? '';
  final isSimple = ctrl.isSimpleSection(currentSectionId);
  if (isSimple &&
      f.paperCode != null &&
      f.paperCode!.isNotEmpty &&
      !label.startsWith(f.paperCode!)) {
    label = '${f.paperCode} - $label';
  }
  return label;
}

Widget errorRow(String m) => Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 14, color: kDanger),
          const SizedBox(width: 6),
          Flexible(
            child: Text(m, style: const TextStyle(fontSize: 11, color: kDanger)),
          ),
        ],
      ),
    );

InputDecoration inputDecoration({
  required bool focused,
  required bool hasError,
  String? hint,
  String? helperText,
}) {
  return InputDecoration(
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
    filled: true,
    fillColor: hasError ? kDangerSoft : kFieldFill,
    hintText: hint,
    hintStyle: const TextStyle(fontSize: 14, color: kInkFaint),
    helperText: helperText,
    helperStyle: const TextStyle(fontSize: 11, color: kInkFaint),
    helperMaxLines: 2,
    border: const OutlineInputBorder(
        borderRadius: BorderRadius.zero,
        borderSide: BorderSide(color: kBorder, width: 1)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.zero,
        borderSide: BorderSide(color: hasError ? kDanger : kBorder, width: 1)),
    focusedBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.zero,
        borderSide: BorderSide(color: kAccent, width: 1.5)),
    errorBorder: const OutlineInputBorder(
        borderRadius: BorderRadius.zero,
        borderSide: BorderSide(color: kDanger, width: 1)),
  );
}

InputDecoration dropdownDecoration(bool hasError) => InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      filled: true,
      fillColor: hasError ? kDangerSoft : kFieldFill,
      border: const OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: kBorder, width: 1)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide:
              BorderSide(color: hasError ? kDanger : kBorder, width: 1)),
      focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: kAccent, width: 1.5)),
    );

/// Upfront hint for fields capped by an input formatter, so hitting the
/// limit doesn't look like a dead keystroke with no explanation.
String? fieldHelperText(FieldSchema f, AppLocalizations l10n) {
  if (f.type == 'tel') return l10n.telHelper;
  if (FieldValidator.isYearField(f)) return l10n.yearHelper;
  return null;
}

TextInputType keyboardType(String t) {
  switch (t) {
    case 'number':
      return TextInputType.number;
    case 'email':
      return TextInputType.emailAddress;
    case 'tel':
      return TextInputType.phone;
    default:
      return TextInputType.text;
  }
}

// ══════════════════════════════════════════════════════════════
// FIELD WIDGETS
// ══════════════════════════════════════════════════════════════

class SimpleField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final double? maxWidth;
  const SimpleField(
      {super.key, required this.ctrl, required this.field, this.maxWidth});

  @override
  Widget build(BuildContext context) {
    final c = ctrl.ctrl[field.id]!;
    final fn = ctrl.fm.getNode(field.id);
    final e = ctrl.hasError(field);
    final locale = context.loc;
    final l10n = context.l10n;

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field, locale),
              required: field.required,
              optional: FieldValidator.kOptionalOverrides.contains(field.id),
            ),
            const SizedBox(height: OL.labelGapV),
            TextFormField(
              controller: c,
              focusNode: fn,
              keyboardType: keyboardType(field.type),
              textInputAction: TextInputAction.next,
              inputFormatters: [
                if (field.type == 'number')
                  FilteringTextInputFormatter.digitsOnly,
                if (FieldValidator.isYearField(field))
                  LengthLimitingTextInputFormatter(4),
                if (field.type == 'tel') ...[
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(9),
                ],
              ],
              style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
              decoration: inputDecoration(
                  focused: fn.hasFocus,
                  hasError: e,
                  hint: field.type == 'number' ? '0' : null,
                  helperText: fieldHelperText(field, l10n)),
              onTapOutside: (_) => ctrl.onBlur(field.id),
              onFieldSubmitted: (_) {
                ctrl.onBlur(field.id);
                ctrl.focusFieldOffset(1);
              },
            ),
            if (e) errorRow(ctrl.errorText(field, l10n)),
          ],
        ),
      ),
    );
  }
}

class RadioField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const RadioField({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? [];
    final cur = ctrl.data[field.id] as String?;
    final e = ctrl.hasError(field);
    final horizontal = opts.length == 2;
    final locale = context.loc;
    final l10n = context.l10n;

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kDocWidth),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field, locale),
              required: field.required,
              optional: FieldValidator.kOptionalOverrides.contains(field.id),
            ),
            const SizedBox(height: 10),
            Focus(
              focusNode: ctrl.fm.getNode(field.id),
              child: ListenableBuilder(
                listenable: ctrl.fm.getNode(field.id),
                builder: (context, _) {
                  final optWidgets = opts
                      .map((o) => RadioOption(
                            label: o.text.of(locale),
                            isSelected: cur == o.value,
                            onTap: () {
                              ctrl.fm.focus(field.id);
                              ctrl.setRadioValue(field, o.value);
                            },
                          ))
                      .toList();

                  if (horizontal) {
                    return Row(
                      children:
                          optWidgets.map((w) => Expanded(child: w)).toList(),
                    );
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (int i = 0; i < optWidgets.length; i++) ...[
                        optWidgets[i],
                        if (i < optWidgets.length - 1)
                          const SizedBox(height: 8),
                      ],
                    ],
                  );
                },
              ),
            ),
            if (e) ...[
              const SizedBox(height: 6),
              errorRow(l10n.selectAnOption),
            ],
          ],
        ),
      ),
    );
  }
}

class SelectField extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  final double? maxWidth;
  const SelectField(
      {super.key, required this.ctrl, required this.field, this.maxWidth});

  @override
  Widget build(BuildContext context) {
    final opts = field.optionsI18n ?? [];
    final cur = ctrl.data[field.id] as String?;
    final e = ctrl.hasError(field);
    final locale = context.loc;
    final l10n = context.l10n;

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field, locale),
              required: field.required,
              optional: FieldValidator.kOptionalOverrides.contains(field.id),
            ),
            const SizedBox(height: OL.labelGapV),
            Focus(
              focusNode: ctrl.fm.getNode(field.id),
              child: DropdownButtonFormField<String>(
                initialValue: cur,
                hint: Text(l10n.selectPlaceholder,
                    style:
                        const TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
                isExpanded: true,
                style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                items: opts
                    .map((o) => DropdownMenuItem(
                          value: o.value,
                          child: Text(o.text.of(locale),
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF1E293B))),
                        ))
                    .toList(),
                onChanged: (v) => ctrl.onSelectChanged(field, v),
                decoration: dropdownDecoration(e),
              ),
            ),
            if (e && (cur == null || cur.isEmpty))
              errorRow(l10n.selectAnOption),
          ],
        ),
      ),
    );
  }
}

class TableFieldWidget extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const TableFieldWidget({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Align(
        alignment: Alignment.topCenter,
        child: TableRenderer.renderTable(
          field: field,
          gridValues: ctrl.aGrid,
          onCellChanged: ctrl.onGridCellChanged,
          focusManager: ctrl.fm,
          entityType: entityTypeString(ctrl.entityType),
          onExitTable: () => ctrl.exitTable(field.id),
          onExitPrevious: () => ctrl.exitTablePrevious(field.id),
          hybridController: ctrl.hybridController,
          mobile: MediaQuery.of(context).size.width < OL.pageWidth,
          locale: context.loc,
          enteredValues: ctrl.uGrid,
          tableClosed: field.paperCode != null &&
              TableResponseStatus.isClosed(ctrl
                  .data[TableResponseStatus.fieldId(field.paperCode!)]
                  ?.toString()),
        ),
      ),
    );
  }
}

/// Renders Projects & Programs' Section 2 activities table — deliberately
/// bypasses TableRenderer.renderTable/TableSpecBuilder entirely (see
/// AstFieldType.repeatingTable and ActivitiesTable's file-level comment):
/// this field's tableSpec is heterogeneous-column shaped, not a numeric
/// GridRenderSpec matrix.
class ActivitiesTableFieldWidget extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const ActivitiesTableFieldWidget(
      {super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final spec = field.tableSpec ?? const {};
    final prefix = (spec['prefix'] as String? ?? field.id).toLowerCase();
    final rows = spec['rows'] is int ? spec['rows'] as int : 13;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ActivitiesTable(
        prefix: prefix,
        rows: rows,
        hybridController: ctrl.hybridController,
      ),
    );
  }
}

class HybridTableWidget extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const HybridTableWidget({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final sp = field.tableSpec!;
    final pfx = (sp['prefix'] as String).toLowerCase();
    final def = kHybridTables[pfx];
    if (def == null) return const SizedBox.shrink();

    final allCells = [
      for (final rk in def.rowKeys) ...[
        '${pfx}_${rk}_male',
        '${pfx}_${rk}_female',
      ],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        OnefopQuestionHeader(
          paperCode: field.paperCode,
          questionText: field.label?.of(locale) ?? field.questionText,
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: OL.questionGapV),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return _HybridTableBody(
                ctrl: ctrl,
                pfx: pfx,
                def: def,
                tableLabel: kHybridColumnHeaders[pfx]?.of(locale) ?? '',
                allCells: allCells,
                fieldId: field.id,
                availableWidth: constraints.maxWidth,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _HybridTableBody extends StatelessWidget {
  final OnefopFormController ctrl;
  final String pfx;
  final HTDef def;
  final String tableLabel;
  final List<String> allCells;
  final String fieldId;
  final double availableWidth;

  const _HybridTableBody({
    required this.ctrl,
    required this.pfx,
    required this.def,
    required this.tableLabel,
    required this.allCells,
    required this.fieldId,
    required this.availableWidth,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    const nc = kHybridNumWidth;
    const double outerBorder = 1.0;

    // Text column has a fixed minimum width; when the table doesn't fit the
    // available width, the horizontal SingleChildScrollView below (driven by
    // needsScroll) takes over instead of trying to squeeze it — clamping it
    // to the available width here could push the lower bound above the
    // upper bound and throw on narrow screens.
    const double tc = 200.0;
    const totalTableWidth = tc + 3 * nc + 2 * OL.borderWidth + 2 * outerBorder;

    // Below the mobile breakpoint, the 200px label column + 3×100px number
    // columns can't share a row without scrolling. Stack each row as a
    // full-width label field over a Row of 3 Expanded M/F/Total cells
    // instead — no horizontal scroll, and each number cell gets a real
    // touch-target-sized box rather than a ~60px sliver.
    final mobile = availableWidth < OL.pageWidth;
    if (mobile) {
      int tm = 0, tf = 0, tt = 0;
      for (final k in def.rowKeys) {
        tm += ctrl.aGrid['${pfx}_${k}_male'] ?? 0;
        tf += ctrl.aGrid['${pfx}_${k}_female'] ?? 0;
        tt += ctrl.aGrid['${pfx}_${k}_total'] ?? 0;
      }

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8, left: 2),
            child: Text(tableLabel, style: kTableHeaderStyle),
          ),
          for (int i = 0; i < def.rowKeys.length; i++)
            _HybridMobileDataCard(
              tid: '${pfx}_${def.rowKeys[i]}_${def.textSuffix}',
              mid: '${pfx}_${def.rowKeys[i]}_male',
              fid: '${pfx}_${def.rowKeys[i]}_female',
              tot: ctrl.aGrid['${pfx}_${def.rowKeys[i]}_total'] ?? 0,
              rowLabel: def.rowLabels[i].of(locale),
              allCells: allCells,
              fieldId: fieldId,
              ctrl: ctrl,
              tableId: pfx,
            ),
          _HybridMobileTotalCard(male: tm, female: tf, total: tt),
        ],
      );
    }

    Widget headerRow = Container(
      constraints: const BoxConstraints(minHeight: OL.headerRowHeight),
      decoration: BoxDecoration(
        color: OL.tableHdrBg,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
        border: Border.all(color: OL.borderColor, width: OL.borderWidth),
      ),
      child: Row(children: [
        SizedBox(
          width: tc,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text(tableLabel,
                style: kTableHeaderStyle, overflow: TextOverflow.ellipsis),
          ),
        ),
        for (final col in [
          context.l10n.male,
          context.l10n.female,
          context.l10n.total
        ])
          Container(
            width: nc,
            height: OL.headerRowHeight,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: Text(col, style: kTableHeaderStyle),
          ),
      ]),
    );

    final dataRows = <Widget>[];
    for (int i = 0; i < def.rowKeys.length; i++) {
      final rk = def.rowKeys[i];
      final tid = '${pfx}_${rk}_${def.textSuffix}';
      final mid = '${pfx}_${rk}_male';
      final fid = '${pfx}_${rk}_female';
      final tot = ctrl.aGrid['${pfx}_${rk}_total'] ?? 0;
      dataRows.add(_HybridDataRow(
        index: i,
        tc: tc,
        nc: nc,
        tid: tid,
        mid: mid,
        fid: fid,
        tot: tot,
        rowLabel: def.rowLabels[i].of(locale),
        isEven: i % 2 == 0,
        allCells: allCells,
        fieldId: fieldId,
        ctrl: ctrl,
        tableId: pfx,
      ));
    }

    int tm = 0, tf = 0, tt = 0;
    for (final k in def.rowKeys) {
      tm += ctrl.aGrid['${pfx}_${k}_male'] ?? 0;
      tf += ctrl.aGrid['${pfx}_${k}_female'] ?? 0;
      tt += ctrl.aGrid['${pfx}_${k}_total'] ?? 0;
    }

    Widget grandTotalRow = Container(
      constraints: const BoxConstraints(minHeight: OL.rowHeight),
      decoration: BoxDecoration(
        color: OL.grandTotalBg,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(12),
          bottomRight: Radius.circular(12),
        ),
        border: Border.all(color: OL.borderColor, width: OL.borderWidth),
      ),
      child: Row(children: [
        const SizedBox(
          width: tc,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Text('TOTAL', style: kGrandTotalStyle),
          ),
        ),
        for (final v in [tm, tf, tt])
          Container(
            width: nc,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              border: Border(
                  left:
                      BorderSide(color: OL.borderColor, width: OL.borderWidth)),
            ),
            child: Text(v == 0 ? '—' : '$v', style: kGrandTotalStyle),
          ),
      ]),
    );

    final needsScroll = totalTableWidth > availableWidth;

    final tableContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [headerRow, ...dataRows, grandTotalRow],
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(kRadiusMd),
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          border: Border.all(color: kBorder, width: 1),
          boxShadow: kShadowCard,
        ),
        child: needsScroll
            ? SingleChildScrollView(
                scrollDirection: Axis.horizontal, child: tableContent)
            : tableContent,
      ),
    );
  }
}

class _HybridDataRow extends StatelessWidget {
  final int index;
  final double tc;
  final double nc;
  final String tid;
  final String mid;
  final String fid;
  final int tot;
  final String rowLabel;
  final bool isEven;
  final List<String> allCells;
  final String fieldId;
  final OnefopFormController ctrl;
  final String tableId;

  const _HybridDataRow({
    required this.index,
    required this.tc,
    required this.nc,
    required this.tid,
    required this.mid,
    required this.fid,
    required this.tot,
    required this.rowLabel,
    required this.isEven,
    required this.allCells,
    required this.fieldId,
    required this.ctrl,
    required this.tableId,
  });

  @override
  Widget build(BuildContext context) {
    final rowBg = isEven ? OL.tableRowEven : OL.tableRowOdd;
    // ── FIX: IntrinsicHeight so the Row with crossAxisAlignment.stretch
    // receives a finite height, preventing "BoxConstraints forces an
    // infinite height" which crashed section3/section4 pages entirely.
    return IntrinsicHeight(
      child: Container(
        constraints: const BoxConstraints(minHeight: OL.rowHeight),
        decoration: BoxDecoration(
          color: rowBg,
          border: const Border(
            left: BorderSide(color: OL.borderColor, width: OL.borderWidth),
            right: BorderSide(color: OL.borderColor, width: OL.borderWidth),
            bottom: BorderSide(color: OL.borderColor, width: OL.borderWidth),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: tc,
              child: TextFormField(
                controller: ctrl.hybridController(tid),
                style: kTableDataStyle,
                maxLines: 3, // bounded — avoids infinite height inside Row
                minLines: 1,
                // See number_field.dart: default onTapOutside would close
                // the keyboard on the touch that starts a scroll gesture on
                // mobile web.
                onTapOutside: (_) {},
                decoration: InputDecoration(
                  hintText: rowLabel,
                  hintStyle: const TextStyle(fontSize: 13, color: kInkFaint),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: OL.cellPadH + 4, vertical: 10),
                  isDense: false,
                ),
              ),
            ),
            Container(
              width: nc,
              decoration: const BoxDecoration(
                color: OL.inputCellBg,
                border: Border(
                    left: BorderSide(
                        color: OL.borderColor, width: OL.borderWidth)),
              ),
              child: HybridNumericCell(
                cellId: mid,
                value: ctrl.aGrid[mid] ?? 0,
                onChanged: ctrl.onGridCellChanged,
                fm: ctrl.fm,
                tableId: tableId,
                allCells: allCells,
                rowWidth: 2,
                onExitTable: () => ctrl.exitTable(fieldId),
                onExitPrevious: () => ctrl.exitTablePrevious(fieldId),
              ),
            ),
            Container(
              width: nc,
              decoration: const BoxDecoration(
                color: OL.inputCellBg,
                border: Border(
                    left: BorderSide(
                        color: OL.borderColor, width: OL.borderWidth)),
              ),
              child: HybridNumericCell(
                cellId: fid,
                value: ctrl.aGrid[fid] ?? 0,
                onChanged: ctrl.onGridCellChanged,
                fm: ctrl.fm,
                tableId: tableId,
                allCells: allCells,
                rowWidth: 2,
                onExitTable: () => ctrl.exitTable(fieldId),
                onExitPrevious: () => ctrl.exitTablePrevious(fieldId),
              ),
            ),
            Container(
              width: nc,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: tot > 0 ? OL.totalCellBg : OL.inputCellBgTotal,
                border: const Border(
                    left: BorderSide(
                        color: OL.borderColor, width: OL.borderWidth)),
              ),
              child: Text(
                tot == 0 ? '—' : '$tot',
                style: tot > 0
                    ? kTotalStyle
                    : kTableDataStyle.copyWith(color: kInkFaint),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// HYBRID TABLE — MOBILE CARDS
//
// One card per row: full-width label field, then a Row of 3
// Expanded Homme/Femme/Total cells below it. Replaces the fixed
// 200px-label + 3×100px-numeric Row layout that can't fit a phone
// screen without horizontal scrolling.
// ══════════════════════════════════════════════════════════════

class _HybridMobileDataCard extends StatelessWidget {
  final String tid;
  final String mid;
  final String fid;
  final int tot;
  final String rowLabel;
  final List<String> allCells;
  final String fieldId;
  final OnefopFormController ctrl;
  final String tableId;

  const _HybridMobileDataCard({
    required this.tid,
    required this.mid,
    required this.fid,
    required this.tot,
    required this.rowLabel,
    required this.allCells,
    required this.fieldId,
    required this.ctrl,
    required this.tableId,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          TextFormField(
            controller: ctrl.hybridController(tid),
            style: kTableDataStyle,
            maxLines: 3,
            minLines: 1,
            // See number_field.dart: default onTapOutside would close the
            // keyboard on the touch that starts a scroll gesture on mobile
            // web.
            onTapOutside: (_) {},
            decoration: InputDecoration(
              hintText: rowLabel,
              hintStyle: const TextStyle(fontSize: 13, color: kInkFaint),
              isDense: true,
              filled: true,
              fillColor: kFieldFill,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(kRadiusSm),
                borderSide: const BorderSide(color: kBorder, width: 1),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _HybridMobileNumField(
                  label: context.l10n.male,
                  cellId: mid,
                  value: ctrl.aGrid[mid] ?? 0,
                  ctrl: ctrl,
                  tableId: tableId,
                  allCells: allCells,
                  onExitTable: () => ctrl.exitTable(fieldId),
                  onExitPrevious: () => ctrl.exitTablePrevious(fieldId),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _HybridMobileNumField(
                  label: context.l10n.female,
                  cellId: fid,
                  value: ctrl.aGrid[fid] ?? 0,
                  ctrl: ctrl,
                  tableId: tableId,
                  allCells: allCells,
                  onExitTable: () => ctrl.exitTable(fieldId),
                  onExitPrevious: () => ctrl.exitTablePrevious(fieldId),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _HybridMobileReadOnlyCell(label: 'Total', value: tot),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HybridMobileNumField extends StatelessWidget {
  final String label;
  final String cellId;
  final int value;
  final OnefopFormController ctrl;
  final String tableId;
  final List<String> allCells;
  final VoidCallback onExitTable;
  final VoidCallback onExitPrevious;

  const _HybridMobileNumField({
    required this.label,
    required this.cellId,
    required this.value,
    required this.ctrl,
    required this.tableId,
    required this.allCells,
    required this.onExitTable,
    required this.onExitPrevious,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: kInkFaint),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        const SizedBox(height: 4),
        Container(
          decoration: BoxDecoration(
            color: OL.inputCellBg,
            border: Border.all(color: kBorder, width: 1),
            borderRadius: BorderRadius.circular(kRadiusSm),
          ),
          // Tight-sized (not just min-height) so the field's actual
          // focusable area — not merely its decoration — is a real
          // touch target, matching MobileCardTable's approach.
          child: SizedBox(
            height: 44,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: HybridNumericCell(
                cellId: cellId,
                value: value,
                onChanged: ctrl.onGridCellChanged,
                fm: ctrl.fm,
                tableId: tableId,
                allCells: allCells,
                rowWidth: 2,
                onExitTable: onExitTable,
                onExitPrevious: onExitPrevious,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _HybridMobileReadOnlyCell extends StatelessWidget {
  final String label;
  final int value;
  const _HybridMobileReadOnlyCell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: kInkFaint),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        const SizedBox(height: 4),
        Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: value > 0 ? OL.totalCellBg : OL.inputCellBgTotal,
            border: Border.all(color: kBorder, width: 1),
            borderRadius: BorderRadius.circular(kRadiusSm),
          ),
          child: Text(
            value == 0 ? '—' : '$value',
            style: value > 0
                ? kTotalStyle
                : kTableDataStyle.copyWith(color: kInkFaint),
          ),
        ),
      ],
    );
  }
}

class _HybridMobileTotalCard extends StatelessWidget {
  final int male;
  final int female;
  final int total;
  const _HybridMobileTotalCard(
      {required this.male, required this.female, required this.total});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: OL.grandTotalBg,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const Text('TOTAL', style: kGrandTotalStyle),
          const Spacer(),
          for (final v in [
            ('H', male),
            ('F', female),
            ('T', total),
          ]) ...[
            Text('${v.$1}: ${v.$2 == 0 ? '—' : v.$2}', style: kGrandTotalStyle),
            const SizedBox(width: 12),
          ],
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// HYBRID NUMERIC CELL
// ══════════════════════════════════════════════════════════════

class HybridNumericCell extends StatefulWidget {
  final String cellId;
  final int value;
  final void Function(String, int?) onChanged;
  final UnifiedFocusManagerV2 fm;
  final String tableId;
  final List<String> allCells;
  final int rowWidth;
  final VoidCallback onExitTable;
  final VoidCallback onExitPrevious;

  const HybridNumericCell({
    super.key,
    required this.cellId,
    required this.value,
    required this.onChanged,
    required this.fm,
    required this.tableId,
    required this.allCells,
    required this.rowWidth,
    required this.onExitTable,
    required this.onExitPrevious,
  });

  @override
  State<HybridNumericCell> createState() => _HybridNumericCellState();
}

class _HybridNumericCellState extends State<HybridNumericCell> {
  late final TextEditingController _c;
  FocusNode get _n => widget.fm.node(widget.cellId);
  String _t(int v) => v == 0 ? '' : '$v';

  @override
  void initState() {
    super.initState();
    _c = TextEditingController(text: _t(widget.value));
    _n.onKeyEvent = _key;
    _n.addListener(_onFocusChange);
  }

  // Enter/Next moves focus straight to the next cell (see _key), which can
  // land outside the viewport — scroll it into view. Mirrors NumberField's
  // identical fix in shared/number_field.dart (this is a separate, older
  // duplicate of that widget used only by the hybrid reason/skill/domain
  // tables, so it needed the same fix applied here too).
  void _onFocusChange() {
    if (!_n.hasFocus) return;
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

  KeyEventResult _key(FocusNode n, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final kb = HardwareKeyboard.instance;
    final idx = widget.allCells.indexOf(widget.cellId);
    if (idx < 0) return widget.fm.handleKey(n, e, gridId: widget.tableId);

    final row = idx ~/ widget.rowWidth;
    final col = idx % widget.rowWidth;
    final totalRows = (widget.allCells.length / widget.rowWidth).ceil();

    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowRight)) {
      if (col < widget.rowWidth - 1 && idx < widget.allCells.length - 1) {
        widget.fm.focus(widget.allCells[idx + 1]);
      } else if (row < totalRows - 1) {
        widget.fm.focus(widget.allCells[(row + 1) * widget.rowWidth]);
      } else {
        widget.onExitTable();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowLeft)) {
      if (col > 0) {
        widget.fm.focus(widget.allCells[idx - 1]);
      } else if (row > 0) {
        widget.fm.focus(widget.allCells[row * widget.rowWidth - 1]);
      } else {
        widget.onExitPrevious();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowDown)) {
      final nextIdx = (row + 1) * widget.rowWidth + col;
      if (nextIdx < widget.allCells.length) {
        widget.fm.focus(widget.allCells[nextIdx]);
      } else {
        widget.onExitTable();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.arrowUp)) {
      final prevIdx = (row - 1) * widget.rowWidth + col;
      if (prevIdx >= 0) {
        widget.fm.focus(widget.allCells[prevIdx]);
      } else {
        widget.onExitPrevious();
      }
      return KeyEventResult.handled;
    }
    if (kb.isLogicalKeyPressed(LogicalKeyboardKey.enter) ||
        kb.isLogicalKeyPressed(LogicalKeyboardKey.tab)) {
      if (kb.isShiftPressed) {
        if (idx > 0) {
          widget.fm.focus(widget.allCells[idx - 1]);
        } else {
          widget.onExitPrevious();
        }
      } else {
        if (idx < widget.allCells.length - 1) {
          widget.fm.focus(widget.allCells[idx + 1]);
        } else {
          widget.onExitTable();
        }
      }
      return KeyEventResult.handled;
    }
    return widget.fm.handleKey(n, e, gridId: widget.tableId);
  }

  @override
  void didUpdateWidget(HybridNumericCell old) {
    super.didUpdateWidget(old);
    if (old.tableId != widget.tableId || old.fm != widget.fm) {
      old.fm.node(old.cellId).removeListener(_onFocusChange);
      _n.onKeyEvent = _key;
      _n.addListener(_onFocusChange);
    }
    if (old.value != widget.value) {
      final t = _t(widget.value);
      if (_c.text != t) _c.text = t;
    }
  }

  @override
  void dispose() {
    _n.onKeyEvent = null;
    _n.removeListener(_onFocusChange);
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _n,
        builder: (ctx, _) {
          // Center: see number_field.dart — an isDense+zero-padding
          // TextField collapses to its intrinsic height and pins to the top
          // of whatever height its ancestor gives it, so the caret sits
          // near the top of the cell instead of vertically centered without
          // this wrapper.
          return Center(
            child: Container(
              margin: const EdgeInsets.all(4),
              child: TextField(
                controller: _c,
                focusNode: _n,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                // See number_field.dart: default onTapOutside would close the
                // keyboard on the touch that starts a scroll gesture on
                // mobile web.
                onTapOutside: (_) {},
                textAlign: TextAlign.center,
                textAlignVertical: TextAlignVertical.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: const TextStyle(
                    fontSize: kNumCellFontSize,
                    fontWeight: FontWeight.w500,
                    color: kInk),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
                onChanged: (v) =>
                    widget.onChanged(widget.cellId, int.tryParse(v) ?? 0),
                onSubmitted: (_) => _key(
                    _n,
                    const KeyDownEvent(
                      physicalKey: PhysicalKeyboardKey.enter,
                      logicalKey: LogicalKeyboardKey.enter,
                      timeStamp: Duration.zero,
                    )),
              ),
            ),
          );
        },
      );
}

// ══════════════════════════════════════════════════════════════
// HIGHLIGHT BLOCK
// ══════════════════════════════════════════════════════════════

class HighlightBlock extends StatefulWidget {
  final String fieldId;
  final UnifiedFocusManagerV2 fm;
  final bool isTable;
  final Widget child;

  const HighlightBlock({
    super.key,
    required this.fieldId,
    required this.fm,
    required this.isTable,
    required this.child,
  });

  @override
  State<HighlightBlock> createState() => _HighlightBlockState();
}

class _HighlightBlockState extends State<HighlightBlock> {
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    widget.fm.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(HighlightBlock old) {
    super.didUpdateWidget(old);
    if (old.fm != widget.fm) {
      old.fm.removeListener(_onFocusChange);
      widget.fm.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    widget.fm.removeListener(_onFocusChange);
    super.dispose();
  }

  void _onFocusChange() {
    final active = widget.fm.activeId;
    final isFocused = active == widget.fieldId;
    if (isFocused != _focused) {
      setState(() => _focused = isFocused);
      if (isFocused && mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          // `mounted`, not `context.mounted` — State.context itself throws
          // once the state is defunct, so checking .mounted on it doesn't
          // guard anything; the unit-reveal widgets now unmount/remount
          // fields far more often (only the active unit stays mounted),
          // making this race actually reachable.
          if (mounted) {
            Scrollable.ensureVisible(
              context,
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOut,
              alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
            );
          }
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: widget.isTable ? 0 : 4,
      ),
      child: widget.child,
    );
  }
}

// ══════════════════════════════════════════════════════════════
// RADIO OPTION
// ══════════════════════════════════════════════════════════════

class RadioOption extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const RadioOption(
      {super.key,
      required this.label,
      required this.isSelected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(kRadiusSm),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? kAccentSoft : Colors.transparent,
            border: Border.all(
              color: isSelected ? kAccent : kBorder,
              width: isSelected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(kRadiusSm),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                        color: kAccent.withValues(alpha: 0.10),
                        blurRadius: 8,
                        offset: const Offset(0, 2)),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: isSelected ? kAccent : kInkFaint, width: 2),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: isSelected
                      ? const DecoratedBox(
                          decoration: BoxDecoration(
                              shape: BoxShape.circle, color: kAccent))
                      : const SizedBox.shrink(),
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: isSelected ? kInk : kInkSoft,
                    )),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION COMPLETION BADGE  (used inside the app bar's section row)
// ══════════════════════════════════════════════════════════════

class SectionCompletionBadge extends StatelessWidget {
  final bool isComplete;
  const SectionCompletionBadge({super.key, required this.isComplete});

  @override
  Widget build(BuildContext context) {
    if (isComplete) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: kSuccess,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check, color: Colors.white, size: 12),
            const SizedBox(width: 4),
            Text(
              context.l10n.sectionComplete,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: kWarningSoft,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kWarning.withValues(alpha: 0.4), width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.pending, color: kWarning, size: 12),
          const SizedBox(width: 4),
          Text(
            context.l10n.sectionInProgress,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: kWarning,
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════

class Sidebar extends StatelessWidget {
  final OnefopFormController ctrl;
  final EntityType entityType;
  const Sidebar({super.key, required this.ctrl, required this.entityType});

  @override
  Widget build(BuildContext context) {
    if (ctrl.schema == null) return const SizedBox(width: 0);

    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (_, __, ___) => AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        width: _width,
        color: kCanvas,
        child: ClipRect(
          child: OverflowBox(
            alignment: Alignment.topLeft,
            maxWidth: kSidebarFullWidth,
            child: SizedBox(
              width: kSidebarFullWidth,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sidebarHeader(context),
                  if (ctrl.sidebarMode == 2) ...[
                    Container(
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: kBorder)),
                      ),
                      child: Column(
                        children: [_progressHeader(), _progressBar()],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Expanded(
                    child: ListView.builder(
                      padding: EdgeInsets.symmetric(
                          horizontal: ctrl.sidebarMode == 2 ? 8 : 4,
                          vertical: 4),
                      itemCount: ctrl.pageCount,
                      itemBuilder: (ctx, page) => _SidebarPageItem(
                        ctrl: ctrl,
                        page: page,
                        entityType: entityType,
                      ),
                    ),
                  ),
                  if (ctrl.sidebarMode == 2) _autosaveIndicator(context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  double get _width {
    switch (ctrl.sidebarMode) {
      case 0:
        return 0;
      case 1:
        return kSidebarCollapsedWidth;
      default:
        return kSidebarFullWidth;
    }
  }

  Widget _sidebarHeader(BuildContext context) {
    if (ctrl.sidebarMode == 1) {
      return Container(
        height: kOnefopHeaderHeight,
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: kBorder)),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            const Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.only(top: 4),
                child: SizedBox(
                  width: 30,
                  height: 30,
                  child: RailLogo(isExpanded: false),
                ),
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: _toggleButton(context, compact: true),
            ),
          ],
        ),
      );
    }

    return Container(
      height: kOnefopHeaderHeight,
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: kBorder)),
      ),
      child: Row(
        children: [
          const Expanded(child: RailLogo(isExpanded: false)),
          _toggleButton(context),
        ],
      ),
    );
  }

  Widget _toggleButton(BuildContext context, {bool compact = false}) {
    final l10n = context.l10n;
    IconData icon;
    String tooltip;
    switch (ctrl.sidebarMode) {
      case 2:
        icon = Icons.chevron_left;
        tooltip = l10n.collapseSidebar;
        break;
      case 1:
        icon = Icons.last_page;
        tooltip = l10n.showSidebar;
        break;
      default:
        icon = Icons.menu;
        tooltip = l10n.showSidebar;
    }
    return Align(
      alignment: ctrl.sidebarMode == 1
          ? Alignment.topLeft
          : Alignment.topRight,
      child: Padding(
        padding: EdgeInsets.only(
        top: 0, left: ctrl.sidebarMode == 1 && !compact ? 11 : 0, right: 0),
        child: Tooltip(
          message: tooltip,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => ctrl.setSidebarMode(
                  ctrl.sidebarMode == 1 ? 2 : (ctrl.sidebarMode + 2) % 3),
              borderRadius: BorderRadius.circular(10),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOut,
                width: compact ? 26 : 34,
                height: compact ? 26 : 34,
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kBorder),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x120F172A),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 160),
                  transitionBuilder: (child, animation) => ScaleTransition(
                    scale: animation,
                    child: child,
                  ),
                  child: Icon(
                    icon,
                    key: ValueKey(icon),
                    size: compact ? 15 : 18,
                    color: kAccent,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _progressHeader() {
    final secs = ctrl.schema!.sections;
    final done = ctrl.valid.values.where((v) => v).length;
    final ratio = done / secs.length.clamp(1, 999);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(children: [
        Text('$done/${secs.length}',
            style: const TextStyle(fontSize: 12, color: kInkSoft)),
        const Spacer(),
        Text('${(ratio * 100).round()}%',
            style: const TextStyle(
                fontSize: 12, fontWeight: FontWeight.w700, color: kAccent)),
      ]),
    );
  }

  Widget _progressBar() {
    final secs = ctrl.schema!.sections;
    final done = ctrl.valid.values.where((v) => v).length;
    final ratio = done / secs.length.clamp(1, 999);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          value: ratio,
          backgroundColor: kBorder,
          valueColor: const AlwaysStoppedAnimation<Color>(kSuccess),
          minHeight: 6,
        ),
      ),
    );
  }

  Widget _autosaveIndicator(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: kBorder, width: 1))),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        transitionBuilder: (child, anim) =>
            FadeTransition(opacity: anim, child: child),
        child: ctrl.saving
            ? Row(key: const ValueKey('s'), children: [
                const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: kInkFaint)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(l10n.saving,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: kInkFaint)),
                ),
              ])
            : ctrl.dirty
                ? Row(key: const ValueKey('d'), children: [
                    const Icon(Icons.circle, size: 8, color: kWarning),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(l10n.unsaved,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: kWarning)),
                    ),
                  ])
                : Row(key: const ValueKey('ok'), children: [
                    const Icon(Icons.check_circle_outline,
                        size: 14, color: kSuccess),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(l10n.saved,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, color: kSuccess)),
                    ),
                  ]),
      ),
    );
  }
}

class _SidebarPageItem extends StatelessWidget {
  final OnefopFormController ctrl;
  final int page;
  final EntityType entityType;
  const _SidebarPageItem({required this.ctrl, required this.page, required this.entityType});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final idxs = ctrl.sectionIndicesForPage(page);
    final allDone =
        idxs.every((i) => ctrl.valid[ctrl.schema!.sections[i].id] ?? false);
    final isActive = page == ctrl.currentPage;
    int missingCount = 0;
    for (final i in idxs) {
      missingCount += ctrl.missingLabels(ctrl.schema!.sections[i], locale).length;
    }
    final firstSec = idxs.isNotEmpty ? ctrl.schema!.sections[idxs.first] : null;
    final meta = firstSec != null ? kSidebarMeta[firstSec.id] : null;
    final label = meta?.label.of(locale) ?? context.l10n.sectionFallback(page + 1);

    // Only the active item, and only once there's room for text (full
    // sidebar, not the icon-only collapsed rail) — the same subsection →
    // question-code breakdown OnefopSectionMap already shows above the
    // active table, surfaced here too so the vertical tab itself reads as
    // a real outline of where you are, not just "which of 5 sections".
    // simpleFieldsBuilder is a throwaway: this list is only ever read for
    // its labels/done-state (subsectionLabel, shortLabel, hasData/
    // canAdvance), never actually built into a widget.
    final units = (isActive && ctrl.sidebarMode == 2 && firstSec != null)
        ? buildTableGroupUnits(
            ctrl,
            firstSec,
            locale,
            entityType: entityType,
            simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
            mobile: false,
          )
        : const <SectionUnit>[];

    return InkWell(
      // Section click: jump to this section's very first question, not
      // wherever Back/Next progress last left off — see navigateToSection.
      onTap: firstSec == null
          ? null
          : () => navigateToSection(ctrl, locale, entityType, firstSec.id),
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        margin: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
        padding: EdgeInsets.symmetric(
            horizontal: ctrl.sidebarMode == 2 ? 12 : 8,
            vertical: ctrl.sidebarMode == 2 ? 12 : 8),
        decoration: BoxDecoration(
          color: isActive ? kAccentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isActive
              ? Border.all(color: kAccent.withValues(alpha: 0.35), width: 1)
              : null,
        ),
        child: Row(children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: allDone
                  ? kSuccess
                  : isActive
                      ? kAccent
                      : kBorder,
            ),
            alignment: Alignment.center,
            child: allDone
                ? const Icon(Icons.check, color: Colors.white, size: 14)
                : (isActive && meta != null)
                    ? Icon(meta.icon, color: Colors.white, size: 14)
                    : Text('${page + 1}',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isActive ? Colors.white : kInkFaint)),
          ),
          if (ctrl.sidebarMode == 2) ...[
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive ? kInk : kInkSoft),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  if (!allDone && missingCount > 0)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                          color: kWarningSoft,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: kWarning.withValues(alpha: 0.4),
                              width: 0.5)),
                      child: Text(
                          missingCount == 1
                              ? context.l10n.missingFieldTitle
                              : context.l10n.missingFieldsTitle(missingCount),
                          style: const TextStyle(
                              fontSize: 10,
                              color: kWarning,
                              fontWeight: FontWeight.w600)),
                    ),
                  if (isActive && units.length > 1)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: OnefopSectionMap(
                        ctrl: ctrl,
                        units: units,
                        currentIndex: (ctrl.unitCursor(firstSec!.id) ??
                                currentUnitIndex(ctrl, units))
                            .clamp(0, units.length - 1),
                        onJump: (i) => jumpToUnit(ctrl, firstSec, units, i),
                        onJumpToLocation: (i) => jumpToLocation(ctrl, firstSec, units, i),
                      ),
                    ),
                ],
              ),
            ),
            if (allDone)
              const Icon(Icons.check_circle, size: 16, color: kSuccess),
          ],
        ]),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// STEPPER STRIP (Mobile)
// ══════════════════════════════════════════════════════════════

// Fixed-width, horizontally-scrolling items (rather than an N-way
// Expanded split) so each step keeps a comfortable, constant width no
// matter how many sections the flow has — a Row of Expanded items
// squeezed labels down to nothing once a flow reached 6+ steps.
// Replaces the old horizontally-scrolling StepperStrip: a full row of
// numbered circles cost ~68px of vertical space and its own horizontal
// scroll on a phone-width viewport, for information (section position,
// completion) that's cheaper to show as text. This is a single compact
// row (~34px) — section name, "N / total", a hairline progress bar, and
// (when a question is focused) its paper code — so more of the screen
// stays available for the actual question content. No tap-to-jump; on
// mobile that's Précédent/Suivant in the NavBar below the form instead.
class MobileContextHeader extends StatelessWidget {
  final OnefopFormController ctrl;
  const MobileContextHeader({super.key, required this.ctrl});

  @override
  Widget build(BuildContext context) {
    if (ctrl.schema == null) return const SizedBox.shrink();
    final page = ctrl.currentPage + 1;
    final total = ctrl.pageCount;
    final sectionId = ctrl.primarySection(ctrl.currentPage)?.id;
    final sectionLabel = sectionId == null
        ? null
        : kSidebarMeta[sectionId]?.label.of(context.loc);
    final positionText = sectionLabel == null
        ? 'Section $page / $total'
        : '$sectionLabel  ·  $page / $total';

    // The question-code chip depends on which field/cell currently has
    // focus, which changes without the controller itself notifying (focus
    // moves go through UnifiedFocusManagerV2, a separate ChangeNotifier) —
    // listen to ctrl.fm directly so the chip updates as the user tabs
    // through fields, not just on page change.
    return AnimatedBuilder(
      animation: ctrl.fm,
      builder: (context, _) {
        final code = ctrl.activeField?.paperCode;
        return Container(
          color: kSurface,
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      positionText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: kInk),
                    ),
                  ),
                  if (code != null && code.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: kAccentSoft,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(code,
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: kAccent)),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: SizedBox(
                  height: 3,
                  child: LinearProgressIndicator(
                    value: total == 0 ? 0 : (page / total).clamp(0.0, 1.0),
                    backgroundColor: kBorder,
                    valueColor: const AlwaysStoppedAnimation<Color>(kAccent),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════════════
// APP BAR
// ══════════════════════════════════════════════════════════════

const double kSectionHeaderRowHeight = 32.0;
const double kAppBarToolbarHeight = 40.0;
const double _kSectionRowPaddingV = 4.0;

class OnefopAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool loading;
  final bool saving;
  final bool dirty;
  final VoidCallback? onCancel;
  final VoidCallback? onOpenDrafts;
  final String? sectionTitle;
  final IconData? sectionIcon;
  final bool sectionComplete;
  // Desktop-only Simple/Spreadsheet mode toggle (or any other trailing
  // widget) — rendered in the actions row, ahead of the drafts/cancel
  // icons, so it stays visible regardless of which shell renders below.
  final Widget? trailing;

  const OnefopAppBar({
    super.key,
    required this.title,
    required this.loading,
    required this.saving,
    required this.dirty,
    this.onCancel,
    this.onOpenDrafts,
    this.sectionTitle,
    this.sectionIcon,
    this.sectionComplete = false,
    this.trailing,
  });

  @override
  Size get preferredSize => Size.fromHeight(kAppBarToolbarHeight +
      (sectionTitle == null ? 0 : kSectionHeaderRowHeight));

  @override
  Widget build(BuildContext context) {
    // Flat, bordered chrome (matches UltraTheme.border/ContentShell app-wide)
    // rather than a solid brand-color fill — the AppBar itself stays
    // transparent and this wrapping Container supplies the surface,
    // color, and hairline bottom border.
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        border: Border(bottom: BorderSide(color: kBorder, width: 1)),
      ),
      child: AppBar(
        title: Row(
          children: [
            const RailLogo(isExpanded: false),
            const SizedBox(width: 10),
            Expanded(
              child: Text(title,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: kInk,
        elevation: 0,
        toolbarHeight: kAppBarToolbarHeight,
        bottom: sectionTitle == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(kSectionHeaderRowHeight),
                // AppBar lays out `bottom` as a non-flexible child of an
                // internal Column, which hands it an unbounded height
                // constraint. PreferredSize only pins its own size, not its
                // child's, so without this explicit height NavigationToolbar
                // below receives Infinity and throws during layout.
                child: SizedBox(
                  height: kSectionHeaderRowHeight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: OL.sectionHeaderPaddingH,
                      vertical: _kSectionRowPaddingV,
                    ),
                    // Hairline separator from the title row above — same
                    // background color otherwise reads as one merged block,
                    // and this row's weight is dialed below the title's so it
                    // reads as subordinate context, not a second headline.
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: kBorder, width: 1)),
                    ),
                    // NavigationToolbar (the same widget AppBar uses
                    // internally) measures the leading/trailing slots and
                    // centers the middle title in the true remaining space,
                    // so the title stays centered even though the icon and
                    // the completion badge are different widths (and the
                    // badge's width changes between "En cours" and "Complet").
                    child: NavigationToolbar(
                      centerMiddle: true,
                      leading: sectionIcon == null
                          ? null
                          : Icon(sectionIcon, color: kInkFaint, size: 16),
                      middle: Text(
                        sectionTitle!,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: kInkSoft,
                        ),
                      ),
                      trailing:
                          SectionCompletionBadge(isComplete: sectionComplete),
                    ),
                  ),
                ),
              ),
        actions: [
          if (!loading)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: saving
                      ? const SizedBox(
                          key: ValueKey('s'),
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: kAccent))
                      : dirty
                          ? const Icon(
                              key: ValueKey('d'),
                              Icons.circle,
                              size: 8,
                              color: Color(0xFFD9B274))
                          : const Icon(
                              key: ValueKey('ok'),
                              Icons.cloud_done_outlined,
                              size: 18,
                              color: kInkFaint),
                ),
              ),
            ),
          if (trailing != null) ...[
            trailing!,
            const SizedBox(width: 12),
          ],
          if (onOpenDrafts != null)
            IconButton(
              icon: const Icon(Icons.drafts_outlined, color: kInkSoft),
              onPressed: onOpenDrafts,
            ),
          if (onCancel != null)
            TextButton(
              onPressed: onCancel,
              child: Text(context.l10n.cancelButton,
                  style: const TextStyle(color: kInkSoft, fontSize: 12)),
            ),
          const SizedBox(width: 8),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// SHELL TITLE BAR  (shared by OnefopExcelShell and SimpleModeShell so
// both desktop modes render exactly one app bar with exactly one logo —
// the Sidebar they both sit next to already carries its own RailLogo in
// its header, so this bar's leading slot is a mode icon, not a second
// logo. See onefop_excel_shell.dart / simple_mode_shell.dart.)
// ══════════════════════════════════════════════════════════════

class OnefopShellTitleBar extends StatelessWidget {
  final String title;
  final IconData leadingIcon;
  final bool dirty;
  final bool saving;
  final Future<void> Function()? onSaveNow;
  final VoidCallback? onOpenDrafts;
  final VoidCallback? onCancel;
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onModeChanged;
  const OnefopShellTitleBar({
    super.key,
    required this.title,
    required this.leadingIcon,
    required this.dirty,
    required this.saving,
    required this.mode,
    required this.onModeChanged,
    this.onSaveNow,
    this.onOpenDrafts,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      height: kOnefopHeaderHeight,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: kSurface,
        border: Border(bottom: BorderSide(color: kBorder, width: 1)),
      ),
      child: Row(
        children: [
          Icon(leadingIcon, color: kAccent, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: kInk, fontWeight: FontWeight.w600, fontSize: 13.5),
            ),
          ),
          if (saving)
            _ShellStatusChip(
              icon: Icons.sync_rounded,
              label:
                  const LocalizedText(fr: 'Enregistrement…', en: 'Saving…').of(locale),
            )
          else if (dirty)
            _ShellStatusChip(
              icon: Icons.cloud_off_rounded,
              label: const LocalizedText(fr: 'Non enregistré', en: 'Unsaved').of(locale),
            )
          else
            _ShellStatusChip(
              icon: Icons.check_circle_outline_rounded,
              label: const LocalizedText(fr: 'Enregistré', en: 'Saved').of(locale),
            ),
          const SizedBox(width: 8),
          OnefopModeDropdown(mode: mode, onChanged: onModeChanged),
          if (onSaveNow != null) ...[
            const SizedBox(width: 8),
            _ShellBarButton(
              icon: Icons.save_outlined,
              label: const LocalizedText(fr: 'Enregistrer', en: 'Save').of(locale),
              color: kAccent,
              onPressed: dirty || saving ? () => onSaveNow!() : null,
            ),
          ],
          if (onOpenDrafts != null) ...[
            const SizedBox(width: 8),
            _ShellBarButton(
              icon: Icons.folder_open_rounded,
              color: kInkSoft,
              onPressed: onOpenDrafts,
              tooltip: const LocalizedText(fr: 'Brouillons', en: 'Drafts').of(locale),
            ),
          ],
          if (onCancel != null) ...[
            const SizedBox(width: 8),
            _ShellBarButton(
              icon: Icons.chevron_left_rounded,
              label: const LocalizedText(fr: 'Tableau de bord', en: 'Dashboard').of(locale),
              color: kAccent,
              onPressed: onCancel,
            ),
          ],
        ],
      ),
    );
  }
}

/// One consistent bordered-pill control for OnefopShellTitleBar's trailing
/// buttons (Save, Drafts, Dashboard) — same height/border/radius as
/// OnefopModeDropdown's own box, with an icon-only pill (no [label]) for
/// Drafts landing narrower than the labeled ones purely because it has
/// less content to pad around, not because it's styled differently.
class _ShellBarButton extends StatelessWidget {
  final IconData icon;
  final String? label;
  final Color color;
  final VoidCallback? onPressed;
  final String? tooltip;
  const _ShellBarButton({
    required this.icon,
    this.label,
    required this.color,
    required this.onPressed,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final fg = onPressed != null ? color : kInkFaint;
    final button = Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          height: kShellBarButtonHeight,
          padding: EdgeInsets.symmetric(horizontal: label == null ? 7 : 10),
          decoration: BoxDecoration(
            border: Border.all(color: kBorder),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: fg),
              if (label != null) ...[
                const SizedBox(width: 6),
                Text(label!,
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
              ],
            ],
          ),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

class _ShellStatusChip extends StatelessWidget {
  final IconData icon;
  final String label;
  const _ShellStatusChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: kAccent),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: kInkSoft, fontSize: 11.5)),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// MODE TOGGLE  (desktop-only Simple / Spreadsheet — see
// onefop_mode_provider.dart)
// ══════════════════════════════════════════════════════════════

String _modeLabel(OnefopViewMode m, Locale locale) => m == OnefopViewMode.simple
    ? const LocalizedText.same('Simple').of(locale)
    : const LocalizedText(fr: 'Feuille de calcul', en: 'Spreadsheet').of(locale);

class OnefopModeToggle extends StatelessWidget {
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onChanged;
  const OnefopModeToggle({super.key, required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: kCanvas,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _segment(_modeLabel(OnefopViewMode.simple, context.loc), OnefopViewMode.simple),
          _segment(
              _modeLabel(OnefopViewMode.spreadsheet, context.loc), OnefopViewMode.spreadsheet),
        ],
      ),
    );
  }

  Widget _segment(String label, OnefopViewMode value) {
    final selected = mode == value;
    return InkWell(
      onTap: () => onChanged(value),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? kAccent : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : kInkSoft,
          ),
        ),
      ),
    );
  }
}

/// Simple/Spreadsheet mode switch for the excel shell's title bar
/// (OnefopExcelShell's _TitleBar, kSurface/white background) — opens a
/// small popup menu rather than OnefopModeToggle's two-segment pill, which
/// read as too heavy for this title bar's tighter row of controls.
class OnefopModeDropdown extends StatelessWidget {
  final OnefopViewMode mode;
  final void Function(OnefopViewMode) onChanged;
  const OnefopModeDropdown({super.key, required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return PopupMenuButton<OnefopViewMode>(
      initialValue: mode,
      onSelected: onChanged,
      tooltip: '',
      offset: const Offset(0, 32),
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusSm)),
      itemBuilder: (context) => [
        for (final m in OnefopViewMode.values)
          PopupMenuItem(
            value: m,
            child: Row(
              children: [
                Icon(
                  m == mode ? Icons.check_rounded : null,
                  size: 16,
                  color: kAccent,
                ),
                const SizedBox(width: 8),
                Text(_modeLabel(m, locale), style: const TextStyle(fontSize: 13, color: kInk)),
              ],
            ),
          ),
      ],
      child: Container(
        height: kShellBarButtonHeight,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _modeLabel(mode, locale),
              style: const TextStyle(
                  color: kInkSoft, fontSize: 12, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: kInkSoft),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// SKELETONS
// ══════════════════════════════════════════════════════════════

class SkeletonLine extends StatelessWidget {
  final double width;
  final double height;
  const SkeletonLine({super.key, required this.width, required this.height});

  @override
  Widget build(BuildContext context) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
            color: kBorder, borderRadius: BorderRadius.circular(6)),
      );
}

class SkeletonCircle extends StatelessWidget {
  final double size;
  const SkeletonCircle({super.key, required this.size});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(color: kBorder, shape: BoxShape.circle),
      );
}

class SkeletonScreen extends StatelessWidget {
  const SkeletonScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < 4; i++) ...[
                const Expanded(
                  child: Column(children: [
                    SkeletonCircle(size: 28),
                    SizedBox(height: 4),
                    SkeletonLine(width: 48, height: 10),
                  ]),
                ),
                if (i < 3)
                  const Expanded(child: SkeletonLine(width: 24, height: 2)),
              ],
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SkeletonLine(width: 160, height: 20),
                  const SizedBox(height: 16),
                  for (int i = 0; i < 6; i++) ...[
                    const SkeletonLine(width: double.infinity, height: 48),
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// DEFERRED REVEAL — spreads expensive widget construction (big
// tables) across several frames instead of all in the same frame
// a page navigation lands on. A section like "Emploi" can hold
// 200+ numeric cells across its tables; building all of them
// synchronously in one frame is real CPU work that reads as the
// tap "taking a moment to react". Staggering the reveal keeps
// every individual frame cheap so the tap itself feels instant,
// and the tables fill in progressively right behind it.
// ══════════════════════════════════════════════════════════════

class DeferredReveal extends StatefulWidget {
  final Widget placeholder;
  final WidgetBuilder builder;
  final Duration delay;

  const DeferredReveal({
    super.key,
    required this.placeholder,
    required this.builder,
    this.delay = Duration.zero,
  });

  @override
  State<DeferredReveal> createState() => _DeferredRevealState();
}

class _DeferredRevealState extends State<DeferredReveal> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.delay, () {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) =>
      _ready ? widget.builder(context) : widget.placeholder;
}

class TableSkeleton extends StatelessWidget {
  final double height;
  const TableSkeleton({super.key, this.height = 180});

  @override
  Widget build(BuildContext context) => Container(
        height: height,
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: OL.questionGapV),
        decoration: BoxDecoration(
          color: kFieldFill,
          borderRadius: BorderRadius.circular(kRadiusMd),
          border: Border.all(color: kBorder),
        ),
      );
}

// ══════════════════════════════════════════════════════════════
// TABLE JUMP NAV  (desktop only)
//
// A pinned chip bar shown above sections that stack several tables
// (e.g. section2 "Employment" has 8), so a user can hop straight to
// the one they need instead of scrolling past every table to find it.
// Chips are grouped by the field's `subsection` (e.g. "2.2
// RECRUTEMENTS") with a thin divider between groups.
// ══════════════════════════════════════════════════════════════

class JumpTarget {
  final String id;
  final String label;
  final String? groupLabel;
  const JumpTarget({required this.id, required this.label, this.groupLabel});
}

class TableJumpNav extends StatelessWidget {
  final List<JumpTarget> targets;
  final ValueChanged<String> onJump;

  const TableJumpNav({super.key, required this.targets, required this.onJump});

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[];
    String? lastGroup;
    for (final t in targets) {
      if (lastGroup != null && t.groupLabel != lastGroup) {
        chips.add(const Padding(
          padding: EdgeInsets.symmetric(horizontal: 6),
          child: SizedBox(
            height: 16,
            child: VerticalDivider(width: 1, thickness: 1, color: kBorder),
          ),
        ));
      }
      lastGroup = t.groupLabel;
      chips.add(Padding(
        padding: const EdgeInsets.only(right: 8),
        child: _JumpChip(label: t.label, onTap: () => onJump(t.id)),
      ));
    }

    return Container(
      decoration: const BoxDecoration(
        color: kCanvas,
        border: Border(bottom: BorderSide(color: kBorder, width: 1)),
      ),
      alignment: Alignment.center,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
        child: Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: OL.sectionBodyPaddingH, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.table_chart_outlined, size: 15, color: kInkFaint),
              const SizedBox(width: 8),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: chips),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _JumpChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _JumpChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: kFieldFill,
            border: Border.all(color: kBorder, width: 1),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: kInkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

class TableJumpNavDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  final double height;

  const TableJumpNavDelegate({required this.child, this.height = 44});

  @override
  double get minExtent => height;
  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      child;

  @override
  bool shouldRebuild(covariant TableJumpNavDelegate oldDelegate) => true;
}
