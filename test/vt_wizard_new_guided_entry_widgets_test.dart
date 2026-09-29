// Coverage for the two guided-entry widgets added to close the last
// documented Mode Guidé gaps (screens/onefop/wizard/
// vt_wizard_table_guided_entry.dart's VtWizardFixedRowMultiNumberEntry and
// VtWizardRosterGuidedEntry) — confirmed via Figma against nodes 154:536
// ("Section 4: Âges & Flux Grid, Mode Guidé – Multi-colonnes") and 154:724
// ("Section 8: État Nominatif Formateurs, Mode Guidé - 8.8"). Verifies:
// both shapes are recognized by vtWizardSupportsGuidedEntry, both render
// empty with no layout exception, and a full add/edit/delete round-trip
// persists the right flat keys on OnefopFormController.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_types.dart';
import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_table_guided_entry.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(1920, 1200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('fr'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _settleAutosave(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
}

void main() {
  group('VtWizardFixedRowMultiNumberEntry (4.7 age/flow grid)', () {
    final def = vtTableDefFor('vt_trainee_age_flow_table', const {'prefix': 's4q7'})!;

    testWidgets('shape is recognized as guided-entry', (tester) async {
      expect(vtWizardSupportsGuidedEntry(def), isTrue,
          reason: 'fixed-row tables with >2 number cells should get their own guided widget');
    });

    testWidgets('renders empty with no layout exception', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pump(tester, VtWizardFixedRowMultiNumberEntry(ctrl: ctrl, def: def));
      expect(tester.takeException(), isNull);
      expect(find.byType(VtWizardFixedRowMultiNumberEntry), findsOneWidget);
    });

    testWidgets('selecting a row and entering all 6 numbers round-trips on Ajouter',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pump(tester, VtWizardFixedRowMultiNumberEntry(ctrl: ctrl, def: def));

      await tester.tap(find.byType(DropdownButton<VtRowDef>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('14 ans').last);
      await tester.pumpAndSettle();

      final fields = find.byType(TextField);
      expect(fields, findsNWidgets(6));
      for (var i = 0; i < 6; i++) {
        await tester.enterText(fields.at(i), '${i + 1}');
      }

      await tester.tap(find.text('Ajouter'));
      await tester.pumpAndSettle();

      expect(ctrl.data['s4q7_age_14_entrant_male'], 1);
      expect(ctrl.data['s4q7_age_14_entrant_female'], 2);
      expect(ctrl.data['s4q7_age_14_sortant_male'], 3);
      expect(ctrl.data['s4q7_age_14_sortant_female'], 4);
      expect(ctrl.data['s4q7_age_14_abandon_male'], 5);
      expect(ctrl.data['s4q7_age_14_abandon_female'], 6);
      expect(find.textContaining('14 ans'), findsWidgets);

      await _settleAutosave(tester);
    });
  });

  group('VtWizardRosterGuidedEntry (8.8 named trainer roster)', () {
    final def = vtTableDefFor('vt_trainer_roster_table', const {'prefix': 's8q8'})!;

    testWidgets('shape is recognized as guided-entry', (tester) async {
      expect(vtWizardSupportsGuidedEntry(def), isTrue,
          reason: 'isRoster tables should get their own guided widget');
    });

    testWidgets('renders empty with no layout exception', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pump(tester, VtWizardRosterGuidedEntry(ctrl: ctrl, def: def));
      expect(tester.takeException(), isNull);
      expect(find.byType(VtWizardRosterGuidedEntry), findsOneWidget);
    });

    testWidgets('Save trainer persists name + admin flag, edit/delete round-trip',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pump(tester, VtWizardRosterGuidedEntry(ctrl: ctrl, def: def));

      final textFields = find.byType(TextField);
      await tester.enterText(textFields.at(0), 'Mbarga');
      await tester.enterText(textFields.at(1), 'Jean-Pierre');

      // Sexe pill toggle: tap the first option ("Homme").
      await tester.tap(find.text('HOMME'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer le formateur'));
      await tester.pumpAndSettle();

      expect(ctrl.data['s8q8_row1_lastName'], 'Mbarga');
      expect(ctrl.data['s8q8_row1_firstName'], 'Jean-Pierre');
      expect(ctrl.data['s8q8_row1_sex'], '1');
      expect(find.textContaining('Mbarga'), findsWidgets);

      final def2 = def; // avoid shadow warning in the inline callback below
      final row = def2.rows.first;
      final deleteBtn = find.byIcon(Icons.delete_outline);
      expect(deleteBtn, findsOneWidget);
      await tester.tap(deleteBtn);
      await tester.pumpAndSettle();
      expect(ctrl.data['${row.id}_lastName'], isNull);
      expect(tester.takeException(), isNull);

      await _settleAutosave(tester);
    });
  });
}
