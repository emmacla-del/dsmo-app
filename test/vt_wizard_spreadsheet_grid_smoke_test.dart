// Smoke coverage for VtWizardSpreadsheetGrid (screens/onefop/wizard/
// vt_wizard_spreadsheet_grid.dart) — the VT Wizard's own "Mode Tableur"
// grid, pixel-matched against Figma's excel-grid node rather than reusing
// Excel Mode's VtSpreadsheetTable (see that file's own header comment).
// Mirrors vt_spreadsheet_table_smoke_test.dart's approach: pump every
// wired VtTableDef at a desktop width and assert no render exception — a
// class of bug column-width guesses are prone to (Table's fixed column
// widths are just as capable of clipping a YesNoToggle-shaped boolean
// chip or a wide radioCode dropdown as GridLayoutEngine's were).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_spreadsheet_grid.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpAtDesktopWidth(
    WidgetTester tester, OnefopFormController ctrl, VtTableDef def) async {
  tester.view.physicalSize = const Size(1920, 1080);
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
        body: SingleChildScrollView(
          child: VtWizardSpreadsheetGrid(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Every mutation schedules a debounced autosave timer — flush it before
/// the test ends, same as vt_spreadsheet_table_smoke_test.dart's own.
Future<void> _settleAutosave(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
}

void main() {
  // Same (template, prefix, paperCode) list vt_spreadsheet_table_smoke_
  // test.dart uses — every entry vtTableDefFor's switch resolves.
  const wired = [
    ('vt_diploma_table', 's4q1', '4.1'),
    ('vt_diploma_table', 's4q2', '4.2'),
    ('vt_diploma_table', 's8q1', '8.1'),
    ('vt_diploma_table', 's8q2', '8.2'),
    ('vt_specialty_fi_fc_table', 's4q3', '4.3'),
    ('vt_specialty_fi_fc_table', 's4q4', '4.4'),
    ('vt_specialty_fi_fc_table', 's4q5', '4.5'),
    ('vt_specialty_fi_fc_table', 's8q4', '8.4'),
    ('vt_specialty_year_table', 's4q6', '4.6'),
    ('vt_trainee_age_flow_table', 's4q7', '4.7'),
    ('vt_education_level_flow_table', 's4q8', '4.8'),
    ('vt_vulnerable_table', 's4q9', '4.9'),
    ('vt_specialty_gender_total_table', 's4q10', '4.10'),
    ('vt_scholarship_table', 's4q11', '4.11'),
    ('vt_curriculum_table', 's5q2', '5.2'),
    ('vt_infrastructure_table', 's5q3', '5.3'),
    ('vt_furniture_table', 's5q4', '5.4'),
    ('vt_specialty_gender_total_table', 's6q3', '6.3'),
    ('vt_trainer_age_table', 's8q3', '8.3'),
    ('vt_trainer_disability_table', 's8q6', '8.6'),
    ('vt_specialty_fi_fc_count_table', 's8q7', '8.7'),
    ('vt_trainer_roster_table', 's8q8', '8.8'),
  ];

  for (final (template, prefix, paperCode) in wired) {
    testWidgets('$paperCode $template renders with no layout exception (empty)', (tester) async {
      final def = vtTableDefFor(template, {'prefix': prefix});
      expect(def, isNotNull, reason: '$template/$prefix should be wired in vtTableDefFor');
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pumpAtDesktopWidth(tester, ctrl, def!);
      expect(tester.takeException(), isNull);
      expect(find.byType(VtWizardSpreadsheetGrid), findsOneWidget);
    });
  }

  testWidgets('4.1 diploma table: typing a number round-trips into ctrl.data', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAtDesktopWidth(tester, ctrl, def);

    const id = 's4q1_doctorat_male';
    await tester.enterText(find.byType(TextField).first, '7');
    await tester.pumpAndSettle();
    expect(ctrl.data[id], 7);
    expect(tester.takeException(), isNull);
    await _settleAutosave(tester);
  });

  testWidgets('4.1 diploma table: filled row shows a completion checkmark', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    ctrl.onGridCellChanged('s4q1_doctorat_male', 3);
    ctrl.onGridCellChanged('s4q1_doctorat_female', 1);
    await _pumpAtDesktopWidth(tester, ctrl, def);

    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    await _settleAutosave(tester);
  });

  testWidgets('4.1 diploma table: Σ TOTAL footer sums a filled column', (tester) async {
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    ctrl.onGridCellChanged('s4q1_doctorat_male', 3);
    ctrl.onGridCellChanged('s4q1_master2_male', 4);
    await _pumpAtDesktopWidth(tester, ctrl, def);

    expect(find.text('7'), findsOneWidget);
    await _settleAutosave(tester);
  });

  testWidgets('8.8 roster: typing a name round-trips and the roster reveal rule still applies',
      (tester) async {
    final def = vtTrainerRosterTableDef;
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpAtDesktopWidth(tester, ctrl, def);

    // Only one blank row visible to start (isRoster reveal rule).
    expect(find.text('Ligne 2'), findsNothing);

    ctrl.setRawValue('s8q8_row1_lastName', 'Mbarga');
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    // Typing into row 1 reveals row 2's blank slot.
    expect(find.text('Ligne 2'), findsOneWidget);
    await _settleAutosave(tester);
  });
}
