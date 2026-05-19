import 'package:flutter/material.dart';
import '../../schema/field_schema.dart';
import '../spreadsheet_compiler.dart';
import '../generic_spreadsheet_table.dart';
import '../../unified_focus_manager_v2.dart';

class DiplomaGenderAgeTable extends StatelessWidget {
  final FieldSchema field;
  final Map<String, int> numberValues;
  final Map<String, String> textValues;
  final Function(String, int) onNumberChanged;
  final Function(String, String) onTextChanged;
  final UnifiedFocusManagerV2 focusManager;
  final String tableId;
  final VoidCallback? onExitTable;
  final VoidCallback? onExitPrevious;

  const DiplomaGenderAgeTable({
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

  static const _diplomaRows = [
    'CEP/CEPE/FSLC',
    'BEPC/CAP/GCE-OL',
    'PROBATOIRE / Lower Sixth',
    'BAC / GCE-AL',
    'BTS / DUT / HND',
    'Licence (Bac+3) / Bachelor',
    'Maîtrise (Bac+4) / Master 1',
    'Master (Bac+5) / Master 2',
    'DQP / PQD',
    'CQP / CPQ',
    'Autres / Others',
    'Sans diplôme / Without diploma',
  ];

  @override
  Widget build(BuildContext context) {
    final spec = field.tableSpec!;
    final rows = (spec['rows'] as List?)?.cast<String>() ?? _diplomaRows;
    final rawPrefix = spec['prefix'] as String? ?? field.id;
    final prefix = rawPrefix.toLowerCase();

    final matrix = _buildMatrix(prefix, rows);
    final renderSpec = SpreadsheetCompiler.compileDiplomaGenderAge(
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

  List<List<String>> _buildMatrix(String prefix, List<String> rows) {
    final genders = ['male', 'female', 'total'];
    final ageBands = ['15_24', '25_34', '35_plus'];
    final matrix = <List<String>>[];

    for (final row in rows) {
      final sanitizedKey = row
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

    return matrix;
  }
}
