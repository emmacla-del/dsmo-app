// Coverage for a live UX request: "let all the options for the
// conditional yes be hidden, they should show only when the user
// choses yes." An app-wide audit found every AST-level dependsOn/
// dependsValue field (the ~28 conditional follow-up questions across
// Administration/VT, since reformulated from paper-style "Si oui, ..."
// phrasing to direct questions) was already correctly gated — the one
// real gap was
// inside VT's own grid-table row editor (vt_row_editor.dart): VtCellDef
// had no conditional-visibility mechanism at all, so 5.2's `isApproved`
// ("Le référentiel est-il homologué ?") always showed in a row's sheet
// even before `hasCurriculum` ("Existence d'un référentiel de
// formation") had been answered Oui — a question that makes no sense to
// ask yet. Fixed with VtCellDef.dependsOnKey (mirrors the AST's
// dependsOn/dependsValue pattern) and vtCellVisible(), used by both the
// row sheet (vt_row_editor.dart's _cellField loop) and the desktop-only
// secondary summary line (VtRowEditor._secondarySummary).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

const _hasCurriculumLabel = "Existence d'un référentiel de formation";
const _isApprovedLabel = 'Le référentiel est-il homologué ?';

Future<OnefopFormController> _controller(Map<String, dynamic> initialData) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpAndOpenRow1(WidgetTester tester, OnefopFormController ctrl) async {
  final def = vtCurriculumTableDef(prefix: 's5q2', paperCode: 'S5Q2');
  tester.view.physicalSize = const Size(1200, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        backgroundColor: kCanvas,
        body: VtRowEditor(ctrl: ctrl, def: def),
      ),
    ),
  );
  await tester.pump();
  await tester.tap(find.text('Ligne 1'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('isApproved hidden when hasCurriculum has never been answered', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow1(tester, ctrl);

    expect(find.text(_hasCurriculumLabel), findsOneWidget);
    expect(find.text(_isApprovedLabel), findsNothing);
  });

  testWidgets('isApproved hidden when hasCurriculum = Non', (tester) async {
    final ctrl = await _controller(const {'s5q2_row1_hasCurriculum': false});
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow1(tester, ctrl);

    expect(find.text(_isApprovedLabel), findsNothing);
  });

  testWidgets('isApproved shown once hasCurriculum = Oui', (tester) async {
    final ctrl = await _controller(const {'s5q2_row1_hasCurriculum': true});
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow1(tester, ctrl);

    expect(find.text(_isApprovedLabel), findsOneWidget);
  });

  testWidgets('toggling hasCurriculum to Oui inside the open sheet reveals isApproved live',
      (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpAndOpenRow1(tester, ctrl);

    expect(find.text(_isApprovedLabel), findsNothing);

    // hasCurriculum's own YesNoToggle "Oui" — the first (only) one open in
    // the sheet at this point, since isApproved's is not rendered yet.
    await tester.tap(find.text('Oui').first);
    await tester.pumpAndSettle();

    expect(find.text(_isApprovedLabel), findsOneWidget);
  });

  testWidgets(
      'switching hasCurriculum back to Non hides isApproved again, and the desktop '
      'secondary summary never shows a stale isApproved value', (tester) async {
    final ctrl = await _controller(const {
      's5q2_row1_specialtyText': 'Menuiserie',
      's5q2_row1_hasCurriculum': true,
      's5q2_row1_isApproved': true,
    });
    addTearDown(ctrl.dispose);
    final def = vtCurriculumTableDef(prefix: 's5q2', paperCode: 'S5Q2');

    tester.view.physicalSize = const Size(1200, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: VtRowEditor(ctrl: ctrl, def: def),
        ),
      ),
    );
    await tester.pump();

    // Both booleans start Oui — the desktop secondary summary line shows
    // isApproved's "Oui" alongside hasCurriculum's.
    expect(find.textContaining('Le référentiel est-il homologué'), findsOneWidget);

    await tester.tap(find.text('Menuiserie'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Non').first); // hasCurriculum -> Non
    await tester.pumpAndSettle();
    expect(find.text(_isApprovedLabel), findsNothing);

    // Dismiss the sheet by tapping the modal barrier, well outside the
    // sheet's own 560px-capped content column on this 1200px-wide surface.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    // Back on the row list — the summary line must not still claim an
    // approval answer that is no longer a visible/answerable question.
    expect(find.textContaining('Le référentiel est-il homologué'), findsNothing);
  });
}
