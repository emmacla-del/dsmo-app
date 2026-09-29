// lib/screens/onefop/wizard/vt_wizard_table_guided_entry.dart
// ══════════════════════════════════════════════════════════════
// VT WIZARD MODE — "guided entry" table widgets, pixel-matched against
// the dedicated Formateurs screen (Figma node 77:216) and the
// "Effectifs par Spécialités" card on the Suivi Post-Formation screen
// (Figma node 11:1992, frame 77:141): pick/enter a row, fill its
// numbers, tap Ajouter — the row joins a summary list below with an
// edit/delete action per row.
//
// Four shapes are covered, dispatched by [vtWizardSupportsGuidedEntry]:
//  - Fixed-row / two-number-cell (VtWizardGuidedTableEntry): diploma
//    (4.1/4.2/8.1/8.2), trainer-age (8.3), trainer-disability (8.6) —
//    row picked from a dropdown of fixed, pre-named rows.
//  - Fixed-row / more-than-two-number-cell
//    (VtWizardFixedRowMultiNumberEntry): the age/flow grid (4.7),
//    category flow tables (4.8/4.9), scholarships (4.11) — same
//    dropdown-of-fixed-rows mechanics as the two-cell shape above, but
//    every number cell is rendered (paired two-per-row) instead of just
//    cells[0]/[1].
//  - Progressive / free-text-labeled + number cells
//    (VtWizardProgressiveGuidedTableEntry): specialty tables (4.3-4.6,
//    8.4, 8.7, 4.10, 6.3) — the row's own label is user-entered text
//    (def.cells.first, kind .text) rather than a fixed name, so there's
//    no dropdown: the next empty capacity slot is filled in automatically
//    on Ajouter.
//  - Progressive / free-text-labeled + boolean cells
//    (VtWizardProgressiveBooleanTableEntry): 5.2's curriculum table —
//    same free-text-row mechanics as the number variant, but with toggle
//    inputs instead of number boxes (confirmed via get_screenshot against
//    node 66:589's "5.2 Référentiel de formation" card).
// The named roster (8.8) and §7.1.3's folded group still render via the
// existing VtRowEditor/VtTableFieldWidget — see vt_wizard_section_screen
// .dart's dispatch — until they get their own guided-entry treatment.
//
// Reads/writes through the exact same primitives VtRowEditor already
// uses (def.cellId, ctrl.data, ctrl.onGridCellChanged, ctrl.setRawValue)
// — no new cell model, no new persistence path. A def's own computed
// cell (e.g. 4.10/6.3's Total) is read via its computeValue, never
// written — Spreadsheet/Simple Mode's rendering of the same table is
// completely unaffected either way.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/focus/renderers/vt_table_types.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/localized_text.dart';
import '../onefop_form_constants.dart' show kAccent, kDanger;
import '../onefop_form_controller.dart';
import 'vt_wizard_constants.dart';

/// True for the fixed-row/male-female shape [VtWizardGuidedTableEntry]
/// renders — anything else falls back to the caller's existing table
/// renderer (or, for progressiveRows tables, to
/// [VtWizardProgressiveGuidedTableEntry] below). Exactly two number cells
/// (def.cells[0]/[1], read directly by name elsewhere in this file) plus
/// an optional trailing computed Total — vtDiplomaTableDef/
/// vtTrainerAgeTableDef/vtTrainerDisabilityTableDef all carry one now
/// (matching Figma's own "Σ Total" column), never written by this widget,
/// same as every other computed cell.
///
/// Dispatch below (and [_isFixedRowMultiNumberShape]'s) is purely by
/// number-cell *count* (==2 vs >2), not by an explicit per-table flag — so
/// adding or removing a numeric column on any VtTableDef silently
/// re-routes it to a different guided-entry widget (or out of guided-entry
/// support entirely, if the new shape matches none of the predicates in
/// this file) the next time this dispatcher runs. There is no compile-time
/// or test-time guard against that today; a shape change here is easy to
/// miss unless the wizard rendering is checked by hand.
bool _isFixedRowNumberShape(VtTableDef def) =>
    !def.isRoster &&
    !def.progressiveRows &&
    !def.singleCellPerRow &&
    def.cells.where((c) => c.kind == VtCellKind.number).length == 2 &&
    def.cells.every(
        (c) => c.kind == VtCellKind.number || c.kind == VtCellKind.computed) &&
    def.rows.every((r) => r.fixedLabel != null);

/// True for the progressive/free-text-row shape
/// [VtWizardProgressiveGuidedTableEntry] renders: rows aren't pre-named
/// (labelFromCells, not fixedLabel), the first cell is that free-text
/// label, and every remaining cell is a plain number or a read-only
/// computed value (4.10/6.3's Total) — never boolean/radioCode, which
/// this widget doesn't build an input for.
bool _isProgressiveNumberShape(VtTableDef def) =>
    def.progressiveRows &&
    !def.isRoster &&
    !def.singleCellPerRow &&
    def.cells.length >= 2 &&
    def.cells.first.kind == VtCellKind.text &&
    def.cells.skip(1).every(
        (c) => c.kind == VtCellKind.number || c.kind == VtCellKind.computed);

/// True for the progressive/free-text-row shape
/// [VtWizardProgressiveBooleanTableEntry] renders: same free-text-first-
/// cell rule as the number variant above, but every remaining cell is a
/// plain Oui/Non toggle instead — 5.2's curriculum table (specialtyText +
/// hasCurriculum + isApproved) is the one VT shape like this.
bool _isProgressiveBooleanShape(VtTableDef def) =>
    def.progressiveRows &&
    !def.isRoster &&
    !def.singleCellPerRow &&
    def.cells.length >= 2 &&
    def.cells.first.kind == VtCellKind.text &&
    def.cells.skip(1).every((c) => c.kind == VtCellKind.boolean);

/// True for the fixed-row/more-than-two-number-cell shape
/// [VtWizardFixedRowMultiNumberEntry] renders: fixed, pre-named rows (a
/// dropdown, not free text) with more than 2 number cells — the age/flow
/// grid (4.7), the category flow tables (4.8/4.9), and the scholarship
/// table (4.11). Distinguished from [_isFixedRowNumberShape] purely by
/// cell count (>2 vs ==2), so the two predicates never overlap.
bool _isFixedRowMultiNumberShape(VtTableDef def) =>
    !def.isRoster &&
    !def.progressiveRows &&
    !def.singleCellPerRow &&
    def.cells.where((c) => c.kind == VtCellKind.number).length > 2 &&
    def.cells.every(
        (c) => c.kind == VtCellKind.number || c.kind == VtCellKind.computed) &&
    def.rows.every((r) => r.fixedLabel != null);

/// True for the named-roster shape [VtWizardRosterGuidedEntry] renders —
/// just [VtTableDef.isRoster] (only 8.8 today), same "next empty slot"
/// mechanics as the progressive shapes but with the roster's own field
/// set (name/sex/status/diplomas/admin flag), not number or boolean cells.
bool _isRosterShape(VtTableDef def) => def.isRoster;

bool vtWizardSupportsGuidedEntry(VtTableDef def) =>
    _isFixedRowNumberShape(def) ||
    _isFixedRowMultiNumberShape(def) ||
    _isProgressiveNumberShape(def) ||
    _isProgressiveBooleanShape(def) ||
    _isRosterShape(def);

/// Missing and zero have different statistical meanings. Guided summaries
/// must therefore show a missing cell as missing, while preserving a literal
/// entered `0` as `0`.
String _guidedNumberDisplay(int? value, Locale locale) =>
    value?.toString() ??
    const LocalizedText(fr: 'Non renseigné', en: 'Not provided').of(locale);

/// A running total is only meaningful when at least one value has actually
/// been reported. Missing cells contribute no value, rather than silently
/// becoming zero.
int? _sumReported(Iterable<int?> values) {
  final reported = values.whereType<int>().toList();
  return reported.isEmpty
      ? null
      : reported.fold<int>(0, (sum, value) => sum + value);
}

class VtWizardGuidedTableEntry extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardGuidedTableEntry(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardGuidedTableEntry> createState() =>
      _VtWizardGuidedTableEntryState();
}

class _VtWizardGuidedTableEntryState extends State<VtWizardGuidedTableEntry> {
  VtRowDef? _selectedRow;
  final _maleCtrl = TextEditingController();
  final _femaleCtrl = TextEditingController();

  @override
  void dispose() {
    _maleCtrl.dispose();
    _femaleCtrl.dispose();
    super.dispose();
  }

  bool _rowFilled(VtRowDef row) => widget.def.cells
      .any((c) => _filled(widget.ctrl.data[widget.def.cellId(row, c)]));

  static bool _filled(dynamic v) {
    if (v == null) return false;
    if (v is String) return v.trim().isNotEmpty;
    return true;
  }

  int? _cellInt(VtRowDef row, VtCellDef cell) {
    final v = widget.ctrl.data[widget.def.cellId(row, cell)];
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }

  void _add() {
    final row = _selectedRow;
    if (row == null) return;
    final male = widget.def.cells[0];
    final female = widget.def.cells[1];
    final maleVal = int.tryParse(_maleCtrl.text.trim());
    final femaleVal = int.tryParse(_femaleCtrl.text.trim());
    widget.ctrl.onGridCellChanged(widget.def.cellId(row, male), maleVal);
    widget.ctrl.onGridCellChanged(widget.def.cellId(row, female), femaleVal);
    setState(() {
      _selectedRow = null;
      _maleCtrl.clear();
      _femaleCtrl.clear();
    });
  }

  void _remove(VtRowDef row) {
    final male = widget.def.cells[0];
    final female = widget.def.cells[1];
    widget.ctrl.onGridCellChanged(widget.def.cellId(row, male), null);
    widget.ctrl.onGridCellChanged(widget.def.cellId(row, female), null);
    setState(() {});
  }

  void _edit(VtRowDef row) {
    final male = widget.def.cells[0];
    final female = widget.def.cells[1];
    setState(() {
      _selectedRow = row;
      _maleCtrl.text = (_cellInt(row, male) ?? '').toString();
      _femaleCtrl.text = (_cellInt(row, female) ?? '').toString();
    });
    // Editing an already-added row re-selects it into the entry form;
    // Ajouter overwrites its two cells in place (onGridCellChanged is
    // idempotent per cell id), so there's no separate "update" path.
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    final available =
        def.rows.where((r) => !_rowFilled(r) || r == _selectedRow).toList();
    final filledRows = def.rows.where(_rowFilled).toList();
    final entered = filledRows.where((r) => r != _selectedRow).toList();
    final maleLabel = def.cells[0].label.of(locale);
    final femaleLabel = def.cells[1].label.of(locale);
    final totalMale = _sumReported(
      filledRows.map((r) => _cellInt(r, def.cells[0])),
    );
    final totalFemale = _sumReported(
      filledRows.map((r) => _cellInt(r, def.cells[1])),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAF9),
            border: Border.all(color: kVtWizardCardBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                const LocalizedText(
                        fr: 'Saisie progressive', en: 'Step-by-step entry')
                    .of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: kAccent),
              ),
              const SizedBox(height: 4),
              Text(
                const LocalizedText(
                  fr: 'Sélectionnez une ligne, renseignez les effectifs par sexe, '
                      'puis ajoutez-la au résumé.',
                  en: 'Select a row, enter its counts by sex, then add it to the summary.',
                ).of(locale),
                style: kVtWizardCaption,
              ),
              const SizedBox(height: 16),
              Text(
                def.progressNoun.of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    color: kVtWizardInkSoft),
              ),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFD1D6D3)),
                  borderRadius: BorderRadius.circular(8),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<VtRowDef>(
                    value: _selectedRow,
                    isExpanded: true,
                    hint: Text(
                      const LocalizedText(fr: 'Sélectionner…', en: 'Select…')
                          .of(locale),
                      style: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: kVtWizardInkFaint),
                    ),
                    items: [
                      for (final r in available)
                        DropdownMenuItem(
                          value: r,
                          child: Text(r.fixedLabel!.of(locale),
                              style: const TextStyle(
                                  fontFamily: kVtWizardFontFamily,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: kVtWizardInk)),
                        ),
                    ],
                    onChanged: (r) => _edit(r!),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: _GuidedNumberBox(
                          label: maleLabel, controller: _maleCtrl)),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _GuidedNumberBox(
                          label: femaleLabel, controller: _femaleCtrl)),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _selectedRow == null ? null : _add,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kVtWizardInkFaint,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  child: Text(
                    const LocalizedText(fr: 'Ajouter', en: 'Add').of(locale),
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          const LocalizedText(
                  fr: 'Résumé des lignes saisies',
                  en: 'Summary of entered rows')
              .of(locale),
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: kAccent),
        ),
        const SizedBox(height: 4),
        Text(
          LocalizedText(
            fr: '${filledRows.length} ${def.progressNoun.fr} renseigné(s) sur ${def.rows.length}. '
                'Les lignes peuvent être éditées ou supprimées avant validation.',
            en: '${filledRows.length} of ${def.rows.length} ${def.progressNoun.en} filled in. '
                'Rows can be edited or removed before validation.',
          ).of(locale),
          style: kVtWizardCaption,
        ),
        const SizedBox(height: 12),
        if (entered.isEmpty)
          Text(
            const LocalizedText(
                    fr: 'Aucune ligne saisie pour le moment.',
                    en: 'No rows entered yet.')
                .of(locale),
            style: kVtWizardCaption,
          )
        else
          Column(
            children: [
              for (final r in entered) ...[
                _GuidedSummaryRow(
                  label: r.fixedLabel!.of(locale),
                  male: _cellInt(r, def.cells[0]),
                  female: _cellInt(r, def.cells[1]),
                  onEdit: () => _edit(r),
                  onDelete: () => _remove(r),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
        if (filledRows.isNotEmpty) ...[
          const SizedBox(height: 16),
          _GuidedTotalBar(
            totalsText:
                '$maleLabel: ${_guidedNumberDisplay(totalMale, locale)} · '
                '$femaleLabel: ${_guidedNumberDisplay(totalFemale, locale)} · '
                '${const LocalizedText(fr: "Total", en: "Total").of(locale)}: '
                '${_guidedNumberDisplay(
              totalMale == null || totalFemale == null
                  ? null
                  : totalMale + totalFemale,
              locale,
            )}',
            countText: '${filledRows.length}/${def.rows.length} '
                '${def.progressNoun.of(locale)} '
                '${const LocalizedText(fr: "renseignés", en: "filled in").of(locale)}',
          ),
        ],
      ],
    );
  }
}

/// Fixed-row / more-than-two-number-cell guided entry — Figma's age/flow
/// grid pattern (node 154:536, "Section 4: Âges & Flux Grid (Mode Guidé –
/// Multi-colonnes)"): a dropdown of fixed rows (age bands, not free text)
/// followed by every number cell grouped in pairs, "Ajouter", and a
/// summary list. Covers 4.7 (age/flow, 6 number cells), 4.8/4.9 (category
/// flow tables, 6 number cells + 3 computed totals), and 4.11
/// (scholarships, 4 number cells + 2 computed totals) — one widget for
/// every "fixed row × more than 2 numbers" shape, the same way
/// [VtWizardGuidedTableEntry] covers every fixed-row/2-number shape.
///
/// Figma's own mockup groups ages into 7 illustrative bands ("14-17 ans");
/// the real AST (`vtAgeBandRows`) has 24 individual-year rows — matching
/// the by-now-established pattern of Figma showing simplified/illustrative
/// row content while the structural pattern (dropdown + paired numbers +
/// summary) still applies. This widget sources its row list from the real
/// [VtTableDef.rows], not a re-derived band grouping.
class VtWizardFixedRowMultiNumberEntry extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardFixedRowMultiNumberEntry(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardFixedRowMultiNumberEntry> createState() =>
      _VtWizardFixedRowMultiNumberEntryState();
}

class _VtWizardFixedRowMultiNumberEntryState
    extends State<VtWizardFixedRowMultiNumberEntry> {
  VtRowDef? _selectedRow;
  final Map<String, TextEditingController> _numCtrls = {};

  List<VtCellDef> get _numberCells =>
      widget.def.cells.where((c) => c.kind == VtCellKind.number).toList();

  TextEditingController _ctrlFor(VtCellDef cell) =>
      _numCtrls.putIfAbsent(cell.key, () => TextEditingController());

  @override
  void dispose() {
    for (final c in _numCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  bool _rowFilled(VtRowDef row) => _numberCells
      .any((c) => widget.ctrl.data[widget.def.cellId(row, c)] != null);

  int? _cellInt(VtRowDef row, VtCellDef cell) {
    final v = widget.ctrl.data[widget.def.cellId(row, cell)];
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }

  void _clearForm() {
    _selectedRow = null;
    for (final c in _numCtrls.values) {
      c.clear();
    }
  }

  void _add() {
    final row = _selectedRow;
    if (row == null) return;
    for (final cell in _numberCells) {
      final val = int.tryParse(_ctrlFor(cell).text.trim());
      widget.ctrl.onGridCellChanged(widget.def.cellId(row, cell), val);
    }
    setState(_clearForm);
  }

  void _remove(VtRowDef row) {
    for (final cell in _numberCells) {
      widget.ctrl.onGridCellChanged(widget.def.cellId(row, cell), null);
    }
    setState(() {
      if (_selectedRow == row) _clearForm();
    });
  }

  void _edit(VtRowDef row) {
    setState(() {
      _selectedRow = row;
      for (final cell in _numberCells) {
        _ctrlFor(cell).text = (_cellInt(row, cell) ?? '').toString();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    final available =
        def.rows.where((r) => !_rowFilled(r) || r == _selectedRow).toList();
    final filledRows = def.rows.where(_rowFilled).toList();
    final entered = filledRows.where((r) => r != _selectedRow).toList();
    final totals = <String, int?>{
      for (final cell in _numberCells)
        cell.key: _sumReported(filledRows.map((r) => _cellInt(r, cell))),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAF9),
            border: Border.all(color: kVtWizardCardBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                def.progressNoun.of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    color: kVtWizardInkSoft),
              ),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFD1D6D3)),
                  borderRadius: BorderRadius.circular(8),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<VtRowDef>(
                    value: _selectedRow,
                    isExpanded: true,
                    hint: Text(
                      const LocalizedText(fr: 'Sélectionner…', en: 'Select…')
                          .of(locale),
                      style: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: kVtWizardInkFaint),
                    ),
                    items: [
                      for (final r in available)
                        DropdownMenuItem(
                          value: r,
                          child: Text(r.fixedLabel!.of(locale),
                              style: const TextStyle(
                                  fontFamily: kVtWizardFontFamily,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: kVtWizardInk)),
                        ),
                    ],
                    onChanged: (r) => _edit(r!),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              for (var i = 0; i < _numberCells.length; i += 2)
                Padding(
                  padding: EdgeInsets.only(
                      bottom: i + 2 < _numberCells.length ? 12 : 0),
                  child: Row(
                    children: [
                      Expanded(
                          child: _GuidedNumberBox(
                              label: _numberCells[i].label.of(locale),
                              controller: _ctrlFor(_numberCells[i]))),
                      if (i + 1 < _numberCells.length) ...[
                        const SizedBox(width: 12),
                        Expanded(
                            child: _GuidedNumberBox(
                                label: _numberCells[i + 1].label.of(locale),
                                controller: _ctrlFor(_numberCells[i + 1]))),
                      ],
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _selectedRow == null ? null : _add,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kVtWizardInkFaint,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  child: Text(
                    const LocalizedText(fr: 'Ajouter', en: 'Add').of(locale),
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          const LocalizedText(
                  fr: 'Résumé des lignes saisies',
                  en: 'Summary of entered rows')
              .of(locale),
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: kAccent),
        ),
        const SizedBox(height: 4),
        Text(
          LocalizedText(
            fr: '${filledRows.length} ${def.progressNoun.fr} renseignée(s) sur ${def.rows.length}. '
                'Les lignes peuvent être éditées ou supprimées avant validation.',
            en: '${filledRows.length} of ${def.rows.length} ${def.progressNoun.en} filled in. '
                'Rows can be edited or removed before validation.',
          ).of(locale),
          style: kVtWizardCaption,
        ),
        const SizedBox(height: 12),
        if (entered.isEmpty)
          Text(
            const LocalizedText(
                    fr: 'Aucune ligne saisie pour le moment.',
                    en: 'No rows entered yet.')
                .of(locale),
            style: kVtWizardCaption,
          )
        else
          Column(
            children: [
              for (final r in entered) ...[
                _GuidedProgressiveSummaryRow(
                  label: r.fixedLabel!.of(locale),
                  detail: [
                    for (final cell in _numberCells)
                      '${cell.label.of(locale)}: '
                          '${_guidedNumberDisplay(_cellInt(r, cell), locale)}',
                  ].join(' · '),
                  onEdit: () => _edit(r),
                  onDelete: () => _remove(r),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
        if (filledRows.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            const LocalizedText(fr: 'Total en cours', en: 'Running total')
                .of(locale),
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: kAccent),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final cell in _numberCells)
                SizedBox(
                  width: 140,
                  child: _GuidedStatBox(
                    label: cell.label.of(locale),
                    value: totals[cell.key],
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Progressive-row guided entry — Figma's "Effectifs par Spécialités"
/// pattern (node 11:1992, frame 77:141): a free-text row label (e.g.
/// "Spécialité") typed once per row, plus its number cells, "Ajouter"
/// fills the next empty capacity slot in [def.rows] — there's no
/// dropdown of pre-named rows here (unlike VtWizardGuidedTableEntry)
/// since the row's own identity IS the free text the user enters, not
/// a fixed taxonomy. Editing an already-added row re-selects that exact
/// slot so Ajouter overwrites it in place instead of consuming a new one.
/// Title is plain (untinted), and the running total is a row of
/// [_GuidedStatBox]es, one per number cell — both confirmed via
/// get_screenshot against node 11:1992, distinct from the fixed-row
/// widget's tinted header + single-line total bar.
class VtWizardProgressiveGuidedTableEntry extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardProgressiveGuidedTableEntry(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardProgressiveGuidedTableEntry> createState() =>
      _VtWizardProgressiveGuidedTableEntryState();
}

class _VtWizardProgressiveGuidedTableEntryState
    extends State<VtWizardProgressiveGuidedTableEntry> {
  VtRowDef? _selectedRow;
  final _labelCtrl = TextEditingController();
  final Map<String, TextEditingController> _numCtrls = {};
  bool _labelError = false;

  VtCellDef get _labelCell => widget.def.cells.first;
  List<VtCellDef> get _numberCells => widget.def.cells
      .skip(1)
      .where((c) => c.kind == VtCellKind.number)
      .toList();
  VtCellDef? get _computedCell => widget.def.cells
      .skip(1)
      .where((c) => c.kind == VtCellKind.computed)
      .cast<VtCellDef?>()
      .firstOrNull;

  TextEditingController _ctrlFor(VtCellDef cell) =>
      _numCtrls.putIfAbsent(cell.key, () => TextEditingController());

  @override
  void dispose() {
    _labelCtrl.dispose();
    for (final c in _numCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  bool _rowFilled(VtRowDef row) =>
      _filled(widget.ctrl.data[widget.def.cellId(row, _labelCell)]);

  static bool _filled(dynamic v) {
    if (v == null) return false;
    if (v is String) return v.trim().isNotEmpty;
    return true;
  }

  int? _cellInt(VtRowDef row, VtCellDef cell) {
    final v = widget.ctrl.data[widget.def.cellId(row, cell)];
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse(v.toString());
  }

  void _clearForm() {
    _selectedRow = null;
    _labelError = false;
    _labelCtrl.clear();
    for (final c in _numCtrls.values) {
      c.clear();
    }
  }

  void _add() {
    final row = _selectedRow ??
        widget.def.rows.firstWhere((r) => !_rowFilled(r),
            orElse: () => widget.def.rows.last);
    final label = _labelCtrl.text.trim();
    if (label.isEmpty) {
      setState(() => _labelError = true);
      return;
    }
    widget.ctrl.setRawValue(widget.def.cellId(row, _labelCell), label);
    for (final cell in _numberCells) {
      final val = int.tryParse(_ctrlFor(cell).text.trim());
      widget.ctrl.onGridCellChanged(widget.def.cellId(row, cell), val);
    }
    setState(_clearForm);
  }

  void _remove(VtRowDef row) {
    widget.ctrl.setRawValue(widget.def.cellId(row, _labelCell), null);
    for (final cell in _numberCells) {
      widget.ctrl.onGridCellChanged(widget.def.cellId(row, cell), null);
    }
    setState(() {
      if (_selectedRow == row) _clearForm();
    });
  }

  void _edit(VtRowDef row) {
    setState(() {
      _selectedRow = row;
      _labelCtrl.text =
          widget.ctrl.data[widget.def.cellId(row, _labelCell)]?.toString() ??
              '';
      for (final cell in _numberCells) {
        _ctrlFor(cell).text = (_cellInt(row, cell) ?? '').toString();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    final filledRows = def.rows.where(_rowFilled).toList();
    final entered = filledRows.where((r) => r != _selectedRow).toList();
    final atCapacity = _selectedRow == null && def.rows.every(_rowFilled);
    final totals = <String, int?>{
      for (final cell in _numberCells)
        cell.key: _sumReported(filledRows.map((r) => _cellInt(r, cell))),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          tinted: false,
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAF9),
            border: Border.all(color: kVtWizardCardBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                const LocalizedText(
                        fr: 'Saisie progressive', en: 'Step-by-step entry')
                    .of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: kAccent),
              ),
              const SizedBox(height: 4),
              Text(
                def.progressNoun.of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    color: kVtWizardInkSoft),
              ),
              const SizedBox(height: 16),
              _GuidedNumberBox(
                  label: _labelCell.label.of(locale),
                  controller: _labelCtrl,
                  numeric: false,
                  errorText: _labelError
                      ? const LocalizedText(
                          fr: 'Saisissez un intitulé avant d’enregistrer la ligne.',
                          en: 'Enter a name before saving this row.',
                        ).of(locale)
                      : null,
                  onChanged: (_) {
                    if (_labelError) setState(() => _labelError = false);
                  }),
              const SizedBox(height: 12),
              for (var i = 0; i < _numberCells.length; i += 2)
                Padding(
                  padding: EdgeInsets.only(
                      bottom: i + 2 < _numberCells.length ? 12 : 0),
                  child: Row(
                    children: [
                      Expanded(
                          child: _GuidedNumberBox(
                              label: _numberCells[i].label.of(locale),
                              controller: _ctrlFor(_numberCells[i]))),
                      if (i + 1 < _numberCells.length) ...[
                        const SizedBox(width: 12),
                        Expanded(
                            child: _GuidedNumberBox(
                                label: _numberCells[i + 1].label.of(locale),
                                controller: _ctrlFor(_numberCells[i + 1]))),
                      ],
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: atCapacity ? null : _add,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kVtWizardInkFaint,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  child: Text(
                    const LocalizedText(
                            fr: 'Enregistrer la ligne', en: 'Save row')
                        .of(locale),
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          const LocalizedText(
                  fr: 'Résumé des lignes saisies',
                  en: 'Summary of entered rows')
              .of(locale),
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: kAccent),
        ),
        const SizedBox(height: 4),
        Text(
          LocalizedText(
            fr: '${filledRows.length} ${def.progressNoun.fr} renseignée(s) sur ${def.rows.length}. '
                'Les lignes peuvent être éditées ou supprimées avant validation.',
            en: '${filledRows.length} of ${def.rows.length} ${def.progressNoun.en} filled in. '
                'Rows can be edited or removed before validation.',
          ).of(locale),
          style: kVtWizardCaption,
        ),
        const SizedBox(height: 12),
        if (entered.isEmpty)
          Text(
            const LocalizedText(
                    fr: 'Aucune ligne saisie pour le moment.',
                    en: 'No rows entered yet.')
                .of(locale),
            style: kVtWizardCaption,
          )
        else
          Column(
            children: [
              for (final r in entered) ...[
                _GuidedProgressiveSummaryRow(
                  label:
                      widget.ctrl.data[def.cellId(r, _labelCell)]?.toString() ??
                          '',
                  detail: [
                    for (final cell in _numberCells)
                      '${cell.label.of(locale)}: '
                          '${_guidedNumberDisplay(_cellInt(r, cell), locale)}',
                  ].join(' · '),
                  computedLabel: _computedCell?.label.of(locale),
                  computedValue:
                      _computedCell?.computeValue?.call(r.id, widget.ctrl.data),
                  onEdit: () => _edit(r),
                  onDelete: () => _remove(r),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
        if (filledRows.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            const LocalizedText(fr: 'Total en cours', en: 'Running total')
                .of(locale),
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: kAccent),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 0; i < _numberCells.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(
                  child: _GuidedStatBox(
                    label: _numberCells[i].label.of(locale),
                    value: totals[_numberCells[i].key],
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

/// Progressive/boolean guided entry — Figma's "5.2 Référentiel de
/// formation" card (node 66:589): a free-text specialty field plus one
/// or more Oui/Non toggles per row (a later toggle can be gated behind
/// an earlier one via dependsOnKey, e.g. isApproved behind hasCurriculum
/// — hidden, not just disabled, until the gate is Oui), a "Total N
/// {progressNoun} ajoutés" caption beside a compact Ajouter button (not
/// full-width, unlike the number/specialty variant above — this card
/// genuinely lays it out that way), and a summary list whose actions are
/// "Éditer"/"Supprimer" text pills — confirmed via get_screenshot against
/// this exact card, distinct from the icon-square buttons every other
/// guided-entry card in this file uses (see _GuidedIconButton's own doc
/// comment for why THAT one is icon-square instead of pill: different
/// Figma screens showed different button styles for otherwise-identical
/// summary rows, and each widget here matches its own confirmed screen
/// rather than forcing one convention everywhere).
class VtWizardProgressiveBooleanTableEntry extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardProgressiveBooleanTableEntry(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardProgressiveBooleanTableEntry> createState() =>
      _VtWizardProgressiveBooleanTableEntryState();
}

class _VtWizardProgressiveBooleanTableEntryState
    extends State<VtWizardProgressiveBooleanTableEntry> {
  VtRowDef? _selectedRow;
  final _labelCtrl = TextEditingController();
  final Map<String, bool?> _boolValues = {};

  VtCellDef get _labelCell => widget.def.cells.first;
  List<VtCellDef> get _boolCells => widget.def.cells.skip(1).toList();

  @override
  void dispose() {
    _labelCtrl.dispose();
    super.dispose();
  }

  bool _rowFilled(VtRowDef row) =>
      _filled(widget.ctrl.data[widget.def.cellId(row, _labelCell)]);

  static bool _filled(dynamic v) {
    if (v == null) return false;
    if (v is String) return v.trim().isNotEmpty;
    return true;
  }

  bool? _cellBool(VtRowDef row, VtCellDef cell) {
    final v = widget.ctrl.data[widget.def.cellId(row, cell)];
    return cell.decodeBoolean != null ? cell.decodeBoolean!(v) : v as bool?;
  }

  void _clearForm() {
    _selectedRow = null;
    _labelCtrl.clear();
    _boolValues.clear();
  }

  void _add() {
    final label = _labelCtrl.text.trim();
    if (label.isEmpty) return;
    final row = _selectedRow ??
        widget.def.rows.firstWhere((r) => !_rowFilled(r),
            orElse: () => widget.def.rows.last);
    widget.ctrl.setRawValue(widget.def.cellId(row, _labelCell), label);
    for (final cell in _boolCells) {
      final v = _boolValues[cell.key];
      final stored = v == null
          ? null
          : (cell.encodeBoolean != null ? cell.encodeBoolean!(v) : v);
      widget.ctrl.setRawValue(widget.def.cellId(row, cell), stored);
    }
    setState(_clearForm);
  }

  void _remove(VtRowDef row) {
    widget.ctrl.setRawValue(widget.def.cellId(row, _labelCell), null);
    for (final cell in _boolCells) {
      widget.ctrl.setRawValue(widget.def.cellId(row, cell), null);
    }
    setState(() {
      if (_selectedRow == row) _clearForm();
    });
  }

  void _edit(VtRowDef row) {
    setState(() {
      _selectedRow = row;
      _labelCtrl.text =
          widget.ctrl.data[widget.def.cellId(row, _labelCell)]?.toString() ??
              '';
      _boolValues
        ..clear()
        ..addEntries(_boolCells.map((c) => MapEntry(c.key, _cellBool(row, c))));
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    final filledRows = def.rows.where(_rowFilled).toList();
    final entered = filledRows.where((r) => r != _selectedRow).toList();
    final atCapacity = _selectedRow == null && def.rows.every(_rowFilled);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          tinted: false,
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        _GuidedNumberBox(
            label: _labelCell.label.of(locale),
            controller: _labelCtrl,
            numeric: false),
        const SizedBox(height: 16),
        for (final cell in _boolCells)
          if (cell.dependsOnKey == null ||
              _boolValues[cell.dependsOnKey] == true)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(cell.label.of(locale),
                        style: const TextStyle(
                            fontFamily: kVtWizardFontFamily,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: kVtWizardInk)),
                  ),
                  _GuidedToggle(
                    value: _boolValues[cell.key],
                    onChanged: (v) => setState(() => _boolValues[cell.key] = v),
                  ),
                ],
              ),
            ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(
                      fontFamily: kVtWizardFontFamily,
                      fontSize: 13,
                      color: kVtWizardInk),
                  children: [
                    TextSpan(
                        text:
                            '${const LocalizedText(fr: "Total", en: "Total").of(locale)}   ',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    TextSpan(
                      text:
                          '${filledRows.length} ${def.progressNoun.of(locale)} '
                          '${const LocalizedText(fr: "ajoutés", en: "added").of(locale)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, color: kAccent),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton(
              onPressed: atCapacity ? null : _add,
              style: ElevatedButton.styleFrom(
                backgroundColor: kAccent,
                foregroundColor: Colors.white,
                disabledBackgroundColor: kVtWizardInkFaint,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6)),
              ),
              child: Text(
                const LocalizedText(fr: 'Ajouter', en: 'Add').of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        if (entered.isNotEmpty) ...[
          const SizedBox(height: 16),
          Column(
            children: [
              for (final r in entered) ...[
                _GuidedBooleanSummaryRow(
                  label:
                      widget.ctrl.data[def.cellId(r, _labelCell)]?.toString() ??
                          '',
                  detail: [
                    for (final cell in _boolCells)
                      if (_cellBool(r, cell) != null)
                        '${cell.label.of(locale)} : '
                            '${_cellBool(r, cell)! ? const LocalizedText(fr: "Oui", en: "Yes").of(locale) : const LocalizedText(fr: "Non", en: "No").of(locale)}',
                  ].join(' • '),
                  onEdit: () => _edit(r),
                  onDelete: () => _remove(r),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

/// Explicit Yes/No radio choices for the guided row editor. A factual
/// response must retain its unanswered state; a switch-like pill made null
/// look like Non and encouraged accidental answers.
class _GuidedToggle extends StatelessWidget {
  final bool? value;
  final ValueChanged<bool> onChanged;
  const _GuidedToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    Widget option({required bool answer, required String label}) {
      final selected = value == answer;
      return Semantics(
        checked: selected,
        inMutuallyExclusiveGroup: true,
        child: InkWell(
          onTap: () => onChanged(answer),
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: 20,
                  color: selected ? kAccent : const Color(0xFFCBD5E1),
                ),
                const SizedBox(width: 10),
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                    fontSize: 14,
                    color: selected ? kVtWizardInk : kVtWizardInkSoft,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Semantics(
      label: const LocalizedText(
              fr: 'Choisissez Oui ou Non', en: 'Choose Yes or No')
          .of(locale),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          option(
              answer: true,
              label: const LocalizedText(fr: 'Oui', en: 'Yes').of(locale)),
          const SizedBox(width: 32),
          option(
              answer: false,
              label: const LocalizedText(fr: 'Non', en: 'No').of(locale)),
        ],
      ),
    );
  }
}

class _GuidedBooleanSummaryRow extends StatelessWidget {
  final String label;
  final String detail;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _GuidedBooleanSummaryRow({
    required this.label,
    required this.detail,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: kVtWizardInk)),
                if (detail.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(detail,
                      style: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                          color: kVtWizardInkSoft)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          _GuidedTextPill(
              label: const LocalizedText(fr: 'Éditer', en: 'Edit').of(locale),
              danger: false,
              onTap: onEdit),
          const SizedBox(width: 8),
          _GuidedTextPill(
              label:
                  const LocalizedText(fr: 'Supprimer', en: 'Delete').of(locale),
              danger: true,
              onTap: onDelete),
        ],
      ),
    );
  }
}

class _GuidedTextPill extends StatelessWidget {
  final String label;
  final bool danger;
  final VoidCallback onTap;
  const _GuidedTextPill(
      {required this.label, required this.danger, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xFFCE1126) : kVtWizardInkSoft;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: danger ? color : kVtWizardCardBorder),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: color)),
      ),
    );
  }
}

class _GuidedProgressiveSummaryRow extends StatelessWidget {
  final String label;
  final String detail;
  final String? computedLabel;
  final int? computedValue;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _GuidedProgressiveSummaryRow({
    required this.label,
    required this.detail,
    this.computedLabel,
    this.computedValue,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: kVtWizardInk)),
                const SizedBox(height: 2),
                Text(detail,
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                        color: kVtWizardInkSoft)),
              ],
            ),
          ),
          if (computedLabel != null) ...[
            const SizedBox(width: 12),
            Text(_guidedNumberDisplay(computedValue, context.loc),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: kAccent)),
          ],
          const SizedBox(width: 8),
          _GuidedIconButton(icon: Icons.edit_outlined, onTap: onEdit),
          const SizedBox(width: 8),
          _GuidedIconButton(icon: Icons.delete_outline, onTap: onDelete),
        ],
      ),
    );
  }
}

/// Edit/delete square icon button — Figma's actual summary-row action
/// style on every one of the newer, toggle-equipped section screens
/// (nodes 74:44/74:46 on Section 4's 08a, matching 15a's own Formateurs
/// card): a 28x28 rounded-6px box, bg #F4F6F5, border #D1D6D3, a plain
/// pencil/trash glyph — not the colored "Modifier"/"Supprimer" text pill
/// this file used briefly (that pill's only source, node 11:2206, turned
/// out to be a stale combined Sections-7&8 screen predating the 08a/09a/
/// 13a/15a per-section breakout — every one of those newer screens uses
/// this icon-square style instead).
class _GuidedIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _GuidedIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: kVtWizardBackground,
          border: Border.all(color: const Color(0xFFD1D6D3)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14, color: kVtWizardInkSoft),
      ),
    );
  }
}

/// Named-roster guided entry — Figma's "État Nominatif des Formateurs /
/// Trainer Directory" card (node 154:724, "13a-2 - Section 8: État
/// Nominatif Formateurs (Mode Guidé - 8.8)"): one form per trainer, an
/// "Ajouter un formateur" button, a per-entry progress count, and a named
/// summary list. The only VT roster (8.8) — [VtTableDef.isRoster].
///
/// Figma's own mockup fields (Spécialité, Diplôme le plus élevé, Années
/// d'expérience) don't match the real AST cells at all — 8.8's actual
/// columns are lastName/firstName/sex/trainerStatus/isAdminPersonnel/
/// academicDiploma/professionalDiploma (vtTrainerRosterTableDef). Same
/// established rule as Section 5's tabs and Section 6's specialty card:
/// follow Figma's structural pattern (one card per record, name-first
/// identity, progress count, named summary), source the actual fields
/// from the real table def. Rows have no fixedLabel (roster slots are
/// anonymous `s8q8_row1..14`), so — like the progressive-shape widgets,
/// not the dropdown ones — Ajouter fills the next empty slot rather than
/// picking from a list. Header stays tinted (unlike the progressive
/// number/boolean widgets): Figma's own screenshot shows this card with
/// the same tinted box the fixed-row shapes use, read as "a roster is a
/// directory, not a repeating specialty table" even though its identity
/// is free text.
class VtWizardRosterGuidedEntry extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardRosterGuidedEntry(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardRosterGuidedEntry> createState() =>
      _VtWizardRosterGuidedEntryState();
}

class _VtWizardRosterGuidedEntryState extends State<VtWizardRosterGuidedEntry> {
  VtRowDef? _selectedRow;
  final _lastNameCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final Map<String, String?> _radioValues = {};
  bool? _isAdminPersonnel;
  bool _lastNameError = false;

  VtCellDef get _lastNameCell =>
      widget.def.cells.firstWhere((c) => c.key == 'lastName');
  VtCellDef get _firstNameCell =>
      widget.def.cells.firstWhere((c) => c.key == 'firstName');
  VtCellDef get _sexCell => widget.def.cells.firstWhere((c) => c.key == 'sex');
  VtCellDef get _statusCell =>
      widget.def.cells.firstWhere((c) => c.key == 'trainerStatus');
  VtCellDef get _adminCell =>
      widget.def.cells.firstWhere((c) => c.key == 'isAdminPersonnel');
  List<VtCellDef> get _diplomaCells =>
      widget.def.cells.where((c) => c.key.endsWith('Diploma')).toList();

  @override
  void dispose() {
    _lastNameCtrl.dispose();
    _firstNameCtrl.dispose();
    super.dispose();
  }

  bool _rowFilled(VtRowDef row) =>
      _filled(widget.ctrl.data[widget.def.cellId(row, _lastNameCell)]);

  static bool _filled(dynamic v) {
    if (v == null) return false;
    if (v is String) return v.trim().isNotEmpty;
    return true;
  }

  String? _radioValue(VtRowDef row, VtCellDef cell) =>
      widget.ctrl.data[widget.def.cellId(row, cell)] as String?;

  bool? _boolValue(VtRowDef row, VtCellDef cell) =>
      widget.ctrl.data[widget.def.cellId(row, cell)] as bool?;

  void _clearForm() {
    _selectedRow = null;
    _lastNameError = false;
    _lastNameCtrl.clear();
    _firstNameCtrl.clear();
    _radioValues.clear();
    _isAdminPersonnel = null;
  }

  void _add() {
    final lastName = _lastNameCtrl.text.trim();
    if (lastName.isEmpty) {
      setState(() => _lastNameError = true);
      return;
    }
    final row = _selectedRow ??
        widget.def.rows.firstWhere((r) => !_rowFilled(r),
            orElse: () => widget.def.rows.last);
    widget.ctrl.setRawValue(widget.def.cellId(row, _lastNameCell), lastName);
    widget.ctrl.setRawValue(
        widget.def.cellId(row, _firstNameCell), _firstNameCtrl.text.trim());
    for (final cell in [_sexCell, _statusCell, ..._diplomaCells]) {
      widget.ctrl
          .setRawValue(widget.def.cellId(row, cell), _radioValues[cell.key]);
    }
    widget.ctrl
        .setRawValue(widget.def.cellId(row, _adminCell), _isAdminPersonnel);
    setState(_clearForm);
  }

  void _remove(VtRowDef row) {
    for (final cell in widget.def.cells) {
      widget.ctrl.setRawValue(widget.def.cellId(row, cell), null);
    }
    setState(() {
      if (_selectedRow == row) _clearForm();
    });
  }

  void _edit(VtRowDef row) {
    setState(() {
      _selectedRow = row;
      _lastNameCtrl.text =
          widget.ctrl.data[widget.def.cellId(row, _lastNameCell)]?.toString() ??
              '';
      _firstNameCtrl.text = widget
              .ctrl.data[widget.def.cellId(row, _firstNameCell)]
              ?.toString() ??
          '';
      _radioValues
        ..clear()
        ..addEntries([_sexCell, _statusCell, ..._diplomaCells]
            .map((c) => MapEntry(c.key, _radioValue(row, c))));
      _isAdminPersonnel = _boolValue(row, _adminCell);
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    final filledRows = def.rows.where(_rowFilled).toList();
    final entered = filledRows.where((r) => r != _selectedRow).toList();
    final atCapacity = _selectedRow == null && def.rows.every(_rowFilled);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        VtWizardGuidedHeaderBox(
          title: def.paperCode != null
              ? LocalizedText(
                  fr: '${def.paperCode}  ${def.title.fr}',
                  // Was missing the paperCode prefix on the EN side —
                  // only surfaced once the wizard stopped always showing
                  // the FR string regardless of locale.
                  en: '${def.paperCode}  ${def.title.en}',
                )
              : def.title,
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAF9),
            border: Border.all(color: kVtWizardCardBorder),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                const LocalizedText(
                        fr: 'Ajouter un formateur', en: 'Add a trainer')
                    .of(locale),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: kAccent),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                      child: _GuidedNumberBox(
                          label: _lastNameCell.label.of(locale),
                          controller: _lastNameCtrl,
                          numeric: false,
                          errorText: _lastNameError
                              ? const LocalizedText(
                                  fr: 'Saisissez le nom avant d’enregistrer le formateur.',
                                  en: 'Enter a surname before saving this trainer.',
                                ).of(locale)
                              : null,
                          onChanged: (_) {
                            if (_lastNameError) {
                              setState(() => _lastNameError = false);
                            }
                          })),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _GuidedNumberBox(
                          label: _firstNameCell.label.of(locale),
                          controller: _firstNameCtrl,
                          numeric: false)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: _GuidedRadioDropdown(
                      label: _statusCell.label.of(locale),
                      options: _statusCell.options!,
                      value: _radioValues[_statusCell.key],
                      onChanged: (v) =>
                          setState(() => _radioValues[_statusCell.key] = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 180,
                    child: _GuidedSexToggle(
                      label: _sexCell.label.of(locale),
                      options: _sexCell.options!,
                      value: _radioValues[_sexCell.key],
                      onChanged: (v) =>
                          setState(() => _radioValues[_sexCell.key] = v),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final cell in _diplomaCells) ...[
                _GuidedRadioDropdown(
                  label: cell.label.of(locale),
                  options: cell.options!,
                  value: _radioValues[cell.key],
                  onChanged: (v) => setState(() => _radioValues[cell.key] = v),
                ),
                const SizedBox(height: 12),
              ],
              Row(
                children: [
                  Expanded(
                    child: Text(_adminCell.label.of(locale),
                        style: const TextStyle(
                            fontFamily: kVtWizardFontFamily,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: kVtWizardInk)),
                  ),
                  _GuidedToggle(
                    value: _isAdminPersonnel,
                    onChanged: (v) => setState(() => _isAdminPersonnel = v),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: atCapacity ? null : _add,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kVtWizardInkFaint,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6)),
                  ),
                  child: Text(
                    const LocalizedText(
                      fr: 'Enregistrer le formateur',
                      en: 'Save trainer',
                    ).of(locale),
                    style: const TextStyle(
                        fontFamily: kVtWizardFontFamily,
                        fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          const LocalizedText(
                  fr: 'Formateurs enregistrés', en: 'Registered trainers')
              .of(locale),
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: kAccent),
        ),
        const SizedBox(height: 4),
        Text(
          LocalizedText(
            fr: '${filledRows.length} ${def.progressNoun.fr} sur ${def.rows.length}.',
            en: '${filledRows.length} of ${def.rows.length} ${def.progressNoun.en}.',
          ).of(locale),
          style: kVtWizardCaption,
        ),
        const SizedBox(height: 12),
        if (entered.isEmpty)
          Text(
            const LocalizedText(
                    fr: 'Aucun formateur enregistré pour le moment.',
                    en: 'No trainer registered yet.')
                .of(locale),
            style: kVtWizardCaption,
          )
        else
          Column(
            children: [
              for (final r in entered) ...[
                _GuidedProgressiveSummaryRow(
                  label: '${widget.ctrl.data[def.cellId(r, _lastNameCell)] ?? ''} '
                          '${widget.ctrl.data[def.cellId(r, _firstNameCell)] ?? ''}'
                      .trim(),
                  detail: [
                    if (_radioValue(r, _statusCell) != null)
                      _optionLabel(
                          _statusCell, _radioValue(r, _statusCell), locale),
                    if (_boolValue(r, _adminCell) == true)
                      const LocalizedText(
                              fr: 'Personnel administratif',
                              en: 'Administrative staff')
                          .of(locale),
                  ].join(' · '),
                  onEdit: () => _edit(r),
                  onDelete: () => _remove(r),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
      ],
    );
  }

  String _optionLabel(VtCellDef cell, String? value, Locale locale) {
    final opt = cell.options!
        .where((o) => o.value == value)
        .cast<VtOption?>()
        .firstOrNull;
    return opt?.label.of(locale) ?? '';
  }
}

/// Dropdown for a [VtCellKind.radioCode] cell with more than 2 options —
/// the roster's Statut/Diplôme académique/Diplôme professionnel pickers.
class _GuidedRadioDropdown extends StatelessWidget {
  final String label;
  final List<VtOption> options;
  final String? value;
  final ValueChanged<String?> onChanged;
  const _GuidedRadioDropdown(
      {required this.label,
      required this.options,
      required this.value,
      required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: kVtWizardInkSoft)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFD1D6D3)),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              hint: Text(
                const LocalizedText(fr: 'Sélectionner…', en: 'Select…')
                    .of(context.loc),
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: kVtWizardInkFaint),
              ),
              items: [
                for (final o in options)
                  DropdownMenuItem(
                    value: o.value,
                    child: Text(o.label.of(context.loc),
                        style: const TextStyle(
                            fontFamily: kVtWizardFontFamily,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: kVtWizardInk)),
                  ),
              ],
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}

/// 2-option pill toggle for the roster's Sexe cell — matches Figma's H/F
/// toggle look for this exact field, reusing the same [VtOption] values
/// (not a hardcoded boolean) since sex is a [VtCellKind.radioCode] cell,
/// not [VtCellKind.boolean].
class _GuidedSexToggle extends StatelessWidget {
  final String label;
  final List<VtOption> options;
  final String? value;
  final ValueChanged<String?> onChanged;
  const _GuidedSexToggle(
      {required this.label,
      required this.options,
      required this.value,
      required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: kVtWizardInkSoft)),
        const SizedBox(height: 6),
        Container(
          height: 46,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: kVtWizardBackground,
            border: Border.all(color: const Color(0xFFD1D6D3)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              for (final o in options)
                Expanded(
                  child: InkWell(
                    onTap: () => onChanged(o.value),
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: value == o.value ? kAccent : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(o.label.of(locale).toUpperCase(),
                          style: TextStyle(
                              fontFamily: kVtWizardFontFamily,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                              color: value == o.value
                                  ? Colors.white
                                  : kVtWizardInkSoft)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// §7.1.3's five stakeholder-informed toggles — Figma's new card, built on
/// node 11:2206 ("Thèmes Transversaux") right after the existing 7.7 row:
/// a plain small sub-header followed by 5 always-visible toggle rows, one
/// per stakeholder, directly editable — no add/edit/delete ceremony,
/// unlike every other guided-entry shape in this file, because the row
/// set is small and fixed (5 stakeholders, never more or fewer) rather
/// than a capacity to fill. VT7_7-11 have no tableSpec at all — they're
/// plain AST `checkbox`-typed fields, not `type: table` — so
/// vt_wizard_section_screen.dart special-cases these 5 field ids directly
/// rather than routing through _vtWizardTableField's normal template
/// dispatch, which only fires when a field actually carries a tableSpec.
class VtWizardStakeholderInformedCard extends StatefulWidget {
  final OnefopFormController ctrl;
  final VtTableDef def;
  const VtWizardStakeholderInformedCard(
      {super.key, required this.ctrl, required this.def});

  @override
  State<VtWizardStakeholderInformedCard> createState() =>
      _VtWizardStakeholderInformedCardState();
}

class _VtWizardStakeholderInformedCardState
    extends State<VtWizardStakeholderInformedCard> {
  bool? _valueOf(VtRowDef row) {
    final cell = widget.def.cells.first;
    final stored = widget.ctrl.data[widget.def.cellId(row, cell)];
    return cell.decodeBoolean != null
        ? cell.decodeBoolean!(stored)
        : stored as bool?;
  }

  void _setValue(VtRowDef row, bool value) {
    final cell = widget.def.cells.first;
    final stored =
        cell.encodeBoolean != null ? cell.encodeBoolean!(value) : value;
    widget.ctrl.setRawValue(widget.def.cellId(row, cell), stored);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final def = widget.def;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          def.paperCode != null
              ? '${def.paperCode} ${def.title.of(locale)}'
              : def.title.of(locale),
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w700,
              fontSize: 11,
              color: kVtWizardInkFaint),
        ),
        const SizedBox(height: 8),
        for (final row in def.rows) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(row.fixedLabel!.of(locale),
                      style: const TextStyle(
                          fontFamily: kVtWizardFontFamily,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: kVtWizardInk)),
                ),
                _GuidedToggle(
                    value: _valueOf(row), onChanged: (v) => _setValue(row, v)),
              ],
            ),
          ),
          if (row != def.rows.last)
            Container(height: 1, color: kVtWizardCardBorder),
        ],
      ],
    );
  }
}

/// The table's own bilingual title, tinted — Figma's "guided-header" box
/// (e.g. node 74:4 on the Section 4 Guidé screen): bg #EDF7F2, bordered,
/// rounded-8, FR sentence bold on top of an EN regular subtitle —
/// replaces this file's previous plain accent Text title, which had no
/// box treatment and only showed one language at a time. Bilingual
/// regardless of active locale, same deliberate departure from
/// locale.of(...) vt_wizard_fields.dart's field labels already use.
/// Card title above a guided-entry table. Fixed-row shapes (diploma,
/// trainer-age, trainer-disability — confirmed via get_screenshot on the
/// Section 4 Guidé screen) get the tinted box below. Progressive-row
/// shapes (specialty tables, curriculum table — confirmed via
/// get_screenshot on both the Section 5 curriculum card, node 66:589, and
/// the Section 6 specialty card, node 11:1992) instead get a plain bold
/// title with no box: pass `tinted: false`.
class VtWizardGuidedHeaderBox extends StatelessWidget {
  final LocalizedText title;
  final bool tinted;
  const VtWizardGuidedHeaderBox(
      {super.key, required this.title, this.tinted = true});

  @override
  Widget build(BuildContext context) {
    final text = title.of(context.loc);
    if (!tinted) {
      return Text(text,
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w800,
              fontSize: 15,
              color: kVtWizardInk));
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFEDF7F2),
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: kAccent)),
    );
  }
}

/// Running-totals strip — Figma's "total-bar" (node 74:68 on the Section
/// 4 Guidé screen): accent-tinted box (bg #E8F5E9, border kAccent,
/// rounded-10) with the summed counts on the left and a solid-accent
/// "N/M renseignés" pill on the right — sits below the summary list,
/// only shown once at least one row has been entered.
class _GuidedTotalBar extends StatelessWidget {
  final String totalsText;
  final String countText;
  const _GuidedTotalBar({required this.totalsText, required this.countText});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        border: Border.all(color: kAccent),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(totalsText,
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: kAccent)),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
                color: kAccent, borderRadius: BorderRadius.circular(999)),
            child: Text(countText,
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

/// Read-only running-total mini box — Figma's "Total en cours" row on the
/// progressive-shape guided-entry cards (Section 6's specialty table, node
/// 11:1992: four side-by-side boxes, one per number cell, each a small
/// grey label above a large bold accent number). Confirmed via
/// get_screenshot; replaces the single joined-text total bar this card
/// used before.
class _GuidedStatBox extends StatelessWidget {
  final String label;
  final int? value;
  const _GuidedStatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAF9),
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontWeight: FontWeight.w700,
                  fontSize: 10,
                  color: kVtWizardInkSoft)),
          const SizedBox(height: 4),
          Text(_guidedNumberDisplay(value, context.loc),
              style: const TextStyle(
                  fontFamily: kVtWizardFontFamily,
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  color: kAccent)),
        ],
      ),
    );
  }
}

class _GuidedNumberBox extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool numeric;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  const _GuidedNumberBox({
    required this.label,
    required this.controller,
    this.numeric = true,
    this.errorText,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: kVtWizardInkSoft)),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: errorText == null ? Colors.white : const Color(0xFFFFF6F5),
            border: Border.all(
              color: errorText == null ? const Color(0xFFD1D6D3) : kDanger,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: TextField(
            controller: controller,
            onChanged: onChanged,
            keyboardType: numeric ? TextInputType.number : TextInputType.text,
            inputFormatters:
                numeric ? [FilteringTextInputFormatter.digitsOnly] : null,
            style: const TextStyle(
                fontFamily: kVtWizardFontFamily,
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: kVtWizardInk),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 5),
          Text(
            errorText!,
            style: const TextStyle(
              fontFamily: kVtWizardFontFamily,
              fontSize: 11,
              color: kDanger,
            ),
          ),
        ],
      ],
    );
  }
}

class _GuidedSummaryRow extends StatelessWidget {
  final String label;
  final int? male;
  final int? female;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _GuidedSummaryRow({
    required this.label,
    required this.male,
    required this.female,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final total = male == null || female == null ? null : male! + female!;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: kVtWizardCardBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    fontFamily: kVtWizardFontFamily,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: kVtWizardInk)),
          ),
          SizedBox(
              width: 56,
              child: Text(_guidedNumberDisplay(male, locale),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontFamily: kVtWizardFontFamily,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: kVtWizardInk))),
          SizedBox(
              width: 56,
              child: Text(_guidedNumberDisplay(female, locale),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontFamily: kVtWizardFontFamily,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: kVtWizardInk))),
          SizedBox(
              width: 56,
              child: Text(_guidedNumberDisplay(total, locale),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontFamily: kVtWizardFontFamily,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: kAccent))),
          const SizedBox(width: 8),
          _GuidedIconButton(icon: Icons.edit_outlined, onTap: onEdit),
          const SizedBox(width: 8),
          _GuidedIconButton(icon: Icons.delete_outline, onTap: onDelete),
        ],
      ),
    );
  }
}
