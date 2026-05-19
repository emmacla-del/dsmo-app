import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class CSPGenderAgeTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const CSPGenderAgeTable({
    super.key,
    required this.field,
    required this.numberValues,
    required this.textValues,
    required this.onNumberChanged,
    required this.onTextChanged,
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
    final renderSpec = SpreadsheetCompiler.compileCspGenderAge(
      id: field.id,
      matrix: matrix,
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
    final rows = ['cadres', 'foremen', 'workers'];
    final ageBands = ['15_24', '25_34', '35_plus', 'total'];

    final matrix = <List<String>>[];

    for (final row in rows) {
      final rowCells = <String>[];
      for (final age in ageBands) {
        rowCells.add('${prefix}_${row}_male_$age');
      }
      for (final age in ageBands) {
        rowCells.add('${prefix}_${row}_female_$age');
      }
      for (final age in ageBands) {
        rowCells.add('${prefix}_${row}_total_$age');
      }
      matrix.add(rowCells);
    }

    final totalRow = <String>[];
    for (final age in ageBands) {
      totalRow.add('${prefix}_total_male_$age');
    }
    for (final age in ageBands) {
      totalRow.add('${prefix}_total_female_$age');
    }
    for (final age in ageBands) {
      totalRow.add('${prefix}_total_total_$age');
    }
    matrix.add(totalRow);

    return matrix;
  }
}
