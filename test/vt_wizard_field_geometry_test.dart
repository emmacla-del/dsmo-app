// Regression coverage for the VTC wizard's compact-control and prompt
// hierarchy rules: a small count should not stretch like a text area, and
// the question that introduces a response group must be more prominent than
// the answer alternatives.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/l10n/generated/app_localizations.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/wizard/vt_wizard_fields.dart';

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
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('count controls are compact and prompts are larger than choices',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    // VT2_19 used to be this test's "compact count control" example, but
    // it's now one of kVtWizardNoStepperNumberFieldIds (open-ended
    // headcount, long label — renders full-width with no +/- stepper, see
    // vt_wizard_fields.dart). VT2_8 ("of which female") is a short-label
    // count that still gets the compact/stepper treatment.
    final count =
        ctrl.schema!.fields.firstWhere((field) => field.id == 'VT2_8');
    final residence =
        ctrl.schema!.fields.firstWhere((field) => field.id == 'VT1_9');
    final trainingTypes =
        ctrl.schema!.fields.firstWhere((field) => field.id == 'VT2_18');

    await _pump(
      tester,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          VtWizardNumberStepperField(ctrl: ctrl, field: count),
          const SizedBox(height: 32),
          VtWizardRadioGroup(ctrl: ctrl, field: residence),
          const SizedBox(height: 32),
          VtWizardCheckboxGroup(ctrl: ctrl, field: trainingTypes),
        ],
      ),
    );

    final countLabel = tester.widget<Text>(find.text('of which female'));
    expect(countLabel.style?.fontSize, 15);
    expect(countLabel.style?.fontWeight, FontWeight.w700);

    // VT1_9's label was "Area of residence" — renamed to avoid implying a
    // person's residence rather than the center's own site (see
    // onefop_ast.dart's comment on VT1_9).
    final residencePrompt =
        tester.widget<Text>(find.text('Location / Area of establishment'));
    expect(residencePrompt.style?.fontSize, 16);
    expect(residencePrompt.style?.fontWeight, FontWeight.w800);

    // Option text is 14 — smaller than both the count control (15) and the
    // prompt (16), preserving the prompt > choices hierarchy this test is
    // named for (see VtWizardRadioGroup/VtWizardCheckboxGroup's option style).
    final option = tester.widget<Text>(find.text('Urban'));
    expect(option.style?.fontSize, 14);

    // The compact stepper is still width-capped (180); VtWizardCheckboxGroup
    // no longer caps its own width at all — it now splits into a responsive
    // 2-column Row/Expanded layout (LayoutBuilder-driven) instead of a fixed-
    // width ConstrainedBox, so there's no longer a "360" to find here.
    final widths = tester
        .widgetList<ConstrainedBox>(find.byType(ConstrainedBox))
        .map((box) => box.constraints.maxWidth)
        .toList();
    expect(widths, contains(180));
  });

  testWidgets('year field renders 4-digit input without stepper',
      (tester) async {
    final ctrl = await _controller();
    addTearDown(ctrl.dispose);
    final yearField =
        ctrl.schema!.fields.firstWhere((field) => field.id == 'VT1_14');
    await _pump(tester, vtWizardBuildField(ctrl, yearField));
    expect(find.byType(VtWizardYearField), findsOneWidget);
    expect(find.text('−'), findsNothing);
    expect(find.text('+'), findsNothing);
  });
}
