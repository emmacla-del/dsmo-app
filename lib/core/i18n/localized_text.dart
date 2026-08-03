import 'package:flutter/widgets.dart';

/// A French/English pair of display text, resolved to a plain [String] at
/// render time via [of]. Used for ONEFOP questionnaire content (titles,
/// labels, hints, instructions) that lives as per-record data rather than
/// static app-chrome strings.
@immutable
class LocalizedText {
  final String fr;
  final String en;

  const LocalizedText({required this.fr, required this.en});

  /// For values that are identical in both languages (acronyms, codes,
  /// language-neutral examples) rather than genuine translations.
  const LocalizedText.same(String value)
      : fr = value,
        en = value;

  String of(Locale locale) => locale.languageCode == 'en' ? en : fr;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalizedText && other.fr == fr && other.en == en);

  @override
  int get hashCode => Object.hash(fr, en);

  @override
  String toString() => 'LocalizedText(fr: $fr, en: $en)';
}

/// An option (radio/select) with a canonical stored [value] — byte-identical
/// to what the backend mappers and `dependsValue` checks expect — and a
/// separate localized display [text]. Only [text] is ever rendered; [value]
/// is what gets stored in form data and submitted.
@immutable
class LocalizedOption {
  final String value;
  final LocalizedText text;

  const LocalizedOption(this.value, this.text);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalizedOption && other.value == value && other.text == text);

  @override
  int get hashCode => Object.hash(value, text);
}
