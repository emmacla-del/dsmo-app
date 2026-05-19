// lib/core/focus/compiler/form_schema_compiler.dart
// ignore_for_file: avoid_print

import '../schema/field_schema.dart';
import '../schema/section_schema.dart';
import '../schema/form_schema_v2.dart';
import '../schema/grid_schema.dart';
import '../schema/navigation_graph.dart';
import '../schema/types.dart';
import 'form_ast.dart';

class FormSchemaCompiler {
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
    }
  }

  static FormSchemaV2 compile({
    required List<SectionAst> sections,
    required List<FormQuestionAst> questions,
    required String entityType,
  }) {
    print('\n🔧 ========== COMPILER DEBUG ==========');
    print('🔧 COMPILING SCHEMA for entity: $entityType');
    print('🔧 Total sections in AST: ${sections.length}');
    print('🔧 Section IDs: ${sections.map((s) => s.id).toList()}');
    print('🔧 Total questions in AST: ${questions.length}');

    // 1. Filter by entity type
    final filteredSections = sections.where((s) {
      if (s.entityTypes == null) {
        print('   ✅ Section ${s.id} - no entity filter (always included)');
        return true;
      }
      final include = s.entityTypes!.contains(entityType);
      print(
          '   ${include ? "✅" : "❌"} Section ${s.id} - entityTypes: ${s.entityTypes}');
      return include;
    }).toList();

    final filteredQuestions = questions.where((q) {
      if (q.entityTypes == null) return true;
      return q.entityTypes!.contains(entityType);
    }).toList();

    print('\n🔧 Filtered sections: ${filteredSections.length}');
    print(
        '🔧 Filtered section IDs: ${filteredSections.map((s) => s.id).toList()}');
    print('🔧 Filtered questions: ${filteredQuestions.length}');

    // 2. Build fields
    final allFields = filteredQuestions
        .map((q) => FieldSchema(
              id: q.id,
              path: q.path ?? '${q.sectionId}.${q.id}',
              type: _getFieldTypeString(q.type),
              label: q.label,
              options: q.options,
              required: q.requiredField,
              hint: q.hint,
              paperCode: q.paperCode,
              tableSpec: q.tableSpec,
              dependsOn: q.dependsOn,
              dependsValue: q.dependsValue,
              questionText: q.label,
              instruction: q.instruction,
              subsection: q.subsection,
            ))
        .toList();

    print('\n🔧 Fields created: ${allFields.length}');

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

      print('🔧 Section ${s.id}: prev=$prevId, next=$nextId');

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
      if (field.type == 'table' && field.tableSpec != null) {
        final grid = _buildGridFromTableSpec(field);
        if (grid != null) {
          grids.add(grid);
        }
      }
    }

    print('\n🔧 Grids created: ${grids.length}');

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

    print(
        '\n🔧 Navigation built: ${next.length} field links, ${gridNeighbors.length} grid neighbors');
    print('\n🔧 ==========================================\n');

    return FormSchemaV2(
      fields: allFields,
      sections: sectionSchemas,
      grids: grids,
      navigation: navigation,
      firstField: allFieldIds.isNotEmpty ? allFieldIds.first : null,
    );
  }

  // Helper to build GridSchema from tableSpec
  static GridSchema? _buildGridFromTableSpec(FieldSchema field) {
    final tableSpec = field.tableSpec;
    if (tableSpec == null) return null;

    final template = tableSpec['template'] as String?;
    final prefix = tableSpec['prefix'] as String? ?? field.id;

    switch (template) {
      case 'csp_gender_age_table':
        return _buildCspGenderAgeGrid(prefix);
      case 'csp_status_gender_table':
        return _buildCspStatusGenderGrid(prefix, tableSpec);
      case 'diploma_gender_age_table':
        return _buildDiplomaGenderAgeGrid(prefix, tableSpec);
      case 'departure_table':
        return _buildDepartureGrid(prefix);
      case 'first_time_workers_table':
        return _buildFirstTimeWorkersGrid(prefix);
      case 'dismissal_unemployment_table':
        return _buildDismissalUnemploymentGrid(prefix);
      case 'internship_table':
        return _buildInternshipGrid(prefix);
      default:
        return null;
    }
  }

  static GridSchema _buildCspGenderAgeGrid(String prefix) {
    final rows = ['cadres', 'foremen', 'workers'];
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

  static GridSchema _buildCspStatusGenderGrid(
      String prefix, Map<String, dynamic> tableSpec) {
    final rows = (tableSpec['rows'] as List?)?.cast<String>() ??
        ['cadres', 'foremen', 'workers'];
    final statuses = ['permanent', 'temporary'];
    final genders = ['male', 'female', 'total'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final status in statuses) {
        for (final gender in genders) {
          rowCells.add('${prefix}_${row}_${status}_$gender');
        }
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final status in statuses) {
      for (final gender in genders) {
        totalRow.add('${prefix}_total_${status}_$gender');
      }
    }
    matrix.add(totalRow);

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

  static GridSchema _buildDepartureGrid(String prefix) {
    final rows = ['cadres', 'foremen', 'workers'];
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

  static GridSchema _buildFirstTimeWorkersGrid(String prefix) {
    final statuses = ['permanent', 'temporary'];
    final rows = ['cadres', 'foremen', 'workers'];
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

  static GridSchema _buildDismissalUnemploymentGrid(String prefix) {
    final rows = ['cadres', 'foremen', 'workers'];
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
}
