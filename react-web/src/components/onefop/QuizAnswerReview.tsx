"use client";

import { useTranslations } from "next-intl";
import { tableQuestionHeadingStyle } from "./table/TableQuestionHeading";
import { RadioGroup } from "./form/Radio";

export interface QuizAnswerFacet {
  key: string;
  label: string;
  value: string;
}

/** One answered fact on the preliminary-quiz review. */
export interface QuizAnswerRow {
  id: string;
  /** Short name of the fact, the same role as a row in the employer review. */
  title: string;
  answer: "yes" | "no" | null;
  /** Any choices selected after a Yes. */
  facets?: QuizAnswerFacet[];
}

/** Shared answer review for employer, vocational training, and project/program quizzes. */
export function QuizAnswerReview({
  rows,
  warning,
  copy,
  onSelect,
  onProceed,
}: {
  rows: QuizAnswerRow[];
  /** Figures already typed that these answers will clear. */
  warning?: string;
  /** Quiz-specific wording, while keeping the same review layout. */
  copy?: { title: string };
  onSelect: (id: string) => void;
  onProceed: () => void;
}) {
  const t = useTranslations("modernJobs.factsReview");
  const tFacts = useTranslations("modernJobs.facts");
  return (
    <div>
      <header className="cam-step-head">
        <h2 className="cam-step-title">{copy?.title ?? t("title")}</h2>
      </header>

      {warning && (
        <p className="cam-hint" role="alert" style={{ margin: "var(--cam-space-3) 0 0" }}>
          {warning}
        </p>
      )}

      {rows.length === 0 ? <p className="cam-hint">{tFacts("empty")}</p> : null}
      <ul className="cam-quiz-review" aria-label={tFacts("title")}>
        {rows.map((row) => {
          const answer =
            row.answer === "yes" ? tFacts("yes") : row.answer === "no" ? tFacts("no") : "";
          const facets = row.answer === "yes" ? (row.facets ?? []).filter((facet) => facet.value) : [];
          return (
            <li key={row.id}>
              <button
                type="button"
                className="cam-quiz-review-line"
                onClick={() => onSelect(row.id)}
              >
                <span className="cam-quiz-review-fact">
                  <span style={tableQuestionHeadingStyle}>{row.title}</span>
                  <span className="cam-quiz-review-actions">
                    {answer && (
                      <span
                        className={`cam-badge ${
                          row.answer === "yes" ? "cam-badge-success" : "cam-badge-neutral"
                        }`}
                      >
                        {answer}
                      </span>
                    )}
                    <span className="cam-quiz-review-edit" aria-hidden="true">
                      {tFacts("changeAnswer")} {"\u270E"}
                    </span>
                  </span>
                </span>
                {facets.length > 0 && (
                  <span className="cam-quiz-review-facets">
                    {facets.map((facet) => (
                      <span key={facet.key} className="cam-quiz-review-facet">
                        <span className="cam-quiz-review-facet-label">{facet.label}:</span>
                        <span className="cam-quiz-review-facet-value">{facet.value}</span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="cam-wizard-actions">
        <button type="button" className="cam-button cam-button-primary" onClick={onProceed}>
          {t("proceed")}
        </button>
      </div>
    </div>
  );
}


/** Shared Oui / Non answer control for every preliminary quiz. */
export function QuizYesNo({
  fieldId,
  value,
  onChange,
  ariaLabel,
  yesLabel,
  noLabel,
  required = false,
}: {
  fieldId: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  ariaLabel: string;
  yesLabel: string;
  noLabel: string;
  required?: boolean;
}) {
  return (
    <div style={{ marginTop: "var(--cam-field-stack-gap)" }}>
      <RadioGroup
        fieldId={fieldId}
        ariaLabel={ariaLabel}
        layout="horizontal"
        options={[{ value: "yes", label: yesLabel }, { value: "no", label: noLabel }]}
        value={value === true ? "yes" : value === false ? "no" : undefined}
        onChange={(_, choice) => onChange(choice === "yes")}
        required={required}
      />
    </div>
  );
}
/** Previous / Continue under one quiz question, the employer beat's row. */
export function QuizBeatNav({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  nextDisabled = false,
}: {
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="cam-wizard-actions">
      <button type="button" className="cam-button cam-button-secondary" onClick={onPrevious}>
        {previousLabel}
      </button>
      <button
        type="button"
        className="cam-button cam-button-primary"
        onClick={onNext}
        disabled={nextDisabled}
      >
        {nextLabel}
      </button>
    </div>
  );
}
