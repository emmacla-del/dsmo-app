// Regression test for the "training section is all empty" bug report.
// Root cause: section2 ("Emploi et travail"), section3 ("Départs"), and
// section4 ("Stage et formation" — literally titled "training" in
// English) had no `entityTypes` restriction on their own SectionAst
// declarations (onefop_ast.dart), even though every one of their child
// questions already restricts itself to some subset of {enterprise,
// cooperative, ctd, ong, administration}. With the section itself
// defaulting to entityTypes: null ("always included" per
// form_schema_compiler.dart), the compiler included these three sections
// for every entity type anyway — VocationalTraining and ProjectProgram
// included, neither of which has a single question in any of the three,
// so for them the section rendered as a second, completely blank
// "SECTION 4. STAGE ET FORMATION" page (sidebar entry present, since the
// section itself compiled fine; body blank, since no question survived
// the per-field entity filter) — same class of gap section0 was already
// fixed for, just missed here. Fix: give the section itself the same
// allow-list its own questions already carry — {enterprise, cooperative,
// ctd, ong, administration}. Administration is included because it has
// real content in all three (s21q01Administration, s22q01Administration,
// the shared S22Q05 variant, s3q01Administration, the shared s4q01, and
// s4q02Administration) — an earlier version of this fix wrongly left
// administration out, which silently deleted that real content instead
// of just closing the leak (caught by the "non-VT control" cases in
// vt_unit_boundary_test.dart / vt_desktop_excel_shell_test.dart, which
// both use administration's section2/S21Q01 as their control).
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_controller.dart';

Future<List<String>> _sectionIds(EntityType type) async {
  final ctrl = OnefopFormController(
    entityType: type,
    initialData: const {},
    onSave: (_) async {},
  );
  await ctrl.initialize();
  final ids = ctrl.schema!.sections.map((s) => s.id).toList();
  ctrl.dispose();
  return ids;
}

void main() {
  testWidgets('Vocational Training compiles to exactly its own 9 sections — '
      'no leaked section2/3/4', (tester) async {
    final ids = await _sectionIds(EntityType.vocationalTraining);
    expect(ids.length, 9);
    expect(ids, everyElement(contains('vocationalTraining')));
    expect(ids, isNot(contains('section2')));
    expect(ids, isNot(contains('section3')));
    expect(ids, isNot(contains('section4')));
  });

  testWidgets(
      'ProjectProgram no longer gets the leaked sections (same root cause, '
      'not VT-specific) — it has no question in any of the three',
      (tester) async {
    final pp = await _sectionIds(EntityType.projectProgram);
    expect(pp, isNot(contains('section2')));
    expect(pp, isNot(contains('section3')));
    expect(pp, isNot(contains('section4')));
  });

  testWidgets(
      'The five real owners (enterprise/cooperative/ctd/ong/administration) '
      'still get section2/3/4 — Administration has real content there too, '
      'not just a leak', (tester) async {
    for (final type in [
      EntityType.enterprise,
      EntityType.cooperative,
      EntityType.ctd,
      EntityType.ong,
      EntityType.administration,
    ]) {
      final ids = await _sectionIds(type);
      expect(ids, contains('section2'), reason: '$type');
      expect(ids, contains('section3'), reason: '$type');
      expect(ids, contains('section4'), reason: '$type');
    }
  });

  testWidgets(
      'Administration section2 contains only its own admin-restricted '
      'questions, not the enterprise-family ones', (tester) async {
    final ctrl = OnefopFormController(
      entityType: EntityType.administration,
      initialData: const {},
      onSave: (_) async {},
    );
    await ctrl.initialize();
    addTearDown(ctrl.dispose);
    final section2 =
        ctrl.schema!.sections.firstWhere((s) => s.id == 'section2');
    expect(section2.fieldIds, contains('S21Q01'));
    expect(section2.fieldIds, contains('S22Q01'));
    // S23Q02 ("primo demandeur") is enterprise-family only — Administration
    // has no such question (see its own "no Primo demandeur section" note
    // in onefop_ast.dart).
    expect(section2.fieldIds, isNot(contains('S23Q02')));
  });
}
