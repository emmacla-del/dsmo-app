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
    this.firstColWidthOverride,
    this.rowLabelCellIds,
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
