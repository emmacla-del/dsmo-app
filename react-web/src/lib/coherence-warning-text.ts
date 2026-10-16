// A VT coherence warning in the reviewer's language.
//
// The server stores each warning as a French sentence
// (checkVtCoherence, src/questionnaires/questionnaires.service.ts), with its
// two figures written as "(4.1: 12, hommes)" … "(4.2: 10, hommes)". The
// sentence for each rule code lives in the message catalogue
// (adminDossierPage.coherence.<CODE>); this reads the two figures and the
// sex back out of the stored text. When the code is not one of the VT rules
// or the text does not have that shape, the stored text is shown as it is:
// a warning is never dropped for want of a translation.

export const VT_COHERENCE_CODES = [
  "VT_DIPLOMA_ACADEMIC_PRO_MISMATCH",
  "VT_TRAINEE_SPECIALTY_TOTAL_MISMATCH",
  "VT_TRAINEE_INITIAL_TRAINING_YEAR_MISMATCH",
  "VT_TRAINEE_AGE_ENTRANT_MISMATCH",
  "VT_TRAINEE_EDU_LEVEL_ENTRANT_MISMATCH",
  "VT_TRAINEE_OUTGOING_SPECIALTY_MISMATCH",
  "VT_TRAINER_DIPLOMA_ACADEMIC_PRO_MISMATCH",
  "VT_TRAINER_AGE_MISMATCH",
  "VT_TRAINER_STATUS_MISMATCH",
] as const;

export type VtCoherenceCode = (typeof VT_COHERENCE_CODES)[number];

export interface CoherenceWarningParts {
  code: VtCoherenceCode;
  first: number;
  second: number;
  sex: "male" | "female";
}

const FIGURE = /\(([^():]+):\s*(\d+),\s*(hommes|femmes)\)/g;

export function parseCoherenceWarning(ruleCode: string | null | undefined, description: string | null | undefined): CoherenceWarningParts | null {
  if (!ruleCode || !(VT_COHERENCE_CODES as readonly string[]).includes(ruleCode)) return null;
  const figures = [...String(description ?? "").matchAll(FIGURE)];
  if (figures.length !== 2 || figures[0][3] !== figures[1][3]) return null;
  return {
    code: ruleCode as VtCoherenceCode,
    first: Number(figures[0][2]),
    second: Number(figures[1][2]),
    sex: figures[0][3] === "hommes" ? "male" : "female",
  };
}

/** A translator scoped to adminDossierPage, where the coherence sentences live. */
export type CoherenceTranslate = (key: string, values?: Record<string, string | number>) => string;

/**
 * A coherence warning in the reader's language: the catalogue sentence with
 * the stored figures, or the stored text when it cannot be read. Shared by
 * the file page and the quality centre.
 */
export function coherenceWarningText(
  t: CoherenceTranslate,
  ruleCode: string | null | undefined,
  description: string | null | undefined,
): string {
  const parts = parseCoherenceWarning(ruleCode, description);
  if (!parts) return description ?? "";
  return t(`coherence.${parts.code}`, { first: parts.first, second: parts.second, sex: t(`coherence.${parts.sex}`) });
}
