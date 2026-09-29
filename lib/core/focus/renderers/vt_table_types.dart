// lib/core/focus/renderers/vt_table_types.dart
//
// Pure data-shape declarations for a Vocational Training (VT) grid field —
// split out of vt_row_editor.dart so they can be imported from
// form_schema_compiler.dart without pulling in vt_row_editor.dart's own
// import of OnefopFormController (which would create a real import cycle:
// compiler → renderers → screens → compiler). This file has exactly one
// import — LocalizedText — and must stay that way; if a future change
// needs anything screens-side, put it in vt_row_editor.dart instead, not
// here.
//
// vt_row_editor.dart re-exports everything in this file, so nothing that
// already imports vt_row_editor.dart for these types needs to change.

import '../../i18n/localized_text.dart';

enum VtCellKind { number, text, radioCode, boolean, computed }

/// One selectable value for a [VtCellKind.radioCode] cell — [value] is the
/// exact string written to the flat key (a PDF-printed numeric code for
/// roster pickers, or a lower_snake_case diploma/row key elsewhere), never
/// a display label — matching the backend's flat-key contract exactly.
class VtOption {
  final String value;
  final String code;
  final LocalizedText label;
  const VtOption({required this.value, required this.code, required this.label});
}

class VtCellDef {
  final String key;
  final LocalizedText label;
  final VtCellKind kind;
  final List<VtOption>? options;

  /// [VtCellKind.computed] only — derives a display-only value from the
  /// row's other already-persisted cells (e.g. Total = male + female).
  /// Never written back to [OnefopFormController] — the paper form's
  /// Total column/row is never something the user is asked to fill (see
  /// UX rule 4), and this cell has no `onChanged` of any kind.
  final int Function(String rowId, Map<String, dynamic> data)? computeValue;

  /// [VtCellKind.boolean] only — how a Yes/No answer is written to/read
  /// from the persisted value at this cell's id. Defaults to a real Dart
  /// `bool` (identity encode/decode) when both are null. Overridden by
  /// tables that repurpose an existing non-Boolean column (e.g. §7.1.3's
  /// `String[]` fields — see vt_table_defs.dart's vt713* table for why).
  final dynamic Function(bool value)? encodeBoolean;
  final bool? Function(dynamic stored)? decodeBoolean;

  /// Mechanism-only flag (VT-UI/UX-03): when true, the row sheet shows a
  /// required-field asterisk on this cell's label (matching
  /// OnefopFieldLabel's own red-asterisk convention elsewhere in the app)
  /// and, if the cell is still empty when "Terminé" is tapped, a red
  /// border/fill plus an inline error message. No VtTableDef currently
  /// sets this on any cell — none of the 22 VT AST table fields carry
  /// `required: true` today, so there is no existing signal to derive a
  /// per-cell requiredness from (deliberately not invented here — see
  /// VT-UI/UX-01 §12: "do not recommend blanket validation rules unless
  /// supported by the questionnaire/business rules"). Ignored for
  /// [VtCellKind.computed] (never user-entered, never empty in the sense
  /// this flag cares about).
  final bool required;

  /// Key of another [VtCellKind.boolean] cell in the same row that gates
  /// this one — e.g. 5.2's `isApproved` ("Le référentiel est-il
  /// homologué ?") only makes sense once `hasCurriculum` ("Existence d'un
  /// référentiel de formation") is Oui, so it stays hidden (not merely
  /// disabled) until that sibling cell decodes to `true`. Mirrors the
  /// AST-level `dependsOn`/`dependsValue: "Oui/ Yes"` pattern used
  /// everywhere else in the app (onefop_ast.dart, FieldSchema.
  /// isVisibleGiven) — VtCellDef had no equivalent at all before this,
  /// since every existing table's boolean cells stood alone. Null for
  /// every other cell (the common case).
  final String? dependsOnKey;

  const VtCellDef({
    required this.key,
    required this.label,
    required this.kind,
    this.options,
    this.computeValue,
    this.encodeBoolean,
    this.decodeBoolean,
    this.required = false,
    this.dependsOnKey,
  });
}

class VtRowDef {
  /// Full row id used as the prefix for every cell's flat key
  /// (`${id}_${cell.key}`) — e.g. `s4q1_licence` or `s8q8_row3`.
  final String id;

  /// Fixed printed label (diploma/age-band/infrastructure rows). Null for
  /// rows whose displayed label is itself user-entered text.
  final LocalizedText? fixedLabel;

  /// Cell key(s) to compose a live label from when [fixedLabel] is null —
  /// e.g. `['specialtyText']` or `['lastName', 'firstName']`.
  final List<String>? labelFromCells;

  const VtRowDef({required this.id, this.fixedLabel, this.labelFromCells});
}

class VtTableDef {
  final String prefix;
  final String? paperCode;
  final LocalizedText title;
  final List<VtRowDef> rows;
  final List<VtCellDef> cells;
  final LocalizedText progressNoun;

  /// Roster-only: rows past the last one with any data (plus one trailing
  /// blank "add" slot) stay hidden — see §8.8's UX rule.
  final bool isRoster;

  /// Same "filled rows + one trailing blank" reveal rule as [isRoster],
  /// for the repeating free-slot tables (4.3–4.6, 8.4, 8.7, 4.10, 6.3, 5.2)
  /// whose fixed display capacity (10–15 rows) otherwise shows every
  /// unfilled row up front — see VT-UI/UX-01 §3's "empty-row overload"
  /// finding. Deliberately a separate flag from [isRoster] rather than
  /// reusing it: isRoster also gates roster-specific semantics elsewhere
  /// (completion rules, PDF export exclusion) that these tables don't
  /// share, and collapsing the two would leak that. Never set on a
  /// fixed-taxonomy table (4.1, 4.2, 4.7, 4.8, 4.9, 4.11, 5.3, 5.4,
  /// 8.1–8.3, 8.5–8.6, 7.1.3) — every row there is meaningful on its own
  /// (a diploma type, an age band, ...), so hiding an unfilled one would
  /// hide information the user needs to see, not just an empty slot.
  final bool progressiveRows;

  /// True for tables where a row IS a single already-persisted AST field
  /// (e.g. §7.1.3, one VT7_7..VT7_11 field per stakeholder row) rather
  /// than a `${prefix}_row${n}`-synthesized id — the cell id is then the
  /// row id verbatim, not `${row.id}_${cell.key}`.
  final bool singleCellPerRow;

  const VtTableDef({
    required this.prefix,
    this.paperCode,
    required this.title,
    required this.rows,
    required this.cells,
    required this.progressNoun,
    this.isRoster = false,
    this.progressiveRows = false,
    this.singleCellPerRow = false,
  });

  String cellId(VtRowDef row, VtCellDef cell) =>
      singleCellPerRow ? row.id : '${row.id}_${cell.key}';
}
