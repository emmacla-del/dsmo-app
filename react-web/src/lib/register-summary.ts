// src/lib/register-summary.ts
//
// The one place that decides what a completed section says about itself.
//
// There were two answers to that question before: RegistrationReview built
// the review tables from its own hardcoded row list, and nothing built the
// one-line summary a collapsed section needs. Two sources would have drifted
// the moment a field was added -- the review card would show it and the
// collapsed line would not. Both now come from summaryRows().
//
// Pure, and deliberately not a React component: the collapsed line is derived
// at the moment of collapsing rather than cached, so this runs during render
// and must not touch hooks, storage or the DOM.
//
// TRANSLATION: labels that are UI copy arrive through the `t` resolver the
// caller passes in (next-intl in the app, identity in tests). Labels that come
// from the questionnaire's own field set -- ENTITY_CONFIGS' bilingual
// "Raison sociale/ Company name" strings -- are data, not UI copy, and are
// passed through untouched. Values are never translated: they are what the
// respondent typed, except for select answers, which are shown with the
// option's own label so the review does not print a wire value like
// "Non-fonctionnelle" as a bare code.
import {
  ENTITY_CONFIGS,
  isFieldVisible,
  type RegistrationStepId,
} from "./register-constants";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS } from "./register-options";
import type { RegState } from "./register-completeness";

export interface SummaryRow {
  label: string;
  value: string;
}

// RegState plus the administrative names, which the wizard resolves from its
// loaders and the payload sends instead of the ids.
export interface SummaryState extends RegState {
  regionName: string;
  departmentName: string;
  subdivisionName: string;
  sectorName: string;
}

export type TranslateFn = (key: string) => string;

// How many values a collapsed section shows before it stops.
export const SECTION_SUMMARY_MAX_VALUES = 3;

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function row(label: string, value: string | undefined): SummaryRow | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? { label, value: trimmed } : null;
}

function compact(rows: (SummaryRow | null)[]): SummaryRow[] {
  return rows.filter((r): r is SummaryRow => r !== null);
}

export function summaryRows(
  step: RegistrationStepId,
  state: SummaryState,
  t: TranslateFn
): SummaryRow[] {
  switch (step) {
    case "entityType":
      return compact([
        row(
          t("registerPage.summaryEntityTypeLabel"),
          state.entityType ? ENTITY_CONFIGS[state.entityType].title : ""
        ),
      ]);

    case "respondent": {
      const r = state.respondent;
      const fullName = `${r.firstName.trim()} ${r.lastName.trim()}`.trim();
      return compact([
        row(t("registerPage.summaryFullNameLabel"), fullName),
        row(
          t("registerPage.functionLabel"),
          r.function ? optionLabel(RESPONDENT_FUNCTION_OPTIONS, r.function) : ""
        ),
        row(t("registerPage.professionalEmailLabel"), r.email),
        row(t("registerPage.phone1Label"), r.phone1),
        // Optional, so it is simply absent when unanswered rather than shown
        // as an empty row.
        row(t("registerPage.phone2Label"), r.phone2),
      ]);
    }

    case "entityInfo": {
      if (!state.entityType) return [];
      const config = ENTITY_CONFIGS[state.entityType];
      const rows: (SummaryRow | null)[] = [
        row(t("registerPage.summaryEntityTypeLabel"), config.title),
      ];
      for (const field of config.fields) {
        // A field whose gate has closed is not part of the declaration, even
        // if a value is still sitting in state from before the gate shut --
        // the same rule submit() applies through visibleEntityDataForType.
        if (!isFieldVisible(field, state.entityData, config.fields)) continue;
        const raw = state.entityData[field.key];
        rows.push(
          row(field.label, field.options && raw ? optionLabel(field.options, raw) : raw)
        );
      }
      return compact(rows);
    }

    case "location":
      return compact([
        row(t("registerPage.regionLabel"), state.regionName),
        row(t("registerPage.departmentLabel"), state.departmentName),
        row(t("registerPage.subdivisionLabel"), state.subdivisionName),
        row(
          t("registerPage.areaLabel"),
          state.area ? optionLabel(AREA_OPTIONS, state.area) : ""
        ),
        row(t("registerPage.sectorLabel"), state.sectorName),
      ]);

    case "security":
      // The password is never summarised, shown or stored. The login identity
      // is what this section actually establishes.
      return compact([
        row(t("registerPage.summaryLoginLabel"), state.respondent.email),
      ]);

    case "review":
      // The review section summarises the others; it has nothing of its own,
      // and it is never collapsed.
      return [];
  }
}

// The one-line form a collapsed section shows: the first few values, in the
// order summaryRows produced them. Built from the same rows as the review
// card, so the two can never disagree.
export function sectionSummary(
  rows: readonly SummaryRow[],
  maxValues: number = SECTION_SUMMARY_MAX_VALUES
): string {
  return rows
    .map((r) => r.value.trim())
    .filter((v) => v.length > 0)
    .slice(0, maxValues)
    .join(", ");
}
