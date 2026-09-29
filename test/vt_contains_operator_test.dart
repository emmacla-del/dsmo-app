// VT-UI/UX-07 P1 — the "contains" dependsOperator, and the two VT
// checkbox->write-in gates it enables (VT6_5->VT6_6, VT6_8->VT6_9).
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

Future<void> _setRaw(
  WidgetTester tester,
  OnefopFormController ctrl,
  String id,
  dynamic value,
) async {
  ctrl.setRawValue(id, value);
  // setRawValue schedules the 3-second debounced autosave (schedAS), which
  // itself (_doAS) schedules a further short-lived timer once it fires —
  // both must be flushed before the widget tree is disposed, same pattern
  // already fixed in vt_required_cell_test.dart/vt_sheet_title_test.dart.
  // isFieldVisible itself reads _data synchronously, so the assertion
  // right after setRawValue is already correct without waiting for this.
  await tester.pump(const Duration(seconds: 3));
  await tester.pump(const Duration(milliseconds: 700));
}

const _fieldA = FieldSchema(id: 'a', path: 'a', type: 'text');

void main() {
  group('FieldSchema.isVisibleGiven — pure evaluator unit tests', () {
    test('no dependsOn -> always visible', () {
      expect(_fieldA.isVisibleGiven(const {}), isTrue);
    });

    test('equality (default/"eq"): visible only when data[dependsOn] == dependsValue', () {
      const f = FieldSchema(
          id: 'b', path: 'b', type: 'text', dependsOn: 'a', dependsValue: 'Oui/ Yes');
      expect(f.isVisibleGiven(const {'a': 'Oui/ Yes'}), isTrue);
      expect(f.isVisibleGiven(const {'a': 'Non/ No'}), isFalse);
      expect(f.isVisibleGiven(const {}), isFalse);
    });

    test('explicit dependsOperator: "eq" behaves identically to null', () {
      const f = FieldSchema(
          id: 'b',
          path: 'b',
          type: 'text',
          dependsOn: 'a',
          dependsValue: 'Oui/ Yes',
          dependsOperator: 'eq');
      expect(f.isVisibleGiven(const {'a': 'Oui/ Yes'}), isTrue);
      expect(f.isVisibleGiven(const {'a': 'Non/ No'}), isFalse);
    });

    group('dependsOperator: "contains"', () {
      const f = FieldSchema(
          id: 'b',
          path: 'b',
          type: 'text',
          dependsOn: 'a',
          dependsValue: 'Autres/ Others',
          dependsOperator: 'contains');

      test('true when the list includes the value', () {
        expect(f.isVisibleGiven(const {'a': ['X', 'Autres/ Others']}), isTrue);
      });

      test('false when the list does not include the value', () {
        expect(f.isVisibleGiven(const {'a': ['X', 'Y']}), isFalse);
      });

      test('false when the trigger is an empty list', () {
        expect(f.isVisibleGiven(const {'a': <String>[]}), isFalse);
      });

      test('false when the trigger is null (checkbox never touched)', () {
        expect(f.isVisibleGiven(const {}), isFalse);
      });

      test('false when the trigger is not a list at all', () {
        expect(f.isVisibleGiven(const {'a': 'Autres/ Others'}), isFalse);
      });
    });
  });

  group('Regression: pre-existing equality dependsOn is unaffected by the refactor', () {
    testWidgets('VT2_1 (Oui) -> VT2_2 still gates via plain equality', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final agreement = _field(ctrl, 'VT2_1');
      expect(_field(ctrl, 'VT2_2').dependsOperator, isNull,
          reason: 'pre-existing dependsOn entries must not have gained an operator');

      expect(ctrl.isFieldVisible(_field(ctrl, 'VT2_2')), isFalse);
      await _setRaw(tester, ctrl, agreement.id, 'Non/ No');
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT2_2')), isFalse);
      await _setRaw(tester, ctrl, agreement.id, 'Oui/ Yes');
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT2_2')), isTrue);
    });
  });

  group('VT6_5 (checkbox) contains "Autres" -> VT6_6', () {
    testWidgets('hidden with no selection, hidden with a non-Autres option, '
        'visible once Autres is selected, hidden again once deselected', (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final support = _field(ctrl, 'VT6_5');
      expect(_field(ctrl, 'VT6_6').dependsOperator, 'contains');

      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_6')), isFalse);

      await _setRaw(tester, ctrl, support.id,
          ['Orientation d\'imprégnation/ impregnation orientation']);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_6')), isFalse,
          reason: 'a selected option other than Autres must not reveal the write-in');

      await _setRaw(tester, ctrl, support.id, [
        'Orientation d\'imprégnation/ impregnation orientation',
        'Autres/ Others',
      ]);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_6')), isTrue);

      await _setRaw(
          tester, ctrl, support.id, ['Orientation d\'imprégnation/ impregnation orientation']);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_6')), isFalse,
          reason: 'deselecting Autres must hide the write-in again');
    });
  });

  group('VT6_8 (checkbox) contains "Autres" -> VT6_9', () {
    testWidgets('hidden until VT6_7=Oui and VT6_8 includes Autres; visible once both hold',
        (tester) async {
      final ctrl = await _controller();
      addTearDown(ctrl.dispose);
      final followUp = _field(ctrl, 'VT6_7');
      final mechanisms = _field(ctrl, 'VT6_8');
      expect(_field(ctrl, 'VT6_9').dependsOperator, 'contains');

      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_9')), isFalse);

      // VT6_8 itself is still gated on VT6_7=Oui (untouched by this
      // ticket) — selecting Autres in _data directly without that gate
      // being satisfied mirrors what a real user could never do through
      // the UI (VT6_8 wouldn't be rendered/interactable), so this proves
      // the "contains" check alone, given realistic data, already implies
      // the outer condition once VT6_7 really is Oui below.
      await _setRaw(tester, ctrl, followUp.id, 'Oui/ Yes');
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_8')), isTrue);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_9')), isFalse);

      await _setRaw(tester, ctrl, mechanisms.id, ['Téléphonique/ Telephone']);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_9')), isFalse);

      await _setRaw(
          tester, ctrl, mechanisms.id, ['Téléphonique/ Telephone', 'Autres/ Others']);
      expect(ctrl.isFieldVisible(_field(ctrl, 'VT6_9')), isTrue);
    });
  });
}
