// lib/core/focus/campaign_period.dart
//
// The questionnaire's reference period, taken from the active campaign
// round instead of the years written into the question wording.
//
// The AST (compiler/onefop_ast.dart) carries every period-based question
// with a placeholder date phrase — « du 1er Janvier 2026 à ce jour », « du
// premier Janvier 2025 à ce jour », « from the 1st of January 2025 to the
// present day », « from 1st January 2026 to date ». They are replaced by
// pattern, not by a list of question ids, so a question added to the AST
// (e.g. the project-programme PP_S4Q01-06) is covered without being
// registered anywhere. react-web applies the same rewrite
// (react-web/src/lib/campaign-period.ts) and the PDF prints the same period
// ({{collectionPeriodFr}}, src/services/pdf-data-mapper.service.ts); keep
// the three in step.

import '../i18n/localized_text.dart';

/// tableSpec key carrying a KPI table's period headers (List<LocalizedText>),
/// set by OnefopFormController and read by TableRenderer.
const String kKpiPeriodLabelsKey = 'periodLabels';

/// An unset period bound reads as unset, never as a made-up date.
const LocalizedText kPeriodNotSet = LocalizedText(fr: 'non définie', en: 'not set');

String formatCampaignDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

/// « du 01/01/2026 au 30/06/2026 » / « from 01/01/2026 to 30/06/2026 ».
LocalizedText campaignPeriodPhrase(DateTime? start, DateTime? end) {
  String bound(DateTime? d, String unset) => d == null ? unset : formatCampaignDate(d);
  return LocalizedText(
    fr: 'du ${bound(start, kPeriodNotSet.fr)} au ${bound(end, kPeriodNotSet.fr)}',
    en: 'from ${bound(start, kPeriodNotSet.en)} to ${bound(end, kPeriodNotSet.en)}',
  );
}

final RegExp _frPlaceholder = RegExp(r'du (?:1er|premier) Janvier \d{4} à ce jour');
final RegExp _enPlaceholder =
    RegExp(r'from (?:the )?1st (?:of )?January \d{4} to (?:the present day|date)');
// Vocational training's « pour l'année antérieur (2024-2025) »: the academic
// year before the campaign's — (Y-2)-(Y-1) for a period ending in year Y,
// which is what the AST prints for 2026.
final RegExp _frPriorAcademicYear = RegExp(r"pour l'année antérieur \(\d{4}-\d{4}\)");

/// [text] with every placeholder period replaced; the same instance when
/// there is none, so callers can tell nothing changed.
LocalizedText withCampaignPeriod(LocalizedText text, DateTime? start, DateTime? end) {
  final phrase = campaignPeriodPhrase(start, end);
  final year = end?.year;
  final prior = year == null
      ? "pour l'année antérieur (${kPeriodNotSet.fr})"
      : "pour l'année antérieur (${year - 2}-${year - 1})";
  final fr = text.fr.replaceAll(_frPlaceholder, phrase.fr).replaceAll(_frPriorAcademicYear, prior);
  final en = text.en.replaceAll(_enPlaceholder, phrase.en);
  return fr == text.fr && en == text.en ? text : LocalizedText(fr: fr, en: en);
}

/// Column headers of the project-programme KPI table, in the order
/// current, outlook_dec, outlook_june. « current » is the round's period.
/// The outlooks name no date or year: which year « fin juin » refers to (the
/// campaign's, or the one after the December outlook) is awaiting ONEFOP's
/// answer, so they use the official PDF's wording
/// (src/pdf/i18n/fr.json projectProgram.outcomes) until then.
List<LocalizedText> kpiPeriodLabels(DateTime? start, DateTime? end) {
  final phrase = campaignPeriodPhrase(start, end);
  String capitalise(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
  return [
    LocalizedText(fr: capitalise(phrase.fr), en: capitalise(phrase.en)),
    const LocalizedText(fr: 'Perspectives à fin Décembre', en: 'Outlook at end of December'),
    const LocalizedText(fr: 'Perspectives à fin Juin', en: 'Outlook at end of June'),
  ];
}
