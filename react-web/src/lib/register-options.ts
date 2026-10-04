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
import type { LocalizedText } from "./register-i18n";

export interface RegisterOption {
  value: string;
  label: LocalizedText;
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

export const RESPONDENT_FUNCTION_OPTIONS: RegisterOption[] = [
  { value: "Directeur Général", label: { fr: "Directeur Général", en: "Chief Executive Officer" } },
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
  { value: "Autre", label: { fr: "Autre", en: "Other" } },
];
