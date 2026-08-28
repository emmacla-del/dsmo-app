// Phase 1 — Administration ONEFOP questionnaire.
// Pure AST/compiler-level coverage (no widget tree needed): entity/family
// mapping, Administration schema shape, and non-regression for the four
// previously-operational entity types.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show entityTypeForSchema;

void main() {
  // No widgets are pumped in this file (pure AST/compiler-level checks),
  // but test/flutter_test_config.dart's setUpAll (shared by every file in
  // this directory, e.g. for golden-test font loading) touches
  // TestDefaultBinaryMessengerBinding.instance, which requires the widget
  // binding to already exist.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('EntityType.family mapping', () {
    test('labour-family types resolve to QuestionnaireFamily.onefop', () {
      expect(EntityType.enterprise.family, QuestionnaireFamily.onefop);
      expect(EntityType.cooperative.family, QuestionnaireFamily.onefop);
      expect(EntityType.ctd.family, QuestionnaireFamily.onefop);
      expect(EntityType.ong.family, QuestionnaireFamily.onefop);
      expect(EntityType.administration.family, QuestionnaireFamily.onefop);
      expect(EntityType.projectProgram.family, QuestionnaireFamily.onefop);
    });

    test('vocational resolves to QuestionnaireFamily.onefopVocational', () {
      expect(
          EntityType.vocational.family, QuestionnaireFamily.onefopVocational);
    });
  });

  group('Administration schema shape', () {
    late final schema =
        OnefopFormLoader.loadForEntity(entityTypeForSchema(EntityType.administration));

    test('Section 1 (Administration identification) is present with all 12 questions', () {
      final section =
          schema.sections.where((s) => s.id == 'section1_administration');
      expect(section, isNotEmpty,
          reason: 'section1_administration must be compiled in for administration');
      final fieldIds = section.first.fieldIds;
      for (final id in [
        'ADMIN_S1Q01', 'ADMIN_S1Q02', 'ADMIN_S1Q03',
        'ADMIN_S1Q04_REGION', 'ADMIN_S1Q04_DEPT', 'ADMIN_S1Q04_SUBDIV', 'ADMIN_S1Q04_LOCALITY',
        'ADMIN_S1Q05_TEL1', 'ADMIN_S1Q05_TEL2', 'ADMIN_S1Q05_BP',
        'ADMIN_S1Q06', 'ADMIN_S1Q07', 'ADMIN_S1Q08',
        'ADMIN_S1Q09', 'ADMIN_S1Q10', 'ADMIN_S1Q11', 'ADMIN_S1Q12',
      ]) {
        expect(fieldIds, contains(id), reason: 'missing $id');
      }
    });

    test('S1Q10/S1Q12 carry the conditional dependsOn wired to S1Q09/S1Q11', () {
      final q10 = schema.fields.firstWhere((f) => f.id == 'ADMIN_S1Q10');
      final q12 = schema.fields.firstWhere((f) => f.id == 'ADMIN_S1Q12');
      expect(q10.dependsOn, 'ADMIN_S1Q09');
      expect(q10.dependsValue, 'Oui/ Yes');
      expect(q12.dependsOn, 'ADMIN_S1Q11');
      expect(q12.dependsValue, 'Oui/ Yes');
    });

    test('S21Q01/S22Q01/S3Q01/S4Q02 are present, using SFP rows', () {
      final s21q01 = schema.fields.firstWhere((f) => f.id == 'S21Q01');
      expect(s21q01.tableSpec!['rows'],
          ['fonctionnaire', 'decisionnaire', 'contractuelle']);
      final s22q01 = schema.fields.firstWhere((f) => f.id == 'S22Q01');
      expect(s22q01.tableSpec!['rows'],
          ['fonctionnaire', 'decisionnaire', 'contractuelle']);
      final s3q01 = schema.fields.firstWhere((f) => f.id == 'S3Q01');
      expect(s3q01.tableSpec!['rows'],
          ['fonctionnaire', 'decisionnaire', 'contractuelle']);
      final s4q02 = schema.fields.where((f) => f.id == 'S4Q02');
      expect(s4q02, isNotEmpty);
      expect(s4q02.first.label!.fr, contains('de votre administration'));
    });

    test('S22Q04 (disability) is present and still uses CSP rows', () {
      final s22q04 = schema.fields.firstWhere((f) => f.id == 'S22Q04');
      expect(s22q04.tableSpec!['rows'], ['cadres', 'foremen', 'workers']);
    });

    test('S22Q05 (vulnerable) is present via the shared cooperative/ctd/ong variant', () {
      final ids = schema.fields.map((f) => f.id);
      expect(ids, contains('S22Q05_OTHER'));
      expect(ids, isNot(contains('S22Q05_ENTERPRISE')));
    });

    test(
        'S22Q02, S22Q03, S23Q01, S23Q02, S3Q03, S4Q03 (and its domain-text '
        'fields) are absent for Administration', () {
      final ids = schema.fields.map((f) => f.id).toSet();
      for (final absentId in [
        'S22Q02', 'S22Q03', 'S23Q01', 'S23Q02', 'S3Q03',
        'S4Q03', 'S4Q03_DOMAIN_1_TEXT', 'S4Q03_DOMAIN_2_TEXT', 'S4Q03_DOMAIN_3_TEXT',
      ]) {
        expect(ids, isNot(contains(absentId)), reason: '$absentId should not appear for administration');
      }
    });

    test('no section1 from another entity type leaks in', () {
      final sectionIds = schema.sections.map((s) => s.id);
      expect(sectionIds, isNot(contains('section1_enterprise')));
      expect(sectionIds, isNot(contains('section1_cooperative')));
      expect(sectionIds, isNot(contains('section1_ctd')));
      expect(sectionIds, isNot(contains('section1_ong')));
    });
  });

  group('Existing four entity types are unchanged', () {
    test('enterprise keeps S22Q01/S22Q02/S22Q03/S23Q01/S23Q02/S4Q03 with CSP rows', () {
      final schema =
          OnefopFormLoader.loadForEntity(entityTypeForSchema(EntityType.enterprise));
      final ids = schema.fields.map((f) => f.id).toSet();
      for (final id in [
        'S21Q01', 'S22Q01', 'S22Q02', 'S22Q03', 'S23Q01', 'S23Q02', 'S4Q03',
      ]) {
        expect(ids, contains(id), reason: '$id must still exist for enterprise');
      }
      final s21q01 = schema.fields.firstWhere((f) => f.id == 'S21Q01');
      expect(s21q01.tableSpec!['rows'], ['cadres', 'foremen', 'workers']);
      final s3q01 = schema.fields.firstWhere((f) => f.id == 'S3Q01');
      expect(s3q01.tableSpec!['rows'], ['cadres', 'foremen', 'workers']);
      final s22q05 = schema.fields.map((f) => f.id);
      expect(s22q05, contains('S22Q05_ENTERPRISE'));
      expect(s22q05, isNot(contains('S22Q05_OTHER')));
    });

    test('cooperative/ctd/ong Section 1 unaffected', () {
      for (final entry in {
        EntityType.cooperative: 'section1_cooperative',
        EntityType.ctd: 'section1_ctd',
        EntityType.ong: 'section1_ong',
      }.entries) {
        final schema =
            OnefopFormLoader.loadForEntity(entityTypeForSchema(entry.key));
        expect(schema.sections.map((s) => s.id), contains(entry.value));
        expect(schema.sections.map((s) => s.id),
            isNot(contains('section1_administration')));
      }
    });
  });
}
