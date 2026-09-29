// Coverage for the VT Wizard respecting the app's active locale.
//
// Every wizard field-content widget used to always show French bold +
// "(English)" gloss regardless of context.loc, a deliberate departure
// from the rest of the app's own locale.of(...) single-language pattern
// (matching Figma's own always-bilingual mockup). Per explicit request to
// localize the wizard, every field label/option now resolves through
// FieldSchema.label/LocalizedOption.text's own .of(locale) instead —
// this asserts the two locales genuinely produce different, single-
// language output rather than both showing the same bilingual string.
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

Future<void> _pumpSection1(WidgetTester tester, OnefopFormController ctrl, Locale locale) async {
  final section = ctrl.schema!.getSection('section1_vocationalTraining')!;
  tester.view.physicalSize = const Size(1920, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: locale,
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
            isFirst: true,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  // Section 1 auto-focuses its first field on mount, which fires a
  // spurious TextEditingController selection-change notification and
  // triggers an immediate _doAS() save (schedAS's first-ever-request
  // branch, not the 3s debounce _asTimer) — _doAS's own internal
  // `Future.delayed(600ms)` isn't something flushPendingSave() cancels
  // (that only cancels _asTimer), and pumpAndSettle() alone doesn't
  // reliably advance fake time far enough to resolve it. Advance past it
  // explicitly so the test doesn't leave a dangling Timer behind.
  await tester.pump(const Duration(milliseconds: 700));
}

void main() {
  testWidgets('French locale shows only French field labels', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpSection1(tester, ctrl, const Locale('fr'));
    expect(tester.takeException(), isNull);

    expect(find.textContaining('Code de la Structure'), findsOneWidget);
    expect(find.textContaining('Structure Code'), findsNothing);
    expect(find.textContaining('Nom du CFP'), findsOneWidget);
    expect(find.textContaining('Name of VTC'), findsNothing);
  });

  testWidgets('English locale shows only English field labels', (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpSection1(tester, ctrl, const Locale('en'));
    expect(tester.takeException(), isNull);

    expect(find.textContaining('Structure Code'), findsOneWidget);
    expect(find.textContaining('Code de la Structure'), findsNothing);
    expect(find.textContaining('Name of VTC'), findsOneWidget);
    expect(find.textContaining('Nom du CFP'), findsNothing);
  });
}
