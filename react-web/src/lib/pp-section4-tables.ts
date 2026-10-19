// src/lib/pp-section4-tables.ts
//
// Short respondent-facing names for the six Project/Programme Section 4
// tables, so the preliminary quiz's configuration summary and the Section 4
// table list say the same thing about the same table. The full AST question
// still heads each table on screen; these are the labels a list needs.
//
// The numbers are the ones the quiz has always shown ("4.1 Permanents",
// "4.6 Recrut. vulnérables"): Section 4's tables in order. They are form
// numbers, not internal codes, so §8 allows them on a respondent's screen —
// unlike the paper codes S4Q01…S4Q06, which stay off it.

import type { LocalizedText } from "./onefop-schema";

export interface PpSection4Table {
  /** Paper code of the table field (S4Q01 … S4Q06). */
  paperCode: string;
  /** Form number shown to the respondent. */
  number: string;
  name: LocalizedText;
}

export const PP_SECTION4_TABLES: PpSection4Table[] = [
  { paperCode: "S4Q01", number: "4.1", name: { fr: "Permanents recensés", en: "Permanent staff counted" } },
  { paperCode: "S4Q02", number: "4.2", name: { fr: "Temporaires recensés", en: "Temporary staff counted" } },
  { paperCode: "S4Q03", number: "4.3", name: { fr: "Permanents recrutés", en: "Permanent staff recruited" } },
  { paperCode: "S4Q04", number: "4.4", name: { fr: "Temporaires recrutés", en: "Temporary staff recruited" } },
  { paperCode: "S4Q05", number: "4.5", name: { fr: "Recrutements — handicap", en: "Recruitment — disability" } },
  { paperCode: "S4Q06", number: "4.6", name: { fr: "Recrutements — vulnérables", en: "Recruitment — vulnerable" } },
];

const BY_CODE = new Map(PP_SECTION4_TABLES.map((t) => [t.paperCode, t]));

/**
 * "4.1 Permanents recensés" for a Project/Programme Section 4 table, or
 * undefined for any other field — the caller then falls back to the
 * table's own question.
 */
export function ppSection4TableName(
  fieldId: string,
  paperCode: string | null | undefined,
  locale: "fr" | "en",
): string | undefined {
  if (!fieldId.toUpperCase().startsWith("PP_")) return undefined;
  const entry = paperCode ? BY_CODE.get(paperCode.toUpperCase()) : undefined;
  if (!entry) return undefined;
  return `${entry.number} ${entry.name[locale]}`;
}
