// Coverage for a live request: pressing Enter on a Yes/No or checkbox
// cell in the desktop Excel shell should advance to the next visible
// cell (respecting dependsOn/dependsValue), and landing on a fresh
// (unanswered) Yes/No cell should default to Non — the user can still
// change it to Oui — instead of sitting blank.
//
// Non, not Oui: a conditional follow-up's dependsValue is virtually
// always "Oui/ Yes" throughout this AST, so defaulting to Oui meant
// merely tabbing past an unanswered row (not actually answering it) could
// auto-reveal its conditional fields — reported live as conditional
// exposure firing in bulk instead of per row. Non never triggers a
// dependsValue match, so a row's own conditional follow-up now only ever
// appears from an explicit Oui click on that row.
//
// Uses VT2_23/24/25/26 (real fields, VT2's own "2.2 Informations sur les
// autres équipements..." subsection — the exact table this was reported
// against): VT2_23 "Is there a source of energy?" (Oui/Non) gates VT2_24
// (Oui/Non, "Is this energy source functional?") and VT2_25 (checkbox,
// "Specify the source of energy") — both dependsOn VT2_23 = Oui/ Yes.
// VT2_26 ("water source")
// is the next unconditional field after them.
//
// The conditional-logic-aware advancement itself (part 3 of the request)
// was already correct before this change — ctrl.focusFieldOffset walks
// computeVisibleFieldIds, already isFieldVisible-filtered. What was
// actually missing was any Focus/FocusNode wiring on these two cell
// types at all (confirmed by grep before writing this fix — neither
// YesNoToggle nor _ExcelCheckboxInput registered with ctrl.fm), which is
// what these tests exercise.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _controller(Map<String, dynamic> initialData) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpCell(WidgetTester tester, OnefopFormController ctrl, String fieldId) async {
  final field = ctrl.schema!.getField(fieldId)!;
  // focusFieldOffset walks computeVisibleFieldIds(), which reads the
  // *current page*'s own section — without navigating there first, it
  // silently operates on whatever page 0 happens to be (never containing
  // this VT2 field at all), so Enter-driven advancement would never find
  // a match.
  final section = ctrl.schema!.sections
      .firstWhere((s) => s.fieldIds.contains(fieldId));
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
          builder: (context, _) => ExcelValueCell(ctrl: ctrl, field: field),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('unanswered Yes/No cell defaults to Non on focus arrival',
      (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_23');

    expect(ctrl.data['VT2_23'], isNull);
    ctrl.fm.focus('VT2_23');
    await tester.pump();

    expect(ctrl.data['VT2_23'], 'Non/ No');
    // Non never matches a dependsValue ("Oui/ Yes" throughout this AST),
    // so mere arrival must not reveal VT2_23's own conditional follow-ups.
    expect(ctrl.isFieldVisible(ctrl.schema!.getField('VT2_24')!), isFalse);
    expect(ctrl.isFieldVisible(ctrl.schema!.getField('VT2_25')!), isFalse);

    // Flush the autosave Timer the default-to-Non write just scheduled
    // (OnefopFormController.setRadioValue → _schedRevalidate), same as
    // every other screenshot/interaction test in this suite — otherwise
    // teardown trips the pending-timer assertion.
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'an already-answered Yes/No cell (Oui) is not clobbered by arrival',
      (tester) async {
    final ctrl = await _controller(const {'VT2_23': 'Oui/ Yes'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_23');

    ctrl.fm.focus('VT2_23');
    await tester.pump();

    expect(ctrl.data['VT2_23'], 'Oui/ Yes');
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'an already-answered Yes/No cell (Non) is not clobbered by arrival',
      (tester) async {
    final ctrl = await _controller(const {'VT2_23': 'Non/ No'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_23');

    ctrl.fm.focus('VT2_23');
    await tester.pump();

    expect(ctrl.data['VT2_23'], 'Non/ No');
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'Enter on a Yes/No cell advances, skipping fields hidden by '
      'dependsOn', (tester) async {
    // VT2_23 = Non → VT2_24/VT2_25 (both dependsOn VT2_23 = Oui) stay
    // hidden, so Enter should land straight on VT2_26.
    final ctrl = await _controller(const {'VT2_23': 'Non/ No'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_23');

    ctrl.fm.focus('VT2_23');
    await tester.pump();
    expect(ctrl.fm.activeId, 'VT2_23');

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(ctrl.fm.activeId, 'VT2_26');
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'Enter on a Yes/No cell answered Oui advances to the very next '
      'field (its own conditional follow-up), not past it',
      (tester) async {
    final ctrl = await _controller(const {'VT2_23': 'Oui/ Yes'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_23');

    ctrl.fm.focus('VT2_23');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(ctrl.fm.activeId, 'VT2_24');
    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'Enter on a checkbox cell advances too, with no default-value side '
      'effect', (tester) async {
    final ctrl = await _controller(const {'VT2_23': 'Oui/ Yes'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_25');

    ctrl.fm.focus('VT2_25');
    await tester.pump();
    // No onFocusChange default for a multi-select checkbox — arrival
    // alone must not write anything.
    expect(ctrl.data['VT2_25'], isNull);

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();

    expect(ctrl.fm.activeId, 'VT2_26');
    expect(ctrl.data['VT2_25'], isNull);
    await tester.pump(const Duration(seconds: 1));
  });
}
