// Coverage for the app-wide migration from YesNoToggle to standard
// RadioOption: every Oui/Non 2-option radio field, app-wide, now renders
// as a plain RadioOption row (native circle icon + text label, no
// border/pill/dropdown). The old YesNoToggle widget and its associated
// isYesNoRadioField() helper have been deleted. All yes/no questions are
// standard radio buttons.
//
// This file was formerly vt_yes_no_toggle_test.dart and tested the
// YesNoToggle widget. It now verifies the RadioOption replacement:
// -- RadioField (mobile + Simple Mode): ADMIN_S1Q09 renders two RadioOptions,
//    not YesNoToggle, and 3-option VT1_10 keeps RadioOptions untouched.
// -- Desktop Excel shell: ADMIN_S1Q09 renders RadioOptions inline (not a
//    dropdown), and VT1_10 (3 options) keeps the dropdown.
// -- VT grid-table row editor: opening a row with a boolean cell shows
//    RadioOptions for the Oui/Non choice.
//
// NOTE: isYesNoRadioField() no longer exists as a public function. The
// Oui/Non detection is done inline in RadioField/_ExcelSelectInput/
// VtWizardRadioGroup using a local opts check -- no separate helper to test.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_row_editor.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/excel/onefop_excel_field_rows.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart';

Future<OnefopFormController> _controller(EntityType entityType) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(backgroundColor: kCanvas, body: child),
    ),
  );
  await tester.pump();
}

void main() {
  group('RadioField (mobile + Simple Mode)', () {
    testWidgets(
        'ADMIN_S1Q09 (Oui/Non) renders two RadioOptions -- one for Oui, one for Non',
        (tester) async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);
      final field = ctrl.schema!.fields.firstWhere((f) => f.id == 'ADMIN_S1Q09');

      await _pump(tester, RadioField(ctrl: ctrl, field: field));

      expect(find.byType(RadioOption), findsNWidgets(2));
      expect(find.text('Oui'), findsOneWidget);
      expect(find.text('Non'), findsOneWidget);
    });

    testWidgets('tapping Non on ADMIN_S1Q09 sets the field value to Non/ No',
        (tester) async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);
      final field = ctrl.schema!.fields.firstWhere((f) => f.id == 'ADMIN_S1Q09');

      await _pump(
        tester,
        ListenableBuilder(
          listenable: ctrl,
          builder: (_, __) => RadioField(ctrl: ctrl, field: field),
        ),
      );

      await tester.tap(find.text('Non'));
      await tester.pump();

      expect(ctrl.data['ADMIN_S1Q09'], 'Non/ No');
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('VT1_10 (3-option radio) renders RadioOption widgets',
        (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      final field = ctrl.schema!.fields.firstWhere((f) => f.id == 'VT1_10');

      await _pump(tester, RadioField(ctrl: ctrl, field: field));

      expect(find.byType(RadioOption), findsWidgets);
    });
  });

  group('Desktop Excel shell simple-field cell', () {
    testWidgets(
        'ADMIN_S1Q09 (Oui/Non) renders inline RadioOptions, not a dropdown',
        (tester) async {
      final ctrl = await _controller(EntityType.administration);
      addTearDown(ctrl.dispose);
      final field = ctrl.schema!.fields.firstWhere((f) => f.id == 'ADMIN_S1Q09');

      await _pump(tester, ExcelValueCell(ctrl: ctrl, field: field));

      expect(find.byType(RadioOption), findsNWidgets(2));
      expect(find.byType(DropdownButton<String>), findsNothing);
    });

    testWidgets('VT1_10 (3-option radio) renders inline RadioOptions (not a dropdown)', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      final field = ctrl.schema!.fields.firstWhere((f) => f.id == 'VT1_10');

      await _pump(tester, ExcelValueCell(ctrl: ctrl, field: field));

      // 3-option fields are in the "short radio" range (2-3 options) and
      // render as inline RadioOption widgets, not a dropdown.
      expect(find.byType(RadioOption), findsNWidgets(3));
      expect(find.byType(DropdownButton<String>), findsNothing);
    });
  });

  group('VT grid-table row editor (VtCellKind.boolean)', () {
    testWidgets('a boolean cell in an opened row renders RadioOption widgets', (tester) async {
      final ctrl = await _controller(EntityType.vocationalTraining);
      addTearDown(ctrl.dispose);
      final def = vtCurriculumTableDef(prefix: 's5q2', paperCode: 'S5Q2');

      tester.view.physicalSize = const Size(1200, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pump(tester, VtRowEditor(ctrl: ctrl, def: def));
      // First row reads "Ligne 1" (fr) -- see VtRowEditor._rowTile.
      await tester.tap(find.text('Ligne 1'));
      await tester.pumpAndSettle();

      // Only hasCurriculum renders here (isApproved gated behind it).
      // hasCurriculum is VtCellKind.boolean => two RadioOptions (Oui + Non).
      expect(find.byType(RadioOption), findsWidgets);
      expect(find.text('Oui'), findsOneWidget);
      expect(find.text('Non'), findsOneWidget);
    });
  });
}
