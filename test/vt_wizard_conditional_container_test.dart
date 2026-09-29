// Coverage for the generic "conditional reveal" container
// (screens/onefop/wizard/vt_wizard_section_screen.dart's
// _vtWizardDependentSubtree / _VtWizardConditionalContainer) — built to
// match Figma's now-consistent conditional-reveal pattern (reference
// example: node 11:1178's "Types de chocs" panel under 3.1). Verifies,
// against the real AST's own dependsOn chains (not fabricated ones):
// Section 3's VT3_1 -> VT3_2/VT3_3/VT3_5, with VT3_3's own further
// dependent VT3_4 folded into the same container; and Section 7's
// VT7_1 -> VT7_2..VT7_5. In both cases: dependents are absent when the
// trigger is unanswered/Non (section-level `.where(ctrl.isFieldVisible)`
// already excludes them), and present once the trigger is Oui.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_section_screen.dart';

Future<OnefopFormController> _controller(
    Map<String, dynamic> initialData) async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: initialData,
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

Future<void> _pump(
    WidgetTester tester, OnefopFormController ctrl, String sectionId) async {
  tester.view.physicalSize = const Size(1920, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final section = ctrl.schema!.getSection(sectionId)!;
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
            buildField: (f) => const SizedBox.shrink(),
            onBack: () {},
            onNext: () {},
            isFirst: false,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('Section 3 — VT3_1 conditional subtree', () {
    testWidgets('dependents absent when VT3_1 is unanswered', (tester) async {
      final ctrl = await _controller(const {});
      addTearDown(ctrl.dispose);
      await _pump(tester, ctrl, 'section3_vocationalTraining');
      expect(tester.takeException(), isNull);
      expect(find.textContaining('Attaque contre'), findsNothing);
      expect(find.textContaining('fermeture provisoire') /* label substring */,
          findsNothing);
    });

    testWidgets(
        'dependents (including the nested VT3_3 -> VT3_4 chain) appear when VT3_1 is Oui',
        (tester) async {
      final ctrl =
          await _controller(const {'VT3_1': 'Oui/ Yes', 'VT3_3': 'Oui/ Yes'});
      addTearDown(ctrl.dispose);
      await _pump(tester, ctrl, 'section3_vocationalTraining');
      expect(tester.takeException(), isNull);
      // VT3_2 (checkbox, direct dependent of VT3_1)
      expect(find.textContaining('Incendies'), findsOneWidget);
      // VT3_4 (number, dependent of VT3_3, which is itself a dependent of VT3_1)
      expect(find.textContaining('temps de fermeture'), findsOneWidget);
    });
  });

  group('Section 7 — VT7_1 conditional subtree', () {
    testWidgets(
        'the 4 HIV-rules sub-questions are absent when VT7_1 is unanswered',
        (tester) async {
      final ctrl = await _controller(const {});
      addTearDown(ctrl.dispose);
      await _pump(tester, ctrl, 'section7_vocationalTraining');
      expect(tester.takeException(), isNull);
      expect(find.textContaining('Sécurité physique'), findsNothing);
    });

    testWidgets('the 4 HIV-rules sub-questions appear when VT7_1 is Oui',
        (tester) async {
      final ctrl = await _controller(const {'VT7_1': 'Oui/ Yes'});
      addTearDown(ctrl.dispose);
      await _pump(tester, ctrl, 'section7_vocationalTraining');
      expect(tester.takeException(), isNull);
      // VT7_2-5 are now full questions rather than bare topic fragments
      // (see onefop_ast.dart's own comment on VT7_2) — match the phrase as
      // it actually appears mid-sentence in the current French labels.
      expect(find.textContaining('sécurité physique'), findsOneWidget);
      expect(find.textContaining('stigmatisation et la discrimination'),
          findsWidgets);
      expect(find.textContaining('harcèlement et les abus sexuels'),
          findsOneWidget);
    });
  });
}
