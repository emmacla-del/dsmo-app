import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class TrainingTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const TrainingTable({
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
    final numRows = spec['rows'] as int? ?? 3;
    final rawPrefix = spec['prefix'] as String? ?? field.id;
    final prefix = rawPrefix.toLowerCase();

    final matrix = _buildMatrix(prefix, numRows);
    final renderSpec = SpreadsheetCompiler.compileTraining(
      id: field.id,
      matrix: matrix,
      numRows: numRows,
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

  List<List<String>> _buildMatrix(String prefix, int numRows) {
    final matrix = <List<String>>[];

    for (int i = 0; i < numRows; i++) {
      final rowNum = i + 1;
      matrix.add([
        '${prefix}_training_${rowNum}_text',
        '${prefix}_training_${rowNum}_male',
        '${prefix}_training_${rowNum}_female',
        '${prefix}_training_${rowNum}_total',
      ]);
    }

    matrix.add([
      '${prefix}_total_placeholder',
      '${prefix}_total_male',
      '${prefix}_total_female',
      '${prefix}_total_total',
    ]);

    return matrix;
  }
}
