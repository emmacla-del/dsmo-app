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
  entityFieldLabel,
  isFieldVisible,
  type RegistrationStepId,
} from "./register-constants";
import { AREA_OPTIONS, RESPONDENT_FUNCTION_OPTIONS, RESPONDENT_FUNCTION_OTHER, registerOptionLabel } from "./register-options";
import { localized, type UiLocale } from "./register-i18n";
import { sectorLabel } from "./display-labels";
import { isSecurityComplete, type RegState } from "./register-completeness";

export interface SummaryRow {
  label: string;
  value: string;
  // What the step list shows for this row, when the value alone would not
  // read on its own there: the list prints values without their labels.
  brief?: string;
}

// RegState plus the administrative names, which the wizard resolves from its
// loaders and the payload sends instead of the ids.
export interface SummaryState extends RegState {
  regionName: string;
  departmentName: string;
  subdivisionName: string;
  // The chosen branch of activity's names (a row of the `sectors` table),
  // since entityData holds only its id. The English one, when it has one, so
  // an English reader's review does not print the French DB name (B10 of the
  // 2026-10-17 run).
  branchName: string;
  branchNameEn?: string | null;
}

export type TranslateFn = (key: string) => string;

// The locale every questionnaire string is read in. Passed explicitly rather
// than read from a hook: this module runs during render and must stay pure,
// and the tests need to drive both languages without a React tree.

// How many values a collapsed section shows before it stops.
export const SECTION_SUMMARY_MAX_VALUES = 3;

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
      // Autre is a prompt, not a job. The review and the rail show the text
      // that will be stored, which is what the respondent typed.
      const functionValue =
        r.function === RESPONDENT_FUNCTION_OTHER
          ? r.functionOther.trim() ||
            registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, r.function, locale)
          : r.function
            ? registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, r.function, locale)
            : "";
      return compact([
        row(t("registerPage.summaryFullNameLabel"), fullName),
        row(t("registerPage.functionLabel"), functionValue),
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
        // The branch is stored as an id; the review shows its name.
        const value =
          field.kind === "branch"
            ? raw
              ? sectorLabel({ name: state.branchName, nameEn: state.branchNameEn }, locale)
              : ""
            : field.options && raw
              ? registerOptionLabel(field.options, raw, locale)
              : raw;
        rows.push(row(localized(entityFieldLabel(field, state.entityData), locale), value));
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
          state.area ? registerOptionLabel(AREA_OPTIONS, state.area, locale) : ""
        ),
      ]);

    case "security":
      // The password is never summarised, shown or stored, and neither is the
      // email: that already has its own row under the respondent. One line
      // says the password was chosen, and only once it actually was. The
      // review prints « Mot de passe | Défini »; the step list, which has no
      // label column, keeps the whole phrase.
      if (!isSecurityComplete(state)) return [];
      return [
        {
          label: t("registerPage.passwordLabel"),
          value: t("registerPage.summaryPasswordValue"),
          brief: t("registerPage.summaryPasswordSet"),
        },
      ];

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
    .map((r) => (r.brief ?? r.value).trim())
    .filter((v) => v.length > 0)
    .slice(0, maxValues)
    .join(", ");
}
