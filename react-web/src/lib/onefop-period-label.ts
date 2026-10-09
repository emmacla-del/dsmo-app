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

export function referencePeriodLabel(code: string | null | undefined, locale: Locale): string {
  if (!code) return "";
  const quarter = /^(?:QUARTERLY_)?(\d{4})[-_]T([1-4])(?:_\d+)?$/.exec(code);
  if (quarter) {
    const [, year, n] = quarter;
    return locale === "fr" ? `${QUARTER_FR[Number(n) - 1]} trimestre ${year}` : `Q${n} ${year}`;
  }
  const semester = /^SEMESTER_(\d{4})_S([12])(?:_\d+)?$/.exec(code);
  if (semester) {
    const [, year, n] = semester;
    return locale === "fr" ? `${SEMESTER_FR[Number(n) - 1]} semestre ${year}` : `H${n} ${year}`;
  }
  const annual = /^ANNUAL_(\d{4})_AN(?:_\d+)?$/.exec(code);
  if (annual) return locale === "fr" ? `Année ${annual[1]}` : `Year ${annual[1]}`;
  return code;
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
