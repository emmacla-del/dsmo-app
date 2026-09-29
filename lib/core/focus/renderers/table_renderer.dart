// lib/core/focus/renderers/table_renderer.dart

import 'package:flutter/material.dart';
import '../schema/field_schema.dart';
import '../unified_focus_manager_v2.dart';
import 'age_band_switch_table.dart';
import 'category_mini_grids.dart';
import 'generic_spreadsheet_table.dart';
import 'grid_render_spec.dart';
import 'leading_group_switch_table.dart';
import 'leading_group_tabs.dart';
import 'mobile_card_table.dart';
import 'status_switch_table.dart';
import 'table_spec_builder.dart';
import 'onefop_layout_constants.dart';
import 'shared/grid_cell_dispatch.dart';

class TableRenderer {
  TableRenderer._();

  static Widget renderTable({
    required FieldSchema field,
    required Map<String, int> gridValues,
    required void Function(String, int?) onCellChanged,
    required UnifiedFocusManagerV2 focusManager,
    required String entityType,
    VoidCallback? onExitTable,
    VoidCallback? onExitPrevious,
    // ← ADD: hybrid controller for text/label cells (reasons, skills, training)
    TextEditingController Function(String)? hybridController,
    // Below the mobile breakpoint, dense grids render as one card per
    // row instead of a horizontally-scrolling spreadsheet — see
    // MobileCardTable. Matrix-layout tables have no uniform row/column
    // shape to card-ize and always use GenericSpreadsheetTable.
    bool mobile = false,
    bool squareCorners = false,
    required Locale locale,
    // False when the caller renders the paperCode/question-text banner
    // itself, outside this table (see buildHeader below) — typically to
    // pin it in place while the table/cards scroll underneath it.
    bool showHeader = true,
    // Externally-driven horizontal-tab position for a multi-option table
    // (age bands, Permanent/Temporaire, ...) — see AgeBandSwitchTable/
    // StatusSwitchTable/CategoryGridGroupsView. The caller (typically
    // onefop_section_units.dart, backed by OnefopFormController.tabCursor/
    // tabPeak) owns this so the section's own Suivant/Précédent button can
    // step it, and so position survives navigating away and back. Ignored
    // by tables that aren't tab-switcher-shaped.
    int tabIndex = 0,
    int tabPeak = 0,
    void Function(int)? onTabIndexChanged,
    // "None to report for this category" state (Simple Mode / mobile's
    // card-based categoryGridGroups rendering only — see
    // CategoryGridGroupsView) — sourced from OnefopFormController.
    // isCategorySkipped/setCategorySkipped, threaded down the same way
    // gridValues/onCellChanged already are, so this file never depends on
    // the controller directly. Ignored by every other table shape.
    bool Function(String categoryKey)? isCategorySkipped,
    void Function(String categoryKey, bool value, List<String> cellIds)? onCategorySkipChanged,
    Map<String, int>? enteredValues,
    bool tableClosed = false,
  }) {
    final spec = field.tableSpec;
    if (spec == null) {
      return const SizedBox.shrink();
    }

    // Simple Mode's (mobile: true) card-based table views only, for these
    // four entities only — see grid_theme.dart's own `polished*` doc
    // comment. Spreadsheet Mode (mobile: false) and every other entity
    // never sets this, so GenericSpreadsheetTable/AgeBandSwitchTable/
    // StatusSwitchTable/LeadingGroupSwitchTable/LeadingGroupTabs (S23Q02's
    // own mobile rendering, which reuses GenericSpreadsheetTable directly
    // rather than the card widgets below — see leading_group_tabs.dart)
    // keep their exact current look either way.
    final polished =
        mobile && const {'enterprise', 'cooperative', 'ctd', 'ong'}.contains(entityType);

    final prefix = _prefixFor(field);
    final renderSpec = _buildRenderSpec(field, locale,
        gridValues: gridValues, onCellChanged: onCellChanged, entityType: entityType);

    // ← BUILD textValues from hybrid controllers for row label cells
    final Map<String, String> textValues = {};
    if (hybridController != null && renderSpec.rowLabelCellIds != null) {
      for (final cellId in renderSpec.rowLabelCellIds!) {
        if (cellId.isNotEmpty) {
          final c = hybridController(cellId);
          textValues[cellId] = c.text;
        }
      }
    }

    void onTextChanged(String id, String value) {
      // ← NOW FUNCTIONAL
      if (hybridController != null) {
        final c = hybridController(id);
        // Only update if different to avoid cursor jumps
        if (c.text != value) {
          c.text = value;
        }
      }
    }

    Widget buildOne(
      GridRenderSpec spec,
      String tableId, {
      Widget Function(int, String)? rowAccessory,
    }) {
      return (mobile && !spec.isMatrixLayout)
          ? MobileCardTable(
              spec: spec,
              numberValues: gridValues,
              textValues: textValues,
              onNumberChanged: onCellChanged,
              onTextChanged: onTextChanged,
              focusManager: focusManager,
              tableId: tableId,
              onExitTable: onExitTable,
              onExitPrevious: onExitPrevious,
              hybridController: hybridController,
              squareCorners: squareCorners,
              isCategorySkipped: isCategorySkipped,
              onCategorySkipChanged: onCategorySkipChanged,
              enteredValues: enteredValues,
              polished: polished,
            )
          : GenericSpreadsheetTable(
              spec: spec,
              numberValues: gridValues,
              textValues: textValues, // ← NOW POPULATED
              onNumberChanged: onCellChanged,
              onTextChanged: onTextChanged,
              focusManager: focusManager,
              tableId: tableId,
              onExitTable: onExitTable,
              onExitPrevious: onExitPrevious,
              hybridController: hybridController, // ← PASS THROUGH
              rowAccessoryBuilder: rowAccessory,
              polished: polished,
            );
    }

    // categoryKey-keyed "Aucun cas à signaler" toggle for a flat desktop
    // matrix table's row-label cell — built once here (rather than
    // per-branch below) since both the single-group flat table and
    // LeadingGroupSwitchTable's row-grouped one need the identical
    // "look up rowKeys[r], resolve its editable cell ids, wire the
    // toggle" logic, just against a different (possibly row-sliced)
    // spec. Null whenever the caller didn't wire skip state through at
    // all (e.g. the standalone widget tests for this file).
    Widget Function(int, String)? rowAccessoryFor(GridRenderSpec forSpec) {
      if (isCategorySkipped == null || onCategorySkipChanged == null) return null;
      return (r, rowKey) {
        final skipped = isCategorySkipped(rowKey);
        final cellIds =
            forSpec.matrix[r].where((id) => forSpec.cellSpec?.call(id).editable ?? false).toList();
        return RowSkipToggle(
          skipped: skipped,
          onTap: () => onCategorySkipChanged(rowKey, !skipped, cellIds),
        );
      };
    }

    // Spreadsheet Mode (desktop) is flat everywhere now — no card wrapper
    // for any matrix question. Every one of them (S21Q01/S22Q01/S22Q02/
    // S22Q03/S22Q04/S22Q05/S23Q01/S23Q02/S3Q01/S3Q03) renders as: the
    // question banner, then (if the question has a top-level split — age
    // band, status, departure reason, Permanent/Temporaire, ...) a
    // Row+Expanded/SegmentButton tab strip choosing one option at a time,
    // then one flat GenericSpreadsheetTable for that option. A question
    // with no such split (S21Q01/S22Q01/S22Q02/S23Q01) skips the tab
    // strip and just renders its one table.
    //
    // S22Q03 (age bands) and S22Q04/S22Q05/S3Q01/S3Q03 (status/reason,
    // sharing columns across a common set of rows) already had exactly
    // this shape via AgeBandSwitchTable/StatusSwitchTable — checked
    // first, unchanged. S23Q02 (Permanent/Temporaire) doesn't share rows
    // across its split — each status has its own complete row set — so
    // it needs LeadingGroupSwitchTable instead, which slices ROWS
    // (GridRenderSpec.splitByLeadingGroup) rather than columns. Checked
    // before the plain categoryGridGroups branch so it wins there too.
    //
    // Mobile / Simple Mode is untouched: every categoryGridGroups table
    // (including the ones just named) still renders as CategoryGridGroupsView's
    // collapsible category cards, age/status "switcher" tables falling
    // back to it the same way they always have (ageBandSwitcher/
    // statusSwitcher only ever match `!mobile` above).
    final Widget table;
    if (renderSpec.ageBandSwitcher != null && !mobile) {
      table = AgeBandSwitchTable(
        spec: renderSpec,
        config: renderSpec.ageBandSwitcher!,
        numberValues: gridValues,
        onNumberChanged: onCellChanged,
        focusManager: focusManager,
        tableId: prefix,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        controlledIndex: tabIndex,
        controlledPeak: tabPeak,
        onIndexChanged: onTabIndexChanged,
        rowAccessoryBuilder: rowAccessoryFor(renderSpec),
      );
    } else if (renderSpec.statusSwitcher != null && !mobile) {
      table = StatusSwitchTable(
        spec: renderSpec,
        config: renderSpec.statusSwitcher!,
        numberValues: gridValues,
        onNumberChanged: onCellChanged,
        focusManager: focusManager,
        tableId: prefix,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        controlledIndex: tabIndex,
        controlledPeak: tabPeak,
        onIndexChanged: onTabIndexChanged,
        isCategorySkipped: isCategorySkipped,
        onCategorySkipChanged: onCategorySkipChanged,
      );
    } else if (!mobile && renderSpec.hasLeadingGroup) {
      // S23Q02 only, today (see TableSpecBuilder._buildFirstTimeWorkers)
      // — the row-grouped mirror of AgeBandSwitchTable/StatusSwitchTable.
      table = LeadingGroupSwitchTable(
        spec: renderSpec,
        numberValues: gridValues,
        onNumberChanged: onCellChanged,
        focusManager: focusManager,
        tableId: prefix,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        controlledIndex: tabIndex,
        controlledPeak: tabPeak,
        onIndexChanged: onTabIndexChanged,
        isCategorySkipped: isCategorySkipped,
        onCategorySkipChanged: onCategorySkipChanged,
      );
    } else if (renderSpec.categoryGridGroups != null && mobile) {
      // Mobile / Simple Mode only — desktop Spreadsheet Mode never
      // reaches this branch: a single-group table falls through to the
      // flat-table branch below, and S23Q02 (the only multi-group case
      // that isn't already an ageBandSwitcher/statusSwitcher table) was
      // just handled above.
      table = CategoryGridGroupsView(
        groups: renderSpec.categoryGridGroups!,
        prefix: prefix,
        numberValues: gridValues,
        onNumberChanged: onCellChanged,
        focusManager: focusManager,
        mobile: mobile,
        onExitTable: onExitTable,
        onExitPrevious: onExitPrevious,
        controlledIndex: tabIndex,
        controlledPeak: tabPeak,
        onIndexChanged: onTabIndexChanged,
        isCategorySkipped: isCategorySkipped,
        onCategorySkipChanged: onCategorySkipChanged,
        enteredValues: enteredValues,
        polished: polished,
      );
    } else if (!mobile && renderSpec.categoryGridGroups != null) {
      // S21Q01/S22Q01/S22Q02/S23Q01: no top-level split, so just the flat
      // table — every category as a row, no tab strip, no card. The
      // per-row "Aucun cas" toggle takes over from the card's own skip
      // switch (see RowSkipToggle / GridRenderSpec.rowKeys).
      table = buildOne(renderSpec, prefix, rowAccessory: rowAccessoryFor(renderSpec));
    } else if (renderSpec.hasLeadingGroup) {
      final groups = renderSpec.splitByLeadingGroup();
      if (mobile) {
        table = LeadingGroupTabs(
          groups: groups,
          prefix: prefix,
          numberValues: gridValues,
          textValues: textValues,
          onNumberChanged: onCellChanged,
          onTextChanged: onTextChanged,
          focusManager: focusManager,
          onExitTable: onExitTable,
          onExitPrevious: onExitPrevious,
          hybridController: hybridController,
          polished: polished,
        );
      } else {
        table = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (int i = 0; i < groups.length; i++) ...[
              if (i > 0) const SizedBox(height: OL.sectionGapV),
              MiniTableHeaderBand(label: groups[i].label),
              buildOne(groups[i].spec, '${prefix}_g$i'),
            ],
          ],
        );
      }
    } else {
      // S4Q01 (rowKeys set — gets the toggle on desktop) and S3Q02/S4Q02/
      // S4Q03 (no rowKeys — their row-label cell is already the editable
      // reason/skill/training text field, and GenericSpreadsheetTable
      // never shows an accessory next to an editable label cell, so this
      // is a no-op for those three regardless).
      table = buildOne(renderSpec, prefix, rowAccessory: rowAccessoryFor(renderSpec));
    }

    // Mobile / Simple Mode: every ancestor Column up to the section body
    // uses crossAxisAlignment.start, so a table narrower than the
    // available width (GenericSpreadsheetTable for a small matrix table
    // like S3Q02/S4Q02/S4Q03, LeadingGroupTabs' boxed grid, ...) hugs the
    // left edge instead of sitting centered in the column — the same
    // problem the categoryGridGroups branch above already solves for
    // desktop. A table that already fills the width (MobileCardTable,
    // CategoryGridGroupsView's own full-width cards) just no-ops under
    // Center, so this is safe to apply once here rather than threading a
    // "needs centering" flag through every branch above.
    Widget displayTable = Center(child: table);
    if (enteredValues != null) {
      displayTable = TableEnteredScope(values: enteredValues, child: displayTable);
    }
    if (tableClosed) {
      displayTable = IgnorePointer(
        child: Opacity(opacity: 0.45, child: displayTable),
      );
    }

    final header = showHeader ? buildHeader(field, locale) : null;

    if (header == null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: OL.questionGapV),
        child: displayTable,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [header, displayTable],
    );
  }

  /// The paperCode + question-text heading, on its own — same widget
  /// [renderTable] shows inline above its table, but callable separately
  /// so a shell that wants to pin the question in place while its body
  /// scrolls (Simple Mode, mobile — see SimpleModeShell/
  /// buildTableGroupUnits' separateHeader) can render it outside the
  /// scroll view instead of asking renderTable to bury it inside one.
  /// Returns null when the field has neither a paper code nor question
  /// text to show (matches [renderTable]'s own "no header" case).
  static Widget? buildHeader(FieldSchema field, Locale locale) {
    final paperCode = field.paperCode;
    final questionText = field.label?.of(locale) ?? field.questionText;
    final hasHeader = (paperCode != null && paperCode.isNotEmpty) ||
        (questionText != null && questionText.isNotEmpty);
    if (!hasHeader) return null;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.only(bottom: 10),
      decoration: OL.qtDecoration,
      child: Text.rich(
        TextSpan(
          style: OL.qtStyle,
          children: [
            if (paperCode != null && paperCode.isNotEmpty)
              TextSpan(
                text: '$paperCode ',
                style: OL.qcStyle,
              ),
            if (questionText != null && questionText.isNotEmpty)
              TextSpan(
                text: questionText,
                style: OL.qtStyle,
              ),
          ],
        ),
        softWrap: true,
        textWidthBasis: TextWidthBasis.parent,
      ),
    );
  }

  static String _prefixFor(FieldSchema field) =>
      ((field.tableSpec?['prefix'] as String?) ?? field.id).toLowerCase();

  static GridRenderSpec _buildRenderSpec(
    FieldSchema field,
    Locale locale, {
    Map<String, int> gridValues = const {},
    void Function(String, int?)? onCellChanged,
    String entityType = '',
  }) {
    final spec = field.tableSpec!;
    final template = (spec['template'] as String? ?? '').trim();
    // S4Q02/S4Q03's tableSpec['rows'] is an int (a row *count*, not a row
    // *id list* — see their skills/training-table AST specs), so this must
    // check the runtime type rather than blindly casting.
    final rawRows = spec['rows'];
    final rows = rawRows is List ? rawRows.cast<String>() : null;
    // An explicitly empty `statuses` list = no permanent/temporary dimension
    // (Administration S21Q03 / S21Q04, see FormSchemaCompiler).
    final rawStatuses = spec['statuses'];
    return TableSpecBuilder.build(
      template: template,
      prefix: _prefixFor(field),
      gridValues: gridValues,
      onCellChanged: onCellChanged ?? (_, __) {},
      entityType: entityType,
      locale: locale,
      rows: rows,
      statusless: rawStatuses is List && rawStatuses.isEmpty,
    );
  }

  static bool _anyEditable(GridRenderSpec spec, Iterable<String> ids) {
    final cellSpec = spec.cellSpec;
    if (cellSpec == null) return true;
    return ids.any((id) => cellSpec(id).editable);
  }

  /// How many of a multi-option table's horizontal tabs (age bands,
  /// Permanent/Temporaire, ...) actually have at least one editable cell.
  /// A trailing computed "Total" tab has none, so it's excluded — the
  /// section's Suivant button (onefop_section_units.dart) only steps
  /// through fillable tabs before falling through to the next table/
  /// section, though every tab (including a Total one) stays reachable by
  /// tapping it directly. Returns 1 for a table that isn't tab-switcher-
  /// shaped at all — i.e. "nothing to step through internally" — and,
  /// always, for `mobile: true`: Simple Mode / mobile render every
  /// categoryGridGroups table as free-standing, non-linear category cards
  /// (see CategoryGridGroupsView) instead of Suivant-sequenced tabs — the
  /// status toggle up top is just another thing the user taps whenever,
  /// not a step Suivant walks through for them.
  static int fillableTabCount(FieldSchema field, Locale locale, {required bool mobile}) {
    if (field.tableSpec == null) return 1;
    if (mobile) return 1;
    final renderSpec = _buildRenderSpec(field, locale);

    if (!mobile && renderSpec.ageBandSwitcher != null) {
      final labels = renderSpec.ageBandSwitcher!.labels;
      var count = 0;
      for (var i = 0; i < labels.length; i++) {
        final cols = [i, 4 + i, 8 + i];
        final ids = [for (final row in renderSpec.matrix) for (final c in cols) row[c]];
        if (_anyEditable(renderSpec, ids)) count++;
      }
      return count == 0 ? labels.length : count;
    }

    if (!mobile && renderSpec.statusSwitcher != null) {
      final labels = renderSpec.statusSwitcher!.labels;
      var count = 0;
      for (var i = 0; i < labels.length; i++) {
        final base = i * 3;
        final cols = [base, base + 1, base + 2];
        final ids = [for (final row in renderSpec.matrix) for (final c in cols) row[c]];
        if (_anyEditable(renderSpec, ids)) count++;
      }
      return count == 0 ? labels.length : count;
    }

    final groups = renderSpec.categoryGridGroups;
    if (groups != null && groups.length > 1) {
      var count = 0;
      for (final g in groups) {
        final hasEditable = g.categories.any((cat) => _anyEditable(
              cat.spec,
              cat.spec.matrix.expand((row) => row),
            ));
        if (hasEditable) count++;
      }
      return count == 0 ? groups.length : count;
    }

    return 1;
  }
}
