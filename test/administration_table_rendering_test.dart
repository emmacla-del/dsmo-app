// Phase 2 P0-A regression coverage: administration_ast_test.dart only
// checked FieldSchema.tableSpec (the compiler layer) and passed while the
// live renderer/persistence layer (TableSpecBuilder, TableCellEngine)
// still hardcoded CSP rows for Administration's S21Q01/S22Q01/S3Q01. This
// file exercises those two components directly — the actual failure mode
// — instead of only the AST/compiler passthrough.
import 'dart:ui' show Locale;

import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/core/focus/renderers/table_spec_builder.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show EntityType, entityTypeForSchema;
import 'package:dsmo_app/screens/onefop/onefop_table_engine.dart';

const _locale = Locale('fr');

void main() {
  // Matches administration_ast_test.dart: no widgets are pumped, but the
  // shared test/flutter_test_config.dart setUpAll touches
  // TestDefaultBinaryMessengerBinding.instance, which requires the widget
  // binding to already exist.
  TestWidgetsFlutterBinding.ensureInitialized();

  FieldSchema fieldFor(EntityType entityType, String id) {
    final schema =
        OnefopFormLoader.loadForEntity(entityTypeForSchema(entityType));
    return schema.fields.firstWhere((f) => f.id == id);
  }

  group('Administration S21Q01/S22Q01/S3Q01 — TableCellEngine.cellIds', () {
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01']) {
      test('$id produces fonctionnaire/decisionnaire/contractuelle cell IDs, '
          'not cadres/foremen/workers', () {
        final field = fieldFor(EntityType.administration, id);
        final ids = TableCellEngine.cellIds(field);
        expect(ids, isNotEmpty);
        expect(ids.any((c) => c.contains('_fonctionnaire_')), isTrue,
            reason: '$id must key data under fonctionnaire, got: $ids');
        expect(ids.any((c) => c.contains('_decisionnaire_')), isTrue);
        expect(ids.any((c) => c.contains('_contractuelle_')), isTrue);
        expect(ids.any((c) => c.contains('_cadres_')), isFalse,
            reason: '$id must NOT use CSP rows for administration');
        expect(ids.any((c) => c.contains('_foremen_')), isFalse);
        expect(ids.any((c) => c.contains('_workers_')), isFalse);
      });
    }

    test('S22Q04 (disability) is unaffected — still CSP rows', () {
      final field = fieldFor(EntityType.administration, 'S22Q04');
      final ids = TableCellEngine.cellIds(field);
      expect(ids.any((c) => c.contains('_cadres_')), isTrue);
    });
  });

  group('Enterprise S21Q01/S22Q01/S3Q01 — unchanged (regression)', () {
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01']) {
      test('$id still produces cadres/foremen/workers cell IDs', () {
        final field = fieldFor(EntityType.enterprise, id);
        final ids = TableCellEngine.cellIds(field);
        expect(ids.any((c) => c.contains('_cadres_')), isTrue);
        expect(ids.any((c) => c.contains('_foremen_')), isTrue);
        expect(ids.any((c) => c.contains('_workers_')), isTrue);
        expect(ids.any((c) => c.contains('_fonctionnaire_')), isFalse);
        expect(ids.any((c) => c.contains('_decisionnaire_')), isFalse);
        expect(ids.any((c) => c.contains('_contractuelle_')), isFalse);
      });
    }
  });

  group('Administration S21Q01/S22Q01/S3Q01 — TableSpecBuilder.build', () {
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01']) {
      test('$id renders Fonctionnaire/Décisionnaire/Contractuelle row '
          'labels and rowKeys, not Cadres/Agents de Maîtrise/…', () {
        final field = fieldFor(EntityType.administration, id);
        final spec = field.tableSpec!;
        final rawRows = spec['rows'];
        final rows = rawRows is List ? rawRows.cast<String>() : null;
        final renderSpec = TableSpecBuilder.build(
          template: spec['template'] as String,
          prefix: (spec['prefix'] as String).toLowerCase(),
          gridValues: const {},
          onCellChanged: (_, __) {},
          entityType: 'administration',
          locale: _locale,
          rows: rows,
        );
        expect(renderSpec.rowLabels, contains('Fonctionnaire'));
        expect(renderSpec.rowLabels, contains('Décisionnaire'));
        expect(renderSpec.rowLabels, contains('Contractuelle'));
        expect(renderSpec.rowLabels, isNot(contains('Cadres')));
        expect(renderSpec.rowLabels, isNot(contains('Agents de Maîtrise')));
        expect(renderSpec.rowKeys, isNotNull);
        expect(renderSpec.rowKeys!.any((k) => k.contains('_fonctionnaire')),
            isTrue,
            reason: '$id rowKeys: ${renderSpec.rowKeys}');
      });
    }
  });

  group('Enterprise S21Q01/S22Q01/S3Q01 — TableSpecBuilder.build unchanged', () {
    for (final id in ['S21Q01', 'S22Q01', 'S3Q01']) {
      test('$id still renders Cadres/Agents de Maîtrise/… row labels', () {
        final field = fieldFor(EntityType.enterprise, id);
        final spec = field.tableSpec!;
        final rawRows = spec['rows'];
        final rows = rawRows is List ? rawRows.cast<String>() : null;
        final renderSpec = TableSpecBuilder.build(
          template: spec['template'] as String,
          prefix: (spec['prefix'] as String).toLowerCase(),
          gridValues: const {},
          onCellChanged: (_, __) {},
          entityType: 'enterprise',
          locale: _locale,
          rows: rows,
        );
        expect(renderSpec.rowLabels, contains('Cadres'));
        expect(renderSpec.rowLabels, contains('Agents de Maîtrise'));
        expect(renderSpec.rowLabels, isNot(contains('Fonctionnaire')));
      });
    }
  });

  group('TableCellEngine.dispatch — SFP totals recompute under SFP keys', () {
    test('S21Q01 total recomputes from fonctionnaire/decisionnaire/'
        'contractuelle cells, ignoring any stray cadres/foremen/workers '
        'keys', () {
      const rows = ['fonctionnaire', 'decisionnaire', 'contractuelle'];
      final current = <String, int>{
        's21q01_fonctionnaire_male_15_24': 2,
        's21q01_decisionnaire_male_15_24': 3,
        's21q01_contractuelle_male_15_24': 4,
        // Stray CSP-keyed data (simulating the pre-fix bug) must NOT be
        // picked up once the correct rows are supplied.
        's21q01_cadres_male_15_24': 999,
      };
      final result =
          TableCellEngine.dispatch(current, 's21q01', rows: rows);
      expect(result['s21q01_total_male_15_24'], 9);
    });

    test('without an explicit rows override, s21q01 still defaults to CSP '
        '(unchanged default behavior)', () {
      final current = <String, int>{
        's21q01_cadres_male_15_24': 5,
        's21q01_foremen_male_15_24': 1,
        's21q01_workers_male_15_24': 2,
      };
      final result = TableCellEngine.dispatch(current, 's21q01');
      expect(result['s21q01_total_male_15_24'], 8);
    });
  });
}
