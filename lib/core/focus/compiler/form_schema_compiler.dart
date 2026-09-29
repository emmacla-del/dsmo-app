// lib/core/focus/compiler/form_schema_compiler.dart
// ignore_for_file: avoid_print

import '../schema/field_schema.dart';
import '../schema/section_schema.dart';
import '../schema/form_schema_v2.dart';
import '../schema/grid_schema.dart';
import '../schema/navigation_graph.dart';
import '../schema/types.dart';
import '../renderers/vt_table_defs.dart';
import 'form_ast.dart';

class FormSchemaCompiler {
  static void _debug(String message) {
    if (const bool.fromEnvironment('VERBOSE_FORM_LOGS', defaultValue: false)) {
      print(message);
    }
  }

  static String _getFieldTypeString(AstFieldType type) {
    switch (type) {
      case AstFieldType.text:
        return 'text';
      case AstFieldType.number:
        return 'number';
      case AstFieldType.radio:
        return 'radio';
      case AstFieldType.select:
        return 'select';
      case AstFieldType.checkbox:
        return 'checkbox';
      case AstFieldType.table:
        return 'table';
      case AstFieldType.email:
        return 'email';
      case AstFieldType.tel:
        return 'tel';
      case AstFieldType.date:
        return 'date';
      case AstFieldType.textarea:
        return 'textarea';
      case AstFieldType.repeatingTable:
        return 'repeating_table';
    }
  }

  static FormSchemaV2 compile({
    required List<SectionAst> sections,
    required List<FormQuestionAst> questions,
    required String entityType,
  }) {
    _debug('\n🔧 ========== COMPILER DEBUG ==========');
    _debug('🔧 COMPILING SCHEMA for entity: $entityType');
    _debug('🔧 Total sections in AST: ${sections.length}');
    _debug('🔧 Section IDs: ${sections.map((s) => s.id).toList()}');
    _debug('🔧 Total questions in AST: ${questions.length}');

    // 1. Filter by entity type
    final filteredSections = sections.where((s) {
      if (s.entityTypes == null) {
        _debug('   ✅ Section ${s.id} - no entity filter (always included)');
        return true;
      }
      final include = s.entityTypes!.contains(entityType);
      _debug(
          '   ${include ? "✅" : "❌"} Section ${s.id} - entityTypes: ${s.entityTypes}');
      return include;
    }).toList();

    final filteredQuestions = questions.where((q) {
      if (q.entityTypes == null) return true;
      return q.entityTypes!.contains(entityType);
    }).toList();

    _debug('\n🔧 Filtered sections: ${filteredSections.length}');
    _debug(
        '🔧 Filtered section IDs: ${filteredSections.map((s) => s.id).toList()}');
    _debug('🔧 Filtered questions: ${filteredQuestions.length}');

    // 2. Build fields
    final allFields = filteredQuestions
        .map((q) => FieldSchema(
              id: q.id,
              path: q.path ?? '${q.sectionId}.${q.id}',
              type: _getFieldTypeString(q.type),
              label: q.label,
              optionsI18n: q.options,
              required: q.requiredField,
              hint: q.hint,
              paperCode: q.paperCode,
              tableSpec: q.tableSpec,
              dependsOn: q.dependsOn,
              dependsValue: q.dependsValue,
              dependsOperator: q.dependsOperator,
              // questionText stays a plain (French) String as a last-resort
              // fallback only — every render site now prefers the
              // locale-aware `label` (LocalizedText) and falls back to this
              // only when label is null.
              questionText: q.label.fr,
              instruction: q.instruction,
              subsection: q.subsection,
            ))
        .toList();

    _debug('\n🔧 Fields created: ${allFields.length}');

    // 3. Build sections WITH navigation links (FIXED)
    final sectionFieldMap = <String, List<String>>{};
    for (final q in filteredQuestions) {
      sectionFieldMap.putIfAbsent(q.sectionId, () => []).add(q.id);
    }

    final sectionSchemas = <SectionSchema>[];
    for (int i = 0; i < filteredSections.length; i++) {
      final s = filteredSections[i];
      final prevId = i > 0 ? filteredSections[i - 1].id : null;
      final nextId =
          i < filteredSections.length - 1 ? filteredSections[i + 1].id : null;

      _debug('🔧 Section ${s.id}: prev=$prevId, next=$nextId');

      sectionSchemas.add(SectionSchema(
        id: s.id,
        fieldIds: sectionFieldMap[s.id] ?? [],
        firstField: sectionFieldMap[s.id]?.isNotEmpty == true
            ? sectionFieldMap[s.id]!.first
            : null,
        lastField: sectionFieldMap[s.id]?.isNotEmpty == true
            ? sectionFieldMap[s.id]!.last
            : null,
        nextSection: nextId, // ✅ ADDED
        prevSection: prevId, // ✅ ADDED
      ));
    }

    // 4. Build grids for table fields
    final grids = <GridSchema>[];
    for (final field in allFields) {
      if ((field.type == 'table' || field.type == 'repeating_table') &&
          field.tableSpec != null) {
        final template = field.tableSpec!['template'] as String?;
        final grid = (template != null && template.startsWith('vt_'))
            ? _buildVtGrid(field.tableSpec!)
            : (field.type == 'table' ? _buildGridFromTableSpec(field) : null);
        if (grid != null) {
          grids.add(grid);
        }
      }
    }

    _debug('\n🔧 Grids created: ${grids.length}');

    // 5. Build navigation graph (FIXED)
    final allFieldIds = allFields.map((f) => f.id).toList();
    final next = <String, String?>{};
    final prev = <String, String?>{};

    // Field-to-field navigation (simple linear order)
    for (int i = 0; i < allFieldIds.length - 1; i++) {
      next[allFieldIds[i]] = allFieldIds[i + 1];
      prev[allFieldIds[i + 1]] = allFieldIds[i];
    }

    // Build grid neighbors for table navigation (FIXED)
    final gridNeighbors = <String, Map<Direction, String?>>{};

    for (final grid in grids) {
      for (int row = 0; row < grid.matrix.length; row++) {
        for (int col = 0; col < grid.matrix[row].length; col++) {
          final cellId = grid.matrix[row][col];
          final neighbors = <Direction, String?>{};

          if (row > 0) neighbors[Direction.up] = grid.matrix[row - 1][col];
          if (row < grid.matrix.length - 1) {
            neighbors[Direction.down] = grid.matrix[row + 1][col];
          }
          if (col > 0) neighbors[Direction.left] = grid.matrix[row][col - 1];
          if (col < grid.matrix[row].length - 1) {
            neighbors[Direction.right] = grid.matrix[row][col + 1];
          }

          gridNeighbors[cellId] = neighbors;
        }
      }
    }

    final navigation = NavigationGraph(
      next: next,
      prev: prev,
      gridNeighbors: gridNeighbors, // ✅ FIXED - was empty map
    );

    _debug(
        '\n🔧 Navigation built: ${next.length} field links, ${gridNeighbors.length} grid neighbors');
    _debug('\n🔧 ==========================================\n');

    return FormSchemaV2(
      fields: allFields,
      sections: sectionSchemas,
      grids: grids,
      navigation: navigation,
      firstField: allFieldIds.isNotEmpty ? allFieldIds.first : null,
    );
  }

  // VT tables (Sections 4/5/8) never had a GridSchema at all — every
  // vt_* template fell through _buildGridFromTableSpec's `default: return
  // null` below, since none of the hand-written per-template builders
  // there know about VT's shape. Reuses the real VtTableDef
  // (vtTableDefFor, vt_table_defs.dart) instead of re-deriving VT's row/
  // cell layout a second time, so this can never drift from what
  // VtSpreadsheetTable/VtRowEditor actually render and register with
  // ctrl.fm.getNode(id) — see VtTableDef.cellId(). Built from the
  // table's full row list, not the runtime-filtered visible subset
  // (roster/progressiveRows reveal rows as they're filled) — a
  // not-yet-revealed row simply has no live focus target yet, same as
  // any other "schema knows about it, nothing to focus there yet" case.
  static GridSchema? _buildVtGrid(Map<String, dynamic> tableSpec) {
    final template = tableSpec['template'] as String;
    final def = vtTableDefFor(template, tableSpec);
    if (def == null) return null;

    final matrix = <List<String>>[
      for (final row in def.rows)
        [for (final cell in def.cells) def.cellId(row, cell)],
    ];
    return GridSchema(id: def.prefix, matrix: matrix);
  }

  // Helper to build GridSchema from tableSpec
  static GridSchema? _buildGridFromTableSpec(FieldSchema field) {
    final tableSpec = field.tableSpec;
    if (tableSpec == null) return null;

    final template = tableSpec['template'] as String?;
    final prefix = tableSpec['prefix'] as String? ?? field.id;

    switch (template) {
      case 'csp_gender_age_table':
        return _buildCspGenderAgeGrid(prefix, tableSpec);
      case 'csp_status_gender_table':
        return _buildCspStatusGenderGrid(prefix, tableSpec);
      case 'diploma_gender_age_table':
        return _buildDiplomaGenderAgeGrid(prefix, tableSpec);
      case 'departure_table':
        return _buildDepartureGrid(prefix, tableSpec);
      case 'first_time_workers_table':
        return _buildFirstTimeWorkersGrid(prefix, tableSpec);
      case 'dismissal_unemployment_table':
        return _buildDismissalUnemploymentGrid(prefix, tableSpec);
      case 'internship_table':
        return _buildInternshipGrid(prefix);
      case 'vulnerable_table':
      case 'vulnerable_named_rows_table':
        return _buildVulnerableNamedRowsGrid(prefix, tableSpec);
      case 'kpi_period_table':
        return _buildKpiPeriodGrid(prefix, tableSpec);
      default:
        return null;
    }
  }

  static GridSchema _buildCspGenderAgeGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final genders = ['male', 'female', 'total'];
    final ageBands = ['15_24', '25_34', '35_plus'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final gender in genders) {
        for (final age in ageBands) {
          rowCells.add('${prefix}_${row}_${gender}_$age');
        }
        rowCells.add('${prefix}_${row}_${gender}_total');
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final gender in genders) {
      for (final age in ageBands) {
        totalRow.add('${prefix}_total_${gender}_$age');
      }
      totalRow.add('${prefix}_total_${gender}_total');
    }
    matrix.add(totalRow);

    return GridSchema(id: prefix, matrix: matrix);
  }

  /// Optional status dimension of a table. Absent → [fallback] (every
  /// existing table, keys unchanged); an explicit empty list → no status
  /// dimension at all (Administration S21Q03/S21Q04, which have no
  /// permanent/temporary split), giving `${prefix}_${row}_$gender` keys.
  static List<String> _statusesOf(
      Map<String, dynamic> tableSpec, List<String> fallback) {
    final raw = tableSpec['statuses'];
    if (raw is List) return raw.cast<String>();
    return fallback;
  }

  static String _cellKey(String prefix, String row, String? status, String gender) =>
      status == null ? '${prefix}_${row}_$gender' : '${prefix}_${row}_${status}_$gender';

  static GridSchema _buildCspStatusGenderGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final declared = _statusesOf(tableSpec, ['permanent', 'temporary']);
    final List<String?> statuses = declared.isEmpty ? [null] : [...declared];
    final genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in [...rows, 'total']) {
      final rowCells = <String>[];
      for (final status in statuses) {
        for (final gender in genders) {
          rowCells.add(_cellKey(prefix, row, status, gender));
        }
      }
      matrix.add(rowCells);
    }

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildDiplomaGenderAgeGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final diplomas = (tableSpec['rows'] as List?)?.cast<String>() ??
        [
          'CEP/CEPE/FSLC',
          'BEPC/CAP/GCE-OL',
          'PROBATOIRE/Lower Sixth',
          'BAC/GCE-AL',
          'BTS/DUT/HND',
          'Licence (Bac+3)/Bachelor',
          'Maîtrise (Bac+4)/Master 1',
          'Master (Bac+5)/Master 2',
          'DQP/PQD',
          'CQP/CPQ',
          'Autres/Others',
          'Sans diplôme/Without diploma',
        ];
    final genders = ['male', 'female', 'total'];
    final ageBands = ['15_24', '25_34', '35_plus'];

    final matrix = <List<String>>[];

    for (final diploma in diplomas) {
      final sanitizedKey = diploma
          .toLowerCase()
          .replaceAll(' / ', '_')
          .replaceAll('/', '_')
          .replaceAll(' ', '_')
          .replaceAll('(', '')
          .replaceAll(')', '')
          .replaceAll('+', 'plus')
          .replaceAll('é', 'e')
          .replaceAll('è', 'e')
          .replaceAll('ê', 'e')
          .replaceAll('ô', 'o')
          .replaceAll('î', 'i')
          .replaceAll('û', 'u')
          .replaceAll('ç', 'c');
      final rowCells = <String>[];
      for (final gender in genders) {
        for (final age in ageBands) {
          rowCells.add('${prefix}_${sanitizedKey}_${gender}_$age');
        }
        rowCells.add('${prefix}_${sanitizedKey}_${gender}_total');
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final gender in genders) {
      for (final age in ageBands) {
        totalRow.add('${prefix}_total_${gender}_$age');
      }
      totalRow.add('${prefix}_total_${gender}_total');
    }
    matrix.add(totalRow);

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildDepartureGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final departureTypes = [
      'dismissal',
      'resignation',
      'retirement',
      'other',
      'ensemble'
    ];
    final genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final type in departureTypes) {
        for (final gender in genders) {
          rowCells.add('${prefix}_${row}_${type}_$gender');
        }
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final type in departureTypes) {
      for (final gender in genders) {
        totalRow.add('${prefix}_total_${type}_$gender');
      }
    }
    matrix.add(totalRow);

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildFirstTimeWorkersGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final statuses = ['permanent', 'temporary'];
    // Defensive consistency fix only: honor an explicit tableSpec['rows']
    // if one is ever supplied, matching the other CSP/SFP-row builders
    // above — S23Q02 has no Administration (SFP-row) variant today, so
    // this currently always falls back to the CSP default.
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final genders = ['male', 'female', 'total'];
    final ageBands = ['15_24', '25_34', '35_plus'];

    final matrix = <List<String>>[];

    for (final status in statuses) {
      for (final row in rows) {
        final rowCells = <String>[];
        for (final gender in genders) {
          for (final age in ageBands) {
            rowCells.add('${prefix}_${status}_${row}_${gender}_$age');
          }
          rowCells.add('${prefix}_${status}_${row}_${gender}_total');
        }
        matrix.add(rowCells);
      }
      final subtotalRow = <String>[];
      for (final gender in genders) {
        for (final age in ageBands) {
          subtotalRow.add('${prefix}_${status}_subtotal_${gender}_$age');
        }
        subtotalRow.add('${prefix}_${status}_subtotal_${gender}_total');
      }
      matrix.add(subtotalRow);
    }

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildDismissalUnemploymentGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    // Defensive consistency fix only: honor an explicit tableSpec['rows']
    // if one is ever supplied, matching the other CSP/SFP-row builders
    // above. S3Q03 has no Administration variant today (deliberately
    // unimplemented, pending visual PDF verification), so this currently
    // always falls back to the CSP default — not implementing S3Q03 here.
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final types = ['dismissal', 'technical_unemployment', 'total'];
    final genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final type in types) {
        for (final gender in genders) {
          rowCells.add('${prefix}_${row}_${type}_$gender');
        }
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final type in types) {
      for (final gender in genders) {
        totalRow.add('${prefix}_total_${type}_$gender');
      }
    }
    matrix.add(totalRow);

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildInternshipGrid(String prefix) {
    final rows = ['vacation', 'academic', 'professional', 'pre_employment'];
    final genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final gender in genders) {
        rowCells.add('${prefix}_${row}_$gender');
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final gender in genders) {
      totalRow.add('${prefix}_total_$gender');
    }
    matrix.add(totalRow);

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildVulnerableNamedRowsGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    const dataRows = ['deplaces_internes', 'refugies', 'orphelins'];
    // With statuses, a status-total column group follows them (unchanged
    // S22Q05 keys); without, the table is nature × sex only (S21Q04).
    final declared = _statusesOf(tableSpec, ['permanent', 'temporary']);
    final List<String?> statuses =
        declared.isEmpty ? [null] : [...declared, 'total'];
    const genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in [...dataRows, 'total']) {
      final rowCells = <String>[];
      for (final status in statuses) {
        for (final gender in genders) {
          rowCells.add(_cellKey(prefix, row, status, gender));
        }
      }
      matrix.add(rowCells);
    }

    return GridSchema(id: prefix, matrix: matrix);
  }

  static GridSchema _buildKpiPeriodGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['employed', 'self_employed', 'jobs_created', 'trained'];
    final periods = (tableSpec['periods'] as List?)?.cast<String>() ??
        ['current', 'outlook_dec', 'outlook_june'];

    final matrix = <List<String>>[];
    for (final row in rows) {
      final rowCells = <String>[];
      for (final period in periods) {
        rowCells.add('${prefix}_${row}_$period');
      }
      matrix.add(rowCells);
    }

    return GridSchema(id: prefix, matrix: matrix);
  }
}
