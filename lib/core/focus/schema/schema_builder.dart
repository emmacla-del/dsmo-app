// lib/core/focus/schema/schema_builder.dart

import 'field_schema.dart';
import 'section_schema.dart';
import 'grid_schema.dart';
import 'navigation_graph.dart';
import 'form_schema_v2.dart';
import 'types.dart';

class SchemaBuilder {
  static FormSchemaV2 build({
    required List<FieldSchema> fields,
    required List<SectionSchema> sections,
    required List<GridSchema> grids,
    String? firstField,
  }) {
    final next = <String, String?>{};
    final prev = <String, String?>{};
    final gridNeighbors = <String, Map<Direction, String?>>{};

    // Create a map for O(1) lookup
    final sectionMap = {for (final s in sections) s.id: s};

    // 1. Build section-based navigation
    for (int i = 0; i < sections.length; i++) {
      final section = sections[i];
      final fieldIds = section.fieldIds;

      for (int j = 0; j < fieldIds.length; j++) {
        final current = fieldIds[j];

        // Next within section
        if (j + 1 < fieldIds.length) {
          next[current] = fieldIds[j + 1];
          prev[fieldIds[j + 1]] = current;
        } else {
          // Last field: link to next section's first field (if it exists in filtered list)
          if (section.nextSection != null) {
            final nextSection = sectionMap[section.nextSection];
            if (nextSection != null) {
              final nextField =
                  nextSection.firstField ?? nextSection.fieldIds.first;
              next[current] = nextField;
              prev[nextField] = current;
            }
            // If nextSection not in filtered list, just skip (no link)
          }
        }

        // First field: link from previous section's last field (if it exists in filtered list)
        if (j == 0) {
          if (section.prevSection != null) {
            final prevSection = sectionMap[section.prevSection];
            if (prevSection != null) {
              final prevField =
                  prevSection.lastField ?? prevSection.fieldIds.last;
              next[prevField] = current;
              prev[current] = prevField;
            }
            // If prevSection not in filtered list, just skip (no link)
          }
        }
      }
    }

    // 2. Apply field overrides
    for (final field in fields) {
      if (field.next != null) {
        next[field.id] = field.next;
        if (field.next != null) prev[field.next!] = field.id;
      }
      if (field.prev != null) {
        prev[field.id] = field.prev;
        if (field.prev != null) next[field.prev!] = field.id;
      }
    }

    // 3. Build grid neighbors
    for (final grid in grids) {
      gridNeighbors.addAll(grid.neighbors);
    }

    // 4. Determine first field
    final effectiveFirstField = firstField ??
        (sections.isNotEmpty ? sections.first.fieldIds.first : null);

    if (effectiveFirstField == null) {
      throw Exception('No sections available and no firstField specified');
    }

    return FormSchemaV2(
      fields: fields,
      sections: sections,
      grids: grids,
      navigation: NavigationGraph(
        next: next,
        prev: prev,
        gridNeighbors: gridNeighbors,
      ),
      firstField: effectiveFirstField,
    );
  }
}
