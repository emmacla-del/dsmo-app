// lib/core/focus/schema/form_schema_v2.dart

import 'field_schema.dart';
import 'section_schema.dart';
import 'grid_schema.dart';
import 'navigation_graph.dart';

class FormSchemaV2 {
  final List<FieldSchema> fields;
  final List<SectionSchema> sections;
  final List<GridSchema> grids;
  final NavigationGraph navigation;
  final String? firstField;

  const FormSchemaV2({
    required this.fields,
    required this.sections,
    required this.grids,
    required this.navigation,
    this.firstField,
  });

  FieldSchema? getField(String id) {
    try {
      return fields.firstWhere((f) => f.id == id);
    } catch (_) {
      return null;
    }
  }

  SectionSchema? getSection(String id) {
    try {
      return sections.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  GridSchema? getGridForField(String fieldId) {
    for (final grid in grids) {
      for (final row in grid.matrix) {
        if (row.contains(fieldId)) {
          return grid;
        }
      }
    }
    return null;
  }
}
