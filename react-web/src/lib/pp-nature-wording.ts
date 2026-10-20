// src/lib/pp-nature-wording.ts
//
// The project/programme form serves three kinds of body: a project, a
// programme and a supervised structure (PP_S1Q01 « Type d'entité », asked at
// registration and pre-filled into the wizard). The AST words its questions
// for all three at once — « Nom », « Situation du Projet / Programme »,
// « Identification de la structure » — so a programme's respondent was asked
// for the name of a project, and a project's for the identification of a
// structure.
//
// Once PP_S1Q01 is answered, Sections 0 and 1 name the body the respondent
// said they answer for. Display wording only: field ids, cell keys, stored
// values, exports and the official PDF are unchanged. Until it is answered, or
// when the answer is « Autres », the wording names « le projet ou le
// programme », the official PDF's own phrase.
import type { FormData } from "./onefop-schema";

export type PpNatureKind = "project" | "programme" | "structure" | "generic";

/** PP_S1Q01's stored option strings (onefop_ast.dart, register-options.ts). */
const KIND_BY_VALUE: Record<string, PpNatureKind> = {
  "Projet/ Project": "project",
  "Programme/ Program": "programme",
  "Structure sous-tutelle/ Structure under supervision": "structure",
};

export function ppNatureKind(value: unknown): PpNatureKind {
  return (typeof value === "string" && KIND_BY_VALUE[value]) || "generic";
}

/** The kind the form's current answer names. */
export function ppNatureKindOf(data: FormData | undefined): PpNatureKind {
  return ppNatureKind(data?.["PP_S1Q01"]);
}

interface Wording {
  /** « le projet », "the project" — after « dans », « sur », "in", "on". */
  the: string;
  /** « du projet », "of the project". */
  of: string;
}

const WORDING: Record<PpNatureKind, { fr: Wording; en: Wording }> = {
  project: {
    fr: { the: "le projet", of: "du projet" },
    en: { the: "the project", of: "of the project" },
  },
  programme: {
    fr: { the: "le programme", of: "du programme" },
    en: { the: "the programme", of: "of the programme" },
  },
  structure: {
    fr: { the: "la structure", of: "de la structure" },
    en: { the: "the structure", of: "of the structure" },
  },
  generic: {
    fr: { the: "le projet ou le programme", of: "du projet ou du programme" },
    en: { the: "the project or programme", of: "of the project or programme" },
  },
};

export function ppWording(kind: PpNatureKind, locale: "fr" | "en"): Wording {
  return WORDING[kind][locale];
}

/**
 * The label a project-form question carries for this kind of body, or null
 * where the AST's own label stands. Only questions whose wording names the
 * body are listed.
 */
export function ppFieldLabel(fieldId: string, kind: PpNatureKind, locale: "fr" | "en"): string | null {
  const w = ppWording(kind, locale);
  switch (fieldId) {
    case "S0Q02":
      return locale === "fr" ? `Fonction / Titre dans ${w.the}` : `Function / Title in ${w.the}`;
    case "PP_S1Q02":
      return locale === "fr" ? `Nom ${w.of}` : `Name ${w.of}`;
    case "PP_S1Q13":
      return locale === "fr" ? `Situation ${w.of}` : `Status ${w.of}`;
    default:
      return null;
  }
}

/** « Identification du projet »: Section 1's heading, rail entry and card. */
export function ppIdentificationTitle(kind: PpNatureKind, locale: "fr" | "en"): string {
  return `Identification ${ppWording(kind, locale).of}`;
}

/**
 * « Renseignements sur le projet »: Section 2's rail entry. The generic case
 * keeps the rail's former name, since « le projet ou le programme » would not
 * fit on one line of the rail.
 */
const INFORMATION_TITLES: Record<PpNatureKind, { fr: string; en: string }> = {
  project: { fr: "Renseignements sur le projet", en: "Project information" },
  programme: { fr: "Renseignements sur le programme", en: "Programme information" },
  structure: { fr: "Renseignements sur la structure", en: "Structure information" },
  generic: { fr: "Renseignements sur le projet", en: "Project information" },
};

export function ppInformationTitle(kind: PpNatureKind, locale: "fr" | "en"): string {
  return INFORMATION_TITLES[kind][locale];
}
