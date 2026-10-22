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
//
// What replaces the placeholder is the round's period NAMED, not spelled out
// as two dates: « au cours du trimestre » / "during the quarter", the
// wording the official PDF already uses for the project-programme outcomes
// table (src/pdf/i18n/{fr,en}.json projectProgram.outcomes.current). Owner's
// decision, 2026-10-18. The kind of period comes from the round's own code,
// so a half-yearly or annual round reads as one; a round whose code cannot
// be parsed falls back to the date range rather than naming a kind that is
// not known. The masthead (components/onefop/ModernJobsHeader.tsx) names the
// round too, without its dates (owner, 2026-10-22).
import type { LocalizedText, OnefopField, OnefopSchema } from "./onefop-schema";
import { doualaYear, formatDoualaDate } from "./douala-date";
import { referencePeriodKind } from "./onefop-period-label";

/** The round's data-collection period; null when the server sent none. */
export interface CampaignPeriod {
  start: Date | null;
  end: Date | null;
  /** The round's code ("QUARTERLY_2026_T4_001", "2026-T4"); null when unknown. */
  code: string | null;
}

/** From GET /onefop/active-quarter's periodStart/periodEnd and code. */
export function campaignPeriodFrom(
  quarter:
    | { periodStart?: string | null; periodEnd?: string | null; code?: string | null }
    | null
    | undefined,
): CampaignPeriod {
  const parse = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  return { start: parse(quarter?.periodStart), end: parse(quarter?.periodEnd), code: quarter?.code ?? null };
}

// A period bound is a calendar day stored as midnight of that day, in UTC
// or in Douala depending on the server that built it
// (CampaignService.computeCollectionPeriod uses the server's own zone): the
// round QUARTERLY_2026_T4_001 starts 2026-09-30T23:00:00Z, i.e. 1 Oct in
// Douala. Both read as the intended day in Africa/Douala (lib/douala-date).
function formatDate(date: Date): string {
  return formatDoualaDate(date) ?? "";
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

// « au cours du trimestre », by kind of round. Nothing here names a month,
// a date or a year: that is the point of naming the period instead of
// printing it.
const IN_PERIOD: Record<"quarter" | "semester" | "annual", LocalizedText> = {
  quarter: { fr: "au cours du trimestre", en: "during the quarter" },
  semester: { fr: "au cours du semestre", en: "during the half-year" },
  annual: { fr: "au cours de l'année", en: "during the year" },
};

/**
 * What a question's period placeholder becomes: the round named
 * (« au cours du trimestre »), or — when the round's code says nothing about
 * its kind — the date range, so the respondent is never left without a
 * period at all.
 */
export function inPeriodPhrase(period: CampaignPeriod): LocalizedText {
  const kind = referencePeriodKind(period.code);
  return kind ? IN_PERIOD[kind] : periodPhrase(period);
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
  const phrase = inPeriodPhrase(period);
  // The prior academic year is derived from the period's end date, so with
  // no end date the AST's own year stands: a label that named a year must
  // not come back naming « non définie » instead (the admin file view
  // rewrites from the round's code alone, with no bounds).
  const year = period.end ? doualaYear(period.end) : null;
  const fr = year
    ? text.fr
        .replace(FR_PLACEHOLDER, phrase.fr)
        .replace(FR_PRIOR_ACADEMIC_YEAR, `pour l'année antérieur (${year - 2}-${year - 1})`)
    : text.fr.replace(FR_PLACEHOLDER, phrase.fr);
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
 * current, outlook_dec, outlook_june). « current » is the round itself, in
 * the official PDF's own words — « Réalisations au cours du trimestre » /
 * "Achievements during the quarter"
 * (src/pdf/i18n/{fr,en}.json projectProgram.outcomes.current) — so the
 * wizard, the PDF and Flutter head that column the same way; a round whose
 * kind is unknown keeps the date range.
 * The outlooks name no date or year: which year « fin juin » refers to (the
 * campaign's, or the one after the December outlook) is awaiting ONEFOP's
 * answer, so they use the official PDF's wording until then.
 */
export function kpiPeriodLabels(period: CampaignPeriod): LocalizedText[] {
  const kind = referencePeriodKind(period.code);
  const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const current = kind
    ? { fr: `Réalisations ${IN_PERIOD[kind].fr}`, en: `Achievements ${IN_PERIOD[kind].en}` }
    : ((phrase) => ({ fr: capitalise(phrase.fr), en: capitalise(phrase.en) }))(periodPhrase(period));
  return [
    current,
    { fr: "Perspectives à fin Décembre", en: "Outlook at end of December" },
    { fr: "Perspectives à fin Juin", en: "Outlook at end of June" },
  ];
}
