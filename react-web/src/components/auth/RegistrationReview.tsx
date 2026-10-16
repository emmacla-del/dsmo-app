"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";

import { REGISTRATION_STEPS, type RegistrationStepId } from "@/lib/register-constants";
import { asUiLocale } from "@/lib/register-i18n";
import { summaryRows, type SummaryState } from "@/lib/register-summary";

// The official summary shown before submission.
//
// Every row here comes from summaryRows(), which is also what a collapsed
// section's one-line summary is built from. Before that, this component held
// its own hardcoded row list, so adding a field meant remembering to add it
// here too -- and the collapsed line had no shared source at all. One source
// means the review card and the collapsed line cannot disagree.
//
// Security is listed for the one line summaryRows gives it ("password set").
// That line never carries the password or the email: the email already has
// its own row under the respondent. The type gets its own block so it has
// its own edit link back to step 1 rather than sending the respondent to
// step 3.
const SUMMARISED_STEPS: RegistrationStepId[] = [
  "entityType",
  "respondent",
  "entityInfo",
  "location",
  "security",
];

export function RegistrationReview({
  state,
  onEdit,
}: {
  state: SummaryState;
  onEdit: (step: RegistrationStepId) => void;
}) {
  const t = useTranslations();
  // The questionnaire half of these rows (field names, option answers, the
  // entity type) is {fr, en} data rather than catalogue copy, so it needs the
  // locale as well as the resolver.
  const locale = asUiLocale(useLocale());
  const labelKeyFor = (step: RegistrationStepId) =>
    REGISTRATION_STEPS.find((s) => s.id === step)?.labelKey ?? step;
  // Numbered as the step list and the rail number them, so "3. Informations"
  // here is step 3 there.
  const stepNumber = (step: RegistrationStepId) =>
    REGISTRATION_STEPS.findIndex((s) => s.id === step) + 1;

  return (
    <div style={{ marginTop: "var(--cam-space-3)" }}>
      {SUMMARISED_STEPS.map((step) => {
        const rows = summaryRows(step, state, (key) => t(key), locale);
        if (rows.length === 0) return null;
        const sectionTitle = t(`registerPage.${labelKeyFor(step)}`);

        return (
          <Fragment key={step}>
            <div className="review-header-row">
              {/* h2: the review's own title is the page's h1 (StepHeader). */}
              <h2 className="review-section-title">
                {stepNumber(step)}. {sectionTitle}
              </h2>
              {/* A text link, as on a check-your-answers page: no box, no
                  icon. The section name finishes the accessible name, so six
                  "Modifier" controls are not six identical ones. */}
              <button
                type="button"
                className="btn-edit-section"
                onClick={() => onEdit(step)}
                aria-label={`${t("registerPage.editSectionButton")} — ${sectionTitle}`}
              >
                {t("registerPage.editSectionButton")}
              </button>
            </div>
            {/* Row rules only: a label and its answer per row, the label as
                a row header so a screen reader reads the pair together. */}
            <table className="table-official review-list">
              <tbody>
                {rows.map((row) => (
                  <tr key={`${step}-${row.label}`}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Fragment>
        );
      })}
    </div>
  );
}
