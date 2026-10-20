// src/lib/register-options.ts
//
// Ported from lib/screens/register_constants.dart's static option lists.
// `value` is the canonical string sent to the backend and MUST NOT change --
// only `label` is presentational.
//
// Labels used to be one bilingual string each ("Urbain/ Urban"). They are
// {fr, en} pairs now: the respondent chose a language and a dropdown that
// answers in both is a dropdown they have to read twice. See register-i18n.ts
// for why these live in TypeScript beside their `value` rather than in
// messages/*.json.
import { localized, type LocalizedText, type UiLocale } from "./register-i18n";
import type { EntityType } from "./register-constants";

export interface RegisterOption {
  value: string;
  label: LocalizedText;
}

/**
 * A stored value shown in the reader's language: the option's label, or the
 * value itself when no option matches. Falling back to the stored value, not
 * to an empty string: an answer the option list does not recognise (a role
 * typed by hand) is still an answer the respondent gave, and must not be
 * silently dropped.
 */
export function registerOptionLabel(
  options: readonly RegisterOption[],
  value: string,
  locale: UiLocale,
): string {
  const option = options.find((o) => o.value === value);
  return option ? localized(option.label, locale) : value;
}

export const LEGAL_STATUS_OPTIONS: RegisterOption[] = [
  {
    value: "Société unipersonnelle",
    label: { fr: "Société unipersonnelle", en: "Sole proprietorship" },
  },
  { value: "SARL", label: { fr: "SARL", en: "SARL" } },
  { value: "SA", label: { fr: "SA", en: "SA" } },
  { value: "SNC", label: { fr: "SNC", en: "SNC" } },
  { value: "Autres", label: { fr: "Autres", en: "Other" } },
];

export const COOPERATIVE_TYPE_OPTIONS: RegisterOption[] = [
  {
    value: "Coopérative simplifiée",
    label: { fr: "Coopérative simplifiée", en: "Simplified cooperative" },
  },
  {
    value: "Coopérative avec conseil d'administration",
    label: {
      fr: "Coopérative avec conseil d'administration",
      en: "Cooperative with board of directors",
    },
  },
  { value: "Autre", label: { fr: "Autre", en: "Other" } },
];

export const CTD_TYPE_OPTIONS: RegisterOption[] = [
  { value: "Région", label: { fr: "Région", en: "Region" } },
  { value: "Commune", label: { fr: "Commune", en: "Municipality" } },
];

// PP_S1Q01 « Type d'entité », asked at registration for a project or
// programme and pre-filled into the wizard. `value` is the questionnaire's
// option string (onefop_ast.dart), what the wizard stores, so the pre-fill
// needs no mapping; the server accepts these four only.
export const PROJECT_NATURE_OPTIONS: RegisterOption[] = [
  { value: "Projet/ Project", label: { fr: "Projet", en: "Project" } },
  { value: "Programme/ Program", label: { fr: "Programme", en: "Programme" } },
  { value: "Structure sous-tutelle/ Structure under supervision", label: { fr: "Structure sous-tutelle", en: "Structure under supervision" } },
  { value: "Autres/ Other", label: { fr: "Autre", en: "Other" } },
];

export const AREA_OPTIONS: RegisterOption[] = [
  { value: "Urbain", label: { fr: "Urbain", en: "Urban" } },
  { value: "Rural", label: { fr: "Rural", en: "Rural" } },
];

// Vocational Training (CFP) registration-time option lists — verbatim from
// the source questionnaire (QUESTIONNAIRE FORMATION PROFESSIONNELLE
// 2025_2026.pdf, §1.10-1.13), not invented. The acronyms differ per language
// because the questionnaire itself gives both (CFPR/IVTC, CFPP/PVTC, …).
export const CFP_TYPE_OPTIONS: RegisterOption[] = [
  {
    value: "SAR/SM (RA/HECs)",
    // The only label whose two halves are not a translation pair: the French
    // and English acronyms are printed together in the source and are read
    // as one code. Left intact rather than split down the middle.
    label: { fr: "SAR/SM", en: "RA/HECs" },
  },
  {
    value: "Centre de Formation Professionnelle Rapide (CFPR)",
    label: {
      fr: "Centre de Formation Professionnelle Rapide (CFPR)",
      en: "Intensive Vocational Training Centre (IVTC)",
    },
  },
  {
    value: "Centre de Formation Professionnelle Privé (CFPP)",
    label: {
      fr: "Centre de Formation Professionnelle Privé (CFPP)",
      en: "Private Vocational Training Centre (PVTC)",
    },
  },
  {
    value: "Centre de Formation aux Métiers (CFM)",
    label: {
      fr: "Centre de Formation aux Métiers (CFM)",
      en: "Trades Training Centre (TTC)",
    },
  },
  {
    value: "Centre de Formation Professionnelle d'Excellence (CFPE)",
    label: {
      fr: "Centre de Formation Professionnelle d'Excellence (CFPE)",
      en: "Advanced Vocational Training Centre (AVTC)",
    },
  },
  {
    value: "Centre de Formation Professionnelle Sectorielles (CFPS)",
    label: {
      fr: "Centre de Formation Professionnelle Sectorielles (CFPS)",
      en: "Sectoral Vocational Training Centre (SVTC)",
    },
  },
  {
    value: "Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)",
    label: {
      fr: "Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)",
      en: "National Institute of Vocational Trainers and Programme Development (NIVTPD)",
    },
  },
];

export const EDUCATION_SYSTEM_OPTIONS: RegisterOption[] = [
  { value: "Public", label: { fr: "Public", en: "Public" } },
  { value: "Privé laïc", label: { fr: "Privé laïc", en: "Lay private" } },
  {
    value: "Privé confessionnel",
    label: { fr: "Privé confessionnel", en: "Private denominational" },
  },
];

export const FUNCTIONAL_STATUS_OPTIONS: RegisterOption[] = [
  { value: "Fonctionnelle", label: { fr: "Fonctionnelle", en: "Functional" } },
  { value: "Non-fonctionnelle", label: { fr: "Non-fonctionnelle", en: "Non-functional" } },
  { value: "Fermée", label: { fr: "Fermée", en: "Closed" } },
];

export const NON_FUNCTIONAL_REASON_OPTIONS: RegisterOption[] = [
  { value: "Manque d'apprenants", label: { fr: "Manque d'apprenants", en: "Lack of trainees" } },
  { value: "Manque de formateur", label: { fr: "Manque de formateur", en: "Lack of trainers" } },
  { value: "Raison d'insécurité", label: { fr: "Raison d'insécurité", en: "Insecurity" } },
  { value: "Agrément non valide", label: { fr: "Agrément non valide", en: "Invalid accreditation" } },
  { value: "Autres", label: { fr: "Autres", en: "Other" } },
];

export const SEX_OPTIONS: RegisterOption[] = [
  // Display wording harmonised to Homme/Femme; `value` is what the backend
  // stores, so it stays unchanged.
  { value: "Masculin", label: { fr: "Homme", en: "Male" } },
  { value: "Féminin", label: { fr: "Femme", en: "Female" } },
];

// Choosing this value asks for the real job in a following field. The payload
// sends that text, not this word.
export const RESPONDENT_FUNCTION_OTHER = "Autre";

// Each entity type offers the titles its respondents actually hold: a commune
// has no DRH and a company no mayor. The stored value is the French title,
// free text downstream (S0Q02, the PDF, the Excel column), so a list can grow
// without touching an export.
export const ENTERPRISE_FUNCTION_OPTIONS: RegisterOption[] = [
  // A DG runs the company: General Manager in English, not CEO, which is
  // the Président-Directeur Général (owner, 2026-10-12).
  { value: "Directeur Général", label: { fr: "Directeur Général", en: "General Manager" } },
  {
    value: "Directeur des Ressources Humaines",
    label: { fr: "Directeur des Ressources Humaines", en: "Human Resources Director" },
  },
  {
    value: "Directeur Administratif et Financier",
    label: {
      fr: "Directeur Administratif et Financier",
      en: "Administrative and Financial Director",
    },
  },
  { value: "Gérant", label: { fr: "Gérant", en: "Manager" } },
  { value: "Chef du Personnel", label: { fr: "Chef du Personnel", en: "Head of Personnel" } },
  { value: "Responsable RH", label: { fr: "Responsable RH", en: "HR Manager" } },
  { value: "Secrétaire Général", label: { fr: "Secrétaire Général", en: "Secretary General" } },
  {
    value: "Président du Conseil d'Administration",
    label: { fr: "Président du Conseil d'Administration", en: "Chairman of the Board" },
  },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const COOPERATIVE_FUNCTION_OPTIONS: RegisterOption[] = [
  {
    value: "Président du Conseil d'Administration",
    label: { fr: "Président du Conseil d'Administration", en: "Chairman of the Board" },
  },
  {
    value: "Président du Comité de Gestion",
    label: { fr: "Président du Comité de Gestion", en: "Chair of the Management Committee" },
  },
  { value: "Secrétaire Général", label: { fr: "Secrétaire Général", en: "Secretary General" } },
  { value: "Trésorier", label: { fr: "Trésorier", en: "Treasurer" } },
  { value: "Directeur", label: { fr: "Directeur", en: "Director" } },
  { value: "Gérant de coopérative", label: { fr: "Gérant de coopérative", en: "Cooperative Manager" } },
  {
    value: "Responsable d'exploitation",
    label: { fr: "Responsable d'exploitation", en: "Operations Manager" },
  },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const ADMINISTRATION_FUNCTION_OPTIONS: RegisterOption[] = [
  {
    value: "Ministre / Secrétaire d'État",
    label: { fr: "Ministre / Secrétaire d'État", en: "Minister / Secretary of State" },
  },
  { value: "Secrétaire Général", label: { fr: "Secrétaire Général", en: "Secretary General" } },
  { value: "Directeur", label: { fr: "Directeur", en: "Director" } },
  { value: "Sous-Directeur", label: { fr: "Sous-Directeur", en: "Sub-Director" } },
  { value: "Chef de Division", label: { fr: "Chef de Division", en: "Head of Division" } },
  { value: "Chef de Service", label: { fr: "Chef de Service", en: "Chief of Service" } },
  { value: "Délégué Régional", label: { fr: "Délégué Régional", en: "Regional Delegate" } },
  { value: "Délégué Départemental", label: { fr: "Délégué Départemental", en: "Divisional Delegate" } },
  { value: "Point Focal", label: { fr: "Point Focal", en: "Focal Point" } },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const CTD_FUNCTION_OPTIONS: RegisterOption[] = [
  { value: "Maire", label: { fr: "Maire", en: "Mayor" } },
  { value: "Adjoint au Maire", label: { fr: "Adjoint au Maire", en: "Deputy Mayor" } },
  {
    value: "Président du Conseil Régional",
    label: { fr: "Président du Conseil Régional", en: "President of the Regional Council" },
  },
  {
    value: "Vice-Président du Conseil Régional",
    label: { fr: "Vice-Président du Conseil Régional", en: "Vice President of the Regional Council" },
  },
  {
    value: "Secrétaire Général de Mairie",
    label: { fr: "Secrétaire Général de Mairie", en: "Secretary General of the Council" },
  },
  { value: "Receveur Municipal", label: { fr: "Receveur Municipal", en: "Municipal Treasurer" } },
  { value: "Chef de Service", label: { fr: "Chef de Service", en: "Chief of Service" } },
  {
    value: "Responsable des Ressources Humaines",
    label: { fr: "Responsable des Ressources Humaines", en: "Human Resources Officer" },
  },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const ONG_FUNCTION_OPTIONS: RegisterOption[] = [
  { value: "Coordonnateur National", label: { fr: "Coordonnateur National", en: "National Coordinator" } },
  { value: "Directeur Exécutif", label: { fr: "Directeur Exécutif", en: "Executive Director" } },
  { value: "Président", label: { fr: "Président", en: "President" } },
  { value: "Secrétaire Général", label: { fr: "Secrétaire Général", en: "Secretary General" } },
  {
    value: "Responsable des Programmes",
    label: { fr: "Responsable des Programmes", en: "Programme Manager" },
  },
  {
    value: "Responsable Administratif et Financier",
    label: {
      fr: "Responsable Administratif et Financier",
      en: "Administrative and Financial Officer",
    },
  },
  { value: "Chef de Projet", label: { fr: "Chef de Projet", en: "Project Manager" } },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const PROJECT_PROGRAM_FUNCTION_OPTIONS: RegisterOption[] = [
  {
    value: "Coordonnateur de Projet",
    label: { fr: "Coordonnateur de Projet", en: "Project Coordinator" },
  },
  {
    value: "Coordonnateur Adjoint",
    label: { fr: "Coordonnateur Adjoint", en: "Deputy Coordinator" },
  },
  {
    value: "Responsable Administratif et Financier",
    label: {
      fr: "Responsable Administratif et Financier",
      en: "Administrative and Financial Officer",
    },
  },
  {
    value: "Responsable Suivi-Évaluation",
    label: { fr: "Responsable Suivi-Évaluation", en: "Monitoring and Evaluation Officer" },
  },
  {
    value: "Expert / Responsable Technique",
    label: { fr: "Expert / Responsable Technique", en: "Expert / Technical Officer" },
  },
  {
    value: "Chef d'Antenne Régionale",
    label: { fr: "Chef d'Antenne Régionale", en: "Head of Regional Office" },
  },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const VOCATIONAL_TRAINING_FUNCTION_OPTIONS: RegisterOption[] = [
  {
    value: "Promoteur / Fondateur",
    label: { fr: "Promoteur / Fondateur", en: "Promoter / Founder" },
  },
  { value: "Directeur du Centre", label: { fr: "Directeur du Centre", en: "Centre Director" } },
  { value: "Directeur des Études", label: { fr: "Directeur des Études", en: "Director of Studies" } },
  {
    value: "Responsable Pédagogique",
    label: { fr: "Responsable Pédagogique", en: "Head of Teaching" },
  },
  {
    value: "Responsable Administratif et Financier",
    label: {
      fr: "Responsable Administratif et Financier",
      en: "Administrative and Financial Officer",
    },
  },
  { value: "Surveillant Général", label: { fr: "Surveillant Général", en: "Discipline Master" } },
  { value: RESPONDENT_FUNCTION_OTHER, label: { fr: "Autre", en: "Other" } },
];

export const RESPONDENT_FUNCTION_OPTIONS_BY_TYPE: Record<EntityType, RegisterOption[]> = {
  enterprise: ENTERPRISE_FUNCTION_OPTIONS,
  cooperative: COOPERATIVE_FUNCTION_OPTIONS,
  administration: ADMINISTRATION_FUNCTION_OPTIONS,
  ctd: CTD_FUNCTION_OPTIONS,
  ong: ONG_FUNCTION_OPTIONS,
  projectProgram: PROJECT_PROGRAM_FUNCTION_OPTIONS,
  vocationalTraining: VOCATIONAL_TRAINING_FUNCTION_OPTIONS,
};

/**
 * Returns the respondent function list tailored to the given entity type,
 * falling back to the enterprise list when no entity type is selected.
 */
export function getRespondentFunctionOptions(
  entityType?: EntityType | string | null
): RegisterOption[] {
  if (entityType && Object.prototype.hasOwnProperty.call(RESPONDENT_FUNCTION_OPTIONS_BY_TYPE, entityType)) {
    return RESPONDENT_FUNCTION_OPTIONS_BY_TYPE[entityType as EntityType];
  }
  return ENTERPRISE_FUNCTION_OPTIONS;
}

/**
 * Whether a chosen function survives a change of entity type. A title the new
 * type does not offer is cleared rather than left selected in a list that no
 * longer shows it; « Autre » and an empty choice always survive, and so does
 * the typed title that goes with « Autre ».
 */
export function functionFitsEntityType(
  fn: string,
  entityType?: EntityType | string | null,
): boolean {
  if (!fn || fn === RESPONDENT_FUNCTION_OTHER) return true;
  return getRespondentFunctionOptions(entityType).some((o) => o.value === fn);
}

/**
 * Deduplicated union of all options across all entity types, ensuring any
 * historical or specialized role can be resolved back to its localized label.
 */
function buildAllRespondentFunctionOptions(): RegisterOption[] {
  const map = new Map<string, RegisterOption>();
  for (const list of Object.values(RESPONDENT_FUNCTION_OPTIONS_BY_TYPE)) {
    for (const opt of list) {
      if (!map.has(opt.value)) {
        map.set(opt.value, opt);
      }
    }
  }
  return Array.from(map.values());
}

export const ALL_RESPONDENT_FUNCTION_OPTIONS: RegisterOption[] =
  buildAllRespondentFunctionOptions();

// Kept as backward-compatible export containing all possible respondent functions,
// so registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, ...) resolves any entity's role.
export const RESPONDENT_FUNCTION_OPTIONS: RegisterOption[] = ALL_RESPONDENT_FUNCTION_OPTIONS;
