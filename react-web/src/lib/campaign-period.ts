// src/lib/campaign-period.ts
//
// The questionnaire's reference period, taken from the active campaign
// round instead of the years written into the question wording.
//
// The canonical AST (lib/core/focus/compiler/onefop_ast.dart) carries the
// period-based questions with a placeholder date phrase — « du 1er Janvier
// 2026 à ce jour », « du premier Janvier 2025 à ce jour », « from the 1st of
// January 2025 to the present day », « from 1st January 2026 to date ».
// Flutter swaps those phrases for the round's period at runtime
// (OnefopFormController._applyCampaignPeriodLabels) and the PDF prints the
// submission's own period ({{collectionPeriodFr}} in
// src/services/pdf-data-mapper.service.ts). This file does the same for the
// React wizard, so all three show one period.
//
// The phrase is matched by pattern rather than by a list of question ids:
// every phrase of this shape is a placeholder (Flutter's comment says so),
// including the project-programme questions (PP_S4Q01-06) and the English
// « from 1st January … to date » variant that Flutter's id/phrase lists
// miss. The schema JSON itself is never edited (CLAUDE.md §3).
import type { LocalizedText, OnefopField, OnefopSchema } from "./onefop-schema";

/** The round's data-collection period; null when the server sent none. */
export interface CampaignPeriod {
  start: Date | null;
  end: Date | null;
}

/** From GET /onefop/active-quarter's periodStart/periodEnd. */
export function campaignPeriodFrom(
  quarter: { periodStart?: string | null; periodEnd?: string | null } | null | undefined,
): CampaignPeriod {
  const parse = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return { start: parse(quarter?.periodStart), end: parse(quarter?.periodEnd) };
}

// The server stores period bounds as calendar dates at midnight UTC
// (CampaignService.computeCollectionPeriod); format them in UTC so a
// browser west of Greenwich does not show the previous day.
function formatDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

// Flutter's wording for an unset bound (OnefopFormController._undefined),
// so a missing period reads as missing, never as a made-up date.
const NOT_SET: LocalizedText = { fr: "non définie", en: "not set" };

/** « du 01/01/2026 au 30/06/2026 » / « from 01/01/2026 to 30/06/2026 ». */
export function periodPhrase(period: CampaignPeriod): LocalizedText {
  const start = (locale: "fr" | "en") => (period.start ? formatDate(period.start) : NOT_SET[locale]);
  const end = (locale: "fr" | "en") => (period.end ? formatDate(period.end) : NOT_SET[locale]);
  return {
    fr: `du ${start("fr")} au ${end("fr")}`,
    en: `from ${start("en")} to ${end("en")}`,
  };
}

// The AST's placeholder phrases (see header).
const FR_PLACEHOLDER = /du (?:1er|premier) Janvier \d{4} à ce jour/g;
const EN_PLACEHOLDER = /from (?:the )?1st (?:of )?January \d{4} to (?:the present day|date)/g;
// Vocational training's « pour l'année antérieur (2024-2025) »: the
// academic year before the campaign's — (Y-2)-(Y-1) for a campaign ending
// in year Y, which is what the AST prints for 2026.
const FR_PRIOR_ACADEMIC_YEAR = /pour l'année antérieur \(\d{4}-\d{4}\)/g;

function rewrite(text: LocalizedText | null, period: CampaignPeriod): LocalizedText | null {
  if (!text) return text;
  const phrase = periodPhrase(period);
  const year = period.end?.getUTCFullYear();
  const prior = year ? `pour l'année antérieur (${year - 2}-${year - 1})` : `pour l'année antérieur (${NOT_SET.fr})`;
  const fr = text.fr.replace(FR_PLACEHOLDER, phrase.fr).replace(FR_PRIOR_ACADEMIC_YEAR, prior);
  const en = text.en.replace(EN_PLACEHOLDER, phrase.en);
  return fr === text.fr && en === text.en ? text : { fr, en };
}

function rewriteField(field: OnefopField, period: CampaignPeriod): OnefopField {
  const label = rewrite(field.label, period);
  const hint = rewrite(field.hint, period);
  const instruction = rewrite(field.instruction, period);
  return label === field.label && hint === field.hint && instruction === field.instruction
    ? field
    : { ...field, label, hint, instruction };
}

/** The schema with every placeholder period replaced by the round's period. */
export function withCampaignPeriod(schema: OnefopSchema, period: CampaignPeriod): OnefopSchema {
  const entities = Object.fromEntries(
    Object.entries(schema.entities).map(([key, entity]) => [
      key,
      {
        ...entity,
        sections: entity.sections.map((section) => ({
          ...section,
          title: rewrite(section.title, period),
          description: rewrite(section.description, period),
          subsections: section.subsections.map((sub) => ({ ...sub, title: rewrite(sub.title, period) })),
          fields: section.fields.map((field) => rewriteField(field, period)),
        })),
      },
    ]),
  );
  return { ...schema, entities };
}

/**
 * Column headers of the project-programme KPI table (KPI_PERIODS order:
 * current, outlook_dec, outlook_june). « current » is the round's period.
 * The outlooks name no date or year: which year « fin juin » refers to (the
 * campaign's, or the one after the December outlook) is awaiting ONEFOP's
 * answer, so they use the official PDF's wording
 * (src/pdf/i18n/fr.json projectProgram.outcomes) until then.
 */
export function kpiPeriodLabels(period: CampaignPeriod): LocalizedText[] {
  const phrase = periodPhrase(period);
  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return [
    { fr: capitalise(phrase.fr), en: capitalise(phrase.en) },
    { fr: "Perspectives à fin Décembre", en: "Outlook at end of December" },
    { fr: "Perspectives à fin Juin", en: "Outlook at end of June" },
  ];
}
