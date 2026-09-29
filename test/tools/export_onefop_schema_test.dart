// test/tools/export_onefop_schema_test.dart
//
// Phase 2.1 of the CAM-LEAP Flutter→React migration — ONEFOP schema
// extraction harness.
//
// `onefop_ast.dart` (lib/core/focus/compiler/onefop_ast.dart) remains the
// sole canonical ONEFOP domain definition. This test does not re-declare
// any field, section or table: it traverses the exact same
// AST → FormSchemaCompiler → FormSchemaV2 pipeline the app itself uses at
// runtime (OnefopFormLoader.loadForEntity, the same call
// OnefopFormController makes) and serializes the result. The output file,
// assets/schemas/onefop.schema.json, is a generated artifact for the future
// React/NestJS consumers — never hand-edited, never a second source of
// truth. Regenerate it by re-running this test whenever the AST changes.
//
// Run with:
//   flutter test test/tools/export_onefop_schema_test.dart
//
// Known, deliberately-preserved gaps in what the AST/compiler expose as
// *data* (as opposed to Flutter-side rendering code) are called out inline
// below, and summarized in the session's Phase 2.1 report — this test does
// not invent values to paper over them.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/data/minefop_models.dart' show EntityType;
import 'package:dsmo_app/screens/onefop/onefop_form_constants.dart'
    show entityTypeForSchema;
import 'package:dsmo_app/core/focus/onefop_form_loader.dart';
import 'package:dsmo_app/core/focus/compiler/onefop_ast.dart' as ast;
import 'package:dsmo_app/core/i18n/localized_text.dart';
import 'package:dsmo_app/core/focus/schema/form_schema_v2.dart';
import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_defs.dart';
import 'package:dsmo_app/core/focus/renderers/vt_table_types.dart';

const String _outputPath = 'assets/schemas/onefop.schema.json';

// The real, current EntityType/questionnaire-family mechanism
// (lib/data/minefop_models.dart + entityTypeForSchema) — seven distinct
// AST-loadable variants, not five. The migration prompt's five-way grouping
// (ENTERPRISE / COOPERATIVE_ONG / CTD / ADMINISTRATION_PROGRAMS /
// VOCATIONAL_TRAINING) does not correspond to any single enum or loader key
// in the repository: cooperative/ong and administration/projectProgram are
// each two separate EntityType values with two separate
// entityTypeForSchema() keys, not one merged family. Extracting all seven
// (rather than force-fitting into five) is what "use the repository's
// actual mechanism rather than introducing another taxonomy" requires.
const List<EntityType> _entityTypes = [
  EntityType.enterprise,
  EntityType.cooperative,
  EntityType.ctd,
  EntityType.ong,
  EntityType.administration,
  EntityType.projectProgram,
  EntityType.vocationalTraining,
];

const Set<String> _knownFieldTypes = {
  'text', 'number', 'radio', 'select', 'checkbox', 'table',
  'email', 'tel', 'date', 'textarea', 'repeating_table',
};

Map<String, dynamic>? _loc(LocalizedText? t) =>
    t == null ? null : {'fr': t.fr, 'en': t.en};

Map<String, dynamic>? _visibility(FieldSchema f) {
  if (f.dependsOn == null || f.dependsOn!.isEmpty) return null;
  final op = f.dependsOperator == 'contains' ? 'contains' : 'eq';
  return {
    'dependsOn': f.dependsOn,
    'dependsValue': f.dependsValue,
    'dependsOperator': op,
  };
}

/// Rich per-cell table metadata for VT's own table definitions
/// (vtTableDefFor, vt_table_defs.dart/vt_table_types.dart) — title, row
/// labels, cell kind, options, and which cells are computed. This is real
/// AST-adjacent *data* (VtTableDef/VtCellDef), not Flutter widget code, so
/// it is extracted the same way the compiler itself builds VT grids
/// (FormSchemaCompiler._buildVtGrid).
Map<String, dynamic> _vtTableJson(VtTableDef def) {
  return {
    'paperCode': def.paperCode,
    'title': _loc(def.title),
    'progressNoun': _loc(def.progressNoun),
    'isRoster': def.isRoster,
    'progressiveRows': def.progressiveRows,
    'singleCellPerRow': def.singleCellPerRow,
    'rows': [
      for (final r in def.rows)
        {
          'id': r.id,
          'label': _loc(r.fixedLabel),
          'labelFromCells': r.labelFromCells,
        },
    ],
    'cells': [
      for (final c in def.cells)
        {
          'key': c.key,
          'label': _loc(c.label),
          'kind': c.kind.name,
          'required': c.required,
          'dependsOnKey': c.dependsOnKey,
          'options': c.options == null
              ? null
              : [
                  for (final o in c.options!)
                    {'value': o.value, 'code': o.code, 'label': _loc(o.label)},
                ],
          // The only computation semantic that exists anywhere in the VT
          // table layer today (verified: every VtCellKind.computed cell in
          // vt_table_defs.dart — all 5 of them — is exactly
          // `data[row_male] + data[row_female]`). No other formula kind is
          // invented here.
          'formula': c.kind == VtCellKind.computed ? 'sum-of-siblings' : null,
        },
    ],
  };
}

/// Table metadata for a `table`/`repeating_table` field. Every table gets
/// its cell-id topology from the same GridSchema the compiler already
/// builds for keyboard/grid navigation (identical for VT and non-VT
/// tables). VT tables additionally get the rich VtTableDef metadata above.
/// Non-VT ("classic") tables — csp_gender_age_table, departure_table, etc.
/// — have NO equivalent rich object anywhere in the domain model: their
/// column/row/gender/age-band labels are hardcoded Dart literals private to
/// FormSchemaCompiler's per-template builder methods, not AST/schema data.
/// That gap is not papered over here — see `limitation` below.
Map<String, dynamic> _tableJson(FieldSchema f, FormSchemaV2 schema) {
  final spec = f.tableSpec ?? const <String, dynamic>{};
  final template = spec['template'] as String?;
  final prefix = (spec['prefix'] as String?) ?? f.id;

  // tableSpec['rows'] is polymorphic in the AST itself, not a mistake in
  // this extractor: for CSP/SFP-shaped classic tables it is a List<String>
  // of row keys (e.g. ['cadres','foremen','workers']); for skills/reasons/
  // training/activities and every vt_* template it is instead a plain int
  // row *capacity* (display slot count, e.g. 3, 12, 15). Both are
  // extracted under distinct, unambiguous keys rather than one overloaded
  // "rows" field.
  final rawRows = spec['rows'];
  final rowKeys = rawRows is List ? rawRows.cast<String>() : null;
  final rowCapacity = rawRows is int ? rawRows : null;
  final rawCsps = spec['csps'] ?? spec['csp_categories'];
  final csps = rawCsps is List ? rawCsps.cast<String>() : null;
  // Declared status dimension (e.g. ['permanent','temporary']); an empty
  // list means the table has no status dimension (Administration S21Q03/
  // S21Q04). Omitted when the AST does not declare one.
  final rawStatuses = spec['statuses'];
  final statuses = rawStatuses is List ? rawStatuses.cast<String>() : null;

  final grid = schema.grids.where((g) => g.id == prefix);

  final result = <String, dynamic>{
    'id': prefix,
    'template': template,
    'rowKeys': rowKeys,
    if (csps != null) 'csps': csps,
    if (statuses != null) 'statuses': statuses,
    'rowCapacity': rowCapacity,
    'matrix': grid.isNotEmpty ? grid.first.matrix : null,
  };

  if (template != null && template.startsWith('vt_')) {
    final def = vtTableDefFor(template, spec);
    if (def != null) {
      result['vt'] = _vtTableJson(def);
    } else {
      result['limitation'] =
          'vtTableDefFor($template, ...) returned null for prefix=$prefix — '
          'no VT table definition wired for this template/prefix pair.';
    }
  } else if (template != null) {
    result['limitation'] =
        'Non-VT table template "$template": column/row/gender/age-band '
        'labels and per-cell kind are not represented as AST/schema data — '
        'they are hardcoded inside FormSchemaCompiler\'s private '
        '_build*Grid() methods. Only the cell-id topology (matrix), '
        'template name, prefix, and row keys (when declared in tableSpec) '
        'are extractable today.';
  }

  return result;
}

Map<String, dynamic> _fieldJson(FieldSchema f, FormSchemaV2 schema) {
  return {
    'id': f.id,
    'paperCode': f.paperCode,
    'path': f.path,
    'type': f.type,
    'required': f.required,
    'label': _loc(f.label),
    'hint': _loc(f.hint),
    'instruction': _loc(f.instruction),
    // AST FormQuestionAst has no `placeholder` field at all — not
    // extracted because it does not exist, not omitted by oversight.
    'options': f.optionsI18n == null
        ? null
        : [
            for (final o in f.optionsI18n!)
              {'value': o.value, 'label': _loc(o.text)},
          ],
    'visibility': _visibility(f),
    'table': (f.type == 'table' || f.type == 'repeating_table')
        ? _tableJson(f, schema)
        : null,
  };
}

/// Groups a section's fields by their `FieldSchema.subsection` header text,
/// preserving first-seen order. The AST has no separate subsection
/// id/code — only a bilingual header string per field (`q.subsection`) — so
/// no id is invented here; the French text doubles as the natural grouping
/// key, and fields with no subsection are simply not placed in one.
List<Map<String, dynamic>> _subsectionsJson(
    List<String> fieldIds, FormSchemaV2 schema) {
  final order = <String>[];
  final labelByKey = <String, LocalizedText>{};
  final idsByKey = <String, List<String>>{};

  for (final id in fieldIds) {
    final f = schema.getField(id);
    final sub = f?.subsection;
    if (sub == null) continue;
    final key = sub.fr;
    if (!idsByKey.containsKey(key)) {
      order.add(key);
      labelByKey[key] = sub;
      idsByKey[key] = [];
    }
    idsByKey[key]!.add(id);
  }

  return [
    for (final key in order)
      {'title': _loc(labelByKey[key]), 'fieldIds': idsByKey[key]},
  ];
}

Map<String, dynamic> _entityJson(EntityType entityType) {
  final key = entityTypeForSchema(entityType);
  final schema = OnefopFormLoader.loadForEntity(key);
  final astSectionById = {for (final s in ast.allSections) s.id: s};

  final sectionsJson = <Map<String, dynamic>>[];
  for (final sectionSchema in schema.sections) {
    final sectionAst = astSectionById[sectionSchema.id];
    sectionsJson.add({
      'id': sectionSchema.id,
      'order': sectionAst?.order,
      'title': _loc(sectionAst?.title),
      'description': _loc(sectionAst?.description),
      // null = applies to every entity type (SectionAst.entityTypes
      // contract) — preserved verbatim, not normalized into a list.
      'entityTypes': sectionAst?.entityTypes,
      'subsections': _subsectionsJson(sectionSchema.fieldIds, schema),
      'fields': [
        for (final id in sectionSchema.fieldIds)
          _fieldJson(schema.getField(id)!, schema),
      ],
    });
  }

  return {
    'entityType': key,
    'sectionCount': sectionsJson.length,
    'fieldCount': schema.fields.length,
    'tableCount': schema.grids.length,
    'sections': sectionsJson,
  };
}

Map<String, dynamic> _buildSchema() {
  final entities = <String, dynamic>{};
  for (final et in _entityTypes) {
    entities[entityTypeForSchema(et)] = _entityJson(et);
  }

  return {
    'schemaVersion': 1,
    'source':
        'lib/core/focus/compiler/onefop_ast.dart via OnefopFormLoader.loadForEntity '
        '(FormSchemaCompiler) — generated by test/tools/export_onefop_schema_test.dart. '
        'Do not hand-edit; onefop_ast.dart is the sole canonical source.',
    'astTotals': {
      'sections': ast.allSections.length,
      'questions': ast.allQuestions.length,
    },
    // Which entity types each raw AST section applies to (null = all) —
    // documents structure sharing across entities without duplicating any
    // field/section definition.
    'sectionEntityMap': {
      for (final s in ast.allSections) s.id: s.entityTypes,
    },
    'formulas': {
      'sum-of-siblings':
          'A computed cell equals the sum of this row\'s other, '
          'non-computed sibling cells (e.g. total = male + female). The '
          'only computation semantic found in the VT table layer '
          '(vt_table_defs.dart). Classic (non-VT) grid tables have no '
          'AST-level formula marker at all — see each table\'s '
          '"limitation" field.',
    },
    'entities': entities,
  };
}

String _encode(Map<String, dynamic> schema) =>
    '${const JsonEncoder.withIndent('  ').convert(schema)}\n';

void main() {
  // Shared by every file under test/ (see flutter_test_config.dart) —
  // required before touching TestDefaultBinaryMessengerBinding even though
  // no widgets are pumped in this pure AST/compiler-level test.
  TestWidgetsFlutterBinding.ensureInitialized();

  test('extract ONEFOP schema from the authoritative AST and write it', () {
    final schema = _buildSchema();
    final jsonStr = _encode(schema);

    final file = File(_outputPath);
    file.parent.createSync(recursive: true);
    file.writeAsStringSync(jsonStr, encoding: utf8);

    // ---- structural validation -------------------------------------
    final entities = schema['entities'] as Map<String, dynamic>;
    expect(entities.length, _entityTypes.length,
        reason: 'all seven entity types must be traversable');

    var totalTables = 0;
    var totalConditionalFields = 0;
    var totalFormulaCells = 0;

    for (final et in _entityTypes) {
      final key = entityTypeForSchema(et);
      final entity = entities[key] as Map<String, dynamic>;
      final sections = entity['sections'] as List;
      expect(sections, isNotEmpty,
          reason: '$key must compile to at least one section');

      final fieldIdsSeen = <String>{};
      for (final sectionRaw in sections) {
        final section = sectionRaw as Map<String, dynamic>;
        expect(section['id'], isA<String>());
        expect((section['id'] as String).isNotEmpty, isTrue);

        for (final subRaw in section['subsections'] as List) {
          final sub = subRaw as Map<String, dynamic>;
          expect(sub['title'], isNotNull,
              reason: 'a subsection must carry a bilingual title');
          expect((sub['title'] as Map)['fr'], isA<String>());
          expect((sub['title'] as Map)['en'], isA<String>());
          expect(sub['fieldIds'], isNotEmpty);
        }

        for (final fieldRaw in section['fields'] as List) {
          final field = fieldRaw as Map<String, dynamic>;
          final id = field['id'] as String;
          expect(id.isNotEmpty, isTrue, reason: 'field id must be stable/non-empty');
          expect(fieldIdsSeen.add(id), isTrue,
              reason: 'field id "$id" must be unique within $key\'s schema');

          expect(_knownFieldTypes, contains(field['type']),
              reason: 'field type "${field['type']}" on $id is not in the '
                  'known serializable set — a new AstFieldType value was '
                  'added without updating this extractor');

          expect(field['label'], isNotNull,
              reason: 'FormQuestionAst.label is non-nullable — every '
                  'compiled field must carry a bilingual label');

          final visibility = field['visibility'];
          if (visibility != null) {
            totalConditionalFields++;
            expect(['eq', 'contains'], contains(visibility['dependsOperator']),
                reason: 'only eq/contains are supported operators');
          }

          final table = field['table'];
          if (table != null) {
            totalTables++;
            final vt = table['vt'];
            if (vt != null) {
              for (final cellRaw in vt['cells'] as List) {
                final cell = cellRaw as Map<String, dynamic>;
                if (cell['formula'] != null) {
                  totalFormulaCells++;
                  expect(cell['formula'], 'sum-of-siblings',
                      reason: 'no formula identifier other than '
                          'sum-of-siblings has been verified to exist');
                }
              }
            }
          }
        }
      }
    }

    // ---- round-trip / file validation --------------------------------
    expect(file.existsSync(), isTrue);
    final reparsed = jsonDecode(file.readAsStringSync());
    expect(reparsed, isA<Map<String, dynamic>>());

    // ---- in-process determinism check ---------------------------------
    final secondPass = _encode(_buildSchema());
    expect(secondPass, jsonStr,
        reason: 'extraction must be byte-for-byte deterministic between '
            'in-process runs');

    // ---- statistics report ---------------------------------------------
    final astSections = ast.allSections.length;
    final astQuestions = ast.allQuestions.length;
    // ignore: avoid_print
    print('\n================ ONEFOP SCHEMA EXTRACTION REPORT ================');
    // ignore: avoid_print
    print('Raw AST sections:  $astSections'
        '${astSections == 22 ? ' (matches expected 22)' : ' (expected 22 in the migration plan — see discrepancy note)'}');
    // ignore: avoid_print
    print('Raw AST questions: $astQuestions'
        '${astQuestions == 332 ? ' (matches expected 332)' : ' (expected 332 in the migration plan — see discrepancy note)'}');
    for (final et in _entityTypes) {
      final key = entityTypeForSchema(et);
      final entity = entities[key] as Map<String, dynamic>;
      // ignore: avoid_print
      print('  $key: sections=${entity['sectionCount']} '
          'fields=${entity['fieldCount']} tables=${entity['tableCount']}');
    }
    // ignore: avoid_print
    print('Conditional fields (has visibility rule): $totalConditionalFields');
    // ignore: avoid_print
    print('Table fields (all entities, non-unique across entities): $totalTables');
    // ignore: avoid_print
    print('Formula-bearing cells (sum-of-siblings): $totalFormulaCells');
    // ignore: avoid_print
    print('Output written to: $_outputPath');
    // ignore: avoid_print
    print('===================================================================\n');
  });
}
