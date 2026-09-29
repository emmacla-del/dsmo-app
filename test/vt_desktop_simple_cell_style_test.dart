// Regression coverage for the same rounded-cell bug as
// vt_spreadsheet_table_cell_style_test.dart, this time for
// _ExcelTextInput (onefop_excel_field_rows.dart) — the desktop Excel
// shell's plain text/number cell, used for every entity's non-table
// "simple field" grid rows (VT's own Section 1 identification fields
// included, e.g. "1.2 Name of VTC", "1.8 Village-Quarter"). Live-reported:
// these still showed the rounded pill look after VtSpreadsheetTable's own
// cells were fixed — same root cause (app_theme.dart's global
// InputDecorationTheme.enabledBorder), same missing override. Pumped
// under the app's REAL theme (not flutter_test's unstyled default, which
// wouldn't reproduce the bug at all) — see that file's own header comment
// for why.
//
// _ExcelTextInput is shared by every entity's desktop simple fields, not
// just VT's — this file checks both a VT section and a non-VT one, so a
// regression in either direction (VT still rounded, or the fix somehow
// breaking a non-VT entity's cells) would be caught.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/theme/app_theme.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<void> _pumpSectionUnderRealTheme(
  WidgetTester tester,
  EntityType entityType,
  String sectionId,
) async {
  tester.view.physicalSize = const Size(1920, 1080);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  addTearDown(ctrl.dispose);
  final section = ctrl.schema!.sections.firstWhere((s) => s.id == sectionId);

  await tester.pumpWidget(
    Builder(
      builder: (context) => MaterialApp(
        theme: AppTheme.lightTheme(context),
        locale: const Locale('fr'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          backgroundColor: kCanvas,
          body: ListenableBuilder(
            listenable: ctrl,
            builder: (_, __) => ExcelSectionBody(
              ctrl: ctrl,
              section: section,
              entityType: entityType,
              onPreviewSubmit: () async {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  // Flush any debounced revalidation timer (OnefopFormController.
  // _schedRevalidate) a field's own onFocusChange/onFieldChanged chain
  // may have scheduled — same "no pending timers" invariant every other
  // desktop-shell test in this suite already has to satisfy.
  await tester.pump(const Duration(seconds: 4));
}

void _expectAllSquare(WidgetTester tester) {
  final fields = tester.widgetList<TextField>(find.byType(TextField));
  expect(fields, isNotEmpty);
  for (final field in fields) {
    final d = field.decoration!;
    expect(d.border, InputBorder.none);
    expect(d.enabledBorder, InputBorder.none,
        reason: 'resting/unfocused state must not fall through to the '
            'theme\'s own rounded enabledBorder');
    expect(d.focusedBorder, InputBorder.none);
  }
}

void main() {
  testWidgets(
      'VT section1 (Identification — plain text/number fields, not a VT '
      'table) stays square under the app\'s real theme', (tester) async {
    await _pumpSectionUnderRealTheme(
        tester, EntityType.vocationalTraining, 'section1_vocationalTraining');
    _expectAllSquare(tester);
  });

  testWidgets(
      'non-VT entity (enterprise, section0) also stays square — the fix '
      'is shared and benefits every entity, not just VT', (tester) async {
    await _pumpSectionUnderRealTheme(tester, EntityType.enterprise, 'section0');
    _expectAllSquare(tester);
  });

  testWidgets(
      'a genuine non-VT TABLE (administration section2, S21Q01 — real '
      'TableRenderer/GridLayoutEngine cells, not the simple-fields grid) '
      'is already square under the real theme — shared/number_field.dart '
      'and shared/text_field.dart already set enabledBorder correctly, '
      'confirming ordinary ONEFOP tables never had this bug to begin with',
      (tester) async {
    await _pumpSectionUnderRealTheme(tester, EntityType.administration, 'section2');
    _expectAllSquare(tester);
  });
}
