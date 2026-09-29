// Regression coverage for VTC's document-style section workspace. Ordinary
// sections expose all related groups in one vertical form; the outline is a
// scroll aid, not a mini-page switcher. Dense table sections keep their
// separate tab pattern in vt_wizard_section_screen.dart.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_section_screen.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pumpSection(
  WidgetTester tester,
  OnefopFormController ctrl,
  String sectionId, {
  required VoidCallback onNext,
}) async {
  final section = ctrl.schema!.getSection(sectionId)!;
  tester.view.physicalSize = const Size(1920, 3600);
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
          child: VtWizardSectionScreen(
            ctrl: ctrl,
            section: section,
            buildField: (_) => const SizedBox.shrink(),
            onBack: () {},
            onNext: onNext,
            isFirst: false,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Section 2 keeps its groups in one scrollable workspace',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpSection(tester, ctrl, 'section2_vocationalTraining', onNext: () {});

    // A later group is mounted alongside the section's opening groups
    // rather than being hidden in a future mini-page. The outer
    // SingleChildScrollView owns scrolling. VT2_1-22's own fine groups
    // (Figma node 6:4431, "Informations Générales") replaced the single
    // flat "2.1 Renseignements généraux" AST heading — see
    // _kVtSection2FineGroups's own doc comment.
    expect(find.textContaining('Conventions, Sites et Infrastructures'), findsWidgets);
    expect(find.textContaining('ÉLECTRICITÉ'), findsWidgets);
    expect(find.textContaining('PROGRAMMES & POLITIQUES DE PROTECTION'), findsWidgets);
    expect(find.textContaining("Nombre total d'apprenants dans votre centre"), findsOneWidget);
    // The section outline is supplied to the shell task rail, leaving this
    // standalone workspace free to use its full width.
    expect(find.text('PLAN DE LA SECTION'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('section continuation advances once, not once per group',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    var nextCalls = 0;
    await _pumpSection(
      tester,
      ctrl,
      'section9_vocationalTraining',
      onNext: () => nextCalls++,
    );

    expect(find.textContaining('DIFFICULTÉS'), findsWidgets);
    expect(find.textContaining('9.2 CINQ PRINCIPALES PERSPECTIVES'), findsWidgets);
    expect(find.byType(VtWizardSignaturesCard), findsOneWidget);

    await tester.tap(find.text('Suivant'));
    await tester.pump();
    expect(nextCalls, 1);
  });
}
