// lib/core/focus/renderers/vt_fixed_row_grid.dart
//
// Always-visible, no-Add-step row grid (Proposal C) for the 7 VT tables
// (4.1, 4.2, 5.3, 8.1, 8.2, 8.3, 8.6) whose shape is a fixed, fully-
// enumerated checklist — a constant taxonomy of diploma types /
// infrastructure conditions / age bands, 4-13 rows, never added to or
// removed from. VtRowEditor's tap-row -> bottom-sheet pattern exists to
// avoid dumping a full matrix on a phone screen; these 7 tables are the
// opposite of what that pattern is for — closer to a paper form filled in
// one pass than to open-ended data entry. This widget renders every row
// inline, all at once, from the moment the section opens: no Add step, no
// dropdown, no sheet.
//
// Tablet/desktop only (>=768px) — see vtUsesFixedRowGrid's call site in
// onefop_form_widgets.dart's VtTableFieldWidget, which keeps phone on
// VtRowEditor's bottom-sheet pattern for these same 7 tables unchanged
// (VtRowEditor's own phone-first rationale still applies there).
//
// Reuses VtRowEditor's data-shape helpers (vtRowLabel, vtRowFilled) and
// writes through the exact same OnefopFormController primitive
// (onGridCellChanged) — same int-or-absent convention (typing 0 persists
// 0, clearing removes the key — "empty" and "zero" are never conflated),
// same flat-key contract (def.cellId). Every cell on these 7 tables is
// VtCellKind.number or VtCellKind.computed (matching wizard mode's own
// _isFixedRowNumberShape/_isFixedRowMultiNumberShape predicates in
// vt_wizard_table_guided_entry.dart) — text/radioCode/boolean cells never
// appear here, so this widget doesn't need to handle them.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../i18n/localized_text.dart';
import '../../../screens/onefop/onefop_form_constants.dart';
import '../../../screens/onefop/onefop_form_controller.dart';
import 'onefop_layout_constants.dart';
import 'vt_row_editor.dart'
    show vtRowLabel, vtRowFilled, VtTableDef, VtRowDef, VtCellDef, VtCellKind;

/// paperCodes of the 7 tables this widget applies to — everything else
/// (the genuinely open-ended roster/specialty tables: 4.3-4.6, 8.8) stays
/// on VtRowEditor's Add-row pattern at every width.
const Set<String> _fixedRowGridPaperCodes = {
  '4.1',
  '4.2',
  '5.3',
  '8.1',
  '8.2',
  '8.3',
  '8.6',
};

bool vtUsesFixedRowGrid(VtTableDef def) =>
    def.paperCode != null && _fixedRowGridPaperCodes.contains(def.paperCode);

class VtFixedRowGrid extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtFixedRowGrid({super.key, required this.ctrl, required this.def});

  @override
  State<VtFixedRowGrid> createState() => _VtFixedRowGridState();
}

class _VtFixedRowGridState extends State<VtFixedRowGrid> {
  final Map<String, TextEditingController> _numCtrls = {};

  @override
  void initState() {
    super.initState();
    _seedControllers();
  }

  @override
  void didUpdateWidget(covariant VtFixedRowGrid oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.def != widget.def) {
      for (final c in _numCtrls.values) {
        c.dispose();
      }
      _numCtrls.clear();
      _seedControllers();
    }
  }

  void _seedControllers() {
    final def = widget.def;
    for (final row in def.rows) {
      for (final c in def.cells) {
        if (c.kind != VtCellKind.number) continue;
        final id = def.cellId(row, c);
        _numCtrls[id] =
            TextEditingController(text: widget.ctrl.data[id]?.toString() ?? '');
      }
    }
  }

  @override
  void dispose() {
    for (final c in _numCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _setNumber(String id, String text) {
    final v = text.trim();
    widget.ctrl.onGridCellChanged(id, v.isEmpty ? null : int.tryParse(v));
    // Rebuilds so any VtCellKind.computed cell (e.g. a row's Total column)
    // reflects the new value immediately — same approach VtRowEditor's own
    // _VtRowSheet._setNumber uses, not NumberField's separate focus-manager
    // machinery (that manager targets AST-driven spreadsheet grids and
    // isn't used by any existing VT renderer).
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.ctrl;
    final def = widget.def;
    final locale = Localizations.localeOf(context);
    final numberCells = def.cells.where((c) => c.kind == VtCellKind.number).toList();
    final computedCells = def.cells.where((c) => c.kind == VtCellKind.computed).toList();
    const colWidth = OL.hybridNumColWidth;

    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (context, _, __) {
        final filledCount = def.rows.where((r) => vtRowFilled(ctrl, def, r)).length;
        // Bounded so an 11-13 row table can't push the page's own section
        // navigation off screen — the grid scrolls internally instead. A
        // fraction of viewport height (not a fixed px) so it still fits
        // comfortably on a shorter 768px-tall tablet viewport.
        final maxGridHeight =
            (MediaQuery.of(context).size.height * 0.55).clamp(280.0, 560.0);

        return Container(
          margin: const EdgeInsets.only(top: 12, bottom: 4),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: kSurface,
            border: Border.all(color: kBorder),
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (def.paperCode != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: kAccentSoft,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(def.paperCode!,
                          style: const TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700, color: kAccentDeep)),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(def.title.of(locale),
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700, color: kInk)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '$filledCount / ${def.rows.length} ${def.progressNoun.of(locale)} '
                '${const LocalizedText(fr: "renseignés", en: "filled in").of(locale)}',
                style: const TextStyle(fontSize: 12, color: kInkSoft),
              ),
              const SizedBox(height: 10),
              _headerRow(numberCells, computedCells, colWidth, locale),
              const SizedBox(height: 2),
              FocusTraversalGroup(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: maxGridHeight),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: def.rows.length,
                    itemBuilder: (context, i) => _rowWidget(
                        def.rows[i], numberCells, computedCells, colWidth, locale, i),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _headerRow(List<VtCellDef> numberCells, List<VtCellDef> computedCells, double colWidth,
      Locale locale) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const Expanded(child: SizedBox.shrink()),
        for (final c in [...numberCells, ...computedCells])
          SizedBox(
            width: colWidth,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Text(
                c.label.of(locale),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: OL.thStyle,
              ),
            ),
          ),
      ],
    );
  }

  Widget _rowWidget(VtRowDef row, List<VtCellDef> numberCells, List<VtCellDef> computedCells,
      double colWidth, Locale locale, int index) {
    final def = widget.def;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        border: Border(top: index == 0 ? BorderSide.none : const BorderSide(color: kBorder)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                vtRowLabel(widget.ctrl, row, locale),
                style: OL.rlStyle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          for (final c in numberCells)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 4),
              child: SizedBox(
                width: colWidth,
                child: TextFormField(
                  key: ValueKey(def.cellId(row, c)),
                  controller: _numCtrls[def.cellId(row, c)],
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textAlign: TextAlign.center,
                  onChanged: (v) => _setNumber(def.cellId(row, c), v),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: true,
                    fillColor: kFieldFill,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(kRadiusSm),
                      borderSide: const BorderSide(color: kBorder),
                    ),
                  ),
                ),
              ),
            ),
          for (final c in computedCells)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 4),
              child: SizedBox(
                width: colWidth,
                child: _ComputedCell(value: c.computeValue!(row.id, widget.ctrl.data)),
              ),
            ),
        ],
      ),
    );
  }
}

/// Read-only display for a [VtCellKind.computed] cell inside the grid —
/// same "never editable, never written to OnefopFormController" contract
/// as VtRowEditor's own private _ComputedField, sized to sit in a data
/// column instead of a full-width sheet row (the column header above
/// already carries the cell's label, so this shows only the value).
class _ComputedCell extends StatelessWidget {
  final int value;
  const _ComputedCell({required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: kAccentSoft,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kAccent.withValues(alpha: 0.3)),
      ),
      child: Text('$value',
          style: const TextStyle(fontSize: 14, color: kAccentDeep, fontWeight: FontWeight.w700)),
    );
  }
}
