"use client";

import { createContext, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { RadioGroup } from "./form/Radio";
import { VtWizardFieldError } from "./VtWizardFields";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";
import type { FormData, OnefopEntity, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import {
  VT_QUIZ_QUESTIONS,
  isVtQuizComplete,
  isVtQuizQuestionAsked,
  readVtQuiz,
  type VtQuizAnswers,
  type VtQuizQuestionId,
} from "@/lib/vt-quiz";

/** The quiz heading, focused by WizardShell when the quiz opens. */
export const VT_QUIZ_HEADING_ID = "vt-quiz-heading";

/** Lets a training-centre table send the respondent to the preliminary quiz. */
export const VtQuizContext = createContext<{ openQuiz?: () => void }>({});

interface VtScopeQuizProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  /** Quiz validated: continue to Section 2. */
  onComplete: () => void;
  /** The wizard's bottom bar drives the quiz (Précédent / Suivant, as on
   *  every section): its Suivant calls the validate held here. With a
   *  question unanswered, validate marks it and does not continue. */
  validateRef: MutableRefObject<(() => void) | null>;
  /** The campaign, named in the intro ("pour le 4e trimestre 2026"). */
  quarterCode?: string;
  locale: "fr" | "en";
}

function tableHasData(field: OnefopField | undefined, data: FormData): boolean {
  return !!field?.table?.matrix?.some((row) =>
    row.some((id) => data[id] !== undefined && data[id] !== null && data[id] !== ""),
  );
}

/**
 * The training-centre preliminary quiz: one Oui/Non question per table that
 * can honestly be empty (vt-quiz.ts). "Oui" opens the table; "Non" records
 * it as nothing to report, and erases anything already typed in it. It gates
 * tables only — every ordinary question stays in its section.
 */
export function VtScopeQuiz({ entity, data, onChange, onComplete, validateRef, quarterCode, locale }: VtScopeQuizProps) {
  const isEn = locale === "en";
  const [answers, setAnswers] = useState<VtQuizAnswers>(() => ({ ...(readVtQuiz(data) ?? {}) }));
  // Suivant was pressed with a question unanswered: mark every gap.
  const [attempted, setAttempted] = useState(false);

  const tableById = useMemo(
    () => new Map(entity.sections.flatMap((s) => s.fields).filter((f) => f.table).map((f) => [f.id, f])),
    [entity],
  );

  const asked = VT_QUIZ_QUESTIONS.filter((q) => isVtQuizQuestionAsked(q, answers));
  const complete = isVtQuizComplete(answers);
  const answeredCount = asked.filter((q) => typeof answers[q.id] === "boolean").length;

  const answer = (id: VtQuizQuestionId, value: boolean) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      // A follow-up is asked only after "Oui" to its parent.
      for (const q of VT_QUIZ_QUESTIONS) {
        if (q.parent === id && value === false) delete next[q.id];
      }
      return next;
    });
  };

  // Tables the current answers turn off that still hold typed figures.
  const tablesToErase = VT_QUIZ_QUESTIONS.filter((q) => {
    const off = answers[q.id] === false || (q.parent !== undefined && answers[q.parent] === false);
    return off && tableHasData(tableById.get(q.tableId), data);
  });

  // The question each warning sits under: a follow-up switched off by its
  // parent's Non is no longer shown, so its warning moves to the parent.
  const erasedUnder = new Set(
    tablesToErase.map((q) => (q.parent !== undefined && answers[q.parent] === false ? q.parent : q.id)),
  );

  const handleValidate = () => {
    if (!complete) {
      setAttempted(true);
      const first = asked.find((q) => typeof answers[q.id] !== "boolean");
      const group = first ? document.getElementById(`vt-quiz-${first.id}`) : null;
      group?.scrollIntoView({ behavior: "smooth", block: "center" });
      group?.focus({ preventScroll: true });
      return;
    }
    for (const q of tablesToErase) {
      for (const row of tableById.get(q.tableId)?.table?.matrix ?? []) {
        for (const id of row) if (id in data) onChange(id, undefined);
      }
    }
    const scope = data._scopeConfig && typeof data._scopeConfig === "object" ? data._scopeConfig : {};
    onChange("_scopeConfig", {
      ...(scope as Record<string, unknown>),
      vocationalTraining: { ...answers, completedAt: new Date().toISOString() },
    });
    onComplete();
  };

  // Hand the current validate (it closes over the latest answers) and its
  // readiness to the wizard's bottom bar.
  useEffect(() => {
    validateRef.current = handleValidate;
  });
  useEffect(
    () => () => {
      validateRef.current = null;
    },
    [validateRef],
  );

  const period = referencePeriodPhrases(quarterCode, locale);

  return (
    <div>
      <header className="cam-step-head">
        <h1 id={VT_QUIZ_HEADING_ID} tabIndex={-1} className="cam-step-title">
          {isEn ? "Preliminary questionnaire" : "Questionnaire préliminaire"}
        </h1>
        <p className="cam-step-lede">
          {isEn
            ? `Answer each question ${period?.forPeriod ?? "for the period"}.`
            : `Répondez à chaque question ${period?.forPeriod ?? "pour la période"}.`}
        </p>
        <p aria-live="polite" className="cam-step-lede">
          {isEn ? `${answeredCount} of ${asked.length} answered` : `${answeredCount} sur ${asked.length} répondues`}
        </p>
      </header>

      <ol style={{ listStyle: "none", margin: "var(--cam-space-2) 0 0", padding: 0 }}>
        {asked.map((q, qIndex) => {
          const value = answers[q.id];
          const label = localized(q.text, locale);
          const groupId = `vt-quiz-${q.id}`;
          const missing = attempted && typeof value !== "boolean";
          return (
            <li
              key={q.id}
              style={{
                padding: "var(--cam-space-4) 0",
                paddingLeft: q.parent ? "var(--cam-space-6)" : 0,
                // The last one needs no rule: the actions row draws its own.
                borderBottom: qIndex < asked.length - 1 ? "var(--cam-border-width) solid var(--cam-border)" : undefined,
              }}
            >
              <div className="cam-question" aria-hidden="true">
                {label}
              </div>
              <div style={{ marginTop: "var(--cam-field-stack-gap)" }}>
                <RadioGroup
                  fieldId={groupId}
                  ariaLabel={label}
                  options={[
                    { value: "yes", label: isEn ? "Yes" : "Oui" },
                    { value: "no", label: isEn ? "No" : "Non" },
                  ]}
                  value={value === true ? "yes" : value === false ? "no" : undefined}
                  onChange={(_, choice) => answer(q.id, choice === "yes")}
                  layout="horizontal"
                  invalid={missing}
                  describedBy={missing ? `${groupId}-error` : undefined}
                  required
                />
              </div>
              <VtWizardFieldError
                id={`${groupId}-error`}
                message={missing ? (isEn ? "Answer this question." : "Répondez à cette question.") : undefined}
              />
              {/* Figures already typed that this answer turns off. The
                  respondent answers about the centre, never about tables,
                  so the warning names neither a table nor its code. */}
              {erasedUnder.has(q.id) && (
                <p role="status" className="cam-hint" style={{ margin: "var(--cam-space-2) 0 0", padding: "var(--cam-space-2) var(--cam-space-3)", borderRadius: "var(--cam-radius-sm)", background: "var(--cam-warning-bg)", border: "1px solid var(--cam-warning-border)", color: "var(--cam-text)" }}>
                  {isEn
                    ? "You had already entered figures for this question. They will be erased when you click Next."
                    : "Vous aviez déjà saisi des chiffres pour cette question. Ils seront effacés quand vous cliquerez sur Suivant."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
