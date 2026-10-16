// Stored values shown in the reader's language (defect 7 of the 2026-10-15
// VT run): a respondent function is stored as its French option value, a
// sector by its French name, and English screens showed both in French.
import { RESPONDENT_FUNCTION_OPTIONS, registerOptionLabel } from "./register-options";

type Locale = "fr" | "en";

/**
 * A respondent function in the reader's language: the registration option's
 * label when the stored value is one of the options ("Responsable RH" ->
 * "HR Manager"), else the text as typed. Empty stays empty, so the caller's
 * "not recorded" still shows.
 */
export function respondentFunctionLabel(value: string | null | undefined, locale: Locale): string {
  const stored = (value ?? "").trim();
  return stored ? registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, stored, locale) : "";
}

/** A sector's name in the reader's language: its English name in English when one is set. */
export function sectorLabel(
  sector: { name?: string | null; nameEn?: string | null } | null | undefined,
  locale: Locale,
): string {
  if (!sector) return "";
  if (locale === "en" && sector.nameEn) return sector.nameEn;
  return sector.name ?? "";
}
