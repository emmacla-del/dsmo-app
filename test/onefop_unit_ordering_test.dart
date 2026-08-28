// Regression tests for two related section3/section4 bugs:
//
// 1. Ordering: buildTableGroupUnits used to collect *all* simple fields
//    in a group into one unit rendered ahead of *all* that group's
//    tables, discarding the fields' real document order whenever simple
//    and table fields were interleaved (S3Q01 table, S3Q02 table, 3
//    free-text reason fields, S3Q03 table) — the free-text unit jumped
//    to the front of the section instead of sitting after S3Q02.
//
// 2. Hybrid duplication: S3Q02_REASON_*_TEXT (and the S4Q02/S4Q03
//    DOMAIN_*_TEXT equivalents) are already rendered as editable
//    row-label cells *inside* their table (GridRenderSpec.rowLabelCellIds
//    — see TableSpecBuilder._buildReasons/_buildSkills/_buildTraining).
//    They previously also got merged into the table's own unit as
//    "attached" simple fields, rendering a second, unfillable copy of the
//    same 3 rows underneath the table (those fields have no
//    TextEditingController in OnefopFormController — see kHybridAstIds —
//    so the duplicate could never actually be typed into) and, since
//    they're marked required, permanently disabling that unit's Suivant.
//    Fixed by dropping kHybridAstIds fields from buildTableGroupUnits
//    entirely — the table's own row-label cells are the one real place
//    to fill them in.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';

// TableRenderer's paperCode/question-text header (table_renderer.dart)
// renders as a bare RichText, not a Text/Text.rich — find.text/
// find.textContaining only match Text and EditableText, so they silently
// find nothing against it. This walks RichText widgets directly instead.
Finder findRichTextContaining(String substring) => find.byWidgetPredicate(
    (w) => w is RichText && w.text.toPlainText().contains(substring));

void main() {
  testWidgets('section3 units: S3Q01, S3Q02 (no attached reason-text fields), S3Q03',
      (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) {},
    );
    await ctrl.initialize();

    final section3 = ctrl.schema!.sections.firstWhere((s) => s.id == 'section3');
    final units = buildTableGroupUnits(
      ctrl,
      section3,
      const Locale('fr'),
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (fields, startRow) => const SizedBox.shrink(),
      mobile: true,
    );

    expect(units.length, 3, reason: 'S3Q01, S3Q02, S3Q03');
    expect(units[0].fieldIds, ['S3Q01', 'S3Q01_RESPONSE_STATUS']);
    expect(units[1].fieldIds, ['S3Q02', 'S3Q02_RESPONSE_STATUS']);
    expect(units[2].fieldIds, ['S3Q03', 'S3Q03_RESPONSE_STATUS']);
  });

  testWidgets('section4 units: S4Q01, S4Q02, S4Q03 (no attached skill/training-text fields)',
      (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) {},
    );
    await ctrl.initialize();

    final section4 = ctrl.schema!.sections.firstWhere((s) => s.id == 'section4');
    final units = buildTableGroupUnits(
      ctrl,
      section4,
      const Locale('fr'),
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (fields, startRow) => const SizedBox.shrink(),
      mobile: true,
    );

    expect(units.length, 3, reason: 'S4Q01, S4Q02, S4Q03');
    expect(units[0].fieldIds, ['S4Q01', 'S4Q01_RESPONSE_STATUS']);
    expect(units[1].fieldIds, ['S4Q02', 'S4Q02_RESPONSE_STATUS']);
    expect(units[2].fieldIds, ['S4Q03', 'S4Q03_RESPONSE_STATUS']);
  });

  // End-to-end render check for the whole S3Q01 → S4Q03 range: every unit
  // in section3 and section4, in the corrected order, actually builds
  // without throwing — on both desktop (StatusSwitchTable for S3Q01/S3Q03,
  // plain GenericSpreadsheetTable for the rest) and mobile
  // (categoryGridGroups' cards for S3Q01/S3Q03, MobileCardTable for the
  // rest) — not just that the order is right.
  for (final mobile in [false, true]) {
    testWidgets(
        'every unit from S3Q01 to S4Q03 renders (${mobile ? "mobile" : "desktop"})',
        (tester) async {
      final ctrl = OnefopFormController(
        entityType: EntityType.enterprise,
        initialData: const {},
        onSave: (_) {},
      );
      await ctrl.initialize();

      const expectedOrder = [
        ['S3Q01', 'S3Q01_RESPONSE_STATUS'],
        ['S3Q02', 'S3Q02_RESPONSE_STATUS'],
        ['S3Q03', 'S3Q03_RESPONSE_STATUS'],
        ['S4Q01', 'S4Q01_RESPONSE_STATUS'],
        ['S4Q02', 'S4Q02_RESPONSE_STATUS'],
        ['S4Q03', 'S4Q03_RESPONSE_STATUS'],
      ];

      final allUnits = <SectionUnit>[];
      for (final sectionId in ['section3', 'section4']) {
        final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);
        allUnits.addAll(buildTableGroupUnits(
          ctrl,
          section,
          const Locale('fr'),
          entityType: EntityType.enterprise,
          simpleFieldsBuilder: (fields, startRow) => Column(
            children: [for (final f in fields) Text(f.id)],
          ),
          mobile: mobile,
        ));
      }

      expect(allUnits.map((u) => u.fieldIds).toList(), expectedOrder);

      for (final unit in allUnits) {
        // KeyedSubtree(key: ValueKey(unit.key)) matches both real desktop
        // callers (SimpleModeShell, ExcelSectionBody — see
        // simple_mode_shell.dart/onefop_excel_field_rows.dart): without it,
        // sequential pumpWidget calls here see the same widget *type* at
        // the same tree position each time and reuse the previous unit's
        // Element/State (e.g. a StatusSwitchTable/AgeBandSwitchTable's own
        // internal tab index) instead of mounting each unit fresh. Not a
        // real app bug: production always mounts a fresh unit under its
        // own key.
        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: KeyedSubtree(key: ValueKey(unit.key), child: unit.content()),
            ),
          ),
        ));
        await tester.pump();
        expect(tester.takeException(), isNull,
            reason: 'unit ${unit.fieldIds} (${mobile ? "mobile" : "desktop"}) threw while building');
      }
    });
  }

  // Checks the actual production desktop path (ExcelSectionBody, real
  // _SimpleFieldsTable) for the specific complaint: landing on S3Q02
  // should show its own question text and its gender-count table, with
  // its 3 reason-description cells editable *inside* that table (as
  // their hint placeholders) — and, critically, no second/duplicate
  // "S3Q02_REASON_*_TEXT" table underneath it, and Suivant not blocked.
  testWidgets(
      'desktop: S3Q02 shows its table + question text, reason texts are in-table only, Suivant enabled',
      (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) {},
    );
    await ctrl.initialize();
    final s3q01Status = ctrl.schema!.getField('S3Q01_RESPONSE_STATUS')!;
    ctrl.onFieldChanged('S3Q01_RESPONSE_STATUS', 'NONE', s3q01Status);
    final section3 = ctrl.schema!.sections.firstWhere((s) => s.id == 'section3');

    Future<void> pumpSection() async {
      await tester.pumpWidget(MaterialApp(
        // Table headers/question text pick their French/English variant off
        // the ambient Locale (context.loc → Localizations.localeOf) — the
        // rest of this suite's captures pin 'fr', so the French assertions
        // below (e.g. "motifs de licenciement") are actually reachable
        // instead of silently checking against whatever the host's
        // platform locale happens to be. locale: alone isn't enough —
        // without matching localizationsDelegates/supportedLocales,
        // MaterialApp's own resolution falls back to its default 'en'.
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          // ExcelSectionBody now owns its own pinned-header + scroll
          // layout (an Expanded + internal SingleChildScrollView, so the
          // question can stay pinned above the scrolling table — see its
          // build()), so it needs the bounded height Scaffold's body
          // already provides directly, not an extra ancestor
          // SingleChildScrollView (which would make that height
          // unbounded and break the internal Expanded).
          //
          // ExcelSectionBody is a plain StatelessWidget reading ctrl's
          // getters at build time, not a listener itself — the real app
          // rebuilds it on every ctrl.notifyListeners() via an ancestor
          // that's actually subscribed (OnefopUnifiedFormScreenV4's
          // State). Without an equivalent here, tapping Suivant mutates
          // ctrl's tab/unit cursor but the tree never redraws to reflect
          // it, so this AnimatedBuilder is load-bearing, not decorative.
          body: AnimatedBuilder(
            animation: ctrl,
            builder: (_, __) => ExcelSectionBody(
              ctrl: ctrl,
              section: section3,
              entityType: EntityType.enterprise,
              onPreviewSubmit: () async {},
            ),
          ),
        ),
      ));
      await tester.pump();
    }

    // Unit 0: S3Q01's own table.
    await pumpSection();
    expect(tester.takeException(), isNull);
    expect(findRichTextContaining('S3Q01'), findsWidgets,
        reason: 'S3Q01 paper code should appear above its own table');

    // Advance to unit 1: S3Q02's table on its own. S3Q01 (departure_table)
    // is itself a StatusSwitchTable with 5 fillable horizontal tabs
    // (Licenciements/Démissions/Retraite/Autres/Ensemble — see
    // TableRenderer.fillableTabCount), so Suivant has to step through all
    // 5 of those first (hasMoreInternalSteps) before it actually falls
    // through to advancing the unit — same button throughout, tapped
    // repeatedly, matching how a user would drive it. Never disabled: a
    // table unit's own canAdvance is always true (see SectionUnit), and —
    // the actual regression this test guards — no longer gated by the
    // (now correctly *not* attached) reason-text fields either.
    for (var i = 0; i < 6; i++) {
      final suivant = find.text('Suivant');
      expect(suivant, findsOneWidget);
      final suivantButton = find.ancestor(of: suivant, matching: find.byType(OutlinedButton));
      expect(
          tester.widget<OutlinedButton>(suivantButton.first).onPressed, isNotNull,
          reason: 'Suivant must not be disabled by the (no longer attached) reason-text fields');
      await tester.tap(suivant);
      await tester.pump();
      expect(tester.takeException(), isNull);
      if (findRichTextContaining('S3Q02').evaluate().isNotEmpty) break;
    }

    expect(findRichTextContaining('S3Q02'), findsWidgets,
        reason: 'S3Q02 paper code should appear above its own table');
    expect(findRichTextContaining('motifs de licenciement'), findsWidgets,
        reason: "S3Q02's question text should appear on the same screen");
    // The 3 reason rows' hint placeholders (TableSpecBuilder._buildReasons)
    // — these live inside the table's own row-label cells now, not as a
    // separate table below it.
    for (final label in ['Motif 1', 'Motif 2', 'Motif 3']) {
      expect(find.text(label), findsOneWidget,
          reason: '$label should render once, as the table\'s own row-label hint');
    }
  });
}
