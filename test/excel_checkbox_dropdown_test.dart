// Coverage for the checkbox-dropdown conversion: checkbox fields with 3+
// options render as a closed, single-line MenuAnchor dropdown instead of
// the old inline expanding checklist, whose own SingleChildScrollView
// fallback sat nested inside the page's outer scroll view (a reported
// nested-scroll trap — see ExcelValueCell.build()'s dispatch comment).
// Fields with 1-2 options are unaffected and still render the original
// inline widget.
//
// Also covers the setCheckboxValues regression this same change fixed:
// _ExcelCheckboxInput/_ExcelCheckboxDropdown used to write through
// ctrl.setRawValue, which (unlike setRadioValue/onSelectChanged) never
// reliably notified listeners or recomputed visibility — a live
// dependsOn/"contains" field (VT6_5 -> VT6_6) could go stale after the
// first checkbox edit. The dropdown regression test below drives the
// toggle through the real widget (not ctrl directly, unlike
// vt_contains_operator_test.dart's _setRaw helper) so it actually
// exercises the fixed code path end to end.
//
// pumpAndSettle (not a single pump) after every tap/key event that opens,
// closes, or changes MenuAnchor's overlay — MenuAnchor's own
// layout/positioning settles over more than one frame, confirmed
// empirically (a plain single pump left the closed control's summary one
// toggle behind).
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
  final section = ctrl.schema!.sections.firstWhere((s) => s.fieldIds.contains(fieldId));
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
  testWidgets('a 3-option checkbox field (VT2_25) renders the dropdown, '
      'not the inline checklist', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_25');

    expect(find.byType(MenuAnchor), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsNothing,
        reason: 'the dropdown never needs the nested-scroll fallback the '
            'old inline checklist did');
  });

  testWidgets('a 2-option checkbox field (VT2_18) still renders the '
      'original inline checklist', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_18');

    expect(find.byType(MenuAnchor), findsNothing);
  });

  testWidgets('closed control shows a placeholder, then a bounded summary '
      'as options are toggled through the menu', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_25');

    expect(find.text('— sélectionner —'), findsOneWidget);

    await tester.tap(find.byType(InkWell));
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNWidgets(3));

    await tester.tap(find.text('ENEO'));
    await tester.pumpAndSettle();
    // closeOnActivate: false — the menu must stay open across a toggle so
    // more than one option can be selected in one visit.
    expect(find.byType(MenuItemButton), findsNWidgets(3));
    expect(ctrl.data['VT2_25'], ['ENEO/ ENEO']);

    await tester.tap(find.text('Solaire'));
    await tester.pumpAndSettle();
    expect(ctrl.data['VT2_25'], ['ENEO/ ENEO', 'Solaire/ Solar']);
    expect(find.text('ENEO, Solaire'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'toggling VT6_5 to include Autres through the dropdown makes VT6_6 '
      'visible immediately, with no further interaction (setCheckboxValues '
      'regression)', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    final vt66 = ctrl.schema!.getField('VT6_6')!;
    expect(ctrl.isFieldVisible(vt66), isFalse);

    await _pumpCell(tester, ctrl, 'VT6_5');

    await tester.tap(find.byType(InkWell));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Autres'));
    await tester.pumpAndSettle();

    expect(ctrl.data['VT6_5'], contains('Autres/ Others'));
    expect(ctrl.isFieldVisible(vt66), isTrue);

    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets('keyboard: ArrowDown opens the closed control; Enter advances '
      'without leaving the menu open', (tester) async {
    final ctrl = await _controller(const {'VT2_23': 'Oui/ Yes'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_25');

    ctrl.fm.focus('VT2_25');
    await tester.pump();
    expect(find.byType(MenuItemButton), findsNothing);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNWidgets(3),
        reason: 'ArrowDown opens a closed combo box, the standard '
            'convention this widget follows');

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNothing,
        reason: 'Enter always closes and advances, never leaves the menu '
            'open behind it');
    expect(ctrl.fm.activeId, 'VT2_26');

    await tester.pump(const Duration(seconds: 1));
  });

  testWidgets(
      'ArrowDown while the menu is already open does not move ctrl.fm '
      'focus off the field — MenuAnchor owns arrow-key traversal between '
      'its own items once open', (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_25');

    ctrl.fm.focus('VT2_25');
    await tester.pump();
    await tester.tap(find.byType(InkWell));
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNWidgets(3));

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();

    expect(ctrl.fm.activeId, 'VT2_25');
    expect(find.byType(MenuItemButton), findsNWidgets(3),
        reason: 'still open — the menu was not accidentally closed by the '
            'arrow key either');
  });

  testWidgets('a 10-option field (VT3_2) opens without overflow/exception',
      (tester) async {
    final ctrl = await _controller(const {});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT3_2');

    expect(find.byType(MenuAnchor), findsOneWidget);
    await tester.tap(find.byType(InkWell));
    await tester.pumpAndSettle();
    expect(find.byType(MenuItemButton), findsNWidgets(10));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a 5-option field with longer French labels (VT2_27) renders '
      'as a dropdown too, at the same fixed row footprint', (tester) async {
    final ctrl = await _controller(const {'VT2_26': 'Oui/ Yes'});
    addTearDown(ctrl.dispose);
    await _pumpCell(tester, ctrl, 'VT2_27');

    expect(find.byType(MenuAnchor), findsOneWidget);
    expect(find.byType(SingleChildScrollView), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
