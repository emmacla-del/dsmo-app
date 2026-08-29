// Phase 1 — Projects & Programs questionnaire, structural implementation.
// Pure AST/compiler-level coverage (no widget tree needed): entity/family
// routing, dedicated Section 1-4 shape, Section 2's repeating-table
// tableSpec, Section 3's KPI grid shape, Section 4's CSP-row reuse, and
// non-regression for the five previously-operational entity types.
import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart';
import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show entityTypeForSchema;
import 'package:dsmo_app/screens/onefop/onefop_table_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('EntityType.projectProgram routing', () {
    test('resolves to QuestionnaireFamily.onefop', () {
      expect(EntityType.projectProgram.family, QuestionnaireFamily.onefop);
    });

    test('loads a schema distinct from every other entity', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.projectProgram));
      expect(schema.sections.map((s) => s.id),
          contains('section1_projectProgram'));
      expect(
          schema.sections.map((s) => s.id), contains('section2_projectProgram'));
      expect(
          schema.sections.map((s) => s.id), contains('section3_projectProgram'));
      expect(
          schema.sections.map((s) => s.id), contains('section4_projectProgram'));
      // No foreign section1/2/3/4 leakage.
      expect(schema.sections.map((s) => s.id),
          isNot(contains('section1_enterprise')));
      expect(schema.sections.map((s) => s.id),
          isNot(contains('section1_administration')));
    });
  });

  group('Section 1 — 21 fields', () {
    late final schema = OnefopFormLoader.loadForEntity(
        entityTypeForSchema(EntityType.projectProgram));

    test('all PP_S1Q01-16 field ids are present (composite fields expanded)',
        () {
      final ids = schema.fields.map((f) => f.id).toSet();
      for (final id in [
        'PP_S1Q01', 'PP_S1Q02', 'PP_S1Q03', 'PP_S1Q04', 'PP_S1Q05',
        'PP_S1Q06_REGION', 'PP_S1Q06_DEPT', 'PP_S1Q06_SUBDIV', 'PP_S1Q06_LOCALITY',
        'PP_S1Q07_TEL1', 'PP_S1Q07_TEL2', 'PP_S1Q07_BP',
        'PP_S1Q08', 'PP_S1Q09', 'PP_S1Q10', 'PP_S1Q11', 'PP_S1Q12',
        'PP_S1Q13', 'PP_S1Q14', 'PP_S1Q15', 'PP_S1Q16',
      ]) {
        expect(ids, contains(id), reason: 'missing $id');
      }
    });

    test('PP_S1Q14 carries the conditional dependsOn wired to PP_S1Q13', () {
      final q14 = schema.fields.firstWhere((f) => f.id == 'PP_S1Q14');
      expect(q14.dependsOn, 'PP_S1Q13');
      expect(q14.dependsValue, 'En arrêt/ Stopped');
    });
  });

  group('Section 2 — activities repeating table', () {
    late final schema = OnefopFormLoader.loadForEntity(
        entityTypeForSchema(EntityType.projectProgram));

    test('PP_S2_ACTIVITIES compiles as a repeating_table field', () {
      final f = schema.fields.firstWhere((f) => f.id == 'PP_S2_ACTIVITIES');
      expect(f.type, 'repeating_table');
      expect(f.tableSpec!['template'], 'activities_table');
      expect(f.tableSpec!['prefix'], 's2');
      expect(f.tableSpec!['rows'], 13);
      expect(f.tableSpec!['fields'], [
        'description', 'targetPopulation', 'supportType', 'scope',
        'startDate', 'duration',
      ]);
    });
  });

  group('Section 3 — outcomes KPI grid', () {
    late final schema = OnefopFormLoader.loadForEntity(
        entityTypeForSchema(EntityType.projectProgram));

    test('PP_S3_OUTCOMES compiles as a 4-row x 3-period table field', () {
      final f = schema.fields.firstWhere((f) => f.id == 'PP_S3_OUTCOMES');
      expect(f.type, 'table');
      expect(f.tableSpec!['template'], 'kpi_period_table');
      expect(f.tableSpec!['rows'],
          ['employed', 'self_employed', 'jobs_created', 'trained']);
      expect(f.tableSpec!['periods'], ['current', 'outlook_dec', 'outlook_june']);
    });

    test('TableCellEngine produces exactly 12 cell ids (4 rows x 3 periods)',
        () {
      final f = schema.fields.firstWhere((f) => f.id == 'PP_S3_OUTCOMES');
      final ids = TableCellEngine.cellIds(f);
      expect(ids.length, 12);
      expect(ids, contains('s3kpi_employed_current'));
      expect(ids, contains('s3kpi_trained_outlook_june'));
    });
  });

  group('Section 4 — S4Q01-S4Q06 reuse CSP rows (not SFP)', () {
    late final schema = OnefopFormLoader.loadForEntity(
        entityTypeForSchema(EntityType.projectProgram));

    test('S4Q01-S4Q04 (csp_gender_age_table) use cadres/foremen/workers', () {
      for (final id in ['PP_S4Q01', 'PP_S4Q02', 'PP_S4Q03', 'PP_S4Q04']) {
        final f = schema.fields.firstWhere((f) => f.id == id);
        expect(f.tableSpec!['rows'], ['cadres', 'foremen', 'workers'],
            reason: '$id must use CSP rows, not SFP');
        final cellIds = TableCellEngine.cellIds(f);
        expect(cellIds.any((c) => c.contains('_cadres_')), isTrue);
        expect(cellIds.any((c) => c.contains('_fonctionnaire_')), isFalse);
      }
    });

    test('S4Q05/S4Q06 (csp_status_gender_table) use cadres/foremen/workers',
        () {
      for (final id in ['PP_S4Q05', 'PP_S4Q06']) {
        final f = schema.fields.firstWhere((f) => f.id == id);
        expect(f.tableSpec!['rows'], ['cadres', 'foremen', 'workers']);
      }
    });

    test('S4Q01 and S4Q03 are distinct questions (counted vs recruited)', () {
      final q01 = schema.fields.firstWhere((f) => f.id == 'PP_S4Q01');
      final q03 = schema.fields.firstWhere((f) => f.id == 'PP_S4Q03');
      expect(q01.tableSpec!['prefix'], 'pp_s4q01');
      expect(q03.tableSpec!['prefix'], 'pp_s4q03');
      expect(q01.label!.fr, contains('recensé'));
      expect(q03.label!.fr, contains('recruté'));
    });
  });

  group('Existing five entity types are unchanged (regression)', () {
    test('enterprise S4Q01 (internship table) still present and unaffected',
        () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.enterprise));
      final ids = schema.fields.map((f) => f.id);
      expect(ids, contains('S4Q01'));
      final f = schema.fields.firstWhere((f) => f.id == 'S4Q01');
      expect(f.tableSpec!['template'], 'internship_table');
    });

    test('administration S4Q01 (shared internship table) still present', () {
      final schema = OnefopFormLoader.loadForEntity(
          entityTypeForSchema(EntityType.administration));
      expect(schema.fields.map((f) => f.id), contains('S4Q01'));
    });

    for (final entry in {
      EntityType.cooperative: 'section1_cooperative',
      EntityType.ctd: 'section1_ctd',
      EntityType.ong: 'section1_ong',
      EntityType.administration: 'section1_administration',
    }.entries) {
      test('${entry.key.name} Section 1 unaffected, no PP leakage', () {
        final schema =
            OnefopFormLoader.loadForEntity(entityTypeForSchema(entry.key));
        expect(schema.sections.map((s) => s.id), contains(entry.value));
        expect(schema.sections.map((s) => s.id),
            isNot(contains('section1_projectProgram')));
      });
    }
  });
}
