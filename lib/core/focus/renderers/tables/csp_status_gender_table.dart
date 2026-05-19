import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class CSPStatusGenderTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final String entityType;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const CSPStatusGenderTable({
    super.key,
    required this.field,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
    required this.entityType,
    required this.focusManager,
    required this.tableId,
    this.onExitTable,
    this.onExitPrevious,
  });

  @override
  Widget build(BuildContext context) {
    final spec = field.tableSpec!;
    final rawPrefix = spec['prefix'] as String? ?? field.id;
    final prefix = rawPrefix.toLowerCase();

    final matrix = _buildMatrix(prefix);
    final renderSpec = SpreadsheetCompiler.compileCspStatusGender(
      id: field.id,
      matrix: matrix,
      entityType: entityType,
    );

    return GenericSpreadsheetTable(
      spec: renderSpec,
      onExitTable: onExitTable,
      onExitPrevious: onExitPrevious,
      numberValues: numberValues,
      textValues: textValues,
      onNumberChanged: onNumberChanged,
      onTextChanged: onTextChanged,
      focusManager: focusManager,
      tableId: tableId,
    );
  }

  List<List<String>> _buildMatrix(String prefix) {
    final isEnterprise = entityType == 'enterprise';
    final rows = isEnterprise
        ? ['deplaces_internes', 'refugies', 'orphelins']
        : ['cadres', 'foremen', 'workers'];

    final statuses = ['permanent', 'temporary', 'total'];
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

    return matrix;
  }
}
