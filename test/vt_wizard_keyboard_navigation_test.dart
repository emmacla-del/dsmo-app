// Coverage for keyboard navigation in VT Wizard mode — "field to field,
// question to question, subsection to subsection" via Tab/Shift+Tab,
// arrow keys, and Enter.
//
// Wizard field types previously had no Focus widget attached to their
// shared FocusNode at all (only VtWizardTextField/VtWizardNumberStepperField
// got real keyboard focus for free through Flutter's own TextField
// internals) — vtWizardFocusable in vt_wizard_fields.dart fixes that.
// Separately, OnefopFormController.focusFieldOffset walks the WHOLE
// section's field list regardless of the wizard's own pagination unless
// scoped via setRevealedFieldIds/setRevealBoundaryActions (the same
// mechanism Simple Mode's conditional-reveal units already use) — without
// that, Tab could try to focus a field from a step that isn't even built.
// VtWizardSectionScreen.build() now calls both every build.
//
// Section 9 (2 steps: VT9_1-3 on step 1, VT9_4 on step 2, signatures card
// on step 2 too) is used here since it's small and its step-1 trigger
// field (VT9_1) is itself a Yes/No toggle — letting one test exercise both
// "a toggle can receive keyboard focus and arrow keys change its value"
// and "Tab from the only field on a step crosses the step boundary" in a
// single, minimal fixture.
//
// Any radio/text change here schedules a debounce Timer (revalidate,
// ~300ms; autosave, ~600ms) that pumpAndSettle() does NOT wait out (it
// only drains frame/animation callbacks, not arbitrary Timers) — each
// interaction below is followed by an explicit
// `tester.pump(const Duration(milliseconds: 700))` to flush those within
// the test's fake-time zone, matching the pattern vt_wizard_save_toast_
// test.dart already uses for its own timer-driven behavior.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

Future<int> _pumpSection9(
  WidgetTester tester,
  OnefopFormController ctrl, {
  required VoidCallback onNextCalled,
}) async {
  final section = ctrl.schema!.getSection('section9_vocationalTraining')!;
  tester.view.physicalSize = const Size(1920, 2400);
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
            buildField: (f) => const SizedBox.shrink(),
            onBack: () {},
            onNext: onNextCalled,
            isFirst: false,
            isLast: true,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return 0;
}

Future<int> _pumpSection3(
    WidgetTester tester, OnefopFormController ctrl) async {
  final section = ctrl.schema!.getSection('section3_vocationalTraining')!;
  tester.view.physicalSize = const Size(1920, 2400);
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
          // OnefopUnifiedFormScreenV4 rebuilds its whole subtree on
          // ctrl.addListener(() => setState(() {})) in the real app —
          // VtWizardSectionScreen itself has no such listener of its own
          // (only individual fields do, via their own FocusNode/data
          // ListenableBuilders), so a bare pump of just this widget never
          // sees a conditional-reveal's newly-visible fields after an
          // interactive change. Reproduce that same outer rebuild here.
          child: AnimatedBuilder(
            animation: ctrl,
            builder: (context, _) => VtWizardSectionScreen(
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
    ),
  );
  await tester.pumpAndSettle();
  return 0;
}

void main() {
  testWidgets(
      'VT9_1 toggle receives keyboard focus and arrow keys set its value',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpSection9(tester, ctrl, onNextCalled: () {});
    expect(tester.takeException(), isNull);

    expect(ctrl.data['VT9_1'], isNull);

    ctrl.fm.focus('VT9_1');
    await tester.pump();
    expect(ctrl.fm.getNode('VT9_1').hasFocus, isTrue);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
    await tester.pump(const Duration(milliseconds: 700));
    expect(ctrl.data['VT9_1'], 'Oui/ Yes');
  });

  testWidgets('Tab from the last field of a step crosses into the next step',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    await _pumpSection9(tester, ctrl, onNextCalled: () {});
    expect(tester.takeException(), isNull);

    // With VT9_1 unanswered, VT9_2/VT9_3 (dependsOn VT9_1=Oui) stay
    // hidden, so VT9_1 is the only field revealed in the active block
    // ("Difficultés", VT9_1-3's block heading).
    expect(find.textContaining('DIFFICULTÉS'), findsOneWidget);

    ctrl.fm.focus('VT9_1');
    await tester.pump();

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump(const Duration(milliseconds: 700));

    // Crossed into the next block (VT9_4's own real AST subsection,
    // "9.2 Cinq principales perspectives").
    expect(find.textContaining('PERSPECTIVES'), findsOneWidget);
  });

  testWidgets('Tab from the last field of the last step calls onNext',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    var nextCalls = 0;
    await _pumpSection9(tester, ctrl, onNextCalled: () => nextCalls++);
    expect(tester.takeException(), isNull);

    ctrl.fm.focus('VT9_1');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.textContaining('PERSPECTIVES'), findsOneWidget);

    // VT9_4 is the only field in the last block (the signatures card has
    // no focusable fields of its own — see VtWizardSignaturesCard's doc
    // comment), so this Tab hits the forward boundary at the section's
    // last block and should call the outer onNext, same as clicking
    // "Passer à la Validation" would.
    ctrl.fm.focus('VT9_4');
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump(const Duration(milliseconds: 700));

    expect(nextCalls, 1);
  });

  // Section 3's VT3_1 ("a-t-il fait face à une situation de crise ?") is
  // the same conditional-reveal trigger vt_wizard_conditional_container_
  // test.dart already covers via mouse click — these two exercise the
  // identical dependsOn/dependsValue chain (VT3_1 -> VT3_2 checkbox,
  // VT3_3/VT3_5 toggles, VT3_3 -> VT3_4 number) driven from the keyboard
  // instead: Tab's target list must track newly-revealed/hidden fields,
  // not just the fields that were visible when the step first rendered.
  group('Conditional-reveal switches (VT3_1 -> VT3_2/VT3_3/VT3_5)', () {
    testWidgets(
        'VT3_1 = Non (default): Tab skips the hidden dependents entirely',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pumpSection3(tester, ctrl);
      expect(tester.takeException(), isNull);
      expect(find.textContaining('types de crise'), findsNothing);

      ctrl.fm.focus('VT3_1');
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump(const Duration(milliseconds: 700));

      // VT3_2/VT3_3/VT3_5 (all dependsOn: VT3_1) never mounted, so Tab
      // must land on the next always-visible field instead of getting
      // stuck trying to focus one of them.
      expect(ctrl.fm.activeId, 'VT3_9');
    });

    testWidgets(
        'VT3_1 = Oui via arrow key: newly-revealed VT3_2 joins the Tab order',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      await _pumpSection3(tester, ctrl);
      expect(tester.takeException(), isNull);

      ctrl.fm.focus('VT3_1');
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      // _VtWizardConditionalContainer's entrance animation starts
      // collapsed and flips to revealed via addPostFrameCallback, one
      // frame after it first mounts — a single pump(duration) jump only
      // processes that first frame (queuing the callback's setState, not
      // yet reflecting it), so a plain discrete pump() first lets that
      // second frame land before advancing the clock for the debounce
      // timer below. Content is present in the tree either way (opacity/
      // size animate, nothing unmounts), but real frame cadence needs
      // both steps, same as the actual app running continuously would.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      expect(ctrl.data['VT3_1'], 'Oui/ Yes');
      expect(find.textContaining('types de crise'), findsOneWidget);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));

      // Now that VT3_2 is mounted, Tab from VT3_1 lands there next
      // instead of skipping straight to VT3_9.
      expect(ctrl.fm.activeId, 'VT3_2');
    });
  });
}
