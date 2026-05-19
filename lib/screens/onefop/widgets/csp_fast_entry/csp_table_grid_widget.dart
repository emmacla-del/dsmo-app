import 'package:flutter/material.dart';
import '../../../../onefop_form_models.dart';
import '../../../../core/theme/onefop_colors.dart';
import '../../../../core/theme/typography.dart';
import 'csp_cell_ref.dart';

/// Display the full CSP table in a grid format for reference during data entry
class CspTableGridWidget extends StatelessWidget {
  final CspGenderAgeTable table;
  final CspCellRef? highlightCell;

  const CspTableGridWidget({
    super.key,
    required this.table,
    this.highlightCell,
  });

  static const _cspLabels = {
    'executives': 'Cadres/Executives',
    'foremen': 'Agents de Maîtrise',
    'fieldWorkers': 'Agents d\'exécution',
  };

  static const _ageLabels = {
    AgeField.age15_24: '15-24',
    AgeField.age25_34: '25-34',
    AgeField.age35plus: '35+',
  };

  int? _getCellValue(String csp, AgeField age, GenderType gender) {
    final breakdown = switch (csp) {
      'executives' => table.executives,
      'foremen' => table.foremen,
      'fieldWorkers' => table.fieldWorkers,
      _ => table.executives,
    };

    final genderData =
        gender == GenderType.male ? breakdown.male : breakdown.female;

    return switch (age) {
      AgeField.age15_24 => genderData.age15_24,
      AgeField.age25_34 => genderData.age25_34,
      AgeField.age35plus => genderData.age35plus,
    };
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(
          color: OnefopColors.card,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: OnefopColors.border, width: 0.5),
        ),
        child: DataTable(
          headingRowColor: const WidgetStatePropertyAll(OnefopColors.surface),
          dataRowMinHeight: 48,
          dataRowMaxHeight: 48,
          headingRowHeight: 56,
          columns: [
            DataColumn(
              label: Text(
                'Sex/Gender',
                style: mono(10, weight: FontWeight.w600, color: Colors.white70),
              ),
            ),
            // Male columns
            for (final age in AgeField.values)
              DataColumn(
                label: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Male',
                      style: mono(9,
                          weight: FontWeight.w600, color: OnefopColors.teal),
                    ),
                    Text(
                      _ageLabels[age]!,
                      style: mono(8, color: Colors.white54),
                    ),
                  ],
                ),
              ),
            DataColumn(
              label: Text(
                'M Total',
                style: mono(9, weight: FontWeight.w600),
              ),
            ),
            // Female columns
            for (final age in AgeField.values)
              DataColumn(
                label: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Female',
                      style: mono(9,
                          weight: FontWeight.w600, color: Colors.pinkAccent),
                    ),
                    Text(
                      _ageLabels[age]!,
                      style: mono(8, color: Colors.white54),
                    ),
                  ],
                ),
              ),
            DataColumn(
              label: Text(
                'F Total',
                style: mono(9, weight: FontWeight.w600),
              ),
            ),
            DataColumn(
              label: Text(
                'TOTAL',
                style:
                    mono(10, weight: FontWeight.bold, color: OnefopColors.teal),
              ),
            ),
          ],
          rows: [
            for (final csp in ['executives', 'foremen', 'fieldWorkers'])
              _buildRow(csp),
            _buildTotalRow(),
          ],
        ),
      ),
    );
  }

  DataRow _buildRow(String csp) {
    final breakdown = switch (csp) {
      'executives' => table.executives,
      'foremen' => table.foremen,
      'fieldWorkers' => table.fieldWorkers,
      _ => table.executives,
    };

    final maleTotal = (breakdown.male.age15_24 ?? 0) +
        (breakdown.male.age25_34 ?? 0) +
        (breakdown.male.age35plus ?? 0);

    final femaleTotal = (breakdown.female.age15_24 ?? 0) +
        (breakdown.female.age25_34 ?? 0) +
        (breakdown.female.age35plus ?? 0);

    final total = maleTotal + femaleTotal;

    return DataRow(
      color: WidgetStatePropertyAll(
        total > 0
            ? OnefopColors.surface.withValues(alpha: 0.3)
            : OnefopColors.surface.withValues(alpha: 0.1),
      ),
      cells: [
        DataCell(
          Text(
            _cspLabels[csp] ?? csp,
            style: mono(9, weight: FontWeight.w600),
          ),
        ),
        // Male columns
        for (final age in AgeField.values)
          DataCell(
            _buildCellWidget(
              csp,
              age,
              GenderType.male,
              _getCellValue(csp, age, GenderType.male),
            ),
          ),
        DataCell(
          Text(
            '$maleTotal',
            style: mono(10, weight: FontWeight.bold, color: OnefopColors.teal),
          ),
        ),
        // Female columns
        for (final age in AgeField.values)
          DataCell(
            _buildCellWidget(
              csp,
              age,
              GenderType.female,
              _getCellValue(csp, age, GenderType.female),
            ),
          ),
        DataCell(
          Text(
            '$femaleTotal',
            style: mono(10, weight: FontWeight.bold, color: Colors.pinkAccent),
          ),
        ),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: OnefopColors.teal.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$total',
              style:
                  mono(11, weight: FontWeight.bold, color: OnefopColors.teal),
            ),
          ),
        ),
      ],
    );
  }

  DataRow _buildTotalRow() {
    final maleTotal = _sumAllMale();
    final femaleTotal = _sumAllFemale();
    final grandTotal = maleTotal + femaleTotal;

    return DataRow(
      color:
          WidgetStatePropertyAll(OnefopColors.surface.withValues(alpha: 0.6)),
      cells: [
        DataCell(
          Text(
            'TOTAL',
            style: mono(10, weight: FontWeight.bold, color: OnefopColors.teal),
          ),
        ),
        // Male age columns (populated with age totals)
        for (final age in AgeField.values)
          DataCell(
            Text(
              '${_sumMaleByAge(age)}',
              style: mono(10, weight: FontWeight.bold),
            ),
          ),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: OnefopColors.teal.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$maleTotal',
              style:
                  mono(11, weight: FontWeight.bold, color: OnefopColors.teal),
            ),
          ),
        ),
        // Female age columns
        for (final age in AgeField.values)
          DataCell(
            Text(
              '${_sumFemaleByAge(age)}',
              style: mono(10, weight: FontWeight.bold),
            ),
          ),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.pinkAccent.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$femaleTotal',
              style:
                  mono(11, weight: FontWeight.bold, color: Colors.pinkAccent),
            ),
          ),
        ),
        DataCell(
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: OnefopColors.teal.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$grandTotal',
              style:
                  mono(12, weight: FontWeight.bold, color: OnefopColors.teal),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCellWidget(
      String csp, AgeField age, GenderType gender, int? value) {
    final isHighlighted = highlightCell?.csp == csp &&
        highlightCell?.ageField == age &&
        highlightCell?.gender == gender;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: isHighlighted
            ? OnefopColors.teal.withValues(alpha: 0.4)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        '${value ?? 0}',
        style: mono(
          10,
          weight: isHighlighted ? FontWeight.bold : FontWeight.normal,
          color: isHighlighted ? OnefopColors.teal : Colors.white,
        ),
      ),
    );
  }

  int _sumAllMale() {
    return (table.executives.male.age15_24 ?? 0) +
        (table.executives.male.age25_34 ?? 0) +
        (table.executives.male.age35plus ?? 0) +
        (table.foremen.male.age15_24 ?? 0) +
        (table.foremen.male.age25_34 ?? 0) +
        (table.foremen.male.age35plus ?? 0) +
        (table.fieldWorkers.male.age15_24 ?? 0) +
        (table.fieldWorkers.male.age25_34 ?? 0) +
        (table.fieldWorkers.male.age35plus ?? 0);
  }

  int _sumAllFemale() {
    return (table.executives.female.age15_24 ?? 0) +
        (table.executives.female.age25_34 ?? 0) +
        (table.executives.female.age35plus ?? 0) +
        (table.foremen.female.age15_24 ?? 0) +
        (table.foremen.female.age25_34 ?? 0) +
        (table.foremen.female.age35plus ?? 0) +
        (table.fieldWorkers.female.age15_24 ?? 0) +
        (table.fieldWorkers.female.age25_34 ?? 0) +
        (table.fieldWorkers.female.age35plus ?? 0);
  }

  int _sumMaleByAge(AgeField age) {
    final exec = switch (age) {
      AgeField.age15_24 => table.executives.male.age15_24 ?? 0,
      AgeField.age25_34 => table.executives.male.age25_34 ?? 0,
      AgeField.age35plus => table.executives.male.age35plus ?? 0,
    };
    final foremen = switch (age) {
      AgeField.age15_24 => table.foremen.male.age15_24 ?? 0,
      AgeField.age25_34 => table.foremen.male.age25_34 ?? 0,
      AgeField.age35plus => table.foremen.male.age35plus ?? 0,
    };
    final workers = switch (age) {
      AgeField.age15_24 => table.fieldWorkers.male.age15_24 ?? 0,
      AgeField.age25_34 => table.fieldWorkers.male.age25_34 ?? 0,
      AgeField.age35plus => table.fieldWorkers.male.age35plus ?? 0,
    };
    return exec + foremen + workers;
  }

  int _sumFemaleByAge(AgeField age) {
    final exec = switch (age) {
      AgeField.age15_24 => table.executives.female.age15_24 ?? 0,
      AgeField.age25_34 => table.executives.female.age25_34 ?? 0,
      AgeField.age35plus => table.executives.female.age35plus ?? 0,
    };
    final foremen = switch (age) {
      AgeField.age15_24 => table.foremen.female.age15_24 ?? 0,
      AgeField.age25_34 => table.foremen.female.age25_34 ?? 0,
      AgeField.age35plus => table.foremen.female.age35plus ?? 0,
    };
    final workers = switch (age) {
      AgeField.age15_24 => table.fieldWorkers.female.age15_24 ?? 0,
      AgeField.age25_34 => table.fieldWorkers.female.age25_34 ?? 0,
      AgeField.age35plus => table.fieldWorkers.female.age35plus ?? 0,
    };
    return exec + foremen + workers;
  }
}
