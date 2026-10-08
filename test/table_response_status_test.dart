import 'package:flutter_test/flutter_test.dart';

import 'package:dsmo_app/core/focus/schema/field_schema.dart';
import 'package:dsmo_app/core/focus/utils/field_validator.dart';
import 'package:dsmo_app/core/focus/utils/table_response_status.dart';

FieldSchema _table() => const FieldSchema(
      id: 'S22Q01',
      path: 's22q01',
      type: 'table',
      paperCode: 'S22Q01',
      tableSpec: {
        'template': 'csp_gender_age_table',
        'prefix': 's22q01',
      },
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('missing table status is invalid', () {
    final err = FieldValidator.validate(_table(), {});
    expect(err?.code, ValidationErrorCode.tableResponseRequired);
  });

  test('NONE is a complete empty table, not a silent zero', () {
    final err = FieldValidator.validate(_table(), {
      TableResponseStatus.fieldId('S22Q01'): TableResponseStatus.none,
    });
    expect(err, isNull);
  });

  test('a NOT_APPLICABLE left in an old draft counts as unanswered', () {
    // No longer an answer anyone can give (the server refuses it): the
    // respondent has to choose the table's status again.
    final err = FieldValidator.validate(_table(), {
      TableResponseStatus.fieldId('S22Q01'):
          TableResponseStatus.notApplicable,
    });
    expect(err?.code, ValidationErrorCode.tableResponseRequired);
  });

  test('REPORTED with no cells is incomplete', () {
    final err = FieldValidator.validate(_table(), {
      TableResponseStatus.fieldId('S22Q01'): TableResponseStatus.reported,
    });
    expect(err?.code, ValidationErrorCode.tableFiguresRequired);
  });

  test('REPORTED with an explicit zero is valid', () {
    final err = FieldValidator.validate(_table(), {
      TableResponseStatus.fieldId('S22Q01'): TableResponseStatus.reported,
      's22q01_cadres_male_15_24': 0,
    });
    expect(err, isNull);
  });
}
