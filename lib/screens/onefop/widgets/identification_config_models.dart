import 'package:flutter/material.dart';

/// ============================================================
/// FIELD CONFIG
/// ============================================================
class FieldConfig {
  final String label;
  final String hint;
  final TextEditingController controller;
  final String focusKey;
  final TextInputType keyboardType;
  final bool isNumber;
  final String? nextFocusKey;

  const FieldConfig({
    required this.label,
    required this.hint,
    required this.controller,
    required this.focusKey,
    this.keyboardType = TextInputType.text,
    this.isNumber = false,
    this.nextFocusKey,
  });
}

/// ============================================================
/// RADIO OPTION
/// ============================================================
class RadioOption<T> {
  final T value;
  final String text;

  const RadioOption({
    required this.value,
    required this.text,
  });
}

/// ============================================================
/// RADIO CONFIG
/// ============================================================
class RadioConfig<T> {
  final String label;
  final List<RadioOption<T>> options;
  final T value;
  final ValueChanged<T?> onChanged;
  final String? nextFocusKey;

  const RadioConfig({
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.nextFocusKey,
  });
}

/// ============================================================
/// SECTION CONFIG
/// ============================================================
class SectionConfig {
  final String title;
  final List<Object> fields;

  const SectionConfig({
    required this.title,
    required this.fields,
  });
}
