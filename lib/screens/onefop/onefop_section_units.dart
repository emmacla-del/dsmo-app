// lib/screens/onefop/onefop_section_units.dart
//
// Shared "one table/question-group at a time" model for a ONEFOP section —
// used by both the desktop excel shell (ExcelSectionBody) and the mobile
// stepper (onefop_unified_form_screen_v4.dart's _mobileLayout). A section's
// fields are split into units — one per table field, plus one for each run
// of simple fields between tables — and only the current unit is ever
// mounted; advancing/retreating moves OnefopFormController's per-section
// unit cursor and scrolls the newly-revealed unit into view.
//
// The two platforms only differ in how they render a run of simple fields
// (desktop: a spreadsheet-style grid; mobile: stacked cards) — that's why
// buildTableGroupUnits takes simpleFieldsBuilder as a parameter instead of
// this file picking a layout itself. Table rendering is already shared via
// TableRenderer.renderTable(mobile: ...).

import 'package:flutter/material.dart';

import '../../core/focus/schema/field_schema.dart';
import '../../core/focus/schema/section_schema.dart';
import '../../core/focus/renderers/table_renderer.dart';
import '../../core/focus/renderers/vt_routing.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../core/i18n/localized_text.dart';
import '../../core/focus/renderers/table_size_scope.dart';
import '../../core/focus/utils/table_response_status.dart';
import 'onefop_form_constants.dart';
import 'onefop_form_controller.dart';
import 'onefop_form_widgets.dart' show groupFields;

typedef CtrlPredicate = bool Function(OnefopFormController ctrl);
typedef CtrlAction = void Function(OnefopFormController ctrl);

/// One revealable block within a section: either a run of simple fields or
/// a single table-type field.
class SectionUnit {
  final String key;
  /// The subsection this unit belongs to (e.g. "2.2 RECRUTEMENTS"), set on
  /// *every* unit of the group — not just the first — so OnefopSectionMap
  /// can group units by consecutive-equal-label runs itself.
  final String? subsectionLabel;
  /// Compact chip label for OnefopSectionMap — a table unit's paperCode
  /// (e.g. "S22Q01"), the same short code OnefopQuestionHeader already
  /// shows above the active table.
  final String shortLabel;
  final List<String> fieldIds;
  final Widget Function() content;
  // The paperCode/question-text banner, built separately from [content]
  // only when buildTableGroupUnits was asked for one (separateHeader) —
  // lets a shell pin the current question in view (e.g. above a long
  // scroll of category cards) instead of it scrolling away as part of
  // content. Null for a simple-fields unit (no single question to pin)
  // and whenever separateHeader wasn't requested — content() then already
  // includes its own inline header, unchanged from before.
  final Widget Function()? header;
  final bool Function(OnefopFormController ctrl) hasData;
  final bool Function(OnefopFormController ctrl) canAdvance;
  // Set only for a table unit rendered as horizontal tabs (age bands,
  // Permanent/Temporaire, ...) — see TableRenderer.fillableTabCount. When
  // present, the section's own Suivant/Précédent (UnitNavRow) steps the
  // table's internal tab first and only falls through to the next/
  // previous *unit* once there's no more internal step — see
  // nextWithinUnit/prevWithinUnit below. Absent for every other unit,
  // which behaves exactly as before.
  final CtrlPredicate? hasMoreInternalSteps;
  final CtrlAction? advanceInternalStep;
  final CtrlPredicate? hasMoreInternalStepsBack;
  final CtrlAction? retreatInternalStep;
  const SectionUnit({
    required this.key,
    this.subsectionLabel,
    required this.shortLabel,
    required this.fieldIds,
    required this.content,
    this.header,
    required this.hasData,
    required this.canAdvance,
    this.hasMoreInternalSteps,
    this.advanceInternalStep,
    this.hasMoreInternalStepsBack,
    this.retreatInternalStep,
  });
}

bool isUnitDone(OnefopFormController ctrl, SectionUnit u) =>
    ctrl.isUnitAdvanced(u.key) || u.hasData(ctrl);

/// A *done* unit (already visited/has data) that still fails its own
/// canAdvance check — e.g. a simple-fields group missing a required
/// answer. Reuses the exact same check already gating that unit's own
/// Suivant button (UnitNavRow's nextEnabled), just surfaced earlier in
/// OnefopSectionMap as a soft, non-blocking signal — see
/// isUnitIncomplete's caller for why it's deliberately never applied to
/// the *current* unit (that one's own disabled Suivant button is
/// feedback enough; flagging it too would just be noise while the user
/// is actively filling it in) or to upcoming units (nothing to warn
/// about yet — they haven't been visited).
bool isUnitIncomplete(OnefopFormController ctrl, SectionUnit u) =>
    isUnitDone(ctrl, u) && !u.canAdvance(ctrl);

/// The unit actively being filled is the first one not yet done; if the
/// whole section is already complete (e.g. reopening a finished draft),
/// falls back to the last unit.
int currentUnitIndex(OnefopFormController ctrl, List<SectionUnit> units) {
  final idx = units.indexWhere((u) => !isUnitDone(ctrl, u));
  return idx == -1 ? units.length - 1 : idx;
}

// A simple-fields unit's nav chip used to show whichever field happened
// to come first (e.g. "5.1.1"), even when the same unit also contained a
// field coded "5.1.2" — live-reported as a subsection wrongly labeled by
// one of its own items instead of the subsection itself. When every
// field's code already agrees, or when they differ only in their
// trailing segment (both share the same "major.minor" prefix, e.g.
// "5.1.1"/"5.1.2" -> "5.1"), that shared subsection-level code is the
// correct chip label. Falls back to the first code otherwise (a run
// spanning genuinely different subsections shouldn't happen given
// groupFields already splits on subsection changes, but this is the same
// "just show something reasonable" fallback the old code already had).
String? _sharedSubsectionCode(List<String> codes) {
  if (codes.isEmpty) return null;
  final first = codes.first;
  if (codes.every((c) => c == first)) return first;
  final parts = first.split('.');
  if (parts.length < 2) return first;
  final prefix = '${parts[0]}.${parts[1]}';
  final shared = codes.every((c) => c == prefix || c.startsWith('$prefix.'));
  return shared ? prefix : first;
}

/// Splits [section]'s fields (grouped by subsection via groupFields, same
/// grouping the old all-at-once renderers used) into a sequence of units —
/// one per table field, plus one per non-empty run of simple fields.
List<SectionUnit> buildTableGroupUnits(
  OnefopFormController ctrl,
  SectionSchema section,
  Locale locale, {
  required EntityType entityType,
  required Widget Function(List<FieldSchema> fields, int startRow) simpleFieldsBuilder,
  required bool mobile,
  bool squareCorners = false,
  // When true, a table unit's paperCode/question-text banner (and, for a
  // simple-fields unit, its subsection caption — see addSimpleUnit) is
  // built as its own SectionUnit.header instead of being folded into
  // content() — see TableRenderer.renderTable's showHeader. All three
  // callers (ExcelSectionBody, SimpleModeShell, the mobile layout) opt in
  // today, pinning the question/subsection above the scrolling content
  // rather than letting it scroll away with it.
  bool separateHeader = false,
}) {
  // Hybrid row-label fields (S3Q02_REASON_*_TEXT, S4Q02_DOMAIN_*_TEXT,
  // S4Q03_DOMAIN_*_TEXT, ...) are already rendered as editable cells
  // inside their owning table (see GridRenderSpec.rowLabelCellIds /
  // TableSpecBuilder._buildReasons/_buildSkills/_buildTraining) — they
  // have no OnefopFormController TextEditingController of their own
  // (excluded from _initCtrl), so picking them up here too, as a run of
  // "attached" simple fields following the table, produced a second,
  // unfillable copy of the same 3 rows underneath it. Dropping them from
  // this pass entirely leaves the table's own row-label cells as the one
  // real place to fill them in.
  final fields = section.fieldIds
      .map((id) => ctrl.schema!.getField(id))
      .whereType<FieldSchema>()
      .where(ctrl.isFieldVisible)
      .where((f) => !kHybridAstIds.contains(f.id))
      .toList();
  final groups = groupFields(fields);

  var rowNum = 0;
  final units = <SectionUnit>[];

  for (final group in groups) {
    final subsectionLabel = group.sub?.of(locale);

    void addSimpleUnit(List<FieldSchema> pending) {
      if (pending.isEmpty) return;
      final startRow = rowNum + 1;
      rowNum += pending.length;
      final simplePaperCodes =
          pending.map((f) => f.paperCode).whereType<String>().toList();
      final shortLabel = _sharedSubsectionCode(simplePaperCodes) ?? '${units.length + 1}';
      units.add(SectionUnit(
        key: '${section.id}#${units.length}#simple',
        subsectionLabel: subsectionLabel,
        shortLabel: shortLabel,
        fieldIds: pending.map((f) => f.id).toList(),
        content: () => simpleFieldsBuilder(pending, startRow),
        hasData: (c) => pending.any((f) {
          final v = c.data[f.id];
          return v != null && v.toString().trim().isNotEmpty;
        }),
        canAdvance: (c) => pending
            .where((f) => f.required && c.isFieldVisible(f))
            .every(c.isFieldFilled),
      ));
    }

    // [attached] is a run of simple fields immediately following [f] that
    // share its paperCode (e.g. S3Q02's reason-count table followed by 3
    // separate free-text "Motif de licenciement N" fields — same
    // question, split across FieldSchema entries only because they're
    // different input types). Rendered as one unit — the table plus the
    // attached fields underneath, under the table's own question header
    // — instead of two consecutive screens where the second had no
    // question context of its own (just short per-field labels, no
    // gender columns, since that context lives on the table field).
    void addTableUnit(FieldSchema f, List<FieldSchema> attached) {
      final prefix = ((f.tableSpec?['prefix'] as String?) ?? f.id).toLowerCase();
      final startRow = rowNum + 1;
      rowNum += attached.length;
      final statusFields =
          attached.where((a) => TableResponseStatus.isFieldId(a.id)).toList();
      final otherAttached =
          attached.where((a) => !TableResponseStatus.isFieldId(a.id)).toList();
      final statusId = statusFields.isNotEmpty
          ? statusFields.first.id
          : (f.paperCode != null
              ? TableResponseStatus.fieldId(f.paperCode!)
              : null);
      // Multi-option tables (age bands, Permanent/Temporaire, ...) render
      // as horizontal tabs, one option's table at a time — see
      // TableRenderer.fillableTabCount. When there's more than one
      // fillable option, the section's own Suivant/Précédent steps
      // through them (ctrl.tabCursor/setTabCursor, keyed by this table's
      // own prefix so position survives navigating away and back) before
      // falling through to the next/previous unit.
      final fillableTabs = TableRenderer.fillableTabCount(f, locale, mobile: mobile);
      final isTabbed = fillableTabs > 1;
      units.add(SectionUnit(
        key: '${section.id}#${units.length}#${f.id}',
        subsectionLabel: subsectionLabel,
        shortLabel: f.paperCode ?? f.id,
        fieldIds: [f.id, ...attached.map((a) => a.id)],
        header: separateHeader ? () => TableRenderer.buildHeader(f, locale) ?? const SizedBox.shrink() : null,
        content: () => Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (statusFields.isNotEmpty) ...[
                // A fresh, never-adjusted TableSizeScope shadows the
                // desktop Excel shell's own ambient one (see
                // table_size_scope.dart) for just this status row —
                // GridLayoutEngine (which this row renders through, same
                // as the real data table below) always reads whatever
                // TableSizeScope is nearest in the tree, so without this
                // the status row's height scaled right along with the
                // user's table-cell zoom, growing/shrinking the gap
                // between the question header and the actual table
                // instead of it staying put. This is one compact field
                // row, not a spreadsheet the zoom control is meant for.
                TableSizeScope(
                  controller: TableSizeController(),
                  child: simpleFieldsBuilder(statusFields, startRow),
                ),
                const SizedBox(height: 8),
              ],
              TableRenderer.renderTable(
                field: f,
                gridValues: ctrl.aGrid,
                onCellChanged: ctrl.onGridCellChanged,
                focusManager: ctrl.fm,
                entityType: entityTypeString(entityType),
                hybridController: ctrl.hybridController,
                mobile: mobile,
                squareCorners: squareCorners,
                locale: locale,
                showHeader: !separateHeader,
                tabIndex: ctrl.tabCursor(prefix),
                tabPeak: ctrl.tabPeak(prefix),
                onTabIndexChanged: (i) => ctrl.setTabCursor(prefix, i),
                isCategorySkipped: ctrl.isCategorySkipped,
                onCategorySkipChanged: ctrl.setCategorySkipped,
                enteredValues: ctrl.uGrid,
                tableClosed: TableResponseStatus.isClosed(
                    ctrl.data[statusId]?.toString()),
                onExitTable: () => ctrl.exitTable(f.id),
                onExitPrevious: () => ctrl.exitTablePrevious(f.id),
              ),
              if (otherAttached.isNotEmpty) ...[
                const SizedBox(height: 12),
                simpleFieldsBuilder(otherAttached, startRow),
              ],
            ],
          ),
        ),
        hasData: (c) =>
            c.uGrid.keys.any((k) => k.startsWith('${prefix}_')) ||
            otherAttached.any((a) {
              final v = c.data[a.id];
              return v != null && v.toString().trim().isNotEmpty;
            }),
        canAdvance: (c) =>
            c.isFieldFilled(f) &&
            otherAttached
                .where((a) => a.required && c.isFieldVisible(a))
                .every(c.isFieldFilled),
        hasMoreInternalSteps: isTabbed ? (c) => c.tabCursor(prefix) < fillableTabs - 1 : null,
        advanceInternalStep:
            isTabbed ? (c) => c.setTabCursor(prefix, c.tabCursor(prefix) + 1) : null,
        hasMoreInternalStepsBack: isTabbed ? (c) => c.tabCursor(prefix) > 0 : null,
        retreatInternalStep:
            isTabbed ? (c) => c.setTabCursor(prefix, c.tabCursor(prefix) - 1) : null,
      ));
    }

    // Walk the group's fields in their original document order — tables
    // and simple fields can be interleaved (e.g. S3Q02's table followed
    // by 3 separate free-text reason fields, then S3Q03's table right
    // after), and a group's fields were previously split into "all
    // simple fields as one leading unit, then all tables" regardless of
    // where they actually sat relative to each other, which silently
    // reordered the section (a run of simple fields could jump ahead of
    // tables that came before it in the real form). Buffering only a
    // *consecutive* run of simple fields between tables preserves the
    // true order; a run sharing the following table's paperCode instead
    // attaches to that table (see addTableUnit) rather than starting its
    // own unit.
    var pendingSimple = <FieldSchema>[];
    final groupFieldsList = group.fields;
    var i = 0;
    while (i < groupFieldsList.length) {
      final f = groupFieldsList[i];
      // VT's fixed-taxonomy grids (4.1, 4.2, 4.7, 4.8, 4.9, 4.11, 5.3, 5.4,
      // 8.1, 8.2, 8.3, 8.6) are correctly modelled as `type: 'table'` in the
      // AST (see vt_routing.dart's file comment for why they aren't
      // `repeatingTable`), but TableRenderer/TableSpecBuilder has no vt_*
      // case — routing them to addTableUnit below would claim them before
      // _buildField's own vt_ intercept (onefop_unified_form_screen_v4.dart)
      // ever got a chance to render VtRowEditor, producing an empty grid
      // instead. Falling through to pendingSimple/simpleFieldsBuilder here
      // matches how VT's other 10 tables (type: 'repeatingTable', never
      // intercepted by this branch) already reach that same intercept.
      final isVtTable = isVtTableTemplate(f.tableSpec?['template'] as String?);
      if (f.type == 'table' && !isVtTable) {
        addSimpleUnit(pendingSimple);
        pendingSimple = [];
        final attached = <FieldSchema>[];
        var j = i + 1;
        while (j < groupFieldsList.length &&
            groupFieldsList[j].type != 'table' &&
            f.paperCode != null &&
            groupFieldsList[j].paperCode == f.paperCode) {
          attached.add(groupFieldsList[j]);
          j++;
        }
        addTableUnit(f, attached);
        i = j;
      } else if (isVtTable) {
        // VT-UI/UX-02 P0: every VT table (both `type: table`, caught
        // above as isVtTable, and `type: repeatingTable`, which never
        // entered that branch at all) would otherwise fall straight into
        // pendingSimple and merge into one giant unit together with
        // whatever ordinary fields surround it (e.g. 8.8's roster ending
        // up ~3250px down the same scroll as 8.1–8.7). Force a boundary
        // explicitly instead: flush whatever ordinary fields came before
        // this table, then this table becomes its own unit immediately —
        // not accumulated into pendingSimple — so two adjacent VT tables
        // (nothing else between them to flush on) still end up as two
        // separate units, not one.
        addSimpleUnit(pendingSimple);
        pendingSimple = [];
        addSimpleUnit([f]);
        i++;
      } else {
        pendingSimple.add(f);
        i++;
      }
    }
    addSimpleUnit(pendingSimple);
  }

  return units;
}

/// Marks [units][fromIndex] done, moves the section's unit cursor forward,
/// and focuses + scrolls the newly-revealed unit into view (top-aligned —
/// see OnefopFormController.scrollToUnit). No-ops past the last unit; the
/// caller (a unit's own Next button, or the keyboard reveal-boundary hook)
/// is only ever wired up when a next unit exists.
void advanceToUnit(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int fromIndex,
) {
  ctrl.advanceUnit(units[fromIndex].key);
  final to = fromIndex + 1;
  if (to >= units.length) return;
  ctrl.setUnitCursor(section.id, to);
  ctrl.focusFieldId(units[to].fieldIds.first, preferFirst: true, scroll: false);
  ctrl.scrollToUnit(units[to].key);
}

/// Moves the section's unit cursor back one unit — purely a display-cursor
/// change, doesn't un-mark the unit as advanced (its data is untouched).
void retreatToUnit(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int fromIndex,
) {
  final to = fromIndex - 1;
  if (to < 0) return;
  ctrl.setUnitCursor(section.id, to);
  ctrl.focusFieldId(units[to].fieldIds.first, preferFirst: false, scroll: false);
  ctrl.scrollToUnit(units[to].key);
}

/// Suivant for the *current* unit — steps its internal tab (age band,
/// Permanent/Temporaire, ...) first if it has one and hasn't reached the
/// last fillable option yet; only once there's no more internal step does
/// it fall through to [advanceToUnit]. For a non-tabbed unit this is
/// exactly [advanceToUnit].
void nextWithinUnit(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int fromIndex,
) {
  final unit = units[fromIndex];
  if (unit.hasMoreInternalSteps?.call(ctrl) ?? false) {
    unit.advanceInternalStep!(ctrl);
    return;
  }
  advanceToUnit(ctrl, section, units, fromIndex);
}

/// Précédent mirror of [nextWithinUnit] — retreats the current unit's
/// internal tab first, only falling through to [retreatToUnit] once
/// already on its first option.
void prevWithinUnit(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int fromIndex,
) {
  final unit = units[fromIndex];
  if (unit.hasMoreInternalStepsBack?.call(ctrl) ?? false) {
    unit.retreatInternalStep!(ctrl);
    return;
  }
  retreatToUnit(ctrl, section, units, fromIndex);
}

/// Called off a section's *last* unit (Suivant with nowhere further to go
/// within the section) — instead of stopping at the section boundary,
/// moves straight to the next page/section, revalidating the current one
/// first via [OnefopFormController.next] exactly like the page-level
/// Suivant already does (blocks + surfaces the missing-fields state if
/// invalid), then explicitly lands on the new section's *first* unit. Every
/// unitCursor read elsewhere (ExcelSectionBody, _sectionUnitBody,
/// SimpleModeShell's _UnitBody) already falls back to 0 for a fresh
/// section, but a partially/fully completed one wouldn't — currentUnitIndex
/// would put you on its first *incomplete* unit, or its last if it's
/// already all done, either of which is wrong when arriving here via
/// "next", so this pins it explicitly instead of relying on that default.
void advanceToNextSection(OnefopFormController ctrl) {
  final beforePage = ctrl.currentPage;
  ctrl.next();
  if (ctrl.currentPage == beforePage) return; // validation blocked the page change
  final landed = ctrl.primarySection(ctrl.currentPage);
  if (landed != null) ctrl.setUnitCursor(landed.id, 0);
}

/// Mirror of [advanceToNextSection] for Précédent off a section's *first*
/// unit — moves to the previous page/section and lands on its *last* unit.
/// No need to compute that index here: every unitCursor read already
/// clamps to `units.length - 1`, so an out-of-range sentinel resolves to
/// "last" for free without this function needing to rebuild that section's
/// unit list just to count it.
void retreatToPreviousSection(OnefopFormController ctrl) {
  final beforePage = ctrl.currentPage;
  ctrl.prev();
  if (ctrl.currentPage == beforePage) return;
  final landed = ctrl.primarySection(ctrl.currentPage);
  if (landed != null) ctrl.setUnitCursor(landed.id, 1 << 30);
}

/// The vertical navigation's **Question** resolver: jumps the section's
/// unit cursor directly to [toIndex] — reached from OnefopSectionMap's
/// question chips, and from [navigateToSection]'s siblings for a specific
/// question — then focuses its first editable cell so the user can start
/// typing immediately, no extra click needed. Doesn't call ctrl.advanceUnit
/// (that only happens via genuine Suivant progression or the unit actually
/// having data — see isUnitDone): merely looking at an unfilled unit via
/// the outline shouldn't retroactively mark it ✓ done. That deliberately
/// means this can target a unit the user hasn't reached yet — the outline
/// is a real "jump anywhere" map of the questionnaire, not a linear replay
/// of Suivant; the actual required-fields gate still applies at submit
/// time (validateAllPages), it just no longer also blocks *looking* at a
/// later question early.
void jumpToUnit(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int toIndex,
) {
  if (toIndex < 0 || toIndex >= units.length) return;
  ctrl.setUnitCursor(section.id, toIndex);
  ctrl.focusFieldId(units[toIndex].fieldIds.first, preferFirst: true, scroll: false);
  ctrl.scrollToUnit(units[toIndex].key);
}

/// The vertical navigation's **Section**/**Subsection** resolver: jumps the
/// section's unit cursor to [toIndex] and scrolls it into view, same as
/// [jumpToUnit] but *without* focusing a field — the user is browsing the
/// outline to a location, not starting to answer it yet (see
/// navigateToSection for the Section case; a Subsection click passes the
/// index of that subsection's own first unit, resolved by the caller from
/// the same units list OnefopSectionMap already groups into runs).
void jumpToLocation(
  OnefopFormController ctrl,
  SectionSchema section,
  List<SectionUnit> units,
  int toIndex,
) {
  if (toIndex < 0 || toIndex >= units.length) return;
  ctrl.setUnitCursor(section.id, toIndex);
  ctrl.scrollToUnit(units[toIndex].key);
}

/// The vertical navigation's **Section** entry point (Sidebar section
/// click): switches to [sectionId]'s page if it isn't already active, then
/// jumps straight to its very first question/table — index 0, regardless
/// of how far the user has already progressed through it. That's
/// deliberately different from Back/Next landing on a section (which
/// resumes at the first *incomplete* unit via currentUnitIndex, or the
/// last unit when arriving from the section after — see
/// advanceToNextSection/retreatToPreviousSection): a Section click is an
/// explicit "take me to the top of this section" request, not a resume.
///
/// Rebuilds the section's own unit list via [buildTableGroupUnits] rather
/// than trusting a caller-supplied one — the caller (a Sidebar item for a
/// *different*, not-yet-active section) generally doesn't have one built,
/// since building it is normally gated on that section already being
/// active (see _SidebarPageItem). simpleFieldsBuilder is the same
/// throwaway used there: this call only ever reads units' keys/fieldIds,
/// never builds the returned widget.
void navigateToSection(
  OnefopFormController ctrl,
  Locale locale,
  EntityType entityType,
  String sectionId,
) {
  final schema = ctrl.schema;
  if (schema == null) return;
  final pageIdx = schema.sections.indexWhere((s) => s.id == sectionId);
  if (pageIdx < 0) return;
  if (ctrl.currentPage != pageIdx) {
    ctrl.goto(pageIdx, focus: false, scroll: false);
  }
  final section = schema.sections[pageIdx];
  final units = buildTableGroupUnits(
    ctrl,
    section,
    locale,
    entityType: entityType,
    simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
    mobile: false,
  );
  if (units.isEmpty) return;
  jumpToLocation(ctrl, section, units, 0);
}

/// VT desktop sidebar's **Subsection** row resolver — same page-switch as
/// [navigateToSection], but jumps straight to a specific unit (not always
/// index 0) and focuses it (via [jumpToUnit], not [jumpToLocation]): the
/// sidebar's subsection tree is a "pick exactly this question" control,
/// same semantics the old VtSectionOutline.onJump had before the sidebar
/// absorbed it. Deliberately a new function rather than adding an optional
/// index to [navigateToSection] — every existing Section-click caller keeps
/// calling that one completely unmodified.
void navigateToSectionUnit(
  OnefopFormController ctrl,
  Locale locale,
  EntityType entityType,
  String sectionId,
  int unitIndex,
) {
  final schema = ctrl.schema;
  if (schema == null) return;
  final pageIdx = schema.sections.indexWhere((s) => s.id == sectionId);
  if (pageIdx < 0) return;
  if (ctrl.currentPage != pageIdx) {
    ctrl.goto(pageIdx, focus: false, scroll: false);
  }
  final section = schema.sections[pageIdx];
  final units = buildTableGroupUnits(
    ctrl,
    section,
    locale,
    entityType: entityType,
    simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
    mobile: false,
  );
  if (units.isEmpty) return;
  jumpToUnit(ctrl, section, units, unitIndex.clamp(0, units.length - 1));
}

/// Fade + small upward slide between units — same timing/curve this
/// codebase's other reveal/scroll transitions already use (see
/// OnefopFormController.scrollToField/scrollToUnit).
class UnitTransition extends StatelessWidget {
  final Widget child;
  const UnitTransition({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      // Both callers (ExcelSectionBody, SimpleModeShell's _UnitBody) put
      // this inside an Expanded feeding a SingleChildScrollView — real
      // leftover height whenever a unit's own content is shorter than the
      // viewport. AnimatedSwitcher's default layoutBuilder stacks the
      // outgoing/incoming children with Alignment.center, which vertically
      // centers a short unit (e.g. a small table right under its own
      // question header) inside that entire leftover height — live-
      // reported as a large, unexplained empty gap above a table that
      // should instead start right after its header. topCenter keeps the
      // fade/slide's own horizontal centering but anchors content to the
      // top like every other unit body in this app already does.
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topCenter,
        children: [
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.04),
            end: Offset.zero,
          ).animate(animation),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// Per-unit Précédent/Suivant row, shared by the desktop excel shell, the
/// mobile stepper, and Simple Mode — separate from each platform's sheet-/
/// page-wide Précédent/Suivant, which moves between whole sections, not
/// between the tables within one.
class UnitNavRow extends StatelessWidget {
  final bool showBack;
  final VoidCallback onBack;
  final bool showNext;
  final bool nextEnabled;
  final VoidCallback onNext;
  // Set once there's no further unit or page to advance into — the true
  // end of the form. Swaps the label/icon to Soumettre; this is the only
  // Submit control left now that the page-level nav bars (mobile's NavBar,
  // the excel shell's _BottomActionBar) — which duplicated this same
  // Précédent/Suivant pair everywhere else in the form — are gone.
  final bool isSubmit;
  // Bigger, higher-contrast buttons with their own pinned-footer chrome
  // (background + top border + SafeArea) — for wherever this row sits
  // outside the scrolling content as a fixed footer (mobile, Simple Mode)
  // rather than inline within a card (desktop Spreadsheet Mode's
  // ExcelSectionBody, which keeps the original compact treatment to match
  // its dense chrome elsewhere). The compact size is under the ~44-48px
  // touch-target guideline — too small for a control tapped every single
  // unit on a touch device.
  final bool large;
  // Caps the button row's own width and centers it within the pinned
  // footer, so Back/Next line up under the same content column the
  // question above them is constrained to instead of spreading to the
  // full window width (the footer's background still goes edge-to-edge —
  // only the buttons themselves are capped). Only meaningful when
  // [large] is true; ignored otherwise (the compact variant is already
  // inline within a narrower card).
  final double? contentMaxWidth;
  const UnitNavRow({
    super.key,
    required this.showBack,
    required this.onBack,
    required this.showNext,
    required this.nextEnabled,
    required this.onNext,
    this.isSubmit = false,
    this.large = false,
    this.contentMaxWidth,
  });

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final backLabel = const LocalizedText(fr: 'Précédent', en: 'Back').of(locale);
    final nextLabel = isSubmit
        ? const LocalizedText(fr: 'Soumettre', en: 'Submit').of(locale)
        : const LocalizedText(fr: 'Suivant', en: 'Next').of(locale);
    final row = Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (showBack)
          large
              ? OutlinedButton.icon(
                  onPressed: onBack,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: kInkSoft,
                    side: const BorderSide(color: kBorder),
                    minimumSize: const Size(0, kOnefopFormControlHeight),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusXs)),
                  ),
                  icon: const Icon(Icons.arrow_back_rounded, size: 15),
                  label: Text(backLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                )
              : TextButton.icon(
                  onPressed: onBack,
                  style: TextButton.styleFrom(
                    foregroundColor: kInkSoft,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(0, 30),
                  ),
                  icon: const Icon(Icons.chevron_left_rounded, size: 15),
                  label: Text(backLabel, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                )
        else
          const SizedBox.shrink(),
        if (showNext)
          large
              ? ElevatedButton.icon(
                  onPressed: nextEnabled ? onNext : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kBorder,
                    elevation: 0,
                    minimumSize: const Size(0, kOnefopFormControlHeight),
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusXs)),
                  ),
                  icon: Icon(isSubmit ? Icons.send_rounded : Icons.arrow_forward_rounded, size: 15),
                  label: Text(nextLabel,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                )
              : OutlinedButton.icon(
                  onPressed: nextEnabled ? onNext : null,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: kAccent,
                    disabledForegroundColor: kInkFaint,
                    side: BorderSide(color: nextEnabled ? kAccent : kBorder),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 30),
                  ),
                  icon: Icon(isSubmit ? Icons.send_rounded : Icons.chevron_right_rounded, size: 15),
                  label: Text(nextLabel,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                ),
      ],
    );

    if (!large) {
      return Padding(padding: const EdgeInsets.only(top: 8, bottom: 4), child: row);
    }
    final content = contentMaxWidth == null
        ? row
        : Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: contentMaxWidth!),
              child: row,
            ),
          );
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 14),
        decoration: const BoxDecoration(
          color: kSurface,
          border: Border(top: BorderSide(color: kBorder, width: 1)),
        ),
        child: content,
      ),
    );
  }
}

/// Compact Section → Subsection → Unit map — shown above the active
/// table/question-group, and (full-width, active item only) inside the
/// vertical Sidebar too — a dense document outline, not a stepper: a
/// muted caption per subsection, followed by one scrollable line of
/// glyph+code chips (✓ done / ● current / ○ upcoming). This is the widget
/// every non-VT entity uses everywhere (mobile, Simple Mode, and desktop
/// Spreadsheet Mode) — VT itself no longer uses this widget at all:
/// Spreadsheet Mode shows its subsections in the persistent left Sidebar
/// instead (see _VtSidebarSectionItem/_VtSubsectionTree in
/// onefop_form_widgets.dart), and mobile/Simple Mode use VtSectionOutline
/// (this file) — one integrated glyph+full-text row per subsection,
/// replacing this widget's separate caption-then-chip-row (live-reported
/// as a "floating isolated code" once VT's own field/subsection data was
/// complete enough to make the redundancy obvious). The section itself is
/// already shown by the surrounding chrome (app bar /
/// MobileContextHeader / the sidebar's own item), so this only renders
/// the two tiers below it. Hidden entirely when there's nothing to
/// navigate (a single-unit section like section0).
class OnefopSectionMap extends StatelessWidget {
  final OnefopFormController ctrl;
  final List<SectionUnit> units;
  final int currentIndex;
  // Question chip tap — jumps to that unit AND focuses its first editable
  // cell (jumpToUnit), so the user can start typing immediately.
  final void Function(int index) onJump;
  // Subsection label tap — jumps to that run's first unit WITHOUT
  // focusing a field (jumpToLocation): the user is browsing to a
  // location, not starting to answer it yet, same distinction
  // navigateToSection draws for a Section click. Only reachable for a
  // multi-unit run — a single-unit run has no caption to tap (its own
  // chip already jumps there).
  final void Function(int index) onJumpToLocation;
  const OnefopSectionMap({
    super.key,
    required this.ctrl,
    required this.units,
    required this.currentIndex,
    required this.onJump,
    required this.onJumpToLocation,
  });

  @override
  Widget build(BuildContext context) {
    if (units.length <= 1) return const SizedBox.shrink();

    // Group units into consecutive runs sharing the same subsectionLabel —
    // the same run-length grouping groupFields() already does at the field
    // level, just re-derived here since every unit (not only the first of
    // a group) now carries its own subsectionLabel.
    final runs = <(String?, List<int>)>[];
    for (var i = 0; i < units.length; i++) {
      final label = units[i].subsectionLabel;
      if (runs.isNotEmpty && runs.last.$1 == label) {
        runs.last.$2.add(i);
      } else {
        runs.add((label, [i]));
      }
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final run in runs)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (run.$1 != null)
                    InkWell(
                      onTap: () => onJumpToLocation(run.$2.first),
                      borderRadius: BorderRadius.circular(3),
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          run.$1!,
                          style: kTableHeaderStyle.copyWith(fontSize: 12.5, color: kInk),
                        ),
                      ),
                    ),
                  _SubsectionChipLine(
                    ctrl: ctrl,
                    units: units,
                    indices: run.$2,
                    currentIndex: currentIndex,
                    onJump: onJump,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// VT's replacement for OnefopSectionMap on mobile and desktop Simple
/// Mode — the only two remaining places VT still went through the
/// shared caption-then-chip-row widget (Spreadsheet Mode already has its
/// own persistent Sidebar tree — see _VtSidebarSectionItem/
/// _VtSubsectionTree in onefop_form_widgets.dart). OnefopSectionMap's own
/// "2.1 General Information" caption followed by a separate "● 2.1" chip
/// line right underneath it — live-reported as a "floating isolated
/// code": the caption already carries the same code, so the chip below
/// added nothing but the ✓/●/○ state, sitting oddly alone. This widget
/// folds both into one row per unit instead — glyph + the unit's
/// complete subsectionLabel text together (already "2.1 General
/// Information" — code and description as authored in the AST), or its
/// bare shortLabel for a unit with no real subsection tier, so a row is
/// never blank. Same visual language (glyph/color/weight) as
/// OnefopSectionMap's own chips, just one integrated line instead of
/// two. OnefopSectionMap itself is completely unchanged and still used
/// exactly as before by every non-VT entity, on both platforms.
class VtSectionOutline extends StatelessWidget {
  static const double _maxHeight = 280;

  final OnefopFormController ctrl;
  final List<SectionUnit> units;
  final int currentIndex;
  final void Function(int index) onJump;
  const VtSectionOutline({
    super.key,
    required this.ctrl,
    required this.units,
    required this.currentIndex,
    required this.onJump,
  });

  _UnitChipState _stateFor(int i) {
    if (i == currentIndex) return _UnitChipState.current;
    if (isUnitDone(ctrl, units[i])) return _UnitChipState.done;
    return _UnitChipState.upcoming;
  }

  @override
  Widget build(BuildContext context) {
    if (units.length <= 1) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      constraints: const BoxConstraints(maxHeight: _maxHeight),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        border: const Border.fromBorderSide(BorderSide(color: kBorder)),
        borderRadius: BorderRadius.circular(kRadiusXs),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [for (var i = 0; i < units.length; i++) _row(i)],
        ),
      ),
    );
  }

  Widget _row(int i) {
    final unit = units[i];
    final state = _stateFor(i);
    final incomplete = state == _UnitChipState.done && isUnitIncomplete(ctrl, unit);

    late final String glyph;
    late final Color color;
    late final FontWeight weight;
    switch (state) {
      case _UnitChipState.done:
        if (incomplete) {
          glyph = '!';
          color = kWarning;
          weight = FontWeight.w700;
        } else {
          glyph = '✓';
          color = kInk;
          weight = FontWeight.w500;
        }
        break;
      case _UnitChipState.current:
        glyph = '●';
        color = kAccent;
        weight = FontWeight.w700;
        break;
      case _UnitChipState.upcoming:
        glyph = '○';
        color = kInk;
        weight = FontWeight.w400;
        break;
    }

    final text = unit.subsectionLabel ?? unit.shortLabel;
    final isCurrent = state == _UnitChipState.current;

    return InkWell(
      onTap: () => onJump(i),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: isCurrent
            ? BoxDecoration(
                color: kAccent.withValues(alpha: 0.08),
                border: const Border.fromBorderSide(BorderSide(color: kAccent)),
                borderRadius: BorderRadius.circular(kRadiusXs),
              )
            : null,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(glyph, style: TextStyle(fontSize: 13, color: color, fontWeight: weight)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text, style: TextStyle(fontSize: 13, color: color, fontWeight: weight)),
            ),
          ],
        ),
      ),
    );
  }
}

enum _UnitChipState { done, current, upcoming }

/// One subsection's question-code chips, laid out as a wrapping vertical
/// block (the chips flow and stack — this is a vertical panel, not a
/// horizontally-scrolling strip) so the panel simply grows with its
/// content instead of clipping it. A run longer than [_collapsedLimit]
/// chips starts truncated with a "Voir plus" toggle to reveal the rest —
/// "Réduire" collapses it back — so one very long subsection can't push
/// every other section's chips off the bottom of the sidebar.
class _SubsectionChipLine extends StatefulWidget {
  final OnefopFormController ctrl;
  final List<SectionUnit> units;
  final List<int> indices;
  final int currentIndex;
  final void Function(int index) onJump;
  const _SubsectionChipLine({
    required this.ctrl,
    required this.units,
    required this.indices,
    required this.currentIndex,
    required this.onJump,
  });

  @override
  State<_SubsectionChipLine> createState() => _SubsectionChipLineState();
}

class _SubsectionChipLineState extends State<_SubsectionChipLine> {
  static const int _collapsedLimit = 6;

  bool _expanded = false;

  _UnitChipState _stateFor(int i) {
    if (i == widget.currentIndex) return _UnitChipState.current;
    if (isUnitDone(widget.ctrl, widget.units[i])) return _UnitChipState.done;
    return _UnitChipState.upcoming;
  }

  Widget _chip(int i) {
    final state = _stateFor(i);
    return _SectionMapChip(
      unit: widget.units[i],
      state: state,
      incomplete: state == _UnitChipState.done && isUnitIncomplete(widget.ctrl, widget.units[i]),
      // Every chip jumps now, not just done ones — a true outline nav
      // lets the user look at (and start answering) any question, not
      // only ones already reached via Suivant. See jumpToUnit's doc
      // comment for why that's safe: it never bypasses the actual
      // required-fields gate, only the "must go in order" convenience.
      onTap: () => widget.onJump(i),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.loc;
    final indices = widget.indices;
    final showToggle = indices.length > _collapsedLimit;
    final visible = (showToggle && !_expanded) ? indices.take(_collapsedLimit) : indices;

    return Wrap(
      spacing: 12,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final i in visible) _chip(i),
        if (showToggle)
          _ToggleLink(
            label: (_expanded
                    ? const LocalizedText(fr: 'Réduire', en: 'Collapse')
                    : const LocalizedText(fr: 'Voir plus', en: 'Show more'))
                .of(locale),
            onTap: () => setState(() => _expanded = !_expanded),
          ),
      ],
    );
  }
}

class _ToggleLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _ToggleLink({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(3),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 1),
        child: Text(
          label,
          style: const TextStyle(
              fontSize: 12.5, fontWeight: FontWeight.w700, color: kAccent, decoration: TextDecoration.underline),
        ),
      ),
    );
  }
}

class _SectionMapChip extends StatelessWidget {
  final SectionUnit unit;
  final _UnitChipState state;
  // Soft, non-blocking signal only ever set on a *done* chip — a unit
  // already visited/has data but still missing a required answer (see
  // isUnitIncomplete). Never set on current (its own disabled Suivant is
  // feedback enough) or upcoming (nothing to warn about yet).
  final bool incomplete;
  final VoidCallback? onTap;
  const _SectionMapChip({
    required this.unit,
    required this.state,
    this.incomplete = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    late final String glyph;
    late final Color color;
    late final FontWeight weight;
    switch (state) {
      case _UnitChipState.done:
        if (incomplete) {
          glyph = '!';
          color = kWarning;
          weight = FontWeight.w700;
        } else {
          glyph = '✓';
          color = kInk;
          weight = FontWeight.w500;
        }
        break;
      case _UnitChipState.current:
        glyph = '●';
        color = kAccent;
        weight = FontWeight.w700;
        break;
      case _UnitChipState.upcoming:
        glyph = '○';
        color = kInk;
        weight = FontWeight.w400;
        break;
    }

    final label = Text(
      '$glyph ${unit.shortLabel}',
      style: TextStyle(fontSize: 12.5, color: color, fontWeight: weight),
    );

    if (onTap == null) {
      return Padding(padding: const EdgeInsets.symmetric(vertical: 1), child: label);
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: InkWell(
        borderRadius: BorderRadius.circular(3),
        onTap: onTap,
        child: label,
      ),
    );
  }
}
