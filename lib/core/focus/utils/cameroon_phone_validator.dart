import 'package:flutter/services.dart';

/// Returns null if valid, error message if invalid.
String? cameroonPhoneError(String? value, {bool required = true}) {
  if (value == null || value.isEmpty) {
    return required ? 'Champ obligatoire' : null;
  }
  if (value.length != 9) {
    return 'Le numéro doit contenir exactement 9 chiffres';
  }
  if (value[0] != '2' && value[0] != '6') {
    return 'Le numéro doit commencer par 2 (fixe) ou 6 (mobile)';
  }
  return null;
}

bool isValidCameroonPhone(String? value) => cameroonPhoneError(value) == null;

/// Strips non-digits, caps at 9 chars, and blocks any first digit
/// that is not 2 or 6.
final List<TextInputFormatter> kPhoneFormatters = [
  FilteringTextInputFormatter.digitsOnly,
  LengthLimitingTextInputFormatter(9),
  CameroonPhoneFormatter(), // ← was _CameroonPhoneFormatter (private, unusable outside this file)
];

/// Custom formatter: if the user types a first digit that is not 2 or 6,
/// strip it so the field stays empty rather than silently accepting it.
class CameroonPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = newValue.text;
    if (text.isEmpty) return newValue;

    // First character must be 2 or 6
    if (text[0] != '2' && text[0] != '6') {
      // Reject the change — revert to old value
      return oldValue;
    }

    return newValue;
  }
}
