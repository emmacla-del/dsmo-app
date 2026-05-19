import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class InternshipTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const InternshipTable({
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
    final renderSpec = SpreadsheetCompiler.compileInternship(
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
    final rows = [
      'stage_vacance',
      'stage_academique',
      'stage_professionnelle',
      'stage_pre_emploi'
    ];
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

    return matrix;
  }
}
