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
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS, type RegisterOption } from "./register-options";
import { localized, type UiLocale } from "./register-i18n";
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

// The locale every questionnaire string is read in. Passed explicitly rather
// than read from a hook: this module runs during render and must stay pure,
// and the tests need to drive both languages without a React tree.

// How many values a collapsed section shows before it stops.
export const SECTION_SUMMARY_MAX_VALUES = 3;

function optionLabel(
  options: readonly RegisterOption[],
  value: string,
  locale: UiLocale
): string {
  const option = options.find((o) => o.value === value);
  // Falling back to the stored value, not to an empty cell: an answer the
  // option list no longer recognises is still an answer the respondent gave,
  // and the review must not silently drop it.
  return option ? localized(option.label, locale) : value;
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
  t: TranslateFn,
  locale: UiLocale
): SummaryRow[] {
  switch (step) {
    case "entityType":
      return compact([
        row(
          t("registerPage.summaryEntityTypeLabel"),
          state.entityType ? localized(ENTITY_CONFIGS[state.entityType].title, locale) : ""
        ),
      ]);

    case "respondent": {
      const r = state.respondent;
      const fullName = `${r.firstName.trim()} ${r.lastName.trim()}`.trim();
      return compact([
        row(t("registerPage.summaryFullNameLabel"), fullName),
        row(
          t("registerPage.functionLabel"),
          r.function ? optionLabel(RESPONDENT_FUNCTION_OPTIONS, r.function, locale) : ""
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
      // The type is not repeated here: it is section 1's own answer, with
      // its own row and its own edit link in the review.
      const rows: (SummaryRow | null)[] = [];
      for (const field of config.fields) {
        // A field whose gate has closed is not part of the declaration, even
        // if a value is still sitting in state from before the gate shut --
        // the same rule submit() applies through visibleEntityDataForType.
        if (!isFieldVisible(field, state.entityData, config.fields)) continue;
        const raw = state.entityData[field.key];
        rows.push(
          row(
            localized(field.label, locale),
            field.options && raw ? optionLabel(field.options, raw, locale) : raw
          )
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
          state.area ? optionLabel(AREA_OPTIONS, state.area, locale) : ""
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
