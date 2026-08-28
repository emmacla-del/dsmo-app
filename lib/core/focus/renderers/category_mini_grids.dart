// lib/core/focus/renderers/category_mini_grids.dart
//
// Renders GridRenderSpec.categoryGridGroups — the small, transposed
// per-CSP-category grids (rows Male/Female/Total × columns age-bands +
// Total) used by S21Q01/S22Q01/S22Q02/S23Q01/S23Q02 instead of one big
// sheet. See TableSpecBuilder._categoryMiniGrids for how the cell IDs
// are chunked (no new IDs — same _genderAgeRow convention, just
// re-shaped from 1×12 to 3×4).
//
// MiniCategoryGrid renders one category's spec via GridLayoutEngine +
// buildGridCellWidget directly (the same primitives GenericSpreadsheetTable
// and _SimpleFieldsTable already use) rather than GenericSpreadsheetTable
// itself, specifically so row height can be a parameter — GridTheme
// .rowHeight is shared by every table in the app, so bumping it globally
// to meet the mobile 44px touch-target requirement would ripple
// everywhere; here it's just an argument.

import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../i18n/l10n_ext.dart';
import '../../i18n/localized_text.dart';
import '../unified_focus_manager_v2.dart';
import 'grid_layout_engine.dart';
import 'grid_render_spec.dart';
import 'grid_theme.dart';
import 'onefop_layout_constants.dart';
import 'shared/grid_cell_dispatch.dart';

/// Header band above a mini-table / boxed group — same OL.tableHdrBg
/// band, rounded top corners only (so it "caps" the box below it) used
/// by both this file and table_renderer.dart's leadingGroup boxes
/// (S22Q03, until Phase 2 gives it its own treatment).
class MiniTableHeaderBand extends StatelessWidget {
  final String label;
  const MiniTableHeaderBand({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: OL.tableHdrBg,
        // Black, not OL.borderColor's soft slate — this band's bottom
        // edge sits flush against the grid below it, which always paints
        // GridTheme.borderColor (real black, Excel-style) gridlines. A
        // softer color here would show as a two-tone seam right where
        // the two meet.
        border: Border.fromBorderSide(
          BorderSide(
              color: GridTheme.borderColor, width: GridTheme.borderWidth),
        ),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(8),
          topRight: Radius.circular(8),
        ),
      ),
      child: Text(label, style: OL.qcStyle),
    );
  }
}

/// Small segmented-control pill, shared by CategoryGridGroupsView's
/// outer-axis switcher and (via export) anything else wanting the same
/// selected/unselected treatment.
class SegmentButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  // Marks this option as already filled/visited — shown as a small
  // leading checkmark rather than a separate badge, so the tab itself
  // doubles as a progress indicator (see AgeBandSwitchTable/
  // StatusSwitchTable/CategoryGridGroupsView's Suivant-sequencing).
  // Never combined with [selected] — the active tab reads as "current"
  // via its own highlight, not as "done".
  final bool done;
  const SegmentButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.done = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 44,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.deepEmerald.withValues(alpha: 0.10)
              : Colors.transparent,
          border: Border.all(
            color: selected ? AppColors.deepEmerald : OL.borderColor,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (done && !selected) ...[
              const Icon(Icons.check_rounded,
                  size: 14, color: AppColors.deepEmerald),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? AppColors.deepEmerald : AppColors.silver,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MiniCategoryGrid extends StatefulWidget {
  final CategoryMiniGrid category;
  final Map<String, int> numberValues;
  final void Function(String, int?) onNumberChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final bool mobile;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  // Set by CategoryGridGroupsView._openCategory right before this specific
  // category mounts fresh, so this is the one place that actually knows
  // which of its own (possibly row-reveal-restricted) cells exist to
  // focus at all: null means "don't auto-focus anything" (a plain manual
  // tap-to-expand), false means "just cascaded in from the previous
  // category, focus the first cell of whichever row is next to fill",
  // true means "cascaded in backward from the next category, show every
  // row and focus the last cell" — mirroring the desktop controller's own
  // forward-lands-at-top/backward-lands-at-bottom convention.
  final bool? autoFocusFromEnd;

  const MiniCategoryGrid({
    super.key,
    required this.category,
    required this.numberValues,
    required this.onNumberChanged,
    required this.focusManager,
    required this.tableId,
    required this.mobile,
    this.onExitTable,
    this.onExitPrevious,
    this.autoFocusFromEnd,
  });

  @override
  State<MiniCategoryGrid> createState() => _MiniCategoryGridState();
}

class _MiniCategoryGridState extends State<MiniCategoryGrid> {
  // Row-by-row reveal, mobile/Simple Mode only (see the widget.mobile
  // guards below — desktop Spreadsheet Mode always shows every row, same
  // as before this existed). _activeRow is which data row (an index into
  // category.spec.rowLabels) is the one currently being filled; rows with
  // no editable cell at all (the Total row) are never selected. _reviewMode
  // flips true once every fillable row has been visited forward at least
  // once — from then on every row, Total included, is shown together "for
  // cross-checking", the same shape this whole reveal replaces. Tab/Enter
  // out of the table's true last cell while already in review mode is what
  // actually leaves the table (widget.onExitTable); the first time that
  // boundary is hit it only flips _reviewMode, without moving focus, since
  // the cell that triggered it is still the right place to keep typing
  // from if the user tabs straight back in.
  late int _activeRow;
  late bool _reviewMode;

  GridRenderSpec get _spec => widget.category.spec;

  List<int> get _fillableRows => [
        for (int r = 0; r < _spec.rowLabels.length; r++)
          if (_rowEditableIds(r).isNotEmpty) r,
      ];

  List<String> _rowEditableIds(int r) => [
        for (final id in _spec.matrix[r])
          if (_spec.cellSpec?.call(id).editable ?? false) id,
      ];

  // Same "0 reads as unanswered" convention categoryFillStatus already
  // uses elsewhere in this file — there's no separate "confirmed zero"
  // flag at this per-row granularity to tell the two apart.
  bool _rowFilled(int r) {
    final ids = _rowEditableIds(r);
    if (ids.isEmpty) return true;
    return ids.every((id) => (widget.numberValues[id] ?? 0) != 0);
  }

  @override
  void initState() {
    super.initState();
    final fillable = _fillableRows;
    final firstUnfilled =
        fillable.firstWhere((r) => !_rowFilled(r), orElse: () => -1);
    if (!widget.mobile || firstUnfilled == -1) {
      // Desktop never reveals row-by-row; a mobile category that's
      // already fully filled (e.g. resuming a draft) starts in review
      // mode too — the same "don't re-litigate what's already answered"
      // convention OnefopFormController's own unit-reveal uses.
      _activeRow = fillable.isEmpty ? 0 : fillable.last;
      _reviewMode = true;
    } else {
      _activeRow = firstUnfilled;
      _reviewMode = false;
    }

    switch (widget.autoFocusFromEnd) {
      case true:
        _reviewMode = true;
        if (fillable.isNotEmpty) _focusRow(fillable.last, atStart: false);
      case false:
        _focusRow(_activeRow, atStart: true);
      case null:
      // Plain manual expand — don't steal focus.
    }
  }

  void _focusRow(int r, {required bool atStart}) {
    final ids = _rowEditableIds(r);
    if (ids.isEmpty) return;
    final target = atStart ? ids.first : ids.last;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.focusManager.focus(target);
    });
  }

  void _onExitTableBoundary() {
    if (!widget.mobile) {
      widget.onExitTable?.call();
      return;
    }
    if (_reviewMode) {
      widget.onExitTable?.call();
      return;
    }
    final fillable = _fillableRows;
    final idx = fillable.indexOf(_activeRow);
    if (idx >= 0 && idx < fillable.length - 1) {
      final next = fillable[idx + 1];
      setState(() => _activeRow = next);
      _focusRow(next, atStart: true);
    } else {
      setState(() => _reviewMode = true);
    }
  }

  void _onExitPreviousBoundary() {
    if (!widget.mobile || _reviewMode) {
      // Shift+Tab off review mode's true first cell has nothing to walk
      // back into row-by-row (every row's already been visited), so this
      // leaves straight to the previous category, same as desktop always
      // has.
      widget.onExitPrevious?.call();
      return;
    }
    final fillable = _fillableRows;
    final idx = fillable.indexOf(_activeRow);
    if (idx > 0) {
      final prev = fillable[idx - 1];
      setState(() => _activeRow = prev);
      _focusRow(prev, atStart: false);
    } else {
      widget.onExitPrevious?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final spec = _spec;
    final dataRowHeight = widget.mobile ? 44.0 : GridTheme.rowHeight;
    final headerRowHeight = widget.mobile ? 44.0 : GridTheme.rowHeight * 1.4;

    final visibleRows = widget.mobile && !_reviewMode
        ? [_activeRow]
        : [for (int r = 0; r < spec.rowLabels.length; r++) r];

    final visibleCells = <String>[
      for (final r in visibleRows)
        for (final id in spec.matrix[r])
          if (spec.cellSpec?.call(id).editable ?? false) id,
    ];

    // Up/Down arrow-key navigation (number_field.dart's _handleKey) does
    // `row = idx ~/ rowWidth` against whatever list it's handed as
    // allCells — it has to be the *editable* width of one visible row
    // (every row here has the same editable-column count, so dividing
    // the flattened total by the row count recovers it), not
    // spec.colCount's full column count (which counts the read-only
    // Total column too). Get that wrong and, once row-by-row reveal
    // narrows allCells down to a single row, Down/Up arrow's row/col
    // math is computed against a stride that no longer matches the
    // actual (now much shorter) list at all.
    final editableColsPerRow =
        visibleRows.isEmpty ? spec.colCount : visibleCells.length ~/ visibleRows.length;

    final cells = <GridCell>[
      GridCell(
        id: 'corner',
        row: 0,
        col: 0,
        backgroundColor: OL.tableHdrBg,
        child: Text(spec.cornerLabel,
            style: GridTheme.headerStyle.copyWith(fontSize: 11)),
      ),
      for (int c = 0; c < spec.colCount; c++)
        GridCell(
          id: 'hdr_$c',
          row: 0,
          col: c + 1,
          backgroundColor: OL.tableHdrBg,
          child: Text(spec.headers[c].title, style: GridTheme.headerStyle),
        ),
      for (int vi = 0; vi < visibleRows.length; vi++) ...[
        GridCell(
          id: 'label_${visibleRows[vi]}',
          row: vi + 1,
          col: 0,
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child:
                Text(spec.rowLabels[visibleRows[vi]], style: GridTheme.labelStyle),
          ),
        ),
        for (int c = 0; c < spec.colCount; c++)
          () {
            final r = visibleRows[vi];
            final cellId = spec.cellId(r, c);
            final cs = spec.cellSpec?.call(cellId);
            final isTotalRow =
                spec.isTotalCell?.call(spec.cellId(r, 0)) ?? false;
            return GridCell(
              id: cellId,
              row: vi + 1,
              col: c + 1,
              backgroundColor: spec.resolvedCellColor(cellId),
              child: buildGridCellWidget(
                context: context,
                cellId: cellId,
                cs: cs,
                isTotalRow: isTotalRow,
                isGrandTotal: isTotalRow,
                spec: spec,
                numberValues: widget.numberValues,
                textValues: const {},
                onNumberChanged: widget.onNumberChanged,
                onTextChanged: (_, __) {},
                focusManager: widget.focusManager,
                tableId: widget.tableId,
                allCells: visibleCells,
                rowWidth: editableColsPerRow,
                onExitTable: _onExitTableBoundary,
                onExitPrevious: _onExitPreviousBoundary,
                height: dataRowHeight - 2,
              ),
            );
          }(),
      ],
    ];

    // All four corners closed — this grid's only caller (CategoryGridGroupsView
    // ._buildCategory) never pairs it with a MiniTableHeaderBand the way
    // table_renderer.dart's hasLeadingGroup/!mobile branch does (there, only
    // rounding the bottom corners is what makes header+table read as one
    // seamless box); here the grid sits alone inside the card's own padding,
    // so a bottom-only radius left its top corners looking cut off/open.
    //
    // The Border.all below is a second, purely decorative outline drawn as
    // a foregroundDecoration — i.e. painted last, on top of everything
    // else in this subtree — rather than relying on GridLayoutEngine's own
    // straight-rectangle border lines to reach the rounded corners. Those
    // lines are real, un-rounded rects (see grid_layout_engine.dart); once
    // ClipRRect below clips them to an 8px curve, each one stops short of
    // the true corner while the flush cell fill underneath (e.g. the
    // header band's solid color) still reaches all the way to the curve,
    // reading as a border that doesn't quite wrap around the corner. A
    // foreground stroke with the same radius is genuinely curved by
    // Flutter's own rounded-rect border painter, so it always traces the
    // full curve with no gap, regardless of what the clipped content
    // beneath it looks like right at the edge.
    return Container(
      foregroundDecoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: GridTheme.borderColor, width: GridTheme.borderWidth),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: GridLayoutEngine(
          cells: cells,
          rowCount: 1 + visibleRows.length,
          colCount: 1 + spec.colCount,
          colWidths: [
            widget.mobile ? 88 : 80,
            for (int c = 0; c < spec.colCount; c++)
              widget.mobile ? GridTheme.mobileColWidth : GridTheme.colWidth
          ],
          rowHeights: [
            headerRowHeight,
            for (int _ in visibleRows) dataRowHeight,
          ],
          borderColor: GridTheme.borderColor,
          borderWidth: GridTheme.borderWidth,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CATEGORY STATUS — Simple Mode / mobile's card redesign. "Skipped" is
// its own state (an explicit "none to report", persisted separately —
// see OnefopFormController.isCategorySkipped) rather than a flavor of
// "empty", precisely so it reads as a confirmed answer, not a gap.
// ─────────────────────────────────────────────────────────────
enum CategoryFillStatus { empty, partial, complete, skipped }

List<String> _editableCellIds(GridRenderSpec spec) => [
      for (final row in spec.matrix)
        for (final id in row)
          if (spec.cellSpec?.call(id).editable ?? false) id,
    ];

int categorySubtotal(CategoryMiniGrid category, Map<String, int> numberValues) {
  var sum = 0;
  for (final id in _editableCellIds(category.spec)) {
    sum += numberValues[id] ?? 0;
  }
  return sum;
}

// Cell ids are always underscore-joined tokens ending in a gender segment
// (TableSpecBuilder._genderRow/_genderAgeRow/_statusGenderRow — e.g.
// "..._male", "..._male_15_24", "..._male_total"), regardless of whether a
// given template lays gender out as rows (the CSP/age-band mini-grids) or
// as columns (the middle-axis ones, S22Q04/S22Q05/S3Q01/S3Q03's mobile
// fallback) — splitting on '_' and matching the whole "male"/"female"
// token works the same way for both shapes without needing to know which
// one a given category is. A plain `id.contains('male')` would also match
// inside "female" (it's a real substring of it); requiring a whole token
// avoids that.
int categoryGenderSubtotal(
  CategoryMiniGrid category,
  Map<String, int> numberValues,
  String genderToken,
) {
  var sum = 0;
  for (final id in _editableCellIds(category.spec)) {
    if (id.split('_').contains(genderToken)) sum += numberValues[id] ?? 0;
  }
  return sum;
}

CategoryFillStatus categoryFillStatus(
  CategoryMiniGrid category,
  Map<String, int> numberValues,
  bool skipped, {
  Map<String, int>? enteredValues,
}) {
  if (skipped) return CategoryFillStatus.skipped;
  final ids = _editableCellIds(category.spec);
  if (ids.isEmpty) return CategoryFillStatus.empty;
  // A cell the user explicitly typed 0 into counts as filled — only a cell
  // with no entry at all (absent from enteredValues) is "empty". Without an
  // entered map (e.g. this widget's standalone tests) falls back to
  // numberValues != 0, which can't tell a confirmed zero from an untouched
  // cell but is still the best available signal there.
  bool isFilled(String id) => enteredValues != null
      ? enteredValues.containsKey(id)
      : (numberValues[id] ?? 0) != 0;
  final filled = ids.where(isFilled).length;
  if (filled == 0) return CategoryFillStatus.empty;
  if (filled == ids.length) return CategoryFillStatus.complete;
  return CategoryFillStatus.partial;
}

/// Small filled/outlined dot encoding [CategoryFillStatus] — the one
/// glyph a card header needs to read at a glance without opening it.
class CategoryStatusDot extends StatelessWidget {
  final CategoryFillStatus status;
  const CategoryStatusDot({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    const size = 15.0;
    switch (status) {
      case CategoryFillStatus.empty:
        return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: OL.catStatusEmptyBorder, width: 2),
          ),
        );
      case CategoryFillStatus.partial:
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: OL.catStatusPartialSoft,
            border: Border.all(color: OL.catStatusPartial, width: 2),
          ),
          child: Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
                shape: BoxShape.circle, color: OL.catStatusPartial),
          ),
        );
      case CategoryFillStatus.complete:
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
              shape: BoxShape.circle, color: OL.catStatusComplete),
          child: const Icon(Icons.check_rounded, size: 10, color: Colors.white),
        );
      case CategoryFillStatus.skipped:
        return Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
              shape: BoxShape.circle, color: OL.catStatusSkipped),
          child: Container(
              width: 7,
              height: 2,
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(1))),
        );
    }
  }
}

/// Compact, tappable "none to report" toggle for a flat spreadsheet
/// table's row-label cell (see GenericSpreadsheetTable.rowAccessoryBuilder)
/// — Spreadsheet Mode's equivalent of the card view's "Aucun cas à
/// signaler" switch+label row, shrunk to a single glyph since a flat
/// table has no per-category card to hang a full row on. Same two states
/// as [CategoryStatusDot]'s skipped/empty — deliberately not the full
/// 4-state dot: with every cell always visible in a flat table there's no
/// need to *also* summarize fill status here, only whether this row has
/// been marked "none to report".
class RowSkipToggle extends StatelessWidget {
  final bool skipped;
  final VoidCallback onTap;
  const RowSkipToggle({super.key, required this.skipped, required this.onTap});

  @override
  Widget build(BuildContext context) {
    const size = 16.0;
    final locale = context.loc;
    return Tooltip(
      message: skipped
          ? const LocalizedText(
              fr: 'Aucun cas à signaler — toucher pour annuler',
              en: 'None to report — tap to undo',
            ).of(locale)
          : const LocalizedText(
              fr: 'Marquer : aucun cas à signaler pour cette ligne',
              en: 'Mark: none to report for this row',
            ).of(locale),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: skipped ? OL.catStatusSkipped : Colors.transparent,
            border: Border.all(
              color: skipped ? OL.catStatusSkipped : OL.catStatusEmptyBorder,
              width: 1.5,
            ),
          ),
          child: skipped
              ? Container(
                  width: 6,
                  height: 2,
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(1)),
                )
              : null,
        ),
      ),
    );
  }
}

/// Compact on/off pill — used for the per-card "Aucun cas à signaler"
/// toggle. A small hand-rolled switch rather than Material's [Switch]:
/// this app's flat, hairline-bordered chrome (see kShadowCard) doesn't
/// use stock Material controls anywhere else, and Switch's default pill
/// reads a size class heavier than everything around it here.
class MiniSwitch extends StatelessWidget {
  final bool value;
  final VoidCallback onChanged;
  final Color activeColor;
  const MiniSwitch(
      {super.key,
      required this.value,
      required this.onChanged,
      required this.activeColor});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      button: true,
      child: InkWell(
        onTap: onChanged,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: 38,
          height: 22,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: value ? activeColor : OL.borderColor,
            borderRadius: BorderRadius.circular(999),
          ),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 18,
            height: 18,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                    color: Color(0x33000000),
                    blurRadius: 2,
                    offset: Offset(0, 1))
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CategoryGridGroupsView extends StatefulWidget {
  final List<CategoryGridGroup> groups;
  final String prefix;
  final Map<String, int> numberValues;
  final void Function(String, int?) onNumberChanged;
  final UnifiedFocusManagerV2 focusManager;
  final bool mobile;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;
  // See AgeBandSwitchTable's identical trio — externally-driven outer-
  // group tab position/peak (e.g. Permanent/Temporaire), keyed against
  // the *unfiltered* groups list below regardless of mode. On desktop
  // Excel this still drives Suivant-sequencing; on mobile/Simple Mode
  // Suivant no longer touches it (TableRenderer.fillableTabCount always
  // returns 1 there) — it just remembers which status the user last had
  // open, the same way it always has. Only meaningful when
  // groups.length > 1; ignored otherwise.
  final int? controlledIndex;
  final int controlledPeak;
  final void Function(int)? onIndexChanged;
  // "None to report" state — see OnefopFormController.isCategorySkipped/
  // setCategorySkipped. Null (e.g. in the standalone golden/unit tests
  // for this widget) just means no category can ever be marked skipped.
  final bool Function(String categoryKey)? isCategorySkipped;
  final void Function(String categoryKey, bool value, List<String> cellIds)?
      onCategorySkipChanged;
  // User-typed values only, including explicit zeros — absence means a
  // cell was never filled. Passed alongside numberValues (the aggregate
  // grid, always defaulted to 0) so categoryFillStatus can tell "confirmed
  // zero" apart from "untouched" instead of treating both as empty. Null
  // in this widget's standalone tests, where categoryFillStatus falls back
  // to numberValues != 0.
  final Map<String, int>? enteredValues;

  const CategoryGridGroupsView({
    super.key,
    required this.groups,
    required this.prefix,
    required this.numberValues,
    required this.onNumberChanged,
    required this.focusManager,
    required this.mobile,
    this.onExitTable,
    this.onExitPrevious,
    this.controlledIndex,
    this.controlledPeak = 0,
    this.onIndexChanged,
    this.isCategorySkipped,
    this.onCategorySkipChanged,
    this.enteredValues,
  });

  @override
  State<CategoryGridGroupsView> createState() => _CategoryGridGroupsViewState();
}

class _CategoryGridGroupsViewState extends State<CategoryGridGroupsView> {
  int _localSelectedGroup = 0;
  int _localPeak = 0;
  // Which categories are expanded. Desktop Spreadsheet Mode starts with
  // *every* category in *every* group already open — the whole point of
  // Spreadsheet Mode next to Simple Mode is seeing and filling several
  // categories at a glance without clicking each one open first, so
  // defaulting to collapsed there just made it feel like Simple Mode
  // with a sidebar. Mobile/Simple Mode keep the old behavior: only the
  // first category of the initial group starts open, since vertical
  // space is scarce there and the user is expected to open cards one at
  // a time; _selectGroup mirrors that by auto-opening a newly-selected
  // group's first category too. Either way the user stays free to
  // collapse/reopen any card afterward (see the redesign brief: nothing
  // here is a wizard), so this is a Set, not a single "current card".
  late final Set<int> _expanded = widget.mobile
      ? {0}
      : {
          for (var gi = 0; gi < widget.groups.length; gi++)
            for (var ci = 0; ci < widget.groups[gi].categories.length; ci++)
              gi * 100 + ci,
        };

  int get _selectedGroup => widget.controlledIndex ?? _localSelectedGroup;
  int get _peak =>
      widget.controlledIndex != null ? widget.controlledPeak : _localPeak;

  void _selectGroup(int i) {
    final onChanged = widget.onIndexChanged;
    setState(() {
      // Mobile/Simple Mode is an accordion — see _buildCategory's onTap —
      // so switching segment (Permanent/Temporaire) replaces whatever was
      // open rather than adding to it; desktop keeps every category open
      // regardless of segment, same as before.
      if (widget.mobile) {
        _expanded
          ..clear()
          ..add(i * 100);
      } else {
        _expanded.add(i * 100);
      }
      if (onChanged == null) {
        _localSelectedGroup = i;
        if (i > _localPeak) _localPeak = i;
      }
    });
    onChanged?.call(i);
  }

  bool _skipped(CategoryMiniGrid category) =>
      widget.isCategorySkipped?.call(category.spec.id) ?? false;

  // Which category (the same gi*100+ci key _expanded uses) the next build
  // should auto-focus into, and from which end — set by _openCategory
  // right before the cascade target mounts fresh, read (and consumed) once
  // by _buildCategory. Not resolved to an actual cell id here: since
  // MiniCategoryGrid now also reveals its own rows one at a time (see its
  // _activeRow), only *that* freshly-mounted widget's own initState
  // actually knows which of its cells exist to focus at all — a category
  // opened "from the end" mid-fill-in doesn't have its last row's cells
  // mounted for a stale ids.last here to land on.
  int? _autoFocusKey;
  bool _autoFocusFromEnd = false;

  /// Mobile/Simple Mode only (see _buildCategory) — Tab/Enter off the
  /// start/end of one category's own micro table lands here instead of
  /// falling straight through to widget.onExitTable/onExitPrevious (which
  /// would skip past every category after/before it straight to the next
  /// unit or section). Collapses everything and opens just [ci] — the same
  /// accordion move _selectGroup already makes for the outer group tabs.
  void _openCategory(int gi, int ci, List<CategoryMiniGrid> categories,
      {required bool focusStart}) {
    final key = gi * 100 + ci;
    setState(() {
      _expanded
        ..clear()
        ..add(key);
      _autoFocusKey = key;
      _autoFocusFromEnd = !focusStart;
    });
  }

  @override
  Widget build(BuildContext context) {
    final groups = widget.groups;

    // Guided (mobile/Simple Mode) rendering only ever offers a status
    // that actually has something to fill — a trailing computed "Total"
    // split (e.g. S22Q04's Permanent/Temporaire/Total) has no editable
    // cell anywhere in it, so it'd be a dead toggle option with nothing
    // but dashes behind it. Desktop Excel keeps every group, "Total"
    // included, since that mode is a review/spreadsheet surface as much
    // as an entry one.
    final fillableIndices = [
      for (var i = 0; i < groups.length; i++)
        if (groups[i]
            .categories
            .any((c) => _editableCellIds(c.spec).isNotEmpty))
          i,
    ];
    final visibleIndices = widget.mobile && fillableIndices.isNotEmpty
        ? fillableIndices
        : List.generate(groups.length, (i) => i);

    // One group at a time behind a horizontal tab row when there's more
    // than one (e.g. S23Q02's Permanent/Temporaire) — filling Permanent
    // then tapping into Temporaire, rather than everything laid out side
    // by side at once. The tab row (if any) and the visible group's
    // tables are always centered as a block (rather than hugging the
    // left edge) — S21Q01/S22Q01/S22Q02's single group is just as narrow
    // relative to the page as any one tab of a multi-group table, so
    // leaving it left-aligned reads the same way: adrift in the wide
    // page column instead of sitting in the middle of it.
    var gi = _selectedGroup.clamp(0, groups.length - 1);
    if (!visibleIndices.contains(gi)) gi = visibleIndices.first;
    final group = groups[gi];
    final multiGroup = visibleIndices.length > 1;

    final startedCount = widget.mobile
        ? group.categories
            .where((c) =>
                categoryFillStatus(c, widget.numberValues, _skipped(c),
                    enteredValues: widget.enteredValues) !=
                CategoryFillStatus.empty)
            .length
        : 0;

    return Column(
      crossAxisAlignment:
          widget.mobile ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (multiGroup) ...[
          Row(
            mainAxisSize: widget.mobile ? MainAxisSize.max : MainAxisSize.min,
            children: [
              for (int k = 0; k < visibleIndices.length; k++) ...[
                if (k > 0) const SizedBox(width: 8),
                widget.mobile
                    ? Expanded(
                        child: SegmentButton(
                          label: groups[visibleIndices[k]].outerLabel ?? '',
                          selected: visibleIndices[k] == gi,
                          done: visibleIndices[k] <= _peak &&
                              visibleIndices[k] != gi,
                          onTap: () => _selectGroup(visibleIndices[k]),
                        ),
                      )
                    : SegmentButton(
                        label: groups[visibleIndices[k]].outerLabel ?? '',
                        selected: visibleIndices[k] == gi,
                        done: visibleIndices[k] <= _peak &&
                            visibleIndices[k] != gi,
                        onTap: () => _selectGroup(visibleIndices[k]),
                      ),
              ],
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (widget.mobile) ...[
          _ProgressLine(started: startedCount, total: group.categories.length),
          const SizedBox(height: 10),
        ],
        for (int ci = 0; ci < group.categories.length; ci++) ...[
          if (ci > 0) SizedBox(height: widget.mobile ? 10 : OL.sectionGapV),
          _buildCategory(group.categories[ci], gi, ci),
        ],
        if (widget.mobile) ...[
          const SizedBox(height: 12),
          _GrandTotalSummary(
            male: [
              for (final g in groups)
                for (final c in g.categories) c
            ].fold<int>(0,
                (sum, c) => sum + categoryGenderSubtotal(c, widget.numberValues, 'male')),
            female: [
              for (final g in groups)
                for (final c in g.categories) c
            ].fold<int>(0,
                (sum, c) => sum + categoryGenderSubtotal(c, widget.numberValues, 'female')),
          ),
        ],
      ],
    );
  }

  Widget _buildCategory(CategoryMiniGrid category, int gi, int ci) {
    final locale = context.loc;
    final tableId = '${widget.prefix}_g${gi}_c$ci';
    final skipped = _skipped(category);
    final categories = widget.groups[gi].categories;
    // Mobile/Simple Mode only — desktop Spreadsheet Mode shows every
    // category open at once (see the _expanded initializer above), so
    // there's no "next collapsed card" for Tab/Enter to cascade into
    // there; it keeps falling straight through to widget.onExitTable/
    // onExitPrevious like before. Group (Permanent/Temporaire) switching
    // is deliberately excluded from this cascade — see fillableTabCount's
    // own comment on why Suivant doesn't drive that on mobile either — so
    // the last/first category of the *current* group still defers to the
    // widget-level callback rather than auto-switching groups.
    // Consumed once: a rebuild for any other reason (a sibling category's
    // own value changing, say) shouldn't keep re-focusing this one. Key
    // matches _expanded's own (group, category) scheme below.
    final focusKey = gi * 100 + ci;
    final autoFocusFromEnd =
        focusKey == _autoFocusKey ? _autoFocusFromEnd : null;
    if (focusKey == _autoFocusKey) _autoFocusKey = null;

    final grid = MiniCategoryGrid(
      category: category,
      numberValues: widget.numberValues,
      onNumberChanged: widget.onNumberChanged,
      focusManager: widget.focusManager,
      tableId: tableId,
      mobile: widget.mobile,
      autoFocusFromEnd: autoFocusFromEnd,
      onExitTable: widget.mobile && ci < categories.length - 1
          ? () => _openCategory(gi, ci + 1, categories, focusStart: true)
          : widget.onExitTable,
      onExitPrevious: widget.mobile && ci > 0
          ? () => _openCategory(gi, ci - 1, categories, focusStart: false)
          : widget.onExitPrevious,
    );

    // Every category is a real collapsible card — tap the header to
    // expand/collapse, any number open at once, in any order. Desktop used
    // to always show every category's grid at once (a plain label above
    // it, no card); now it gets the same collapsible treatment as mobile/
    // Simple Mode so a category nobody's filling in doesn't sit expanded
    // and take up space. Key is (group, category) so switching the outer
    // segment doesn't carry over stale expanded state.
    final key = gi * 100 + ci;
    final expanded = _expanded.contains(key);
    final status = categoryFillStatus(category, widget.numberValues, skipped,
        enteredValues: widget.enteredValues);
    final subtotal = categorySubtotal(category, widget.numberValues);
    final onSkipChanged = widget.onCategorySkipChanged;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(
            color: expanded ? GridTheme.borderColor : OL.borderColor),
        borderRadius: BorderRadius.circular(10),
        color: OL.tableRowEven,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() {
              if (expanded) {
                _expanded.remove(key);
              } else if (widget.mobile) {
                // Accordion on mobile/Simple Mode: only one category card
                // open at a time — opening this one collapses whichever
                // other was open, instead of piling several open at once
                // (which is desktop Spreadsheet Mode's own, deliberately
                // different behavior — see the _expanded initializer above).
                _expanded
                  ..clear()
                  ..add(key);
              } else {
                _expanded.add(key);
              }
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
                        Text(category.label,
                            style: OL.qcStyle.copyWith(
                                fontSize: 14.5, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          _subtitleFor(status, subtotal, locale),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: status == CategoryFillStatus.complete
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: switch (status) {
                              CategoryFillStatus.complete =>
                                OL.catStatusComplete,
                              CategoryFillStatus.skipped => OL.catStatusSkipped,
                              CategoryFillStatus.partial => OL.catStatusPartial,
                              CategoryFillStatus.empty => AppColors.silver,
                            },
                          ),
                        ),
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
                          fr: 'Aucun cas à signaler pour cette catégorie.',
                          en: 'Nothing to report for this category.',
                        ).of(locale),
                        style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.slate,
                            fontStyle: FontStyle.italic),
                      ),
                    )
                  else
                    grid,
                  if (onSkipChanged != null) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            const LocalizedText(
                              fr: 'Aucun cas à signaler pour cette catégorie',
                              en: 'Nothing to report for this category',
                            ).of(locale),
                            style: const TextStyle(
                                fontSize: 12.5, color: AppColors.slate),
                          ),
                        ),
                        const SizedBox(width: 10),
                        MiniSwitch(
                          value: skipped,
                          activeColor: OL.catStatusSkipped,
                          onChanged: () => onSkipChanged(
                            category.spec.id,
                            !skipped,
                            _editableCellIds(category.spec),
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

  String _subtitleFor(CategoryFillStatus status, int subtotal, Locale locale) {
    switch (status) {
      case CategoryFillStatus.empty:
        return const LocalizedText(fr: 'Non renseignée', en: 'Not filled in')
            .of(locale);
      case CategoryFillStatus.skipped:
        return const LocalizedText(
                fr: 'Aucun cas à signaler', en: 'Nothing to report')
            .of(locale);
      case CategoryFillStatus.partial:
        return locale.languageCode == 'en'
            ? '$subtotal ${subtotal > 1 ? 'people' : 'person'} · in progress'
            : '$subtotal ${subtotal > 1 ? 'personnes' : 'personne'} · en cours';
      case CategoryFillStatus.complete:
        return locale.languageCode == 'en'
            ? '$subtotal ${subtotal > 1 ? 'people' : 'person'}'
            : '$subtotal ${subtotal > 1 ? 'personnes' : 'personne'}';
    }
  }
}

/// "N/Y catégories commencées" — replaces a linear "Question X of Y"
/// counter for matrix questions: progress is about how many of *this
/// question's* categories have an answer (filled or explicitly skipped),
/// not about position in a long, flattened list of every field in the
/// section.
class _ProgressLine extends StatelessWidget {
  final int started;
  final int total;
  const _ProgressLine({required this.started, required this.total});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final rest = locale.languageCode == 'en'
        ? '/$total categor${total > 1 ? 'ies' : 'y'} started'
        : '/$total catégorie${total > 1 ? 's' : ''} commencée${total > 1 ? 's' : ''}';
    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 12.5, color: AppColors.slate),
        children: [
          TextSpan(
            text: '$started',
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.deepEmerald),
          ),
          TextSpan(text: rest),
        ],
      ),
    );
  }
}

/// Running grand total across every category *and* every status split —
/// always visible at the foot of the card list so the user can sanity-
/// check the question as a whole without opening every card. Split into
/// Male/Female (like MobileCardTable._grandTotalFrame's own Grand Total
/// frame for S4Q01 and the other collapsible-option tables) rather than
/// one combined person count, and — same as that frame — live: it reads
/// straight from widget.numberValues on every rebuild, so it updates the
/// moment a cell changes, without the user needing to open every card to
/// see the new figures reflected here.
class _GrandTotalSummary extends StatelessWidget {
  final int male;
  final int female;
  const _GrandTotalSummary({required this.male, required this.female});

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: OL.totalCellBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: OL.catStatusComplete.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Text(
              const LocalizedText(fr: 'Total général', en: 'Grand total')
                  .of(locale),
              style: OL.qcStyle.copyWith(fontSize: 12.5)),
          const Spacer(),
          _stat('M', male),
          const SizedBox(width: 20),
          _stat('F', female),
        ],
      ),
    );
  }

  Widget _stat(String label, int value) => Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate)),
          Text(value == 0 ? '—' : '$value',
              style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.deepEmerald)),
        ],
      );
}
