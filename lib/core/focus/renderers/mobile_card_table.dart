// lib/core/focus/renderers/mobile_card_table.dart
//
// ══════════════════════════════════════════════════════════════
// MOBILE CARD TABLE — phone-friendly alternative to
// GenericSpreadsheetTable's spreadsheet grid.
//
// The desktop grid (60×36px cells, 9+ numeric columns per table)
// forces horizontal scrolling and sub-44px touch targets on a
// 375-414px phone. This widget renders the same GridRenderSpec as
// one card per row instead: the row label as a header, then each
// leaf data column as its own full-width labeled input — no
// horizontal scrolling, ≥48px tall tap targets.
//
// Only covers the "labelGrid" shape (spec.rowLabels non-empty).
// Matrix-layout tables (spec.isMatrixLayout) have no uniform
// row/column shape to card-ize and stay on GenericSpreadsheetTable
// — see TableRenderer.renderTable's mobile branch.
//
// Any table with more than one non-Total row (S3Q02's reasons, S4Q02's
// skills, S4Q03's training domains, S4Q01's internship types — see
// TableSpecBuilder._buildReasons/_buildSkills/_buildTraining/_buildInternship)
// gets a different treatment: those rows render as collapsible option
// cards (_CollapsibleLabelRows) — collapsed to a generic "Skill 1"-style
// or, for a table like S4Q01 with static row labels, its own real label —
// one open at a time (accordion), the same one-at-a-time card language
// CategoryGridGroupsView already uses for S21Q01-style category tables.
// Tab/Enter off an open option's last field cascades into the next
// option (collapsing this one), the same way CategoryGridGroupsView
// cascades between categories — see _CollapsibleLabelRowsState's
// _onExitOption/_onExitPreviousOption. The trailing "Total" row (always
// exactly one row, never a candidate for this treatment) still renders
// via the plain, always-open _rowCard below.
// ══════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../i18n/l10n_ext.dart';
import '../../i18n/localized_text.dart';
import '../unified_focus_manager_v2.dart';
import 'category_mini_grids.dart' show CategoryFillStatus, CategoryStatusDot, MiniSwitch;
import 'grid_render_spec.dart';
import 'grid_theme.dart';
import 'onefop_layout_constants.dart';
import 'shared/grid_cell_dispatch.dart';

class MobileCardTable extends StatelessWidget {
  final GridRenderSpec spec;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int?) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  final TextEditingController Function(String)? hybridController;
  final bool squareCorners;
  // "None to report" state (see OnefopFormController.isCategorySkipped/
  // setCategorySkipped) — only meaningful for a row with its own
  // spec.rowKeys[r] entry (S4Q01's internship types today; S3Q02/S4Q02/
  // S4Q03's rows have no rowKeys at all, by design — an empty "top 3"
  // list entry doesn't need an explicit skip flag the way a fixed
  // category does). Desktop's flat-table equivalent is
  // GenericSpreadsheetTable's rowAccessoryBuilder/RowSkipToggle; this is
  // its collapsible-card counterpart, styled like
  // CategoryGridGroupsView's own mobile skip switch since that's the
  // card language this widget already speaks. Null when the caller
  // didn't wire skip state through at all.
  final bool Function(String categoryKey)? isCategorySkipped;
  final void Function(String categoryKey, bool value, List<String> cellIds)?
      onCategorySkipChanged;
  // User-typed values only, including explicit zeros — absence means a
  // cell was never filled. Mirrors CategoryGridGroupsView's own field: lets
  // _colFilled/_optionFilled/_statusFor tell "confirmed zero" apart from
  // "untouched" instead of treating both as empty via numberValues != 0.
  final Map<String, int>? enteredValues;
  // Simple Mode's Enterprise/Cooperative/CTD/ONG table cards only (see
  // table_renderer.dart's own `polished` doc comment, and grid_theme.dart's
  // `polished*` tokens) — swaps this widget's own card chrome/typography
  // and the grid cells it builds via buildGridCellWidget for the
  // Wizard-matched look. Real mobile users of every other entity, and
  // Spreadsheet Mode entirely, never set this.
  final bool polished;

  const MobileCardTable({
    super.key,
    required this.spec,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
    required this.focusManager,
    required this.tableId,
    this.onExitTable,
    this.onExitPrevious,
    this.hybridController,
    this.squareCorners = false,
    this.isCategorySkipped,
    this.onCategorySkipChanged,
    this.enteredValues,
    this.polished = false,
  });

  // Same flattened editable-cell list GenericSpreadsheetTable exposes,
  // so arrow/tab navigation between cards follows the same row-major
  // order as the desktop grid.
  List<String> get _allCells {
    final cells = <String>[];
    for (int r = 0; r < spec.rowLabels.length; r++) {
      final labelId = spec.rowLabelCellIds != null &&
              r < spec.rowLabelCellIds!.length
          ? spec.rowLabelCellIds![r]
          : '';
      if (labelId.isNotEmpty && (spec.cellSpec?.call(labelId).editable ?? false)) {
        cells.add(labelId);
      }
      for (int c = 0; c < spec.colCount; c++) {
        final cellId = spec.cellId(r, c);
        final cs = spec.cellSpec?.call(cellId);
        if (cs?.editable ?? false) cells.add(cellId);
      }
    }
    return cells;
  }

  // Every row except the trailing computed "Total" one (see
  // TableSpecBuilder._isTotal — every one of its ids contains "_total",
  // including its row-label cell's, which is how this also correctly
  // excludes it when the label itself is editable). build() only routes
  // into the collapsible-option treatment when there's more than one of
  // these — a table with just one real row wouldn't have anything to
  // collapse into besides itself.
  List<int> get _optionRows => [
        for (int r = 0; r < spec.rowLabels.length; r++)
          if (!(spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false)) r,
      ];

  // Every field this whole widget ever renders — the label, M, F, Total,
  // whichever — is its own full-width row stacked vertically (see the
  // file-level doc comment: that's this widget's entire reason to exist,
  // replacing the desktop grid's 2D layout with a phone-friendly list).
  // Up/Down arrow-key navigation (number_field.dart's _handleKey) does
  // `row = idx ~/ rowWidth` against whatever's passed as allCells — with
  // a real per-field vertical list, that's 1, not spec.colCount-ish
  // arithmetic borrowed from the desktop grid's own 2D shape: Down should
  // land on the very next field (same as Tab), not skip an entire
  // "row"'s worth of a grid that was never actually laid out here.
  int get _rowWidth => 1;

  // Walks the header tree, joining ancestor titles for each leaf so a
  // 2-level header (e.g. Homme/Femme/Total × 0-15/16-25/26+) becomes
  // "Homme · 0-15 ans" — one label per leaf column, in the same
  // left-to-right order spec.cellId(r, c)'s `c` iterates.
  List<String> _leafColumnLabels() {
    final labels = <String>[];
    void walk(HeaderNode n, String prefix) {
      final path = prefix.isEmpty ? n.title : '$prefix · ${n.title}';
      if (n.children.isEmpty) {
        labels.add(path);
      } else {
        for (final child in n.children) {
          walk(child, path);
        }
      }
    }

    for (final h in spec.headers) {
      walk(h, '');
    }
    return labels;
  }

  @override
  Widget build(BuildContext context) {
    final colLabels = _leafColumnLabels();
    final cells = _allCells;

    if (spec.hasLeadingGroup) {
      final groupLabels = spec.leadingGroupLabels!;
      final counts = spec.leadingGroupRowCounts!;
      final sections = <Widget>[];
      int rowStart = 0;
      for (int gi = 0; gi < groupLabels.length; gi++) {
        final rows = <Widget>[
          for (int ri = 0; ri < counts[gi]; ri++)
            _rowCard(context, rowStart + ri, colLabels, cells),
        ];
        sections.add(_groupSection(groupLabels[gi], rows));
        rowStart += counts[gi];
      }
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sections,
      );
    }

    // S3Q02/S4Q02/S4Q03/S4Q01: each option (Motif/Compétence/Domaine/type
    // N) becomes its own collapsible card instead of every row's full
    // input frame sitting open at once — see the file-level doc comment
    // above.
    final optionRows = _optionRows;
    if (optionRows.length > 1) {
      return _CollapsibleLabelRows(
          table: this, colLabels: colLabels, cells: cells, optionRows: optionRows);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int r = 0; r < spec.rowLabels.length; r++)
          _rowCard(context, r, colLabels, cells),
      ],
    );
  }

  Widget _groupSection(String label, List<Widget> rows) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 4, 2, 8),
            child: Text(label,
                style: (polished ? GridTheme.polishedHeaderStyle : GridTheme.headerStyle)
                    .copyWith(color: AppColors.deepEmerald, fontSize: 14)),
          ),
          ...rows,
        ],
      ),
    );
  }

  Widget _rowCard(
      BuildContext context, int r, List<String> colLabels, List<String> cells) {
    final rowLabel = r < spec.rowLabels.length ? spec.rowLabels[r] : '';
    final isTotalRow = spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false;

    // The trailing computed "Total" row (S3Q02/S4Q02/S4Q03's own summary
    // across every option) doesn't need a full card mimicking the
    // data-entry rows above it — it's 100% read-only, so a compact
    // "Grand total: M / F" frame says the same thing in a fraction of the
    // height. See _grandTotalFrame.
    if (isTotalRow) return _grandTotalFrame(context, r, colLabels);

    final labelCellId =
        (spec.rowLabelCellIds != null && r < spec.rowLabelCellIds!.length)
            ? spec.rowLabelCellIds![r]
            : '';
    final labelCs =
        labelCellId.isNotEmpty ? spec.cellSpec?.call(labelCellId) : null;

    // isTotalRow is always false from here down — the true case returned
    // above via _grandTotalFrame — so headerWidget/the card below never
    // need the total styling this row type used to also reach.
    final headerWidget = (labelCs?.editable ?? false)
        ? _inputBox(
            buildGridCellWidget(
              context: context,
              cellId: labelCellId,
              cs: labelCs,
              isTotalRow: false,
              isGrandTotal: false,
              spec: spec,
              numberValues: numberValues,
              textValues: textValues,
              onNumberChanged: onNumberChanged,
              onTextChanged: onTextChanged,
              focusManager: focusManager,
              tableId: tableId,
              allCells: cells,
              rowWidth: _rowWidth,
              onExitTable: onExitTable,
              onExitPrevious: onExitPrevious,
              hybridController: hybridController,
              width: double.infinity,
              height: 48,
              polished: polished,
            ),
          )
        : Text(rowLabel,
            style: polished ? GridTheme.polishedHeaderStyle : GridTheme.headerStyle);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardWhite,
        borderRadius: squareCorners ? BorderRadius.zero : BorderRadius.circular(12),
        border: Border.all(color: polished ? GridTheme.polishedBorder : GridTheme.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          headerWidget,
          const SizedBox(height: 10),
          for (int c = 0; c < spec.colCount; c++)
            _fieldRow(
              context,
              c < colLabels.length ? colLabels[c] : 'Col ${c + 1}',
              spec.cellId(r, c),
              spec.cellSpec?.call(spec.cellId(r, c)),
              false,
              cells,
            ),
        ],
      ),
    );
  }

  /// Compact replacement for the trailing "Total" row's own _rowCard —
  /// this row is 100% computed/read-only (see TableSpecBuilder._isTotal),
  /// so mimicking the data-entry cards above it with labeled input-look
  /// boxes just for two-to-three dashes/numbers was a lot of vertical
  /// space and visual weight for something the user never types into.
  /// Only the gender columns (not the redundant trailing "Total" column,
  /// which is just those two numbers added together) get their own stat —
  /// this frame's own "Grand total" label already says what it's showing.
  Widget _grandTotalFrame(BuildContext context, int r, List<String> colLabels) {
    final locale = context.loc;
    final valueCols = (spec.colCount - 1).clamp(0, spec.colCount);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: GridTheme.totalBg,
        borderRadius: squareCorners ? BorderRadius.zero : BorderRadius.circular(12),
        border: Border.all(color: polished ? GridTheme.polishedBorder : GridTheme.borderColor),
      ),
      child: Row(
        children: [
          Text(const LocalizedText(fr: 'Total général', en: 'Grand total').of(locale),
              style: (polished ? GridTheme.polishedHeaderStyle : GridTheme.headerStyle)
                  .copyWith(fontSize: 13)),
          const Spacer(),
          for (int c = 0; c < valueCols; c++) ...[
            if (c > 0) const SizedBox(width: 20),
            _totalStat(
              c < colLabels.length ? colLabels[c] : '',
              numberValues[spec.cellId(r, c)] ?? 0,
            ),
          ],
        ],
      ),
    );
  }

  Widget _totalStat(String label, int value) => Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate)),
          Text(value == 0 ? '—' : '$value',
              style: (polished ? GridTheme.polishedTotalStyle : GridTheme.totalStyle)
                  .copyWith(fontSize: 16)),
        ],
      );

  // exitTable/exitPrevious default to this table's own — only
  // _CollapsibleLabelRowsState overrides them, to redirect a field's
  // Tab/Enter boundary to its own per-option cascade instead of this
  // table's table-wide one.
  Widget _fieldRow(BuildContext context, String label, String cellId, CellSpec? cs, bool isTotalRow,
      List<String> cells,
      {VoidCallback? exitTable, VoidCallback? exitPrevious}) {
    final cellWidget = buildGridCellWidget(
      context: context,
      cellId: cellId,
      cs: cs,
      isTotalRow: isTotalRow,
      isGrandTotal: false,
      spec: spec,
      numberValues: numberValues,
      textValues: textValues,
      onNumberChanged: onNumberChanged,
      onTextChanged: onTextChanged,
      focusManager: focusManager,
      tableId: tableId,
      allCells: cells,
      rowWidth: _rowWidth,
      onExitTable: exitTable ?? onExitTable,
      onExitPrevious: exitPrevious ?? onExitPrevious,
      hybridController: hybridController,
      width: double.infinity,
      height: 48,
      polished: polished,
    );

    // Keyed by cellId: _CollapsibleLabelRowsState's field-level reveal
    // changes *which* columns are in this Column from one rebuild to the
    // next (one, then all of them) — without a stable per-cell key here,
    // Stack/Column-style positional reconciliation would silently reuse
    // one field's Element (and its NumberField State, whose FocusNode
    // wiring only re-runs in didUpdateWidget for a tableId/focusManager
    // change, not a cellId one — see NumberField.didUpdateWidget) for a
    // completely different cell that now happens to land at the same
    // position, the same class of bug GridLayoutEngine's own missing key
    // caused (see its Positioned key comment).
    return Padding(
      key: ValueKey(cellId),
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 5,
            child: Text(label,
                style: polished ? GridTheme.polishedLabelStyle : GridTheme.labelStyle),
          ),
          const SizedBox(width: 10),
          Expanded(flex: 4, child: _inputBox(cellWidget)),
        ],
      ),
    );
  }

  // Tight-sizes the child to exactly 48px tall (not just loosely aligned
  // within a taller box) so the actual focusable/tappable area of the
  // field — not just its decoration — meets the touch-target minimum.
  Widget _inputBox(Widget child) => Container(
        decoration: BoxDecoration(
          color: GridTheme.inputBg,
          border: Border.all(color: polished ? GridTheme.polishedBorder : GridTheme.borderColor),
          borderRadius: squareCorners ? BorderRadius.zero : BorderRadius.circular(8),
        ),
        child: SizedBox(
          height: 48,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: child,
          ),
        ),
      );
}

/// S3Q02/S4Q02/S4Q03/S4Q01's collapsible-option treatment — every non-
/// Total row becomes its own card, one open at a time (accordion),
/// the same one-at-a-time card language CategoryGridGroupsView already
/// uses for S21Q01-style category tables. Tab/Enter off an open option's
/// last field collapses it and opens the next option (focusing its first
/// field) instead of falling straight through this whole table's own
/// onExitTable, the same cascade CategoryGridGroupsView.MiniCategoryGrid
/// uses between categories — see _onExitOption/_onExitPreviousOption.
/// A row whose label is itself editable (Motif/Compétence/Domaine N) also
/// gets an editable label field inside its open card; a row with a static
/// label (S4Q01's internship types) just shows that label as the card's
/// header, same as the collapsed state. The trailing "Total" row (never a
/// candidate — see MobileCardTable._optionRows) still renders via the
/// parent table's plain, always-open _rowCard — reached directly since
/// Dart's `_`-privacy is file-scoped, so this widget can call the parent
/// table's private helpers.
class _CollapsibleLabelRows extends StatefulWidget {
  final MobileCardTable table;
  final List<String> colLabels;
  final List<String> cells;
  final List<int> optionRows;
  const _CollapsibleLabelRows({
    required this.table,
    required this.colLabels,
    required this.cells,
    required this.optionRows,
  });

  @override
  State<_CollapsibleLabelRows> createState() => _CollapsibleLabelRowsState();
}

class _CollapsibleLabelRowsState extends State<_CollapsibleLabelRows> {
  // -1 = every option collapsed.
  late int _openRow;

  // Row-by-row (well, column-by-column: M, then F, ...) reveal *within*
  // whichever option is currently open — the same "one field at a time,
  // then everything together for cross-checking" shape MiniCategoryGrid
  // uses for a category's Homme/Femme/Total rows, just one level down
  // (this table's own "categories" are its options, not its columns).
  // Meaningful only while _openRow != -1; every place that changes
  // _openRow also calls _initFieldReveal for whatever row is opening.
  // The Total column is never a candidate (never editable — see
  // _fillableCols), so it only ever shows once _fieldReviewMode is true.
  int _activeField = 0;
  bool _fieldReviewMode = false;

  MobileCardTable get _t => widget.table;
  GridRenderSpec get _spec => _t.spec;

  String _labelCellIdFor(int r) =>
      (_spec.rowLabelCellIds != null && r < _spec.rowLabelCellIds!.length)
          ? _spec.rowLabelCellIds![r]
          : '';

  CellSpec? _labelCsFor(int r, String labelCellId) =>
      labelCellId.isNotEmpty ? _spec.cellSpec?.call(labelCellId) : null;

  List<String> _editableRowCellIds(int r) => [
        for (int c = 0; c < _spec.colCount; c++)
          if (_spec.cellSpec?.call(_spec.cellId(r, c)).editable ?? false)
            _spec.cellId(r, c),
      ];

  List<int> _fillableCols(int r) => [
        for (int c = 0; c < _spec.colCount; c++)
          if (_spec.cellSpec?.call(_spec.cellId(r, c)).editable ?? false) c,
      ];

  // A cell the user explicitly typed 0 into counts as filled — only a cell
  // with no entry at all (absent from _t.enteredValues) is "unfilled".
  // Falls back to numberValues != 0 when no entered map was wired through,
  // which can't tell a confirmed zero from an untouched cell but is still
  // the best available signal there.
  bool _isFilled(String id) => _t.enteredValues != null
      ? _t.enteredValues!.containsKey(id)
      : (_t.numberValues[id] ?? 0) != 0;

  bool _colFilled(int r, int c) => _isFilled(_spec.cellId(r, c));

  // Which columns to actually render for row [r] right now: just the
  // active one while still filling it in, every column (Total included)
  // once _fieldReviewMode is true.
  List<int> _visibleCols(int r) {
    if (_fieldReviewMode) return [for (int c = 0; c < _spec.colCount; c++) c];
    return [_activeField];
  }

  /// (Re)computes _activeField/_fieldReviewMode for row [r] — called
  /// whenever it's about to become (or already is, on initial build) the
  /// open option. [fromEnd] mirrors MiniCategoryGrid.autoFocusFromEnd:
  /// true when this option was just entered backward (Shift+Tab in from
  /// the next option), which shows every column immediately rather than
  /// starting the reveal over from M — there's nothing to "un-reveal" a
  /// column into on the way in from the end. false (the default —
  /// opening forward, or a plain tap) data-derives the same way
  /// MiniCategoryGrid's own initState does: first not-yet-filled column,
  /// or every column if this option's already complete.
  void _initFieldReveal(int r, {bool fromEnd = false}) {
    final cols = _fillableCols(r);
    if (fromEnd || cols.isEmpty) {
      _activeField = cols.isEmpty ? 0 : cols.last;
      _fieldReviewMode = true;
      return;
    }
    final firstUnfilled =
        cols.firstWhere((c) => !_colFilled(r, c), orElse: () => -1);
    if (firstUnfilled == -1) {
      _activeField = cols.last;
      _fieldReviewMode = true;
    } else {
      _activeField = firstUnfilled;
      _fieldReviewMode = false;
    }
  }

  // No atStart/atEnd distinction (unlike _focusOption) — a single column
  // is just one cell, with no "which end" to land on.
  void _focusField(int r, int c) {
    final id = _spec.cellId(r, c);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _t.focusManager.focus(id);
    });
  }

  // Forward Tab/Enter off the active column's own field — advances to
  // the next fillable column, or (this was the last one) reveals every
  // column for review without moving focus, or (already reviewing)
  // cascades to the next option entirely. Mirrors
  // MiniCategoryGrid._onExitTableBoundary exactly, one level down.
  void _onExitField(int r) {
    if (_fieldReviewMode) {
      _onExitOption(r);
      return;
    }
    final cols = _fillableCols(r);
    final idx = cols.indexOf(_activeField);
    if (idx >= 0 && idx < cols.length - 1) {
      final next = cols[idx + 1];
      setState(() => _activeField = next);
      _focusField(r, next);
    } else {
      setState(() => _fieldReviewMode = true);
    }
  }

  void _onExitPreviousField(int r) {
    if (_fieldReviewMode) {
      // Nothing to walk back into row-by-row from review's true first
      // field — every column's already been visited — so this leaves
      // straight to the previous option.
      _onExitPreviousOption(r);
      return;
    }
    final cols = _fillableCols(r);
    final idx = cols.indexOf(_activeField);
    if (idx > 0) {
      final prev = cols[idx - 1];
      setState(() => _activeField = prev);
      _focusField(r, prev);
    } else {
      _onExitPreviousOption(r);
    }
  }

  // Every field this option's own accordion card currently *shows*, in
  // tab order — the editable label first (if this option has one), then
  // whichever data columns _visibleCols(r) says are visible right now.
  // Restricting Tab/Enter navigation to just this (rather than the whole
  // table's cells, spanning every option whether open or not, or even
  // every column of *this* option before they're all revealed) is what
  // makes _onExitField/_onExitOption fire exactly when the user tabs off
  // the one field that's actually next.
  List<String> _optionCells(int r, String labelCellId, bool editableLabel) => [
        if (editableLabel) labelCellId,
        for (final c in _visibleCols(r))
          if (_spec.cellSpec?.call(_spec.cellId(r, c)).editable ?? false)
            _spec.cellId(r, c),
      ];

  bool _optionFilled(int r, String labelCellId, bool editableLabel) {
    final dataIds = _editableRowCellIds(r);
    final dataFilled = dataIds.isEmpty || dataIds.every(_isFilled);
    if (!editableLabel) return dataFilled;
    return dataFilled && (_t.textValues[labelCellId] ?? '').trim().isNotEmpty;
  }

  CategoryFillStatus _statusFor(int r, bool hasLabel, bool skipped) {
    if (skipped) return CategoryFillStatus.skipped;
    final ids = _editableRowCellIds(r);
    final filled = ids.where(_isFilled).length;
    if (!hasLabel && filled == 0) return CategoryFillStatus.empty;
    if (hasLabel && ids.isNotEmpty && filled == ids.length) {
      return CategoryFillStatus.complete;
    }
    return CategoryFillStatus.partial;
  }

  // '' (no rowKeys at all, or this specific row's entry is blank — the
  // trailing computed "Total" row never has one) means this row was
  // never wired for a skip toggle in the first place, same convention
  // TableSpecBuilder already uses for the desktop equivalent
  // (GenericSpreadsheetTable's rowAccessoryBuilder/RowSkipToggle).
  String _rowKeyFor(int r) =>
      (_spec.rowKeys != null && r < _spec.rowKeys!.length) ? _spec.rowKeys![r] : '';

  bool _skipped(String rowKey) =>
      rowKey.isNotEmpty && (_t.isCategorySkipped?.call(rowKey) ?? false);

  @override
  void initState() {
    super.initState();
    // Same "resume where you left off, don't re-litigate what's already
    // answered" convention as MiniCategoryGrid's own initState: opens the
    // first not-yet-complete option, or leaves everything collapsed (-1)
    // if a returning draft already filled every one of them — forcing the
    // last option back open wouldn't mean anything special here the way
    // MiniCategoryGrid's "review mode" does for a multi-row mini-grid.
    var firstUnfilled = -1;
    for (final r in widget.optionRows) {
      final labelCellId = _labelCellIdFor(r);
      final editableLabel = _labelCsFor(r, labelCellId)?.editable ?? false;
      if (!_optionFilled(r, labelCellId, editableLabel)) {
        firstUnfilled = r;
        break;
      }
    }
    _openRow = firstUnfilled;
    if (_openRow != -1) _initFieldReveal(_openRow);
  }

  void _focusOption(int r, {required bool atStart}) {
    final labelCellId = _labelCellIdFor(r);
    final editableLabel = _labelCsFor(r, labelCellId)?.editable ?? false;
    final ids = _optionCells(r, labelCellId, editableLabel);
    if (ids.isEmpty) return;
    final target = atStart ? ids.first : ids.last;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _t.focusManager.focus(target);
    });
  }

  void _onExitOption(int r) {
    final rows = widget.optionRows;
    final idx = rows.indexOf(r);
    if (idx >= 0 && idx < rows.length - 1) {
      final next = rows[idx + 1];
      setState(() {
        _openRow = next;
        _initFieldReveal(next);
      });
      _focusOption(next, atStart: true);
    } else {
      _t.onExitTable?.call();
    }
  }

  void _onExitPreviousOption(int r) {
    final rows = widget.optionRows;
    final idx = rows.indexOf(r);
    if (idx > 0) {
      final prev = rows[idx - 1];
      setState(() {
        _openRow = prev;
        _initFieldReveal(prev, fromEnd: true);
      });
      _focusOption(prev, atStart: false);
    } else {
      _t.onExitPrevious?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int r = 0; r < _spec.rowLabels.length; r++) _row(context, r),
      ],
    );
  }

  Widget _row(BuildContext context, int r) {
    if (!widget.optionRows.contains(r)) {
      // The trailing "Total" row — unchanged, always-open rendering.
      return _t._rowCard(context, r, widget.colLabels, widget.cells);
    }
    return _card(context, r);
  }

  Widget _card(BuildContext context, int r) {
    final locale = context.loc;
    final expanded = _openRow == r;
    final labelCellId = _labelCellIdFor(r);
    final labelCs = _labelCsFor(r, labelCellId);
    final editableLabel = labelCs?.editable ?? false;
    final labelText = (_t.textValues[labelCellId] ?? '').trim();
    final hasLabel = editableLabel && labelText.isNotEmpty;
    final rowKey = _rowKeyFor(r);
    final skipped = _skipped(rowKey);
    final status = _statusFor(r, hasLabel, skipped);
    final subtitle = skipped
        ? const LocalizedText(fr: 'Aucun cas à signaler', en: 'Nothing to report')
            .of(locale)
        : editableLabel
            ? (status == CategoryFillStatus.empty
                ? const LocalizedText(fr: 'Non renseignée', en: 'Not filled in').of(locale)
                : (hasLabel
                    ? labelText
                    : const LocalizedText(fr: 'En cours', en: 'In progress').of(locale)))
            : switch (status) {
                CategoryFillStatus.empty =>
                  const LocalizedText(fr: 'Non renseignée', en: 'Not filled in').of(locale),
                CategoryFillStatus.complete =>
                  const LocalizedText(fr: 'Complété', en: 'Completed').of(locale),
                _ => const LocalizedText(fr: 'En cours', en: 'In progress').of(locale),
              };
    final optionCells = _optionCells(r, labelCellId, editableLabel);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: OL.tableRowEven,
        border: Border.all(
            color: expanded
                ? (_t.polished ? GridTheme.polishedBorder : GridTheme.borderColor)
                : OL.borderColor),
        borderRadius: _t.squareCorners ? BorderRadius.zero : BorderRadius.circular(10),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() {
              _openRow = expanded ? -1 : r;
              // Opening by tap starts the reveal fresh (data-derived),
              // same as opening forward via cascade — there's no "which
              // end did the user come from" for a direct tap the way
              // there is for Tab/Enter cascading in.
              if (!expanded) _initFieldReveal(r);
            }),
            child: Container(
              constraints: const BoxConstraints(minHeight: 56),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  CategoryStatusDot(status: status),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_spec.rowLabels[r],
                            style: _t.polished
                                ? GridTheme.polishedHeaderStyle
                                : GridTheme.headerStyle),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: AppColors.slate)),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(Icons.keyboard_arrow_down_rounded,
                        color: expanded ? AppColors.slate : AppColors.silver),
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            Container(height: 1, color: OL.borderColor),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (skipped)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        const LocalizedText(
                          fr: 'Aucun cas à signaler pour cette ligne.',
                          en: 'Nothing to report for this row.',
                        ).of(locale),
                        style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.slate,
                            fontStyle: FontStyle.italic),
                      ),
                    )
                  else ...[
                    if (editableLabel)
                      _t._inputBox(
                        buildGridCellWidget(
                          context: context,
                          cellId: labelCellId,
                          cs: labelCs,
                          isTotalRow: false,
                          isGrandTotal: false,
                          spec: _spec,
                          numberValues: _t.numberValues,
                          textValues: _t.textValues,
                          onNumberChanged: _t.onNumberChanged,
                          onTextChanged: _t.onTextChanged,
                          focusManager: _t.focusManager,
                          tableId: _t.tableId,
                          allCells: optionCells,
                          rowWidth: _t._rowWidth,
                          onExitTable: () => _onExitOption(r),
                          onExitPrevious: () => _onExitPreviousOption(r),
                          hybridController: _t.hybridController,
                          width: double.infinity,
                          height: 48,
                          polished: _t.polished,
                        ),
                      ),
                    if (editableLabel) const SizedBox(height: 10),
                    // One column at a time (M, then F, ...) until every
                    // fillable one's been visited, then all of them
                    // (Total included) together for cross-checking — see
                    // _visibleCols/_fieldReviewMode.
                    for (final c in _visibleCols(r))
                      _t._fieldRow(
                        context,
                        c < widget.colLabels.length ? widget.colLabels[c] : 'Col ${c + 1}',
                        _spec.cellId(r, c),
                        _spec.cellSpec?.call(_spec.cellId(r, c)),
                        false,
                        optionCells,
                        exitTable: () => _onExitField(r),
                        exitPrevious: () => _onExitPreviousField(r),
                      ),
                  ],
                  if (rowKey.isNotEmpty && _t.onCategorySkipChanged != null) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            const LocalizedText(
                              fr: 'Aucun cas à signaler pour cette ligne',
                              en: 'Nothing to report for this row',
                            ).of(locale),
                            style: const TextStyle(fontSize: 12.5, color: AppColors.slate),
                          ),
                        ),
                        const SizedBox(width: 10),
                        MiniSwitch(
                          value: skipped,
                          activeColor: OL.catStatusSkipped,
                          onChanged: () => _t.onCategorySkipChanged!(
                            rowKey,
                            !skipped,
                            _editableRowCellIds(r),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
