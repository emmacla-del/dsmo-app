// lib/core/focus/renderers/vt_row_editor.dart
//
// Shared phone-first row editor for every Vocational Training (VT) grid
// field (Sections 4/5/8: diploma tables, specialty tables, the trainer
// roster). VT's tableSpec templates (vt_diploma_table, vt_specialty_fi_fc_
// table, vt_trainer_roster_table, ...) are declared in onefop_ast.dart but
// have no case in TableSpecBuilder/FormSchemaCompiler's grid-building
// switches (both silently no-op for unknown templates today) — this widget
// deliberately does NOT route through GridRenderSpec/TableSpecBuilder/
// TableCellEngine at all, the same precedent ActivitiesTable already set
// for AstFieldType.repeatingTable (see activities_table.dart's file-level
// comment). Unlike ActivitiesTable (which lays every row out inline, all
// at once), this renders a tappable row list — pick a row, edit its cells
// in a bottom sheet, Done, next row — because showing a full VT matrix on
// a phone (up to 24 age-band rows, or an 8-column roster) is exactly the
// "spreadsheet dump" this widget exists to avoid. Desktop reuses the same
// widget and the same data model unchanged — there is no second, wider
// table for desktop; only the bottom sheet has more horizontal room.
//
// One VtTableDef fully describes a grid: its rows, each row's cells
// (heterogeneous — number/text/radio-code/boolean), and the exact flat-key
// convention the (frozen) backend normalizer already expects —
// `${prefix}_${rowKey}_${cellKey}` for fixed-row tables (diploma, age
// flow, furniture, ...) or `${prefix}_row${n}_${cellKey}` for repeating
// ones (specialty rows, roster) — see flat-key-normalizer.ts's
// buildVtDiplomaDataRows/buildVtSpecialtyRows/buildVtTrainerRosterRows for
// the exact wire contract this widget must match cell-for-cell.
//
// Values read/write through OnefopFormController exactly like every other
// ONEFOP field:
//   - number cells  → ctrl.data[id] (read) / ctrl.onGridCellChanged(id, v)
//     (write) — same int-or-absent convention as every existing table
//     (typing 0 persists 0, clearing the field removes the key entirely —
//     "empty" and "zero" are never conflated).
//   - text cells    → ctrl.hybridController(id) (a real TextEditingController,
//     same mechanism reasons/skills/training/ActivitiesTable already use).
//   - radio-code /
//     boolean cells → ctrl.data[id] (read) / ctrl.setRawValue(id, v) (write),
//     a small generic setter added to OnefopFormController for fields with
//     no matching FormQuestionAst entry (every VT row/cell id is synthesized
//     from a VtTableDef, not declared one-by-one in the AST).

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../i18n/localized_text.dart';
import '../../../screens/onefop/onefop_form_constants.dart';
import '../../../screens/onefop/onefop_form_controller.dart';
import 'onefop_layout_constants.dart';
import 'vt_table_types.dart';
import '../../../screens/onefop/onefop_form_widgets.dart' show RadioOption;

export 'vt_table_types.dart';

/// Shared row-label resolution (VT-UI/UX-04) — the row's own fixedLabel
/// when it has one (every fixed-taxonomy row: diploma, age band,
/// infrastructure type, ...), else the text composed live from whichever
/// cells [VtRowDef.labelFromCells] names (e.g. a specialty's free-text
/// name, or the roster's lastName+firstName) — empty until the user has
/// actually typed something identifying. One function so the row tile
/// (VtRowEditor._rowLabel) and the row-detail sheet's title
/// (_VtRowSheet.build) can never diverge on what a row is "called."
String vtRowLabel(OnefopFormController ctrl, VtRowDef row, Locale locale) {
  if (row.fixedLabel != null) return row.fixedLabel!.of(locale);
  final parts = (row.labelFromCells ?? const [])
      .map((k) => ctrl.data['${row.id}_$k']?.toString().trim() ?? '')
      .where((s) => s.isNotEmpty);
  return parts.isNotEmpty ? parts.join(' ') : '';
}

/// True unless [c] names a `dependsOnKey` sibling cell in the same row
/// that isn't currently Oui — see VtCellDef.dependsOnKey's doc comment.
/// Shared by the row-detail sheet (which cells to render/validate) and
/// the row tile's desktop-only secondary summary (which cells to
/// summarize) so the two can never disagree about whether a gated cell
/// counts as "there."
bool vtCellVisible(
    OnefopFormController ctrl, VtTableDef def, VtRowDef row, VtCellDef c) {
  if (c.dependsOnKey == null) return true;
  final sibling = def.cells.firstWhere((o) => o.key == c.dependsOnKey);
  final siblingId = def.cellId(row, sibling);
  final decoded = sibling.decodeBoolean != null
      ? sibling.decodeBoolean!(ctrl.data[siblingId])
      : ctrl.data[siblingId] as bool?;
  return decoded == true;
}

bool _vtCellFilled(dynamic v) {
  if (v == null) return false;
  if (v is String) return v.trim().isNotEmpty;
  return true;
}

/// True once any of [row]'s cells (in [def]) holds a value — the same
/// "has this row been started" test the row tile's dot indicator, the
/// roster/progressiveRows reveal rule, and the desktop spreadsheet grid
/// (VtSpreadsheetTable) all need to agree on.
bool vtRowFilled(OnefopFormController ctrl, VtTableDef def, VtRowDef row) =>
    def.cells.any((c) => _vtCellFilled(ctrl.data[def.cellId(row, c)]));

/// The visible state of one row. A row with data is deliberately a draft
/// until its table definition supplies enough required-cell policy to prove
/// it complete. Today the VTC table definitions do not declare required
/// cells, so this protects respondents from a misleading green “complete”
/// indication while preserving their entered data and existing reveal rules.
enum VtRowStatus { notStarted, draft, complete }

VtRowStatus vtRowStatus(
  OnefopFormController ctrl,
  VtTableDef def,
  VtRowDef row,
) {
  if (!vtRowFilled(ctrl, def, row)) return VtRowStatus.notStarted;
  final requiredCells = def.cells
      .where((cell) => cell.required && vtCellVisible(ctrl, def, row, cell));
  if (requiredCells.isEmpty) return VtRowStatus.draft;
  return requiredCells
          .every((cell) => _vtCellFilled(ctrl.data[def.cellId(row, cell)]))
      ? VtRowStatus.complete
      : VtRowStatus.draft;
}

/// Roster and progressiveRows tables only — rows with any data, plus
/// exactly one trailing blank slot to type into (capped at the row list's
/// own length, e.g. 14 for 8.8, 15 for 5.2). Purely derived from current
/// data, no extra widget state needed: typing into the last visible blank
/// row makes it non-empty, which pushes the next slot into view on the very
/// next rebuild. Shared by [VtRowEditor] (mobile/bottom-sheet) and
/// VtSpreadsheetTable (desktop Excel shell) so the two can never disagree
/// about which rows are showing.
List<VtRowDef> vtVisibleRows(OnefopFormController ctrl, VtTableDef def) {
  if (!def.isRoster && !def.progressiveRows) return def.rows;
  var lastFilled = -1;
  for (var i = 0; i < def.rows.length; i++) {
    if (vtRowFilled(ctrl, def, def.rows[i])) lastFilled = i;
  }
  final visibleCount = (lastFilled + 2).clamp(1, def.rows.length);
  return def.rows.sublist(0, visibleCount);
}

class VtRowEditor extends StatelessWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtRowEditor({super.key, required this.ctrl, required this.def});

  bool _cellFilled(dynamic v) => _vtCellFilled(v);

  String _rowLabel(VtRowDef row, Locale locale) =>
      vtRowLabel(ctrl, row, locale);

  /// Desktop-only (VT-UI/UX-05) — a compact "Label: value" summary of the
  /// row's own already-filled cells, so a wide-viewport user isn't forced
  /// to open every sheet just to see what's in it. Same data source
  /// vtRowLabel already reads (ctrl.data via def.cellId) — no new
  /// data path. Skips the cell(s) already used as the row's own label
  /// (row.labelFromCells) and any [VtCellKind.computed] cell (its inputs
  /// are already implied by whatever else made the cut). Capped at 3
  /// entries so it stays one line even on a 9-cell row (4.8/4.9).
  String _secondarySummary(VtRowDef row, Locale locale) {
    final labelKeys = row.labelFromCells?.toSet() ?? const <String>{};
    final parts = <String>[];
    for (final c in def.cells) {
      if (labelKeys.contains(c.key) || c.kind == VtCellKind.computed) continue;
      if (!vtCellVisible(ctrl, def, row, c)) continue;
      final v = ctrl.data[def.cellId(row, c)];
      if (!_cellFilled(v)) continue;
      final display = switch (c.kind) {
        VtCellKind.boolean =>
          ((c.decodeBoolean != null ? c.decodeBoolean!(v) : v as bool?) == true)
              ? const LocalizedText(fr: 'Oui', en: 'Yes').of(locale)
              : const LocalizedText(fr: 'Non', en: 'No').of(locale),
        VtCellKind.radioCode => () {
            for (final o in c.options ?? const <VtOption>[]) {
              if (o.value == v) return o.label.of(locale);
            }
            return v.toString();
          }(),
        _ => v.toString(),
      };
      parts.add('${c.label.of(locale)}: $display');
      if (parts.length == 3) break;
    }
    return parts.join(' · ');
  }

  List<VtRowDef> _visibleRows() => vtVisibleRows(ctrl, def);

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    // Same desktop/mobile breakpoint the rest of ONEFOP already uses (see
    // onefop_unified_form_screen_v4.dart's own `desktop = ... >=
    // OL.pageWidth` check) — not a new one. Read once per build; VtRowEditor
    // has no other MediaQuery dependency to piggyback on.
    final isDesktop = MediaQuery.of(context).size.width >= OL.pageWidth;
    return ValueListenableBuilder<int>(
      valueListenable: ctrl.version,
      builder: (context, _, __) {
        final visibleRows = _visibleRows();
        final rowStatuses = {
          for (final row in def.rows) row: vtRowStatus(ctrl, def, row),
        };
        final draftCount = rowStatuses.values
            .where((status) => status == VtRowStatus.draft)
            .length;
        final completeCount = rowStatuses.values
            .where((status) => status == VtRowStatus.complete)
            .length;
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: kAccentSoft,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(def.paperCode!,
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: kAccentDeep)),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(def.title.of(locale),
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: kInk)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                LocalizedText(
                  fr: '$completeCount terminée(s) · $draftCount en cours sur '
                      '${def.rows.length} ${def.progressNoun.fr}',
                  en: '$completeCount complete · $draftCount in progress of '
                      '${def.rows.length} ${def.progressNoun.en}',
                ).of(locale),
                style: const TextStyle(fontSize: 12, color: kInkSoft),
              ),
              const SizedBox(height: 10),
              for (final row in visibleRows)
                _rowTile(context, row, locale, isDesktop),
              if ((def.isRoster || def.progressiveRows) &&
                  visibleRows.length < def.rows.length)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    const LocalizedText(
                            fr: 'Renseignez cette ligne pour en ajouter une nouvelle.',
                            en: 'Fill this row to reveal another one.')
                        .of(locale),
                    style: const TextStyle(
                        fontSize: 11,
                        color: kInkFaint,
                        fontStyle: FontStyle.italic),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _rowTile(
      BuildContext context, VtRowDef row, Locale locale, bool isDesktop) {
    final status = vtRowStatus(ctrl, def, row);
    final label = _rowLabel(row, locale);
    final placeholder = row.fixedLabel == null;
    final rowIndex = def.rows.indexOf(row) + 1;
    // Desktop-only secondary line (VT-UI/UX-05) — a compact summary of the
    // row's other filled cells, so a wide-viewport user can skim without
    // opening the sheet. Never computed or shown on mobile (isDesktop is
    // always false there, so `secondary` is always '' and the tile below
    // is exactly the single-Text tree it was before this ticket).
    final secondary = isDesktop ? _secondarySummary(row, locale) : '';
    final primaryText = Text(
      placeholder && label.isEmpty
          ? '${const LocalizedText(fr: "Ligne", en: "Row").of(locale)} $rowIndex'
          : label,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: placeholder && label.isEmpty ? kInkFaint : kInk,
        fontStyle:
            placeholder && label.isEmpty ? FontStyle.italic : FontStyle.normal,
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
    return InkWell(
      borderRadius: BorderRadius.circular(kRadiusSm),
      onTap: () => _openRowSheet(context, row, locale),
      child: Container(
        // Tighter vertical rhythm on desktop only — mobile keeps its exact
        // prior 6/10 spacing (isDesktop is always false there).
        margin: EdgeInsets.only(bottom: isDesktop ? 4 : 6),
        padding:
            EdgeInsets.symmetric(horizontal: 10, vertical: isDesktop ? 7 : 10),
        decoration: BoxDecoration(
          color: kFieldFill,
          borderRadius: BorderRadius.circular(kRadiusSm),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(
                color: switch (status) {
                  VtRowStatus.complete => kAccent,
                  VtRowStatus.draft => kWarning,
                  VtRowStatus.notStarted => kBorderStrong,
                },
                shape: BoxShape.circle,
              ),
            ),
            Expanded(
              child: secondary.isEmpty && status != VtRowStatus.draft
                  ? primaryText
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        primaryText,
                        if (secondary.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            secondary,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                const TextStyle(fontSize: 11, color: kInkSoft),
                          ),
                        ],
                        if (status == VtRowStatus.draft)
                          Text(
                            const LocalizedText(
                              fr: 'Brouillon — à vérifier',
                              en: 'Draft — needs review',
                            ).of(locale),
                            style:
                                const TextStyle(fontSize: 11, color: kWarning),
                          ),
                      ],
                    ),
            ),
            const Icon(Icons.chevron_right, size: 18, color: kInkFaint),
          ],
        ),
      ),
    );
  }

  void _openRowSheet(BuildContext context, VtRowDef row, Locale locale) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusLg)),
      ),
      builder: (sheetCtx) =>
          _VtRowSheet(ctrl: ctrl, def: def, row: row, locale: locale),
    );
  }
}

class _VtRowSheet extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  final VtRowDef row;
  final Locale locale;
  const _VtRowSheet({
    required this.ctrl,
    required this.def,
    required this.row,
    required this.locale,
  });

  @override
  State<_VtRowSheet> createState() => _VtRowSheetState();
}

class _VtRowSheetState extends State<_VtRowSheet> {
  final Map<String, TextEditingController> _numCtrls = {};
  final Map<String, String?> _pickerValues = {};

  /// Cell ids found empty the last time "Terminé" was tapped while a
  /// required cell had no value. A cell's error styling is only ever
  /// shown for an id in this set AND still currently empty (see
  /// _cellField's `isError`) — fixing the value clears the error on its
  /// own next rebuild, no separate "un-mark" bookkeeping needed.
  final Set<String> _invalidAttempted = {};

  @override
  void initState() {
    super.initState();
    for (final c in widget.def.cells) {
      final id = widget.def.cellId(widget.row, c);
      if (c.kind == VtCellKind.number) {
        _numCtrls[id] =
            TextEditingController(text: widget.ctrl.data[id]?.toString() ?? '');
      } else if (c.kind == VtCellKind.radioCode) {
        final v = widget.ctrl.data[id]?.toString();
        _pickerValues[id] = (v == null || v.isEmpty) ? null : v;
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
    // Rebuilds this sheet so any VtCellKind.computed cell (e.g. a row's
    // Total column) reflects the new value immediately — computed cells
    // read live from ctrl.data, already updated synchronously above.
    setState(() {});
  }

  void _setBool(String id, bool? value, VtCellDef c) {
    final stored = value == null
        ? null
        : (c.encodeBoolean != null ? c.encodeBoolean!(value) : value);
    widget.ctrl.setRawValue(id, stored);
    setState(() {});
  }

  void _setPicker(String id, String? value) {
    widget.ctrl.setRawValue(id, value);
    setState(() => _pickerValues[id] = value);
  }

  /// True when [c] (at [id]) has no value entered yet, reading each kind's
  /// own live source of truth (the local TextEditingController for
  /// number/text, the picker map for radioCode, decoded ctrl.data for
  /// boolean). [VtCellKind.computed] is never user-entered, so it's never
  /// "empty" in the sense this required check cares about.
  bool _isCellEmpty(VtCellDef c, String id) {
    switch (c.kind) {
      case VtCellKind.number:
        return (_numCtrls[id]?.text.trim().isEmpty) ?? true;
      case VtCellKind.text:
        return widget.ctrl.hybridController(id).text.trim().isEmpty;
      case VtCellKind.radioCode:
        return _pickerValues[id] == null;
      case VtCellKind.boolean:
        final decoded = c.decodeBoolean != null
            ? c.decodeBoolean!(widget.ctrl.data[id])
            : widget.ctrl.data[id] as bool?;
        return decoded == null;
      case VtCellKind.computed:
        return false;
    }
  }

  bool _cellVisible(VtCellDef c) =>
      vtCellVisible(widget.ctrl, widget.def, widget.row, c);

  /// "Terminé" — validates every required, currently-visible cell in this
  /// row first. Any still-empty required cell blocks the close and gets
  /// flagged for _cellField's error styling instead of silently letting
  /// the sheet pop with missing data. A required cell hidden behind a
  /// dependsOnKey gate that hasn't been satisfied is never "missing" —
  /// there is nothing on screen for the user to have filled in.
  void _handleDone() {
    final missing = <String>{
      for (final c in widget.def.cells)
        if (c.required &&
            _cellVisible(c) &&
            _isCellEmpty(c, widget.def.cellId(widget.row, c)))
          widget.def.cellId(widget.row, c),
    };
    if (missing.isNotEmpty) {
      setState(() => _invalidAttempted.addAll(missing));
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final locale = widget.locale;
    final row = widget.row;
    final def = widget.def;
    final labelCell = row.labelFromCells;
    // showModalBottomSheet has no width cap of its own (no global
    // BottomSheetThemeData.constraints — see VT-UI/UX-01 §7), so on a wide
    // desktop viewport this sheet would otherwise stretch its single-column
    // fields edge to edge. Center + cap here instead: Center hands its
    // child loose constraints, so the ConstrainedBox's maxWidth is a no-op
    // below 560 (phone stays exactly as wide as the sheet already made it —
    // full-bleed) and only takes effect once the sheet itself is wider than
    // 560. heightFactor: 1.0 keeps this shrink-wrapped to the content's own
    // height — a plain Center/Align (default null heightFactor) expands to
    // fill whatever height the isScrollControlled sheet route hands it
    // (close to full screen height), which would center the sheet's
    // content vertically in the middle of the screen instead of anchoring
    // it at the top, right below the drag handle.
    return Align(
      alignment: Alignment.topCenter,
      heightFactor: 1.0,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: kBorderStrong,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Text(
                  // Same resolution the row tile already uses (vtRowLabel) —
                  // a fixed-taxonomy row's own static label, or, once the
                  // user has typed something identifying (specialty text,
                  // roster name, ...), that live text instead of the generic
                  // fallback. Recomputed on every rebuild, so it keeps up as
                  // the user types below, same as the row tile does after the
                  // sheet closes.
                  vtRowLabel(widget.ctrl, row, locale).isNotEmpty
                      ? vtRowLabel(widget.ctrl, row, locale)
                      : const LocalizedText(
                              fr: 'Détails de la ligne', en: 'Row details')
                          .of(locale),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700, color: kInk),
                ),
                const SizedBox(height: 14),
                // Free-text label cell(s) — e.g. specialty name, or the
                // roster's own lastName/firstName cells, which are also plain
                // members of `def.cells` and rendered again below like any
                // other cell; listing them first here just puts the row's
                // identifying text at the top of the sheet.
                if (row.fixedLabel == null && labelCell != null)
                  const SizedBox.shrink(),
                for (final c in def.cells)
                  if (_cellVisible(c)) _cellField(context, def, row, c, locale),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: kAccent),
                    onPressed: _handleDone,
                    child: Text(const LocalizedText(fr: 'Terminé', en: 'Done')
                        .of(locale)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Shared decoration for the three InputDecoration-based cell kinds
  /// (number/text/radioCode). Unchanged from before this ticket when
  /// !c.required (the labelText/fillColor/border branches below all
  /// resolve to their original literal values) — required/error styling
  /// is additive, not a replacement of the existing look.
  InputDecoration _decorationFor(VtCellDef c, Locale locale, bool isError) {
    return InputDecoration(
      labelText: c.required ? null : c.label.of(locale),
      // Same red-asterisk convention as OnefopFieldLabel
      // (onefop_section_renderer.dart) elsewhere in the app — reused, not
      // reinvented.
      label: c.required
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(c.label.of(locale)),
                const SizedBox(width: 4),
                const Text('*',
                    style:
                        TextStyle(color: kDanger, fontWeight: FontWeight.w700)),
              ],
            )
          : null,
      filled: true,
      fillColor: isError ? kDangerSoft : kFieldFill,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRadiusSm),
        borderSide: BorderSide(color: isError ? kDanger : kBorder),
      ),
    );
  }

  /// Appends the required-field error message below [field] when
  /// [isError] — a no-op wrapper (same child, no extra widget) when not,
  /// so a cell that's never required renders exactly the bare field it
  /// always has.
  Widget _withRequiredError(Widget field, bool isError, Locale locale) {
    if (!isError) return field;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        field,
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 14, color: kDanger),
              const SizedBox(width: 6),
              Text(
                const LocalizedText(
                        fr: 'Ce champ est requis.',
                        en: 'This field is required.')
                    .of(locale),
                style: const TextStyle(fontSize: 11, color: kDanger),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _cellField(BuildContext context, VtTableDef def, VtRowDef row,
      VtCellDef c, Locale locale) {
    final id = def.cellId(row, c);
    final isError =
        c.required && _invalidAttempted.contains(id) && _isCellEmpty(c, id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: switch (c.kind) {
        VtCellKind.number => _withRequiredError(
            TextFormField(
              controller: _numCtrls[id],
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: (v) => _setNumber(id, v),
              decoration: _decorationFor(c, locale, isError),
            ),
            isError,
            locale,
          ),
        VtCellKind.text => _withRequiredError(
            TextFormField(
              controller: widget.ctrl.hybridController(id),
              decoration: _decorationFor(c, locale, isError),
              onChanged: (_) => setState(() {}),
            ),
            isError,
            locale,
          ),
        VtCellKind.radioCode => _withRequiredError(
            DropdownButtonFormField<String>(
              initialValue: _pickerValues[id],
              isExpanded: true,
              // Always-drawn, token-colored dropdown affordance — explicit
              // rather than relying on the widget's own default `icon`, so a
              // radioCode cell reads as a picker at a glance instead of
              // looking identical to the plain text/number cells above (see
              // VT-UI/UX-01 §1: picker cells were visually indistinguishable
              // from free-text ones until tapped).
              icon: const Icon(Icons.expand_more, color: kInkFaint, size: 20),
              decoration: _decorationFor(c, locale, isError),
              items: [
                for (final o in c.options ?? const <VtOption>[])
                  DropdownMenuItem(
                    value: o.value,
                    child: Text('${o.code} — ${o.label.of(locale)}',
                        overflow: TextOverflow.ellipsis),
                  ),
              ],
              onChanged: (v) => _setPicker(id, v),
            ),
            isError,
            locale,
          ),
        VtCellKind.boolean => _withRequiredError(
            _OuiNonToggle(
              label: c.label.of(locale),
              required: c.required,
              value: c.decodeBoolean != null
                  ? c.decodeBoolean!(widget.ctrl.data[id])
                  : widget.ctrl.data[id] as bool?,
              onChanged: (v) => _setBool(id, v, c),
            ),
            isError,
            locale,
          ),
        VtCellKind.computed => _ComputedField(
            label: c.label.of(locale),
            value: c.computeValue!(row.id, widget.ctrl.data),
          ),
      },
    );
  }
}

/// Read-only display for a [VtCellKind.computed] cell — never editable,
/// never written to OnefopFormController (see VtCellDef.computeValue's
/// doc comment).
class _ComputedField extends StatelessWidget {
  final String label;
  final int value;
  const _ComputedField({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: kAccentSoft,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kAccent.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontSize: 13,
                    color: kAccentDeep,
                    fontWeight: FontWeight.w600)),
          ),
          Text('$value',
              style: const TextStyle(
                  fontSize: 14,
                  color: kAccentDeep,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _OuiNonToggle extends StatelessWidget {
  final String label;
  final bool required;
  final bool? value;
  final ValueChanged<bool?> onChanged;
  const _OuiNonToggle({
    required this.label,
    this.required = false,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    return Row(
      children: [
        Expanded(
          child: required
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                        child: Text(label,
                            style: const TextStyle(fontSize: 13, color: kInk))),
                    const SizedBox(width: 4),
                    const Text('*',
                        style: TextStyle(
                            fontSize: 13,
                            color: kDanger,
                            fontWeight: FontWeight.w700)),
                  ],
                )
              : Text(label, style: const TextStyle(fontSize: 13, color: kInk)),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioOption(
              label: const LocalizedText(fr: 'Oui', en: 'Yes').of(locale),
              isSelected: value == true,
              onTap: () => onChanged(true),
            ),
            const SizedBox(width: 16),
            RadioOption(
              label: const LocalizedText(fr: 'Non', en: 'No').of(locale),
              isSelected: value == false,
              onTap: () => onChanged(false),
            ),
          ],
        ),
      ],
    );
  }
}
