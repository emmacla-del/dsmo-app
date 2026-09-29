// Coverage for two related, live-reported issues found while auditing
// the desktop Excel shell for "worthy of a government institution"
// visual polish: a short table (Section 2's S21Q01) rendered with a huge,
// unexplained empty gap between its own question header and the table
// itself, and the section outline (OnefopSectionMap) showing "2.3 PRIMO
// DEMANDEUR" and each of S23Q01/S23Q02 TWICE.
//
// Root causes (both confirmed via direct render-tree measurement, not
// guessed from screenshots — see conversation history):
//
// 1. S23Q01/S23Q02's own `subsection:` text ("2.3 PRIMO DEMANDEUR
//    (personne à la recherche de son premier emploi)") didn't match the
//    short-form text ("2.3 PRIMO DEMANDEUR") their own `tableResponseStatus
//    (...)` companion fields declared in onefop_ast.dart — every other
//    table's pair (S21Q01, S22Q01-05, ...) already matched exactly. Since
//    groupFields()/buildTableGroupUnits compare LocalizedText by value,
//    the mismatched pair split into two separate groups/units per
//    paperCode instead of one, and OnefopSectionMap dutifully rendered
//    both.
//
// 2. UnitTransition (shared by ExcelSectionBody AND SimpleModeShell's
//    _UnitBody) wraps unit content in an AnimatedSwitcher inside an
//    Expanded — AnimatedSwitcher's default layoutBuilder stacks children
//    with Alignment.center, so any unit shorter than the Expanded's full
//    leftover height (the common case: most units are far shorter than a
//    tall desktop viewport) rendered vertically centered in that
//    leftover space instead of anchored under its own header. Fixed by
//    giving UnitTransition its own topCenter layoutBuilder.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_section_units.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';

void main() {
  testWidgets(
      'buildTableGroupUnits: S23Q01/S23Q02 form exactly one "2.3 PRIMO '
      'DEMANDEUR..." unit each, not a duplicated pair', (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.sections.firstWhere((s) => s.id == 'section2');

    final units = buildTableGroupUnits(
      ctrl,
      section,
      const Locale('fr'),
      entityType: EntityType.enterprise,
      simpleFieldsBuilder: (_, __) => const SizedBox.shrink(),
      mobile: false,
    );

    final shortLabels = units.map((u) => u.shortLabel).toList();
    expect(shortLabels.where((l) => l == 'S23Q01').length, 1);
    expect(shortLabels.where((l) => l == 'S23Q02').length, 1);

    const fullLabel =
        "2.3 PRIMO DEMANDEUR (personne à la recherche de son premier emploi)";
    final s23q01Unit = units.firstWhere((u) => u.shortLabel == 'S23Q01');
    final s23q02Unit = units.firstWhere((u) => u.shortLabel == 'S23Q02');
    expect(s23q01Unit.subsectionLabel, fullLabel);
    expect(s23q02Unit.subsectionLabel, fullLabel);
  });

  testWidgets(
      'Desktop Excel shell: a short table (S21Q01) starts right under its '
      'header, not vertically centered in the leftover viewport height',
      (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = OnefopFormController(
      entityType: EntityType.enterprise,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final section = ctrl.schema!.sections.firstWhere((s) => s.id == 'section2');
    final pageIdx = ctrl.schema!.sections.indexOf(section);
    ctrl.goto(pageIdx, focus: false, scroll: false);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: ListenableBuilder(
            listenable: ctrl,
            builder: (context, _) => ExcelSectionBody(
              ctrl: ctrl,
              section: section,
              entityType: EntityType.enterprise,
              onPreviewSubmit: () async {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    final expandedFinder = find.ancestor(
      of: find.byType(SingleChildScrollView),
      matching: find.byType(Expanded),
    );
    final expandedTop = tester.getTopLeft(expandedFinder.first).dy;
    final scrollViewTop =
        tester.getTopLeft(find.byType(SingleChildScrollView).first).dy;

    // Before the topCenter fix this gap was ~195px (AnimatedSwitcher's
    // default Stack centered the short table inside the full Expanded
    // height); anchored to the top, it should be at most a couple of
    // pixels of transform/measurement slop.
    expect((scrollViewTop - expandedTop).abs(), lessThan(5));
  });
}
