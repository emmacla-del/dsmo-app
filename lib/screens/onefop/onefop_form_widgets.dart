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
          const Icon(Icons.error_outline, size: 14, color: Color(0xFFE24B4A)),
          const SizedBox(width: 6),
          Text(m,
              style: const TextStyle(fontSize: 12, color: Color(0xFFA32D2D))),
        ],
      ),
    );

InputDecoration inputDecoration(
    {required bool focused, required bool hasError, String? hint}) {
  return InputDecoration(
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    filled: true,
    fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
    hintText: hint,
    hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(
            color: hasError ? const Color(0xFFE24B4A) : const Color(0xFFE2E8F0),
            width: 1)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF4472C4), width: 2)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE24B4A), width: 1)),
  );
}

InputDecoration dropdownDecoration(bool hasError) => InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      filled: true,
      fillColor: hasError ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
              color:
                  hasError ? const Color(0xFFE24B4A) : const Color(0xFFE2E8F0),
              width: 1)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF4472C4), width: 2)),
    );

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
                    hint: field.type == 'number' ? '0' : null),
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
              errorRow('Veuillez sélectionner une option'),
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
                hint: const Text('Sélectionner',
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
              errorRow('Veuillez sélectionner une option'),
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

    final effectiveWidth =
        availableWidth - 2 * outerBorder - 2 * OL.borderWidth;
    final tc = (200.0).clamp(200.0, effectiveWidth - 3 * nc);
    final totalTableWidth = tc + 3 * nc + 2 * OL.borderWidth + 2 * outerBorder;

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
        SizedBox(
          width: tc,
          child: const Padding(
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
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
          boxShadow: const [
            BoxShadow(
                color: Color(0x0D000000), blurRadius: 12, offset: Offset(0, 4)),
          ],
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
                  hintStyle:
                      const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
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
                tableId: 's3q02',
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
                tableId: 's3q02',
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
                    : kTableDataStyle.copyWith(color: const Color(0xFF94A3B8)),
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
            color: focused ? const Color(0xFFEBF3FF) : Colors.transparent,
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
                  color: Color(0xFF000000)),
              decoration: InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
                hintText: focused ? '0' : null,
                hintStyle: const TextStyle(
                    fontSize: kNumCellFontSize, color: Color(0xFFCBD5E1)),
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
        borderRadius: BorderRadius.circular(10),
        color: _focused
            ? (widget.isTable
                ? const Color(0xFFF0F6FF)
                : const Color(0xFFF5F8FF))
            : Colors.transparent,
        border: _focused
            ? Border(
                left: BorderSide(
                    color: const Color(0xFF4472C4).withValues(alpha: 0.7),
                    width: 3))
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
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFEEF2FF) : Colors.transparent,
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF4472C4)
                  : const Color(0xFFE2E8F0),
              width: isSelected ? 1.5 : 1,
            ),
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                        color: const Color(0xFF4472C4).withValues(alpha: 0.1),
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
                        color: isSelected
                            ? const Color(0xFF4472C4)
                            : const Color(0xFF94A3B8),
                        width: 2),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: isSelected
                      ? Container(
                          decoration: const BoxDecoration(
                              shape: BoxShape.circle, color: Color(0xFF4472C4)))
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
                      color: isSelected
                          ? const Color(0xFF1E293B)
                          : const Color(0xFF475569),
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
// STICKY SECTION HEADER
// ══════════════════════════════════════════════════════════════

class StickySectionHeaderDelegate extends SliverPersistentHeaderDelegate {
  final String sectionId;
  final String title;
  final IconData? icon;
  final bool isComplete;

  StickySectionHeaderDelegate({
    required this.sectionId,
    required this.title,
    this.icon,
    required this.isComplete,
  });

  @override
  double get minExtent => 52.0;
  @override
  double get maxExtent => 52.0;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kScrollChildWidth),
        child: Container(
          decoration: BoxDecoration(
            color: OL.sectionHeaderBg(sectionId),
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(12),
              topRight: Radius.circular(12),
            ),
            border: const Border(
              top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
              left: BorderSide(color: Color(0xFFE2E8F0), width: 1),
              right: BorderSide(color: Color(0xFFE2E8F0), width: 1),
            ),
            boxShadow: overlapsContent
                ? [
                    const BoxShadow(
                      color: Color(0x1A000000),
                      blurRadius: 8,
                      offset: Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: OL.sectionHeaderPaddingH,
            vertical: OL.sectionHeaderPaddingV,
          ),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: Colors.white, size: 18),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(title, style: OL.shStyle),
              ),
              if (isComplete)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF70AD47),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text(
                        'Complet',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: const Color(0xFFF59E0B), width: 0.5),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.pending, color: Color(0xFFD97706), size: 12),
                      SizedBox(width: 4),
                      Text(
                        'En cours',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFB45309),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant StickySectionHeaderDelegate old) {
    return old.sectionId != sectionId ||
        old.title != title ||
        old.icon != icon ||
        old.isComplete != isComplete;
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
        color: const Color(0xFFF8FAFC),
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
                    const Divider(height: 1, color: Color(0xFFE2E8F0)),
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
        tooltip = 'Réduire la barre';
        break;
      case 1:
        icon = Icons.last_page;
        tooltip = 'Masquer la barre';
        break;
      default:
        icon = Icons.menu;
        tooltip = 'Afficher la barre';
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
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: const Color(0xFF475569)),
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
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        const Spacer(),
        Text('${(ratio * 100).round()}%',
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF4472C4))),
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
          backgroundColor: const Color(0xFFE2E8F0),
          valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF70AD47)),
          minHeight: 6,
        ),
      ),
    );
  }

  Widget _autosaveIndicator() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: const BoxDecoration(
            border:
                Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1))),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          transitionBuilder: (child, anim) =>
              FadeTransition(opacity: anim, child: child),
          child: ctrl.saving
              ? const Row(
                  key: ValueKey('s'),
                  mainAxisSize: MainAxisSize.min,
                  children: [
                      SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Color(0xFF94A3B8))),
                      SizedBox(width: 8),
                      Text('Sauvegarde…',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF94A3B8))),
                    ])
              : ctrl.dirty
                  ? const Row(
                      key: ValueKey('d'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          Icon(Icons.circle, size: 8, color: Color(0xFFF97316)),
                          SizedBox(width: 8),
                          Text('Non sauvegardé',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFFF97316))),
                        ])
                  : const Row(
                      key: ValueKey('ok'),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                          Icon(Icons.check_circle_outline,
                              size: 14, color: Color(0xFF70AD47)),
                          SizedBox(width: 8),
                          Text('Sauvegardé',
                              style: TextStyle(
                                  fontSize: 12, color: Color(0xFF70AD47))),
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
          color: isActive ? const Color(0xFFEEF2FF) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isActive
              ? Border.all(
                  color: const Color(0xFF4472C4).withValues(alpha: 0.3),
                  width: 1)
              : null,
        ),
        child: Row(children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: allDone
                  ? const Color(0xFF70AD47)
                  : isActive
                      ? const Color(0xFF4472C4)
                      : const Color(0xFFE2E8F0),
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
                            color: isActive
                                ? Colors.white
                                : const Color(0xFF94A3B8))),
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
                          color: isActive
                              ? const Color(0xFF1E293B)
                              : const Color(0xFF475569)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  if (subtitle.isNotEmpty)
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFF94A3B8)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  if (!allDone && missingCount > 0)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: const Color(0xFFFDBA74), width: 0.5)),
                      child: Text(
                          '$missingCount manquant${missingCount > 1 ? 's' : ''}',
                          style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFFEA580C),
                              fontWeight: FontWeight.w600)),
                    ),
                ],
              ),
            ),
            if (allDone)
              const Icon(Icons.check_circle,
                  size: 16, color: Color(0xFF70AD47)),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0A000000), blurRadius: 12, offset: Offset(0, -2))
        ],
      ),
      child: SafeArea(
        child: Row(children: [
          if (onPrevious != null)
            NavButton(
                label: '← Précédent', primary: false, onPressed: onPrevious)
          else
            const SizedBox(width: 100),
          const Spacer(),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${currentPage + 1} / $totalPages  —  $pageLabel',
                  style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4472C4))),
              const SizedBox(height: 6),
              SizedBox(
                width: 160,
                height: 4,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (currentPage + 1) / totalPages,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(allValid
                        ? const Color(0xFF70AD47)
                        : const Color(0xFF4472C4)),
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          NavButton(
            label: isLast ? 'Aperçu PDF →' : 'Suivant →',
            primary: canProceed,
            onPressed: canProceed ? onNextOrPreview : null,
          ),
        ]),
      ),
    );
  }
}

class NavButton extends StatelessWidget {
  final String label;
  final bool primary;
  final VoidCallback? onPressed;

  const NavButton(
      {super.key, required this.label, required this.primary, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor:
            primary ? const Color(0xFF4472C4) : const Color(0xFFF1F5F9),
        foregroundColor: primary ? Colors.white : const Color(0xFF475569),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
      child: Text(label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: primary ? Colors.white : const Color(0xFF475569),
          )),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// STEPPER STRIP (Mobile)
// ══════════════════════════════════════════════════════════════

class StepperStrip extends StatelessWidget {
  final OnefopFormController ctrl;
  const StepperStrip({super.key, required this.ctrl});

  @override
  Widget build(BuildContext context) {
    if (ctrl.schema == null) return const SizedBox.shrink();
    return Container(
      height: 68,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          for (int p = 0; p < ctrl.pageCount; p++) ...[
            Expanded(
              child: StepperItem(
                index: p,
                label: ctrl.pageLabel(p),
                isActive: p == ctrl.currentPage,
                isCompleted: ctrl.validatePage(p),
                onTap: () => ctrl.goto(p),
              ),
            ),
            if (p < ctrl.pageCount - 1)
              StepConnector(isCompleted: ctrl.validatePage(p)),
          ],
        ],
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
                  ? const Color(0xFF70AD47)
                  : isActive
                      ? const Color(0xFF4472C4)
                      : const Color(0xFFE2E8F0),
            ),
            alignment: Alignment.center,
            child: isCompleted
                ? const Icon(Icons.check, color: Colors.white, size: 14)
                : Text('${index + 1}',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color:
                            isActive ? Colors.white : const Color(0xFF94A3B8))),
          ),
          const SizedBox(height: 4),
          Text(label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive
                    ? const Color(0xFF4472C4)
                    : const Color(0xFF64748B),
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
          color:
              isCompleted ? const Color(0xFF70AD47) : const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(1),
        ),
      );
}

// ══════════════════════════════════════════════════════════════
// APP BAR
// ══════════════════════════════════════════════════════════════

class OnefopAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool loading;
  final bool saving;
  final bool dirty;
  final VoidCallback? onCancel;

  const OnefopAppBar({
    super.key,
    required this.title,
    required this.loading,
    required this.saving,
    required this.dirty,
    this.onCancel,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      backgroundColor: const Color(0xFF4472C4),
      foregroundColor: Colors.white,
      elevation: 0,
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
                        ? Icon(
                            key: const ValueKey('d'),
                            Icons.circle,
                            size: 8,
                            color: Colors.orange.shade300)
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
            child: const Text('ANNULER',
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
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(6)),
      );
}

class SkeletonCircle extends StatelessWidget {
  final double size;
  const SkeletonCircle({super.key, required this.size});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
            color: Color(0xFFE2E8F0), shape: BoxShape.circle),
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
