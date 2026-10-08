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
// The security section is not listed: the password is never shown, and the
// sign-in identity it establishes is the email already printed under
// Déclarant. The type gets its own block so it has its own edit link back to
// step 1 rather than sending the respondent to step 3.
const SUMMARISED_STEPS: RegistrationStepId[] = [
  "entityType",
  "respondent",
  "entityInfo",
  "location",
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
    <div style={{ marginTop: "12px" }}>
      {SUMMARISED_STEPS.map((step) => {
        const rows = summaryRows(step, state, (key) => t(key), locale);
        if (rows.length === 0) return null;
        const sectionTitle = t(`registerPage.${labelKeyFor(step)}`);

        return (
          <Fragment key={step}>
            <div className="review-header-row">
              <span className="review-section-title">
                {stepNumber(step)}. {sectionTitle}
              </span>
              <button
                type="button"
                className="btn-edit-section"
                onClick={() => onEdit(step)}
                aria-label={`${t("registerPage.editSectionButton")} — ${sectionTitle}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t("registerPage.editSectionButton")}
              </button>
            </div>
            <table className="table-official">
              <tbody>
                {rows.map((row) => (
                  <tr key={`${step}-${row.label}`}>
                    <td className="label-cell">{row.label}</td>
                    <td className="value-cell">{row.value}</td>
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
