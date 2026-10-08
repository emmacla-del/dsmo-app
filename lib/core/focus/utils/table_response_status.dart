// Distinguishes a collection table that was skipped, genuinely empty,
// or not applicable. Stored under `${paperCode}_RESPONSE_STATUS`.
//
// Cell values separately distinguish missing (key absent) from zero
// (explicit 0). This status is the table-level statement.

class TableResponseStatus {
  TableResponseStatus._();

  static const reported = 'REPORTED';
  static const none = 'NONE';

  /// No longer an answer anyone can give: the server refuses it in a final
  /// submission. A value left in an old draft counts as unanswered (the
  /// respondent chooses again); the questionnaire keeps the option only so
  /// older stored records keep their export label.
  static const notApplicable = 'NOT_APPLICABLE';

  static const values = {reported, none};

  static String fieldId(String paperCode) => '${paperCode}_RESPONSE_STATUS';

  static bool isFieldId(String id) => id.endsWith('_RESPONSE_STATUS');

  static bool isClosed(String? status) => status == none;

  static bool isReported(String? status) => status == reported;
}
