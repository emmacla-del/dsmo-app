// src/lib/register-options.ts
//
// Ported verbatim from lib/screens/register_constants.dart's static option
// lists. `value` is the canonical string sent to the backend and MUST NOT
// change — only `label` (bilingual, "Français/ English" combined per this
// app's existing convention — see role-navigation.ts) is presentational.
// This app has no i18n layer yet, same reason role-navigation.ts inlines
// bilingual strings rather than guessing at translation keys that don't
// exist on this side.
export interface RegisterOption {
  value: string;
  label: string;
}

export const LEGAL_STATUS_OPTIONS: RegisterOption[] = [
  { value: "Société unipersonnelle", label: "Société unipersonnelle/ Sole proprietorship" },
  { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" },
  { value: "SNC", label: "SNC" },
  { value: "Autres", label: "Autres/ Other" },
];

export const COOPERATIVE_TYPE_OPTIONS: RegisterOption[] = [
  { value: "Coopérative simplifiée", label: "Coopérative simplifiée/ Simplified cooperative" },
  {
    value: "Coopérative avec conseil d'administration",
    label: "Coopérative avec conseil d'administration/ Cooperative with board of directors",
  },
  { value: "Autre", label: "Autre/ Other" },
];

export const CTD_TYPE_OPTIONS: RegisterOption[] = [
  { value: "Région", label: "Région/ Region" },
  { value: "Commune", label: "Commune/ Municipality" },
];

export const AREA_OPTIONS: RegisterOption[] = [
  { value: "Urbain", label: "Urbain/ Urban" },
  { value: "Rural", label: "Rural" },
];

// Vocational Training (CFP) registration-time option lists — verbatim from
// the source questionnaire (QUESTIONNAIRE FORMATION PROFESSIONNELLE
// 2025_2026.pdf, §1.10-1.13), not invented.
export const CFP_TYPE_OPTIONS: RegisterOption[] = [
  { value: "SAR/SM (RA/HECs)", label: "SAR/SM (RA/HECs)" },
  {
    value: "Centre de Formation Professionnelle Rapide (CFPR)",
    label: "Centre de Formation Professionnelle Rapide (CFPR)/ Intensive Vocational Training Centre (IVTC)",
  },
  {
    value: "Centre de Formation Professionnelle Privé (CFPP)",
    label: "Centre de Formation Professionnelle Privé (CFPP)/ Private Vocational Training Centre (PVTC)",
  },
  {
    value: "Centre de Formation aux Métiers (CFM)",
    label: "Centre de Formation aux Métiers (CFM)/ Trades Training Centre (TTC)",
  },
  {
    value: "Centre de Formation Professionnelle d'Excellence (CFPE)",
    label: "Centre de Formation Professionnelle d'Excellence (CFPE)/ Advanced Vocational Training Centre (AVTC)",
  },
  {
    value: "Centre de Formation Professionnelle Sectorielles (CFPS)",
    label: "Centre de Formation Professionnelle Sectorielles (CFPS)/ Sectoral Vocational Training Centre (SVTC)",
  },
  {
    value: "Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)",
    label:
      "Centre National de Formation des Formateurs et de Développement des Programmes (CNFFDP)/ National Institute of Vocational Trainers and Programme Development (NIVTPD)",
  },
];

export const EDUCATION_SYSTEM_OPTIONS: RegisterOption[] = [
  { value: "Public", label: "Public" },
  { value: "Privé laïc", label: "Privé laïc/ Lay private" },
  { value: "Privé confessionnel", label: "Privé confessionnel/ Private denominational" },
];

export const FUNCTIONAL_STATUS_OPTIONS: RegisterOption[] = [
  { value: "Fonctionnelle", label: "Fonctionnelle/ Functional" },
  { value: "Non-fonctionnelle", label: "Non-fonctionnelle/ Non-functional" },
  { value: "Fermée", label: "Fermée/ Closed" },
];

export const NON_FUNCTIONAL_REASON_OPTIONS: RegisterOption[] = [
  { value: "Manque d'apprenants", label: "Manque d'apprenants/ Lack of trainees" },
  { value: "Manque de formateur", label: "Manque de formateur/ Lack of trainers" },
  { value: "Raison d'insécurité", label: "Raison d'insécurité/ Insecurity" },
  { value: "Agrément non valide", label: "Agrément non valide/ Invalid accreditation" },
  { value: "Autres", label: "Autres/ Other" },
];

export const SEX_OPTIONS: RegisterOption[] = [
  // Display wording harmonised to Homme/Femme; `value` is what the backend
  // stores, so it stays unchanged.
  { value: "Masculin", label: "Homme/ Male" },
  { value: "Féminin", label: "Femme/ Female" },
];

export const RESPONDENT_FUNCTION_OPTIONS: RegisterOption[] = [
  { value: "Directeur Général", label: "Directeur Général/ Chief Executive Officer" },
  { value: "Directeur des Ressources Humaines", label: "Directeur des Ressources Humaines/ Human Resources Director" },
  {
    value: "Directeur Administratif et Financier",
    label: "Directeur Administratif et Financier/ Administrative and Financial Director",
  },
  { value: "Gérant", label: "Gérant/ Manager" },
  { value: "Chef du Personnel", label: "Chef du Personnel/ Head of Personnel" },
  { value: "Responsable RH", label: "Responsable RH/ HR Manager" },
  { value: "Secrétaire Général", label: "Secrétaire Général/ Secretary General" },
  { value: "Président du Conseil d'Administration", label: "Président du Conseil d'Administration/ Chairman of the Board" },
  { value: "Autre", label: "Autre/ Other" },
];
