enum GenderType { male, female }

enum AgeField {
  age15_24,
  age25_34,
  age35plus,
}

class CspCellRef {
  final String csp;
  final AgeField ageField;
  final GenderType gender;

  const CspCellRef({
    required this.csp,
    required this.ageField,
    required this.gender,
  });
}
