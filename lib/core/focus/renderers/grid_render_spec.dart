// lib/core/focus/renderers/grid_render_spec.dart
//
// ══════════════════════════════════════════════════════════════
// GRID RENDER SPEC  — pixel-perfect ONEFOP table contract
//
// CHANGES:
//   • cornerLabel2: split two-row corner for gender×age tables.
//   • leadingGroupHeader / leadingGroupLabels /
//     leadingGroupRowCounts: frozen "Statut / Status" column
//     for S23Q02.
//   • leadingGroupColWidth: explicit width for the leading group
//     column (defaults to OL.firstColWidthNarrow = 130).
//     Keeping the leading column narrow avoids the "too wide"
//     problem reported for S23Q02.
//   • rowLabelCellIds: optional list of editable cell IDs for
//     the first (label) column — used by reasons/skills/training
//     tables so users can type their own row labels.
//   • copyWith updated to include all new fields.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'grid_theme.dart';

// ─────────────────────────────────────────────────────────────
// HEADER NODE — arbitrary-depth tree
// ─────────────────────────────────────────────────────────────

class HeaderNode {
  final String title;
  final bool highlight;
  final List<HeaderNode> children;

  const HeaderNode(
    this.title, {
    this.highlight = false,
    this.children = const [],
  });
}

// ─────────────────────────────────────────────────────────────
// CELL TYPES
// ─────────────────────────────────────────────────────────────

enum CellType {
  number, // numeric input (editable) or computed total (read-only)
  text, // free-text input
  radio, // rendered as compact dropdown
  select, // dropdown
  readOnly, // always non-editable (computed)
  label, // static text label cell
}

// ─────────────────────────────────────────────────────────────
// CELL SPEC — full contract for one cell
// ─────────────────────────────────────────────────────────────

class CellSpec {
  final String id;
  final CellType type;
  final bool editable;
  final List<String>? options;
  final String? hint;
  final String? label;
  final Color? backgroundColor;
  final TextStyle? textStyle;

  const CellSpec({
    required this.id,
    required this.type,
    this.editable = true,
    this.options,
    this.hint,
    this.label,
    this.backgroundColor,
    this.textStyle,
  });
}

// ─────────────────────────────────────────────────────────────
// TABLE LAYOUT VARIANT
// ─────────────────────────────────────────────────────────────

enum TableLayout {
  /// Standard spreadsheet: first col = row-label, rest = data cols.
  labelGrid,

  /// Identification form: all columns are equal width.
  matrix,
}

// ─────────────────────────────────────────────────────────────
// CATEGORY MINI GRIDS — S21Q01/S22Q01/S22Q02/S23Q01/S23Q02
//
// One CSP category's (Cadres/Foremen/Field workers) small transposed
// grid — rows Male/Female/Total × columns age-bands+Total — plus an
// optional outer grouping axis (S23Q02's Permanent/Temporaire status;
// tables with no such axis use a single group with outerLabel: null).
// See TableSpecBuilder._categoryMiniGrids — cell IDs are unchanged from
// the flat gender-major/age-minor convention _genderAgeRow already
// uses, just re-chunked into a 3×4 shape instead of 1×12.
// ─────────────────────────────────────────────────────────────

class CategoryMiniGrid {
  final String label;
  final GridRenderSpec spec;
  const CategoryMiniGrid({required this.label, required this.spec});
}

class CategoryGridGroup {
  final String? outerLabel;
  final List<CategoryMiniGrid> categories;
  const CategoryGridGroup({this.outerLabel, required this.categories});
}

// ─────────────────────────────────────────────────────────────
// AGE-BAND SWITCHER — S22Q03 (desktop only; see AgeBandSwitchTable)
//
// Rather than one 12-column sheet (3 genders × 4 age bands), a segmented
// control picks one age band at a time and only that band's 3 gender
// columns (Male/Female/Total) are shown, for every row at once. Same
// cell IDs, same matrix — see AgeBandSwitchTable for the fixed
// [ageIdx, 4+ageIdx, 8+ageIdx] column-slice this relies on, mirroring
// _genderAgeRow's [male×4, female×4, total×4] column layout.
// ─────────────────────────────────────────────────────────────

class AgeBandSwitcherConfig {
  final List<String> labels; // e.g. ['15–24', '25–34', '35+', 'Total (tous âges)']
  const AgeBandSwitcherConfig({required this.labels});
}

// ─────────────────────────────────────────────────────────────
// STATUS SWITCHER — S22Q04/S22Q05 (desktop only; see StatusSwitchTable)
//
// Mirror image of the age-band switcher: rather than one 9-column sheet
// (3 statuses × 3 genders), a segmented control picks one status at a
// time (Permanent/Temporaire/Total) and only that status's 3 gender
// columns (Male/Female/Total) are shown, for every row at once. Same
// cell IDs, same matrix — see StatusSwitchTable for the fixed
// [3*statusIdx, 3*statusIdx+1, 3*statusIdx+2] column-slice this relies
// on, mirroring _statusGenderRow's [permanent×3, temporary×3, total×3]
// column layout (a contiguous block per status, unlike the age-band
// switcher's strided pick — status is the *major* axis here, gender the
// minor one, the reverse of _genderAgeRow).
// ─────────────────────────────────────────────────────────────

class StatusSwitcherConfig {
  final List<String> labels; // e.g. ['Permanent', 'Temporaire', 'Total']
  // Raw, non-localized keys parallel to [labels] (e.g. ['permanent',
  // 'temporary', 'total']) — StatusSwitchTable needs these (not the
  // display labels) to compose the same '${rowKey}_${middleKey}'
  // per-(row, status) "Aucun cas à signaler" skip key that mobile's
  // categoryGridGroups fallback already uses (see
  // TableSpecBuilder._middleAxisCategoryGroups), so a flag set on one
  // platform is recognized on the other.
  final List<String> keys;
  const StatusSwitcherConfig({required this.labels, required this.keys});
}

// ─────────────────────────────────────────────────────────────
// GRID RENDER SPEC
// ─────────────────────────────────────────────────────────────

class GridRenderSpec {
  final String id;

  // ── Layout mode ────────────────────────────────────────────
  final List<List<String>> matrix;
  final List<String> rowLabels;

  // ── Header tree ────────────────────────────────────────────
  final List<HeaderNode> headers;

  // ── Corner cell label(s) ───────────────────────────────────

  /// Primary corner label — always shown.
  ///
  /// When [cornerLabel2] is null this cell spans the full header
  /// depth (single-merged-corner behaviour).
  final String cornerLabel;

  /// Optional second label for the corner cell.
  ///
  /// When supplied the corner is rendered as two stacked cells:
  ///   • Top cell    (rowSpan = 1)          → [cornerLabel]
  ///   • Bottom cell (rowSpan = depth − 1)  → [cornerLabel2]
  ///
  /// Tables needing this split:
  ///   S21Q01, S22Q01, S22Q02, S22Q03, S23Q01 →
  ///     cornerLabel  = 'Sexe / Sex'
  ///     cornerLabel2 = "Tranche d'âge (ans) / Age group (years)"
  ///   S23Q02 →
  ///     cornerLabel  = 'Sexe / Sex'
  ///     cornerLabel2 = "Tranche d'âge / Age group"
  ///
  /// Leave null for S22Q04, S22Q05, S3Q01, S3Q03, S4Q01 etc.
  final String? cornerLabel2;

  // ── Leading group column (S23Q02 "Statut / Status") ────────

  /// When non-null, the renderer prepends a frozen extra column
  /// to the LEFT of the normal row-label column.
  ///
  /// Layout:
  ///   • Header cell spanning the full header depth →
  ///       [leadingGroupHeader]   e.g. "Statut / Status"
  ///   • For each group i:
  ///       merged cell spanning [leadingGroupRowCounts[i]] rows →
  ///       [leadingGroupLabels[i]]
  ///   • Grand-total row: merged cell spanning this column,
  ///     no group label (blank or "TOTAL").
  ///
  /// All three fields must be provided together.
  final String? leadingGroupHeader;
  final List<String>? leadingGroupLabels;
  final List<int>? leadingGroupRowCounts;

  /// Width of the leading group column in logical pixels.
  /// Defaults to [GridTheme.leadingGroupColWidth] (= 100 px).
  /// Kept narrow so the overall table width stays harmonised.
  final double? leadingGroupColWidth;

  // ── Category mini-grids (S21Q01/S22Q01/S22Q02/S23Q01/S23Q02) ─
  /// When non-null, TableRenderer renders these instead of
  /// matrix/rowLabels/headers entirely — see CategoryGridGroup.
  final List<CategoryGridGroup>? categoryGridGroups;

  // ── Age-band switcher (S22Q03, desktop only) ─────────────────
  /// When non-null (desktop only — mobile falls back to
  /// categoryGridGroups, per-diploma cards), TableRenderer renders
  /// AgeBandSwitchTable instead of matrix/rowLabels/headers directly.
  final AgeBandSwitcherConfig? ageBandSwitcher;

  // ── Status switcher (S22Q04/S22Q05, desktop only) ─────────────
  /// When non-null (desktop only — mobile falls back to
  /// categoryGridGroups), TableRenderer renders StatusSwitchTable
  /// instead of matrix/rowLabels/headers directly.
  final StatusSwitcherConfig? statusSwitcher;

  // ── First-column (row-label) width override ────────────────
  final double? firstColWidthOverride;

  // ── Editable label column cell IDs ────────────────────────
  /// Optional list of cell IDs for the first (label) column,
  /// one per row in [rowLabels] order.
  ///
  /// When an entry is non-empty and its [cellSpec] marks it as
  /// editable, the renderer replaces the static row-label text
  /// with an interactive [TextFieldCell] so users can type their
  /// own label (e.g. reason, skill, or training domain names).
  ///
  /// Use an empty string `''` for rows that should remain
  /// static (e.g. total rows).
  ///
  /// Used by: reasons_table, skills_table, training_table.
  final List<String>? rowLabelCellIds;

  // ── Row keys (Spreadsheet Mode's flat matrix-question rows) ────
  /// Optional stable, non-localized identifier per row in [rowLabels]
  /// order — e.g. `'s21q01_cadres'`, matching the same
  /// `'${prefix}_$rowKey'` convention CategoryMiniGrid.spec.id already
  /// uses, so a skip flag stored under one identifier is recognized by
  /// either rendering. An empty string marks a row with nothing to skip
  /// (a computed "Total" row). Used by GenericSpreadsheetTable's
  /// rowAccessoryBuilder (the per-row "Aucun cas à signaler" toggle) to
  /// know which rows are real categories versus computed totals.
  final List<String>? rowKeys;

  // ── Cell spec resolver ─────────────────────────────────────
  final CellSpec Function(String fieldId)? cellSpec;

  // ── Total / subtotal predicates ────────────────────────────
  final bool Function(String fieldId)? isTotalCell;

  // ── Style overrides ────────────────────────────────────────
  final Color? Function(String fieldId)? cellColor;
  final TextStyle? Function(String fieldId)? cellTextStyle;

  // ── Text / select / radio value providers ──────────────────
  final String? Function(String fieldId)? textValue;
  final void Function(String fieldId, String value)? onTextChanged;

  final String? Function(String fieldId)? selectedValue;
  final void Function(String fieldId, String value)? onSelectChanged;

  final String? Function(String fieldId)? radioValue;
  final void Function(String fieldId, String value)? onRadioChanged;

  const GridRenderSpec({
    required this.id,
    this.matrix = const [],
    this.rowLabels = const [],
    required this.headers,
    this.cornerLabel = '',
    this.cornerLabel2,
    this.leadingGroupHeader,
    this.leadingGroupLabels,
    this.leadingGroupRowCounts,
    this.leadingGroupColWidth,
    this.categoryGridGroups,
    this.ageBandSwitcher,
    this.statusSwitcher,
    this.firstColWidthOverride,
    this.rowLabelCellIds,
    this.rowKeys,
    this.cellSpec,
    this.isTotalCell,
    this.cellColor,
    this.cellTextStyle,
    this.textValue,
    this.onTextChanged,
    this.selectedValue,
    this.onSelectChanged,
    this.radioValue,
    this.onRadioChanged,
  }) : assert(
          leadingGroupHeader == null ||
              (leadingGroupLabels != null && leadingGroupRowCounts != null),
          'leadingGroupLabels and leadingGroupRowCounts must both be '
          'provided when leadingGroupHeader is set.',
        );

  // ── Convenience ────────────────────────────────────────────
  bool get hasLeadingGroup => leadingGroupHeader != null;

  // ── Split into standalone per-group tables ──────────────────
  //
  // Tables like S22Q03 (education level) or S23Q02 (Permanent /
  // Temporaire) are large enough that a single merged-column sheet
  // reads as one intimidating block. This slices the same
  // rowLabels/matrix/rowLabelCellIds data by [leadingGroupRowCounts]
  // into N standalone specs — one per group, each a normal flat
  // table (no leading column, since the group label now titles its
  // own box) — so the renderer can lay them out as separate boxed
  // tables instead of one table with a frozen first column.
  //
  // Cell IDs are untouched (just re-sliced into smaller lists), so
  // stored data / autosave keys are unaffected — this only changes
  // how the same cells are grouped into boxes on screen.
  List<({String label, GridRenderSpec spec})> splitByLeadingGroup() {
    if (!hasLeadingGroup) return [(label: '', spec: this)];
    final labels = leadingGroupLabels!;
    final counts = leadingGroupRowCounts!;
    final result = <({String label, GridRenderSpec spec})>[];
    var start = 0;
    for (var i = 0; i < labels.length; i++) {
      final end = start + counts[i];
      result.add((
        label: labels[i],
        spec: GridRenderSpec(
          id: '${id}_g$i',
          matrix: matrix.sublist(start, end),
          rowLabels: rowLabels.sublist(start, end),
          headers: headers,
          cornerLabel: cornerLabel,
          cornerLabel2: cornerLabel2,
          firstColWidthOverride: firstColWidthOverride,
          rowLabelCellIds: rowLabelCellIds?.sublist(start, end),
          rowKeys: rowKeys?.sublist(start, end),
          cellSpec: cellSpec,
          isTotalCell: isTotalCell,
          cellColor: cellColor,
          cellTextStyle: cellTextStyle,
          textValue: textValue,
          onTextChanged: onTextChanged,
          selectedValue: selectedValue,
          onSelectChanged: onSelectChanged,
          radioValue: radioValue,
          onRadioChanged: onRadioChanged,
        ),
      ));
      start = end;
    }
    return result;
  }

  // ── Layout discriminator ───────────────────────────────────
  bool get isMatrixLayout => rowLabels.isEmpty && matrix.isNotEmpty;

  // ── Effective column widths ───────────────────────────────
  double get effectiveFirstColWidth =>
      firstColWidthOverride ?? GridTheme.firstColWidth;

  double get effectiveLeadingGroupColWidth =>
      leadingGroupColWidth ?? GridTheme.leadingGroupColWidth;

  // ── Column count (leaf headers) ───────────────────────────
  int get colCount {
    int count(HeaderNode n) =>
        n.children.isEmpty ? 1 : n.children.map(count).reduce((a, b) => a + b);
    return headers.map(count).fold(0, (a, b) => a + b);
  }

  // ── Cell ID accessor ──────────────────────────────────────
  String cellId(int row, int col) => matrix[row][col];

  // ── Resolved colour ────────────────────────────────────────
  Color? resolvedCellColor(String fieldId) {
    final custom = cellColor?.call(fieldId);
    if (custom != null) return custom;
    final isTotal = isTotalCell?.call(fieldId) ?? false;
    return isTotal ? GridTheme.totalBg : null;
  }

  // ── Resolved text style ────────────────────────────────────
  TextStyle resolvedCellTextStyle(String fieldId) {
    final custom = cellTextStyle?.call(fieldId);
    if (custom != null) return custom;
    final isTotal = isTotalCell?.call(fieldId) ?? false;
    return isTotal ? GridTheme.totalStyle : GridTheme.dataStyle;
  }

  // ── copyWith ───────────────────────────────────────────────
  GridRenderSpec copyWith({
    String? id,
    List<List<String>>? matrix,
    List<String>? rowLabels,
    List<HeaderNode>? headers,
    String? cornerLabel,
    String? cornerLabel2,
    String? leadingGroupHeader,
    List<String>? leadingGroupLabels,
    List<int>? leadingGroupRowCounts,
    double? leadingGroupColWidth,
    double? firstColWidthOverride,
    List<String>? rowLabelCellIds,
    List<String>? rowKeys,
    CellSpec Function(String)? cellSpec,
    bool Function(String)? isTotalCell,
    Color? Function(String)? cellColor,
    TextStyle? Function(String)? cellTextStyle,
    String? Function(String)? textValue,
    void Function(String, String)? onTextChanged,
    String? Function(String)? selectedValue,
    void Function(String, String)? onSelectChanged,
    String? Function(String)? radioValue,
    void Function(String, String)? onRadioChanged,
  }) {
    return GridRenderSpec(
      id: id ?? this.id,
      matrix: matrix ?? this.matrix,
      rowLabels: rowLabels ?? this.rowLabels,
      headers: headers ?? this.headers,
      cornerLabel: cornerLabel ?? this.cornerLabel,
      cornerLabel2: cornerLabel2 ?? this.cornerLabel2,
      leadingGroupHeader: leadingGroupHeader ?? this.leadingGroupHeader,
      leadingGroupLabels: leadingGroupLabels ?? this.leadingGroupLabels,
      leadingGroupRowCounts:
          leadingGroupRowCounts ?? this.leadingGroupRowCounts,
      leadingGroupColWidth: leadingGroupColWidth ?? this.leadingGroupColWidth,
      firstColWidthOverride:
          firstColWidthOverride ?? this.firstColWidthOverride,
      rowLabelCellIds: rowLabelCellIds ?? this.rowLabelCellIds,
      rowKeys: rowKeys ?? this.rowKeys,
      cellSpec: cellSpec ?? this.cellSpec,
      isTotalCell: isTotalCell ?? this.isTotalCell,
      cellColor: cellColor ?? this.cellColor,
      cellTextStyle: cellTextStyle ?? this.cellTextStyle,
      textValue: textValue ?? this.textValue,
      onTextChanged: onTextChanged ?? this.onTextChanged,
      selectedValue: selectedValue ?? this.selectedValue,
      onSelectChanged: onSelectChanged ?? this.onSelectChanged,
      radioValue: radioValue ?? this.radioValue,
      onRadioChanged: onRadioChanged ?? this.onRadioChanged,
    );
  }
}
