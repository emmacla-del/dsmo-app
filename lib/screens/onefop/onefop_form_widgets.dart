// lib/screens/onefop/onefop_form_widgets.dart
// ══════════════════════════════════════════════════════════════
// UI WIDGETS — Fields, Sidebar, NavBar, Skeletons, etc.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/unified_focus_manager_v2.dart';
import '../../core/focus/renderers/table_renderer.dart';
import '../../core/focus/renderers/onefop_layout_constants.dart';
import '../../core/focus/renderers/onefop_section_renderer.dart';
import '../../core/focus/utils/field_validator.dart';
import '../../core/focus/compiler/section_title_lookup.dart';

import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';

// ══════════════════════════════════════════════════════════════
// DATA MODELS
// ══════════════════════════════════════════════════════════════

class FieldGroup {
  final String? sub;
  final List<FieldSchema> fields;
  const FieldGroup({required this.sub, required this.fields});
}

List<FieldGroup> groupFields(List<FieldSchema> fields) {
  final groups = <FieldGroup>[];
  String? cSub;
  final cF = <FieldSchema>[];
  for (final f in fields) {
    final sub =
        (f.type == 'table' && f.subsection != null && f.subsection!.isNotEmpty)
            ? f.subsection
            : null;
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

String buildFieldLabel(OnefopFormController ctrl, FieldSchema f) {
  String label = ctrl.fieldLabel(f);
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
            child:
                Text(m, style: const TextStyle(fontSize: 12, color: kDanger)),
          ),
        ],
      ),
    );

InputDecoration inputDecoration(
    {required bool focused,
    required bool hasError,
    String? hint,
    String? helperText}) {
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
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kBorder, width: 1)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: BorderSide(color: hasError ? kDanger : kBorder, width: 1)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kAccent, width: 1.5)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: const BorderSide(color: kDanger, width: 1)),
  );
}

InputDecoration dropdownDecoration(bool hasError) => InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      filled: true,
      fillColor: hasError ? kDangerSoft : kFieldFill,
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(kRadiusSm),
          borderSide: const BorderSide(color: kBorder, width: 1)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(kRadiusSm),
          borderSide:
              BorderSide(color: hasError ? kDanger : kBorder, width: 1)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(kRadiusSm),
          borderSide: const BorderSide(color: kAccent, width: 1.5)),
    );

/// Upfront hint for fields capped by an input formatter, so hitting the
/// limit doesn't look like a dead keystroke with no explanation.
String? fieldHelperText(FieldSchema f) {
  if (f.type == 'tel') {
    return '9 chiffres, sans le 0 initial / 9 digits, no leading 0';
  }
  if (FieldValidator.isYearField(f)) return '4 chiffres / 4-digit year';
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

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field),
              required: field.required,
              optional: FieldValidator.kOptionalOverrides.contains(field.id),
            ),
            const SizedBox(height: OL.labelGapV),
            ListenableBuilder(
              listenable: fn,
              builder: (ctx, _) => TextFormField(
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
                    helperText: fieldHelperText(field)),
                onTapOutside: (_) => ctrl.onBlur(field.id),
                onFieldSubmitted: (_) {
                  ctrl.onBlur(field.id);
                  ctrl.focusFieldOffset(1);
                },
              ),
            ),
            if (e) errorRow(ctrl.errorText(field)!),
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
    final opts = field.options ?? [];
    final cur = ctrl.data[field.id] as String?;
    final e = ctrl.hasError(field);
    final horizontal = opts.length == 2;

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kDocWidth),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field),
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
                            label: o,
                            isSelected: cur == o,
                            onTap: () {
                              ctrl.fm.focus(field.id);
                              ctrl.setRadioValue(field, o);
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
              errorRow(
                  'Veuillez sélectionner une option / Please select an option'),
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
    final opts = field.options ?? [];
    final cur = ctrl.data[field.id] as String?;
    final e = ctrl.hasError(field);

    return Padding(
      padding: const EdgeInsets.only(bottom: OL.questionGapV),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            OnefopFieldLabel(
              label: buildFieldLabel(ctrl, field),
              required: field.required,
              optional: FieldValidator.kOptionalOverrides.contains(field.id),
            ),
            const SizedBox(height: OL.labelGapV),
            Focus(
              focusNode: ctrl.fm.getNode(field.id),
              child: DropdownButtonFormField<String>(
                initialValue: cur,
                hint: const Text('Sélectionner / Select',
                    style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8))),
                isExpanded: true,
                style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                items: opts
                    .map((o) => DropdownMenuItem(
                          value: o,
                          child: Text(o,
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF1E293B))),
                        ))
                    .toList(),
                onChanged: (v) => ctrl.onSelectChanged(field, v),
                decoration: dropdownDecoration(e),
              ),
            ),
            if (e && (cur == null || cur.isEmpty))
              errorRow(
                  'Veuillez sélectionner une option / Please select an option'),
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
    return TableRenderer.renderTable(
      field: field,
      gridValues: ctrl.aGrid,
      onCellChanged: ctrl.onGridCellChanged,
      focusManager: ctrl.fm,
      entityType: entityTypeString(ctrl.entityType),
      onExitTable: () => ctrl.exitTable(field.id),
      onExitPrevious: () => ctrl.exitTablePrevious(field.id),
      hybridController: ctrl.hybridController,
      mobile: MediaQuery.of(context).size.width < OL.pageWidth,
    );
  }
}

class HybridTableWidget extends StatelessWidget {
  final OnefopFormController ctrl;
  final FieldSchema field;
  const HybridTableWidget({super.key, required this.ctrl, required this.field});

  @override
  Widget build(BuildContext context) {
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
          questionText: field.questionText ?? field.label,
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: OL.questionGapV),
          child: LayoutBuilder(
            builder: (context, constraints) {
              return _HybridTableBody(
                ctrl: ctrl,
                pfx: pfx,
                def: def,
                tableLabel: kHybridColumnHeaders[pfx] ?? '',
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
              rowLabel: def.rowLabels[i],
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
        for (final col in ['Homme / Male', 'Femme / Female', 'Total'])
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
        rowLabel: def.rowLabels[i],
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
                  label: 'Homme / Male',
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
                  label: 'Femme / Female',
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
  final void Function(String, int) onChanged;
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
      _n.onKeyEvent = _key;
    }
    if (old.value != widget.value) {
      final t = _t(widget.value);
      if (_c.text != t) _c.text = t;
    }
  }

  @override
  void dispose() {
    _n.onKeyEvent = null;
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _n,
        builder: (ctx, _) {
          final focused = _n.hasFocus;
          return ColoredBox(
            color: focused ? kAccentSoft : Colors.transparent,
            child: TextField(
              controller: _c,
              focusNode: _n,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              textAlignVertical: TextAlignVertical.center,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(
                  fontSize: kNumCellFontSize,
                  fontWeight: FontWeight.w500,
                  color: kInk),
              decoration: InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintText: focused ? '0' : null,
                hintStyle:
                    const TextStyle(fontSize: kNumCellFontSize, color: kBorderStrong),
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
          if (context.mounted) {
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
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      margin: EdgeInsets.only(bottom: widget.isTable ? 0 : 4),
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 8,
        bottom: widget.isTable ? 0 : 8,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(kRadiusSm),
        color: _focused ? kAccentSoft : Colors.transparent,
        border: _focused
            ? const Border(left: BorderSide(color: kAccent, width: 3))
            : null,
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
                          decoration:
                              BoxDecoration(shape: BoxShape.circle, color: kAccent))
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
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check, color: Colors.white, size: 12),
            SizedBox(width: 4),
            Text(
              'Complet / Done',
              style: TextStyle(
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
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.pending, color: kWarning, size: 12),
          SizedBox(width: 4),
          Text(
            'En cours / Pending',
            style: TextStyle(
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
  const Sidebar({super.key, required this.ctrl});

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
                  _toggleButton(),
                  if (ctrl.sidebarMode == 2) ...[
                    _progressHeader(),
                    _progressBar(),
                    const Divider(height: 1, color: kBorder),
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
                      ),
                    ),
                  ),
                  if (ctrl.sidebarMode == 2) _autosaveIndicator(),
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

  Widget _toggleButton() {
    IconData icon;
    String tooltip;
    switch (ctrl.sidebarMode) {
      case 2:
        icon = Icons.chevron_left;
        tooltip = 'Réduire la barre / Collapse sidebar';
        break;
      case 1:
        icon = Icons.last_page;
        tooltip = 'Masquer la barre / Hide sidebar';
        break;
      default:
        icon = Icons.menu;
        tooltip = 'Afficher la barre / Show sidebar';
    }
    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.only(top: 6, right: 6),
        child: Tooltip(
          message: tooltip,
          child: InkWell(
            onTap: () => ctrl.setSidebarMode((ctrl.sidebarMode + 1) % 3),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: kFieldFill,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: kInkSoft),
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

  Widget _autosaveIndicator() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: kBorder, width: 1))),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          transitionBuilder: (child, anim) =>
              FadeTransition(opacity: anim, child: child),
          child: ctrl.saving
              ? const Row(
                  key: ValueKey('s'),
                  children: [
                      SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: kInkFaint)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text('Sauvegarde… / Saving…',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12, color: kInkFaint)),
                      ),
                    ])
              : ctrl.dirty
                  ? const Row(
                      key: ValueKey('d'),
                      children: [
                          Icon(Icons.circle, size: 8, color: kWarning),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text('Non sauvegardé / Unsaved',
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: kWarning)),
                          ),
                        ])
                  : const Row(
                      key: ValueKey('ok'),
                      children: [
                          Icon(Icons.check_circle_outline,
                              size: 14, color: kSuccess),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text('Sauvegardé / Saved',
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, color: kSuccess)),
                          ),
                        ]),
        ),
      );
}

class _SidebarPageItem extends StatelessWidget {
  final OnefopFormController ctrl;
  final int page;
  const _SidebarPageItem({required this.ctrl, required this.page});

  @override
  Widget build(BuildContext context) {
    final idxs = ctrl.sectionIndicesForPage(page);
    final allDone =
        idxs.every((i) => ctrl.valid[ctrl.schema!.sections[i].id] ?? false);
    final isActive = page == ctrl.currentPage;
    int missingCount = 0;
    for (final i in idxs) {
      missingCount += ctrl.missingLabels(ctrl.schema!.sections[i]).length;
    }
    final firstSec = idxs.isNotEmpty ? ctrl.schema!.sections[idxs.first] : null;
    final meta = firstSec != null ? kSidebarMeta[firstSec.id] : null;
    final label = meta?.label ?? 'Section ${page + 1}';
    final subtitle = idxs.isNotEmpty
        ? SectionTitleLookup.getTitle(ctrl.schema!.sections[idxs.first].id)
        : '';

    return InkWell(
      onTap: () => ctrl.goto(page),
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
                  if (subtitle.isNotEmpty)
                    Text(subtitle,
                        style: const TextStyle(fontSize: 11, color: kInkFaint),
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
                          '$missingCount manquant${missingCount > 1 ? 's' : ''} / missing',
                          style: const TextStyle(
                              fontSize: 10,
                              color: kWarning,
                              fontWeight: FontWeight.w600)),
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
// NAV BAR
// ══════════════════════════════════════════════════════════════

class NavBar extends StatelessWidget {
  final bool isLast;
  final bool canProceed;
  final bool allValid;
  final String pageLabel;
  final int currentPage;
  final int totalPages;
  final VoidCallback? onPrevious;
  final VoidCallback onNextOrPreview;

  const NavBar({
    super.key,
    required this.isLast,
    required this.canProceed,
    required this.allValid,
    required this.pageLabel,
    required this.currentPage,
    required this.totalPages,
    this.onPrevious,
    required this.onNextOrPreview,
  });

  @override
  Widget build(BuildContext context) {
    final mobile = MediaQuery.of(context).size.width < OL.pageWidth;

    // Visibility (not a conditional swap) keeps this slot exactly the width
    // of the real button even when hidden on page 1, so the Next button
    // (and, on desktop, the centered progress indicator) doesn't jump
    // sideways when Previous appears on later pages.
    final previousButton = Visibility(
      visible: onPrevious != null,
      maintainSize: true,
      maintainAnimation: true,
      maintainState: true,
      child: NavButton(
        label: 'Précédent / Back',
        icon: Icons.arrow_back_rounded,
        iconLeading: true,
        primary: false,
        onPressed: onPrevious,
      ),
    );
    final nextButton = NavButton(
      label: isLast ? 'Aperçu PDF / Preview' : 'Suivant / Next',
      icon: Icons.arrow_forward_rounded,
      primary: canProceed,
      onPressed: canProceed ? onNextOrPreview : null,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: kSurface,
        border: Border(top: BorderSide(color: kBorder, width: 1)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0A0E1A2E), blurRadius: 16, offset: Offset(0, -2))
        ],
      ),
      child: SafeArea(
        // Mobile: just the two buttons, evenly spaced — the bilingual
        // labels plus a 160px progress bar never fit a phone-width row
        // together (the "Suivant" button was being pushed past the right
        // edge). The page-position/progress info is already shown by the
        // mobile StepperStrip above the form, so it isn't needed here too.
        child: mobile
            ? Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(child: previousButton),
                  const SizedBox(width: 12),
                  Flexible(child: nextButton),
                ],
              )
            : Row(children: [
                previousButton,
                const Spacer(),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${currentPage + 1} / $totalPages  —  $pageLabel',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: kAccent)),
                    const SizedBox(height: 6),
                    SizedBox(
                      width: 160,
                      height: 4,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: (currentPage + 1) / totalPages,
                          backgroundColor: kBorder,
                          valueColor: AlwaysStoppedAnimation<Color>(
                              allValid ? kSuccess : kAccent),
                        ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                nextButton,
              ]),
      ),
    );
  }
}

class NavButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool iconLeading;
  final bool primary;
  final VoidCallback? onPressed;

  const NavButton({
    super.key,
    required this.label,
    required this.icon,
    this.iconLeading = false,
    required this.primary,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final color = primary ? Colors.white : kInkSoft;
    final iconWidget = Icon(icon, size: 16, color: color);
    // Flexible + ellipsis so the label can shrink instead of overflowing
    // when an ancestor (e.g. NavBar's mobile Flexible wrapper) compresses
    // this button below its natural width.
    final textWidget = Flexible(
      child: Text(label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: color,
          )),
    );

    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: primary ? kAccent : kFieldFill,
        foregroundColor: color,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusSm)),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: iconLeading
            ? [iconWidget, const SizedBox(width: 8), textWidget]
            : [textWidget, const SizedBox(width: 8), iconWidget],
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
class StepperStrip extends StatefulWidget {
  final OnefopFormController ctrl;
  const StepperStrip({super.key, required this.ctrl});

  @override
  State<StepperStrip> createState() => _StepperStripState();
}

class _StepperStripState extends State<StepperStrip> {
  final ScrollController _scroll = ScrollController();
  int? _lastScrolledPage;

  static const double _itemWidth = 76.0;
  static const double _connectorWidth = 24.0;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  double _offsetForPage(int page) => page * (_itemWidth + _connectorWidth);

  void _scrollToActive() {
    final page = widget.ctrl.currentPage;
    if (_lastScrolledPage == page || !_scroll.hasClients) return;
    _lastScrolledPage = page;
    final target = _offsetForPage(page) -
        (_scroll.position.viewportDimension / 2) +
        (_itemWidth / 2);
    _scroll.animateTo(
      target.clamp(0.0, _scroll.position.maxScrollExtent),
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.ctrl;
    if (ctrl.schema == null) return const SizedBox.shrink();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scrollToActive();
    });

    return Container(
      height: 68,
      color: kSurface,
      child: SingleChildScrollView(
        controller: _scroll,
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            for (int p = 0; p < ctrl.pageCount; p++) ...[
              SizedBox(
                width: _itemWidth,
                child: StepperItem(
                  index: p,
                  label: ctrl.pageLabel(p),
                  isActive: p == ctrl.currentPage,
                  isCompleted: ctrl.validatePage(p),
                  onTap: () => ctrl.goto(p),
                ),
              ),
              if (p < ctrl.pageCount - 1)
                SizedBox(
                  width: _connectorWidth,
                  child: Center(
                      child: StepConnector(isCompleted: ctrl.validatePage(p))),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class StepperItem extends StatelessWidget {
  final int index;
  final String label;
  final bool isActive;
  final bool isCompleted;
  final VoidCallback onTap;

  const StepperItem({
    super.key,
    required this.index,
    required this.label,
    required this.isActive,
    required this.isCompleted,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isCompleted
                  ? kSuccess
                  : isActive
                      ? kAccent
                      : kBorder,
            ),
            alignment: Alignment.center,
            child: isCompleted
                ? const Icon(Icons.check, color: Colors.white, size: 14)
                : Text('${index + 1}',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isActive ? Colors.white : kInkFaint)),
          ),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive ? kAccent : kInkSoft,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class StepConnector extends StatelessWidget {
  final bool isCompleted;
  const StepConnector({super.key, required this.isCompleted});

  @override
  Widget build(BuildContext context) => Container(
        width: 24,
        height: 2,
        decoration: BoxDecoration(
          color: isCompleted ? kSuccess : kBorder,
          borderRadius: BorderRadius.circular(1),
        ),
      );
}

// ══════════════════════════════════════════════════════════════
// APP BAR
// ══════════════════════════════════════════════════════════════

const double kSectionHeaderRowHeight = 52.0;

class OnefopAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool loading;
  final bool saving;
  final bool dirty;
  final VoidCallback? onCancel;
  final String? sectionTitle;
  final IconData? sectionIcon;
  final bool sectionComplete;

  const OnefopAppBar({
    super.key,
    required this.title,
    required this.loading,
    required this.saving,
    required this.dirty,
    this.onCancel,
    this.sectionTitle,
    this.sectionIcon,
    this.sectionComplete = false,
  });

  @override
  Size get preferredSize => Size.fromHeight(
      kToolbarHeight + (sectionTitle == null ? 0 : kSectionHeaderRowHeight));

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      backgroundColor: kNavy,
      foregroundColor: Colors.white,
      elevation: 0,
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
                    vertical: OL.sectionHeaderPaddingV,
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
                        : Icon(sectionIcon, color: Colors.white, size: 18),
                    middle: Text(
                      sectionTitle!,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: OL.shStyle,
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
                            strokeWidth: 2, color: Colors.white70))
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
                            color: Colors.white70),
              ),
            ),
          ),
        if (onCancel != null)
          TextButton(
            onPressed: onCancel,
            child: const Text('ANNULER / CANCEL',
                style: TextStyle(color: Colors.white70, fontSize: 12)),
          ),
        const SizedBox(width: 8),
      ],
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
