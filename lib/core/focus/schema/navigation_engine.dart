// lib/core/focus/schema/navigation_engine.dart

import 'form_schema_v2.dart';
import 'types.dart';

class NavigationEngine {
  final FormSchemaV2 schema;

  NavigationEngine(this.schema);

  String? next(String currentId) {
    final result = schema.navigation.getNext(currentId);
    return result;
  }

  String? prev(String currentId) {
    final result = schema.navigation.getPrev(currentId);
    return result;
  }

  // FIX THIS METHOD - USE GRIDS FROM SCHEMA
  String? gridNext(String currentId, Direction direction) {
    // Find which grid contains this field
    final grid = schema.getGridForField(currentId);
    if (grid == null) return null;

    // Get the position of the field in the grid
    final pos = grid.positionOf(currentId);
    if (pos == null) return null;

    // Calculate neighbor based on direction
    switch (direction) {
      case Direction.up:
        if (pos.row > 0) return grid.cell(pos.row - 1, pos.col);
        break;
      case Direction.down:
        if (pos.row + 1 < grid.rowCount) return grid.cell(pos.row + 1, pos.col);
        break;
      case Direction.left:
        if (pos.col > 0) return grid.cell(pos.row, pos.col - 1);
        break;
      case Direction.right:
        if (pos.col + 1 < grid.colCount) return grid.cell(pos.row, pos.col + 1);
        break;
    }
    return null;
  }

  String? getSectionFirstField(String sectionId) {
    final section = schema.getSection(sectionId);
    if (section == null) return null;
    return section.firstField ?? section.fieldIds.first;
  }

  String? getSectionLastField(String sectionId) {
    final section = schema.getSection(sectionId);
    if (section == null) return null;
    return section.lastField ?? section.fieldIds.last;
  }

  String? getSectionOf(String fieldId) {
    for (final section in schema.sections) {
      if (section.fieldIds.contains(fieldId)) return section.id;
    }
    return null;
  }

  String? nextSection(String currentFieldId) {
    final sectionId = getSectionOf(currentFieldId);
    if (sectionId == null) return null;
    final section = schema.getSection(sectionId);
    if (section == null) return null;
    return section.nextSection;
  }

  String? prevSection(String currentFieldId) {
    final sectionId = getSectionOf(currentFieldId);
    if (sectionId == null) return null;
    final section = schema.getSection(sectionId);
    if (section == null) return null;
    return section.prevSection;
  }

  String? jumpToNextSection(String currentFieldId) {
    final nextSectionId = nextSection(currentFieldId);
    if (nextSectionId == null) return null;
    return getSectionFirstField(nextSectionId);
  }

  String? jumpToPrevSection(String currentFieldId) {
    final prevSectionId = prevSection(currentFieldId);
    if (prevSectionId == null) return null;
    return getSectionLastField(prevSectionId);
  }
}
