import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class FirstTimeWorkersTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const FirstTimeWorkersTable({
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
    final renderSpec = SpreadsheetCompiler.compileFirstTimeWorkers(
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
    const csps = ['cadres', 'foremen', 'workers'];
    const genders = ['male', 'female', 'total'];
    const ages = ['15_24', '25_34', '35_plus'];

    List<String> cspCells(String status, String csp) {
      final cells = <String>[];
      for (final gender in genders) {
        for (final age in ages) {
          cells.add('${prefix}_${status}_${csp}_${gender}_$age');
        }
        cells.add('${prefix}_${status}_${csp}_${gender}_total');
      }
      return cells;
    }

    List<String> subtotalCells(String status) {
      final cells = <String>[];
      for (final gender in genders) {
        for (final age in ages) {
          cells.add('${prefix}_${status}_subtotal_${gender}_$age');
        }
        cells.add('${prefix}_${status}_subtotal_${gender}_total');
      }
      return cells;
    }

    final matrix = <List<String>>[];

    for (final csp in csps) {
      final row = <String>[
        ...cspCells('permanent', csp),
        ...cspCells('temporary', csp),
      ];
      matrix.add(row);
    }

    final subtotalRow = <String>[
      ...subtotalCells('permanent'),
      ...subtotalCells('temporary'),
    ];
    matrix.add(subtotalRow);

    return matrix;
  }
}
