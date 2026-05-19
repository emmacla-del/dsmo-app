import 'csp_cell_ref.dart';

class CspCursorBuilder {
  /// Builds a 2D grid of cells for table navigation
  /// Layout: rows = CSP types, columns = gender/age combinations
  static List<List<CspCellRef>> build2D() {
    const cspList = ['executives', 'foremen', 'fieldWorkers'];
    const ageFields = AgeField.values;
    const genders = GenderType.values;

    return [
      for (final csp in cspList)
        [
          for (final field in ageFields)
            for (final gender in genders)
              CspCellRef(
                csp: csp,
                ageField: field,
                gender: gender,
              ),
        ],
    ];
  }

  /// Builds a linear list for compatibility
  static List<CspCellRef> build() {
    const cspList = ['executives', 'foremen', 'fieldWorkers'];

    const ageFields = AgeField.values;

    const genders = GenderType.values;

    final result = <CspCellRef>[];

    for (final csp in cspList) {
      for (final field in ageFields) {
        for (final gender in genders) {
          result.add(
            CspCellRef(
              csp: csp,
              ageField: field,
              gender: gender,
            ),
          );
        }
      }
    }

    return result;
  }
}
