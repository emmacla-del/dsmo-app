// Coverage for VtWizardProgressiveBooleanTableEntry (screens/onefop/
// wizard/vt_wizard_table_guided_entry.dart) — the guided-entry widget for
// 5.2's curriculum table (specialtyText + hasCurriculum + isApproved),
// the one VT table shape with free-text rows and boolean cells instead of
// number cells. Verifies: it actually renders for this shape instead of
// falling back to the grid, the isApproved radio group stays hidden until
// hasCurriculum is Oui (dependsOnKey), Ajouter persists a full row, and
// edit/delete round-trip correctly.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
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

Future<void> _pump(WidgetTester tester, OnefopFormController ctrl, def) async {
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
        body: SingleChildScrollView(
          child: VtWizardProgressiveBooleanTableEntry(ctrl: ctrl, def: def),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _settleAutosave(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 4));
}

void main() {
  final def = vtTableDefFor('vt_curriculum_table', const {'prefix': 's5q2'})!;

  testWidgets('5.2 curriculum table is recognized as a guided-entry shape', (tester) async {
    expect(vtWizardSupportsGuidedEntry(def), isTrue,
        reason: 'boolean-celled progressive tables should get their own guided widget now');
  });

  testWidgets('renders with no layout exception (empty)', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl, def);
    expect(tester.takeException(), isNull);
    expect(find.byType(VtWizardProgressiveBooleanTableEntry), findsOneWidget);
  });

  testWidgets('isApproved choice is hidden until hasCurriculum is answered Oui', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl, def);

    // One explicit Yes/No choice is visible before hasCurriculum=Oui.
    expect(find.text('Oui'), findsOneWidget);
    expect(find.text('Non'), findsOneWidget);

    await tester.tap(find.text('Oui'));
    await tester.pumpAndSettle();

    // hasCurriculum is now Oui, revealing a second explicit radio group.
    expect(find.text('Oui'), findsNWidgets(2));
    expect(find.text('Non'), findsNWidgets(2));
  });

  testWidgets('Ajouter persists specialty + both booleans, edit/delete round-trip', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pump(tester, ctrl, def);

    await tester.enterText(find.byType(TextField).first, 'Électricité');
    await tester.tap(find.text('Oui').first); // hasCurriculum -> Oui
    await tester.pumpAndSettle();
    await tester.tap(find.text('Oui').last); // isApproved -> Oui (now revealed)
    await tester.pumpAndSettle();

    await tester.tap(find.text('Ajouter'));
    await tester.pumpAndSettle();

    expect(ctrl.data['s5q2_row1_specialtyText'], 'Électricité');
    expect(ctrl.data['s5q2_row1_hasCurriculum'], true);
    expect(ctrl.data['s5q2_row1_isApproved'], true);
    expect(find.text('Électricité'), findsOneWidget);
    expect(find.text('Éditer'), findsOneWidget);
    expect(find.text('Supprimer'), findsOneWidget);

    await tester.tap(find.text('Supprimer'));
    await tester.pumpAndSettle();
    expect(ctrl.data['s5q2_row1_specialtyText'], isNull);
    expect(tester.takeException(), isNull);
    await _settleAutosave(tester);
  });
}
