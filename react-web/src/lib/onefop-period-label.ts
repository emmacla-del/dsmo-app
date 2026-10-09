// Respondent-facing names for two codes the submission receipt used to show
// raw: the reference period ("QUARTERLY_2026_T4_001", "2026-T4") and the
// questionnaire's entity type ("vocationalTraining").
//
// Campaign codes follow src/campaign/campaign-period.helper.ts:
// QUARTERLY_<year>_T<n>_<seq>, SEMESTER_<year>_S<n>_<seq>, ANNUAL_<year>_AN_<seq>;
// the fallback period (no campaign) is "<year>-T<n>". An unrecognised code is
// returned unchanged rather than guessed at.

type Locale = "fr" | "en";

const QUARTER_FR = ["1er", "2e", "3e", "4e"];
const SEMESTER_FR = ["1er", "2e"];

const ORDINAL_EN = ["1st", "2nd", "3rd", "4th"];

type Period =
  | { kind: "quarter"; year: string; n: number }
  | { kind: "semester"; year: string; n: number }
  | { kind: "annual"; year: string };

function parsePeriod(code: string | null | undefined): Period | null {
  if (!code) return null;
  const quarter = /^(?:QUARTERLY_)?(\d{4})[-_]T([1-4])(?:_\d+)?$/.exec(code);
  if (quarter) return { kind: "quarter", year: quarter[1], n: Number(quarter[2]) };
  const semester = /^SEMESTER_(\d{4})_S([12])(?:_\d+)?$/.exec(code);
  if (semester) return { kind: "semester", year: semester[1], n: Number(semester[2]) };
  const annual = /^ANNUAL_(\d{4})_AN(?:_\d+)?$/.exec(code);
  if (annual) return { kind: "annual", year: annual[1] };
  return null;
}

/** A short label: "4e trimestre 2026", "Q4 2026", "Année 2026"… An unknown code is returned as is. */
export function referencePeriodLabel(code: string | null | undefined, locale: Locale): string {
  const p = parsePeriod(code);
  if (!p) return code ?? "";
  if (p.kind === "quarter") return locale === "fr" ? `${QUARTER_FR[p.n - 1]} trimestre ${p.year}` : `Q${p.n} ${p.year}`;
  if (p.kind === "semester") return locale === "fr" ? `${SEMESTER_FR[p.n - 1]} semestre ${p.year}` : `H${p.n} ${p.year}`;
  return locale === "fr" ? `Année ${p.year}` : `Year ${p.year}`;
}

/**
 * The period inside a sentence, with its article: `forPeriod` ("pour le 4e
 * trimestre 2026", "for the 4th quarter of 2026") and `inRespectOf` ("au titre
 * du 4e trimestre 2026", "au titre de l'année 2026"). Null for an unknown code,
 * so the caller falls back to general wording rather than quoting a code.
 */
export function referencePeriodPhrases(
  code: string | null | undefined,
  locale: Locale,
): { forPeriod: string; inRespectOf: string; campaign: string } | null {
  const p = parsePeriod(code);
  if (!p) return null;
  if (locale === "en") {
    const noun =
      p.kind === "quarter" ? `the ${ORDINAL_EN[p.n - 1]} quarter of ${p.year}`
      : p.kind === "semester" ? `the ${ORDINAL_EN[p.n - 1]} half of ${p.year}`
      : `the year ${p.year}`;
    return { forPeriod: `for ${noun}`, inRespectOf: `for ${noun}`, campaign: `Campaign for ${noun}` };
  }
  if (p.kind === "annual") {
    return { forPeriod: `pour l'année ${p.year}`, inRespectOf: `au titre de l'année ${p.year}`, campaign: `Campagne de l'année ${p.year}` };
  }
  const noun = p.kind === "quarter" ? `${QUARTER_FR[p.n - 1]} trimestre ${p.year}` : `${SEMESTER_FR[p.n - 1]} semestre ${p.year}`;
  return { forPeriod: `pour le ${noun}`, inRespectOf: `au titre du ${noun}`, campaign: `Campagne du ${noun}` };
}

// Same wording as the registration form's entity choice (registerPage.entityOption*).
const ENTITY_LABELS: Record<string, { fr: string; en: string }> = {
  enterprise: { fr: "Entreprise", en: "Enterprise" },
  cooperative: { fr: "Coopérative", en: "Cooperative" },
  ctd: { fr: "Collectivité territoriale", en: "Local authority" },
  ong: { fr: "ONG ou association", en: "NGO or association" },
  administration: { fr: "Administration publique", en: "Public administration" },
  projectProgram: { fr: "Projet ou programme", en: "Project or programme" },
  vocationalTraining: { fr: "Centre de formation professionnelle", en: "Vocational training centre" },
};

export function entityTypeDisplayName(entityType: string | null | undefined, locale: Locale): string {
  if (!entityType) return "";
  return ENTITY_LABELS[entityType]?.[locale] ?? entityType;
}
