// VT-UI/UX-06 P0 — the four paper-confirmed whole-field dependsOn gaps.
// Exercises the real compiled VT AST + the real shared visibility engine
// (OnefopFormController.isFieldVisible), the same predicate
// buildTableGroupUnits already filters section fields with — not a
// reimplementation of the dependsOn rule.
//
// Uses testWidgets (not plain test) even though nothing is pumped for its
// own sake: this suite's flutter_test_config.dart sets up SharedPreferences/
// connectivity mocks in a way that needs the widget test binding
// initialized first, which only testWidgets does automatically — matching
// every other VT test file in this repo. setRadioValue also schedules a
// 300ms debounced revalidation timer (OnefopFormController._schedRevalidate)
// that must be elapsed before the test ends, or the framework's "no pending
// timers left behind" invariant fails — same pattern already hit and fixed
// in vt_required_cell_test.dart/vt_sheet_title_test.dart.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<OnefopFormController> _controller() async {
  final ctrl = OnefopFormController(
    entityType: EntityType.vocationalTraining,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

FieldSchema _field(OnefopFormController ctrl, String id) {
  final f = ctrl.schema!.getField(id);
  expect(f, isNotNull, reason: '$id must exist in the compiled VT schema');
  return f!;
}

/// The option value whose French or English text contains [needle] —
/// pulled from the field's own compiled option list rather than
/// hardcoded a second time, so the test validates against whatever value
/// the real radio button actually writes, not a duplicated assumption.
String _optionValueContaining(FieldSchema f, String needle) {
  final opts = f.optionsI18n ?? const [];
  for (final o in opts) {
    if (o.text.fr.contains(needle) || o.text.en.contains(needle)) {
      return o.value;
    }
  }
  fail('No option on ${f.id} matches "$needle" (options: '
      '${opts.map((o) => o.value).toList()})');
}

Future<void> _setRadio(
  WidgetTester tester,
  OnefopFormController ctrl,
  FieldSchema field,
  String value,
) async {
  ctrl.setRadioValue(field, value);
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  group('VT1_12 -> VT1_13 (functional status -> non-functional reason)', () {
    testWidgets('VT1_13 hidden when VT1_12 is unanswered', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13')), isFalse);
    });

    testWidgets('VT1_13 hidden when VT1_12 = Fonctionnelle (not the trigger value)',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final status = _field(ctrl, 'VT1_12');
      // Case-sensitive match: 'Fonctionnelle' (capital F) matches only the
      // "Fonctionnelle" option's fr text, not "Non-fonctionnelle"'s
      // lowercase 'f' — verified distinct from the next test's value.
      final functional = _optionValueContaining(status, 'Fonctionnelle');
      final nonFunctional = _optionValueContaining(status, 'Non-fonctionnelle');
      expect(functional, isNot(nonFunctional));
      await _setRadio(tester, ctrl, status, functional);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13')), isFalse);
    });

    testWidgets('VT1_13 visible when VT1_12 = Non-fonctionnelle', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final status = _field(ctrl, 'VT1_12');
      await _setRadio(
          tester, ctrl, status, _optionValueContaining(status, 'Non-fonctionnelle'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13')), isTrue);
    });
  });

  group('VT1_13 -> VT1_13_OTHER (reason -> "Précisez" write-in)', () {
    testWidgets('write-in hidden until VT1_13 = Autres', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final status = _field(ctrl, 'VT1_12');
      final reason = _field(ctrl, 'VT1_13');
      await _setRadio(
          tester, ctrl, status, _optionValueContaining(status, 'Non-fonctionnelle'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13_OTHER')), isFalse);

      await _setRadio(
          tester, ctrl, reason, _optionValueContaining(reason, "Manque d'apprenants"));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13_OTHER')), isFalse,
          reason: 'a non-Autres reason must not reveal the write-in');

      await _setRadio(tester, ctrl, reason, _optionValueContaining(reason, 'Autres'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT1_13_OTHER')), isTrue);
    });
  });

  group('VT6_3 -> VT6_4 (negative trigger — the only one in the VT AST)', () {
    testWidgets('VT6_4 hidden when VT6_3 = Oui', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final choose = _field(ctrl, 'VT6_3');
      await _setRadio(tester, ctrl, choose, _optionValueContaining(choose, 'Oui'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_4')), isFalse);
    });

    testWidgets('VT6_4 visible when VT6_3 = Non', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final choose = _field(ctrl, 'VT6_3');
      await _setRadio(tester, ctrl, choose, _optionValueContaining(choose, 'Non'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_4')), isTrue);
    });

    testWidgets('VT6_4 hidden when VT6_3 is unanswered', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_4')), isFalse);
    });
  });

  group('VT7_20 -> VT7_21', () {
    testWidgets('VT7_21 hidden when VT7_20 != Oui', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final delivered = _field(ctrl, 'VT7_20');
      await _setRadio(tester, ctrl, delivered, _optionValueContaining(delivered, 'Non'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT7_21')), isFalse);
    });

    testWidgets('VT7_21 visible when VT7_20 = Oui', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final delivered = _field(ctrl, 'VT7_20');
      await _setRadio(tester, ctrl, delivered, _optionValueContaining(delivered, 'Oui'));
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT7_21')), isTrue);
    });

    testWidgets('VT7_21 hidden when VT7_20 is unanswered', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT7_21')), isFalse);
    });
  });
}
