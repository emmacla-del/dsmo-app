"use client";

import { createContext, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { tableQuestionHeadingStyle } from "./table/TableQuestionHeading";
import { QuizAnswerReview, QuizBeatNav, QuizYesNo, type QuizAnswerRow } from "./QuizAnswerReview";
import type { FormData, OnefopEntity, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import {
  VT_QUIZ_QUESTIONS,
  isVtQuizComplete,
  isVtQuizQuestionAsked,
  readVtQuiz,
  type VtQuizAnswers,
  type VtQuizQuestion,
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
  /** Quiz confirmed: continue to Section 2. */
  onComplete: () => void;
  /** First question's Previous: back to Section 1. The quiz draws its own
   *  Previous / Continue, as the employer quiz does, so the wizard bar
   *  stays hidden while it is open. */
  onBack: () => void;
  locale: "fr" | "en";
}

function tableHasData(field: OnefopField | undefined, data: FormData): boolean {
  return !!field?.table?.matrix?.some((row) =>
    row.some((id) => data[id] !== undefined && data[id] !== null && data[id] !== ""),
  );
}

function askedQuestions(answers: VtQuizAnswers): VtQuizQuestion[] {
  return VT_QUIZ_QUESTIONS.filter((q) => isVtQuizQuestionAsked(q, answers));
}

function withAnswer(prev: VtQuizAnswers, id: VtQuizQuestionId, value: boolean): VtQuizAnswers {
  const next: VtQuizAnswers = { ...prev, [id]: value };
  // A follow-up is asked only after "Oui" to its parent.
  if (value === false) {
    for (const q of VT_QUIZ_QUESTIONS) {
      if (q.parent === id) delete next[q.id];
    }
  }
  return next;
}

function scrollQuizToTop() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * The training-centre preliminary quiz, in the same shape as the employer
 * one: one Oui/Non question at a time, then a review of the answers.
 * "Oui" opens that table; "Non" records it as nothing to report, and
 * erases anything already typed in it when the review is confirmed.
 * Gating stays here — it is not the employer quiz's.
 */
export function VtScopeQuiz({ entity, data, onChange, onComplete, onBack, locale }: VtScopeQuizProps) {
  const tRail = useTranslations("wizardRail");
  const tEvent = useTranslations("modernJobs.event");
  const tReview = useTranslations("modernJobs.vtFactsReview");
  const isEn = locale === "en";
  const initial = useMemo(() => ({ ...(readVtQuiz(data) ?? {}) }), [data]);
  const [answers, setAnswers] = useState<VtQuizAnswers>(initial);
  const [phase, setPhase] = useState<"question" | "review">(() =>
    isVtQuizComplete(initial) ? "review" : "question",
  );
  const [beatId, setBeatId] = useState<VtQuizQuestionId>(() => {
    const beats = askedQuestions(initial);
    return (beats.find((q) => typeof initial[q.id] !== "boolean") ?? beats[0]).id;
  });

  const tableById = useMemo(
    () => new Map(entity.sections.flatMap((s) => s.fields).filter((f) => f.table).map((f) => [f.id, f])),
    [entity],
  );

  const beats = askedQuestions(answers);
  const beat = beats.find((q) => q.id === beatId) ?? beats[0];

  // Tables the current answers turn off that still hold typed figures.
  const tablesToErase = VT_QUIZ_QUESTIONS.filter((q) => {
    const off = answers[q.id] === false || (q.parent !== undefined && answers[q.parent] === false);
    return off && tableHasData(tableById.get(q.tableId), data);
  });

  const erasesOnNo = (id: VtQuizQuestionId) =>
    VT_QUIZ_QUESTIONS.some((q) => (q.id === id || q.parent === id) && tableHasData(tableById.get(q.tableId), data));

  const goAfter = (from: VtQuizQuestionId, nextAnswers: VtQuizAnswers) => {
    const order = askedQuestions(nextAnswers);
    const idx = order.findIndex((q) => q.id === from);
    const following = order[idx + 1];
    if (following) setBeatId(following.id);
    else setPhase("review");
    scrollQuizToTop();
  };

  const answer = (id: VtQuizQuestionId, value: boolean) => {
    const next = withAnswer(answers, id, value);
    setAnswers(next);
    // A Non that would erase figures stays on the question, so the warning
    // is read before Continue. Anything else moves on, as a Yes or No does
    // on the employer quiz.
    if (value === false && erasesOnNo(id)) return;
    goAfter(id, next);
  };

  const handleValidate = () => {
    if (!isVtQuizComplete(answers)) {
      const first = askedQuestions(answers).find((q) => typeof answers[q.id] !== "boolean");
      if (first) {
        setPhase("question");
        setBeatId(first.id);
        scrollQuizToTop();
      }
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

  const reviewRows: QuizAnswerRow[] = beats.map((q) => ({
    id: q.id,
    title: localized(q.text, locale),
    answer: answers[q.id] === true ? "yes" : answers[q.id] === false ? "no" : null,
  }));

  const openQuestion = (id: VtQuizQuestionId) => {
    setPhase("question");
    setBeatId(id);
    scrollQuizToTop();
  };

  return (
    <div>
      <header className="cam-step-head">
        <h1 id={VT_QUIZ_HEADING_ID} tabIndex={-1} className="cam-step-title cam-rail-named">
          {tRail("quiz")}
        </h1>
      </header>

      {phase === "review" ? (
        <QuizAnswerReview
          rows={reviewRows}
          copy={{ title: tReview("title") }}
          warning={
            tablesToErase.length > 0
              ? isEn
                ? "You had already entered figures for a question you answered No. They will be erased when you confirm."
                : "Vous aviez déjà saisi des chiffres pour une question à laquelle vous avez répondu Non. Ils seront effacés quand vous confirmerez."
              : undefined
          }
          onSelect={(id) => openQuestion(id as VtQuizQuestionId)}
          onProceed={handleValidate}
        />
      ) : (
        <section aria-labelledby={`vt-quiz-q-${beat.id}`}>
          <h2 id={`vt-quiz-q-${beat.id}`} style={tableQuestionHeadingStyle}>
            {localized(beat.text, locale)}
          </h2>
          <QuizYesNo
            fieldId={`vt-quiz-${beat.id}`}
            ariaLabel={localized(beat.text, locale)}
            yesLabel={isEn ? "Yes" : "Oui"}
            noLabel={isEn ? "No" : "Non"}
            value={answers[beat.id] ?? null}
            onChange={(choice) => answer(beat.id, choice)}
            required
          />
          {/* Figures already typed that this Non turns off. The respondent
              answers about the centre, never about tables, so the warning
              names neither a table nor its code. */}
          {answers[beat.id] === false && erasesOnNo(beat.id) && (
            <p
              role="status"
              className="cam-hint"
              style={{
                margin: "var(--cam-space-2) 0 0",
                padding: "var(--cam-space-2) var(--cam-space-3)",
                borderRadius: "var(--cam-radius-sm)",
                background: "var(--cam-warning-bg)",
                border: "1px solid var(--cam-warning-border)",
                color: "var(--cam-text)",
              }}
            >
              {isEn
                ? "You had already entered figures for this question. They will be erased when you confirm."
                : "Vous aviez déjà saisi des chiffres pour cette question. Ils seront effacés quand vous confirmerez."}
            </p>
          )}
          <QuizBeatNav
            previousLabel={tEvent("previous")}
            nextLabel={beats[beats.length - 1]?.id === beat.id ? tEvent("openTables") : tEvent("continue")}
            nextDisabled={typeof answers[beat.id] !== "boolean"}
            onPrevious={() => {
              const idx = beats.findIndex((q) => q.id === beat.id);
              if (idx > 0) {
                setBeatId(beats[idx - 1].id);
                scrollQuizToTop();
              } else onBack();
            }}
            onNext={() => {
              if (typeof answers[beat.id] !== "boolean") return;
              goAfter(beat.id, answers);
            }}
          />
        </section>
      )}
    </div>
  );
}
