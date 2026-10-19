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
    // No placeholder: "0" sat in the empty box looking like an answer already
    // given, and the column header says the unit (§9 — an unanswered cell must
    // not present itself as answered).
    hint: { fr: "", en: "" },
    options: null,
  },
];

/** Paper-form display capacity (Questionnaire_Projet_et_Programmes.pdf's
 * Section 2 shows exactly 13 blank rows) — a display capacity, not a hard
 * cap, matching PP_S2_ACTIVITIES's own tableSpec.rowCapacity. */
export const ACTIVITIES_ROW_CAPACITY = 13;

/** The month the column asks for, as the paper form writes it: MM/AAAA. */
export const ACTIVITY_START_DATE_PATTERN = /^(0[1-9]|1[0-2])\/\d{4}$/;

/** The twelve months, as the month half of « Date de début » offers them. */
export const ACTIVITY_MONTHS: { value: string; label: LocalizedText }[] = [
  { value: "01", label: { fr: "Janvier", en: "January" } },
  { value: "02", label: { fr: "Février", en: "February" } },
  { value: "03", label: { fr: "Mars", en: "March" } },
  { value: "04", label: { fr: "Avril", en: "April" } },
  { value: "05", label: { fr: "Mai", en: "May" } },
  { value: "06", label: { fr: "Juin", en: "June" } },
  { value: "07", label: { fr: "Juillet", en: "July" } },
  { value: "08", label: { fr: "Août", en: "August" } },
  { value: "09", label: { fr: "Septembre", en: "September" } },
  { value: "10", label: { fr: "Octobre", en: "October" } },
  { value: "11", label: { fr: "Novembre", en: "November" } },
  { value: "12", label: { fr: "Décembre", en: "December" } },
];

/**
 * « 03/2026 » → { month: "03", year: "2026" }, the two halves the cell shows.
 * A half-finished answer ("03/", "/2026") splits the same way, so what the
 * respondent has chosen survives a saved draft; validation refuses the row
 * until both halves are there, and a submitted file never carries one.
 */
export function splitStartDate(stored: unknown): { month: string; year: string } {
  const [month = "", year = ""] = String(stored ?? "").trim().split("/");
  return { month: month.trim(), year: year.trim() };
}

/** The two halves back into what is stored, printed and exported: MM/AAAA. */
export function joinStartDate(month: string, year: string): string {
  const m = month.trim();
  const y = year.trim();
  return m === "" && y === "" ? "" : `${m}/${y}`;
}

/** How far back the year list goes. A project's service may have begun long
 *  before the round being declared; forty years covers that without a list
 *  nobody can scroll. A year outside it that a file already holds is added
 *  rather than hidden, so no stored answer disappears from its own box. */
export const ACTIVITY_YEAR_SPAN = 40;

/**
 * The years « Date de début » offers, most recent first — the round's own
 * year plus the next one (a service may be announced before it starts), then
 * back through ACTIVITY_YEAR_SPAN.
 */
export function activityYearOptions(referenceYear: number, stored?: string): string[] {
  const years: string[] = [];
  for (let year = referenceYear + 1; year >= referenceYear - ACTIVITY_YEAR_SPAN; year -= 1) {
    years.push(String(year));
  }
  const held = String(stored ?? "").trim();
  if (/^\d{4}$/.test(held) && !years.includes(held)) {
    years.push(held);
    years.sort((a, b) => Number(b) - Number(a));
  }
  return years;
}
