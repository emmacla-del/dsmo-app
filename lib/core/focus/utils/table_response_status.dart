// Distinguishes a collection table that was skipped, genuinely empty,
// or not applicable. Stored under `${paperCode}_RESPONSE_STATUS`.
//
// Cell values separately distinguish missing (key absent) from zero
// (explicit 0). This status is the table-level statement.

class TableResponseStatus {
  TableResponseStatus._();

  static const reported = 'REPORTED';
  static const none = 'NONE';
  static const notApplicable = 'NOT_APPLICABLE';

  static const values = {reported, none, notApplicable};

  static String fieldId(String paperCode) => '${paperCode}_RESPONSE_STATUS';

  static bool isFieldId(String id) => id.endsWith('_RESPONSE_STATUS');

  static bool isClosed(String? status) =>
      status == none || status == notApplicable;

  static bool isReported(String? status) => status == reported;
}
