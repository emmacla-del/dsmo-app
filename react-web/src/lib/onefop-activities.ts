// src/lib/onefop-activities.ts
//
// Field definitions for activities_table (Project/Program's
// PP_S2_ACTIVITIES) — ported from lib/core/focus/renderers/
// activities_table.dart's kActivitiesTableFields, which is itself the
// single source of truth Flutter uses for both its dropdown option lists
// and the flat-key suffixes (confirmed via that file's own comment). This
// table's AstFieldType.repeatingTable shape means it never goes through
// FormSchemaCompiler/GridSchema at all — there is no schema data to read
// this from, so this is a necessary temporary mirror, not a shortcut
// around one that exists.
import type { LocalizedText } from "./onefop-schema";

export interface ActivitiesFieldOption {
  value: string;
  label: LocalizedText;
}

export interface ActivitiesField {
  key: string;
  label: LocalizedText;
  hint: LocalizedText;
  /** null = free-text field; present = coded dropdown. */
  options: ActivitiesFieldOption[] | null;
}

export const ACTIVITIES_TABLE_FIELDS: ActivitiesField[] = [
  {
    key: "description",
    label: { fr: "Prestations offertes", en: "Services offered" },
    hint: { fr: "Décrire la prestation", en: "Describe the service" },
    options: null,
  },
  {
    key: "targetPopulation",
    label: { fr: "Population cible", en: "Target population" },
    hint: { fr: "Choisir", en: "Choose" },
    options: [
      { value: "1", label: { fr: "Jeune non diplômé", en: "Non-graduate youth" } },
      { value: "2", label: { fr: "Jeune diplômé", en: "Graduate youth" } },
      { value: "3", label: { fr: "Femme", en: "Women" } },
      { value: "4", label: { fr: "Monde rural", en: "Rural" } },
      { value: "5", label: { fr: "Population urbaine", en: "Urban population" } },
      { value: "6", label: { fr: "Autre", en: "Other" } },
    ],
  },
  {
    key: "supportType",
    label: { fr: "Nature de l'appui", en: "Type of support" },
    hint: { fr: "Choisir", en: "Choose" },
    options: [
      { value: "1", label: { fr: "Gratuit", en: "Free" } },
      { value: "2", label: { fr: "Tarifé", en: "Fee-based" } },
      { value: "3", label: { fr: "Aide financière remboursable", en: "Reimbursable financial assistance" } },
      { value: "4", label: { fr: "Aide financière non remboursable", en: "Non-reimbursable financial assistance" } },
      { value: "5", label: { fr: "Autre", en: "Other" } },
    ],
  },
  {
    key: "scope",
    label: { fr: "Rayon d'action", en: "Scope of action" },
    hint: { fr: "Choisir", en: "Choose" },
    options: [
      { value: "1", label: { fr: "National", en: "National" } },
      { value: "2", label: { fr: "Régional", en: "Regional" } },
      { value: "3", label: { fr: "Local", en: "Local" } },
      { value: "4", label: { fr: "Autre", en: "Other" } },
    ],
  },
  {
    key: "startDate",
    label: { fr: "Date de début", en: "Start date" },
    hint: { fr: "MM/AAAA", en: "MM/YYYY" },
    options: null,
  },
  {
    key: "duration",
    label: { fr: "Durée (mois)", en: "Duration (months)" },
    hint: { fr: "0", en: "0" },
    options: null,
  },
];

/** Paper-form display capacity (Questionnaire_Projet_et_Programmes.pdf's
 * Section 2 shows exactly 13 blank rows) — a display capacity, not a hard
 * cap, matching PP_S2_ACTIVITIES's own tableSpec.rowCapacity. */
export const ACTIVITIES_ROW_CAPACITY = 13;
