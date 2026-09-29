// Regression coverage for a live UI report: VT desktop table cells
// rendered as rounded/pill-shaped input controls instead of plain
// spreadsheet cells. Root cause: the app's global ThemeData
// (core/theme/app_theme.dart) sets its own `enabledBorder` — a rounded
// OutlineInputBorder(radius 8) — on InputDecorationTheme.
// VtSpreadsheetTable's own cells (_numberCell/_textCell) only ever
// overrode `border` and `focusedBorder` to InputBorder.none;
// InputDecoration.applyDefaults only fills in whichever specific border
// variant is still null from the ambient theme, so the *resting*
// (enabled, unfocused) state — what a cell shows almost all the time —
// fell through to that rounded theme default. This file pumps
// VtSpreadsheetTable under the app's REAL theme (not flutter_test's
// unstyled MaterialApp default, which wouldn't reproduce the bug at all)
// and asserts every border variant a cell can actually be in is
// InputBorder.none.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_spreadsheet_table.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/core/theme/app_theme.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

void main() {
  testWidgets(
      'VtSpreadsheetTable number/text cells stay square under the app\'s '
      'real theme — enabledBorder (the resting state) is InputBorder.none, '
      'not the theme\'s own rounded default', (tester) async {
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final ctrl = OnefopFormController(
      entityType: EntityType.vocationalTraining,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final def = vtTableDefFor('vt_diploma_table', {'prefix': 's4q1'})!;

    await tester.pumpWidget(
      Builder(
        builder: (context) => MaterialApp(
          theme: AppTheme.lightTheme(context),
          locale: const Locale('fr'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            backgroundColor: kCanvas,
            body: SingleChildScrollView(child: VtSpreadsheetTable(ctrl: ctrl, def: def)),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final fields = tester.widgetList<TextField>(find.byType(TextField));
    expect(fields, isNotEmpty);
    for (final field in fields) {
      final d = field.decoration!;
      expect(d.border, InputBorder.none);
      expect(d.enabledBorder, InputBorder.none,
          reason: 'the resting/unfocused state — what a cell shows almost '
              'all the time — must not fall through to the theme\'s own '
              'rounded enabledBorder');
      expect(d.focusedBorder, InputBorder.none);
    }
  });
}
