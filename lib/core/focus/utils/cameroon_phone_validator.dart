import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../i18n/l10n_ext.dart';

/// Returns null if valid, error message if invalid.
String? cameroonPhoneError(BuildContext context, String? value, {bool required = true}) {
  final l10n = context.l10n;
  if (value == null || value.isEmpty) {
    return required ? l10n.requiredField : null;
  }
  if (value.length != 9) {
    return l10n.telExactly9Digits;
  }
  if (value[0] != '2' && value[0] != '6') {
    return l10n.telMustStartWith2Or6;
  }
  return null;
}

bool isValidCameroonPhone(BuildContext context, String? value) =>
    cameroonPhoneError(context, value) == null;

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
