// src/lib/register-i18n.ts
//
// The registration wizard's questionnaire strings, in both languages, as
// data rather than as one bilingual sentence.
//
// Every label, hint, option and block heading in register-constants.ts and
// register-options.ts used to be a single string with both languages inside
// it: "Raison sociale/ Company name", "N° d'affiliation CNPS/ CNPS
// affiliation No.". That was a deliberate stopgap from before this app had an
// i18n layer (see the note those files used to carry), and it had three
// costs. The respondent read a label twice, once in a language they had not
// chosen. The label column had to be wide enough for both halves, so labels
// wrapped to two lines and the inputs beside them started at different
// heights. And nothing could be translated independently -- changing the
// English half meant editing a string the French half lived in.
//
// They are {fr, en} pairs now. The pair is NOT produced by splitting on
// "/ ": several labels contain a slash of their own ("Maison mère / Groupe",
// "SAR/SM (RA/HECs)", "Promoteur/Directeur"), and a blind split would have
// cut them in the wrong place. Each one was converted by hand.
//
// These strings stay here rather than in messages/*.json because they are the
// questionnaire's own field set, not UI copy: they are the registration-time
// subset of ONEFOP Section 1, they are versioned with the field keys they
// name, and a translator editing them in isolation from `key` and `required`
// would be editing the questionnaire. Same reason register-summary.ts passes
// them through untouched while routing everything else through next-intl.
export interface LocalizedText {
  fr: string;
  en: string;
}

// The two locales src/i18n/config.ts declares. Narrower than next-intl's
// string locale on purpose: a LocalizedText has exactly these two keys, so
// anything that can index it has to be one of them.
export type UiLocale = "fr" | "en";

// next-intl's useLocale() returns a plain string (and may carry a region,
// e.g. "en-GB"), so every read goes through this rather than casting.
// Unknown locales fall back to French, matching src/i18n/config.ts's
// defaultLocale -- this is a Cameroonian government form and French is the
// language it is written in first.
export function asUiLocale(locale: string | undefined | null): UiLocale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "fr";
}

export function localized(text: LocalizedText, locale: UiLocale): string {
  return text[locale];
}
