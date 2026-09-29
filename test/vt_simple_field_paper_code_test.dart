// Regression coverage for a live UI report: "not all questions in the VT
// simple forms are having question codes" — VT2_1 ("Has your training
// institution signed an agreement with the Government?", the first
// question of section2_vocationalTraining shown in the screenshot) had
// no paperCode prefix on either desktop Simple Mode or mobile, unlike
// section0/section1_*'s own questions.
//
// Root cause: OnefopFormController.isSimpleSection (checked by
// buildFieldLabel, onefop_form_widgets.dart, before prepending
// f.paperCode to a field's label) only recognized 'section0' and
// 'section1_*' — a rule written for the original ONEFOP entities, where
// every other section is almost entirely tables whose own header already
// carries the code. VT's section2/3/6/7/9 (and the simple fields
// interspersed between VT's own tables in 4/5/8) are flat individual
// questions outside any table, with nowhere else their code would ever
// show — none of them started with 'section1_' (only VT's own Section 1
// did), so they never got a paperCode prefix at all. Fixed by also
// recognizing any section id ending in '_vocationalTraining'.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_widgets.dart' show buildFieldLabel;

Future<OnefopFormController> _controller(EntityType entityType) async {
  final ctrl = OnefopFormController(
    entityType: entityType,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  return ctrl;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
      'VT2_1 (section2_vocationalTraining\'s first question) now gets its '
      'own paperCode prefix', () async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    final idx = ctrl.schema!.sections.indexWhere((s) => s.id == 'section2_vocationalTraining');
    ctrl.goto(idx, focus: false, scroll: false);

    final f = ctrl.schema!.getField('VT2_1')!;
    final label = buildFieldLabel(ctrl, f, const Locale('fr'));
    expect(label, startsWith('2.1.1'));
  });

  test('every VT section id is recognized as a "simple" (per-question '
      'paperCode) section', () async {
    final ctrl = await _controller(EntityType.vocationalTraining);
    addTearDown(ctrl.dispose);
    for (final s in ctrl.schema!.sections) {
      expect(ctrl.isSimpleSection(s.id), isTrue, reason: s.id);
    }
  });

  test(
      'non-VT entities are unaffected: a non-section0/section1 section '
      '(enterprise section2) still does NOT get a paperCode prefix',
      () async {
    final ctrl = await _controller(EntityType.enterprise);
    addTearDown(ctrl.dispose);
    final idx = ctrl.schema!.sections.indexWhere((s) => s.id == 'section2');
    ctrl.goto(idx, focus: false, scroll: false);
    expect(ctrl.isSimpleSection('section2'), isFalse);
  });

  test('section0 and section1_* keep their existing "simple" behavior',
      () async {
    final ctrl = await _controller(EntityType.enterprise);
    addTearDown(ctrl.dispose);
    expect(ctrl.isSimpleSection('section0'), isTrue);
    expect(ctrl.isSimpleSection('section1_enterprise'), isTrue);
  });
}
