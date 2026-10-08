"use client";

import { createContext, useMemo, useState } from "react";
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

/** Lets a training-centre table send the respondent to the preliminary quiz. */
export const VtQuizContext = createContext<{ openQuiz?: () => void }>({});

interface VtScopeQuizProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  /** Quiz validated: continue to Section 2. */
  onComplete: () => void;
  /** Back to Section 1. */
  onBack: () => void;
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
export function VtScopeQuiz({ entity, data, onChange, onComplete, onBack, locale }: VtScopeQuizProps) {
  const isEn = locale === "en";
  const [answers, setAnswers] = useState<VtQuizAnswers>(() => ({ ...(readVtQuiz(data) ?? {}) }));

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

  const handleValidate = () => {
    if (!complete) return;
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

  const choiceStyle = (selected: boolean): React.CSSProperties => ({
    minWidth: 72,
    minHeight: "var(--cam-form-field-height, 40px)",
    padding: "0 18px",
    borderRadius: "var(--cam-radius-sm, 6px)",
    border: selected ? "2px solid var(--cam-green)" : "1px solid var(--cam-border)",
    background: selected ? "var(--cam-green)" : "var(--cam-surface)",
    color: selected ? "#fff" : "var(--cam-text)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(16px, 3vw, 28px) 0 48px" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cam-green)" }}>
          {isEn ? "Preliminary questionnaire" : "Questionnaire préliminaire"}
        </p>
        <h1 style={{ margin: "0 0 8px", fontSize: "clamp(20px, 3vw, 24px)", fontWeight: 800, color: "var(--cam-text)", lineHeight: 1.25 }}>
          {isEn ? "Which tables apply to your centre?" : "Quels tableaux concernent votre centre ?"}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--cam-text-muted)", lineHeight: 1.5, maxWidth: 720 }}>
          {isEn
            ? "Answer each question for the period. Yes opens the table for you to fill; No records it as nothing to report. The other tables always apply."
            : "Répondez à chaque question pour la période. Oui ouvre le tableau à renseigner ; Non l'enregistre comme « aucun cas à signaler ». Les autres tableaux s'appliquent toujours."}
        </p>
        <p aria-live="polite" style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: "var(--cam-text-muted)" }}>
          {isEn ? `${answeredCount} of ${asked.length} answered` : `${answeredCount} sur ${asked.length} répondues`}
        </p>
      </header>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--cam-border)" }}>
        {asked.map((q) => {
          const value = answers[q.id];
          const label = localized(q.text, locale);
          const groupId = `vt-quiz-${q.id}`;
          return (
            <li
              key={q.id}
              style={{
                padding: "16px 0",
                paddingLeft: q.parent ? 28 : 0,
                borderBottom: "1px solid var(--cam-border)",
              }}
            >
              <div role="radiogroup" aria-labelledby={`${groupId}-label`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
                <div style={{ flex: "1 1 320px" }}>
                  <div id={`${groupId}-label`} style={{ fontSize: 15, fontWeight: 600, color: "var(--cam-text)", lineHeight: 1.4 }}>
                    {label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--cam-text-muted)" }}>
                    {value === true
                      ? isEn ? `Table ${q.tableCode} will be open to fill.` : `Le tableau ${q.tableCode} sera à renseigner.`
                      : value === false
                        ? isEn ? `Table ${q.tableCode}: nothing to report.` : `Tableau ${q.tableCode} : aucun cas à signaler.`
                        : isEn ? `Decides table ${q.tableCode}.` : `Détermine le tableau ${q.tableCode}.`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" role="radio" aria-checked={value === true} onClick={() => answer(q.id, true)} style={choiceStyle(value === true)}>
                    {isEn ? "Yes" : "Oui"}
                  </button>
                  <button type="button" role="radio" aria-checked={value === false} onClick={() => answer(q.id, false)} style={choiceStyle(value === false)}>
                    {isEn ? "No" : "Non"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {tablesToErase.length > 0 && (
        <p role="status" style={{ margin: "16px 0 0", padding: "10px 12px", borderRadius: "var(--cam-radius-sm, 6px)", background: "var(--cam-warning-bg, #fffbeb)", border: "1px solid var(--cam-warning-border, #fde68a)", fontSize: 13, color: "var(--cam-text)", lineHeight: 1.5 }}>
          {isEn
            ? `The figures already entered in table${tablesToErase.length > 1 ? "s" : ""} ${tablesToErase.map((q) => q.tableCode).join(", ")} will be erased when you validate.`
            : `Les chiffres déjà saisis dans le${tablesToErase.length > 1 ? "s" : ""} tableau${tablesToErase.length > 1 ? "x" : ""} ${tablesToErase.map((q) => q.tableCode).join(", ")} seront effacés à la validation.`}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 28 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: "transparent", border: "1px solid var(--cam-border)", borderRadius: "var(--cam-radius-sm, 6px)", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "var(--cam-text)", cursor: "pointer" }}
        >
          {isEn ? "← Back to Section 1" : "← Retour à la Section 1"}
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!complete}
          aria-disabled={!complete}
          style={{
            background: complete ? "var(--cam-green)" : "var(--cam-border-strong)",
            border: "none",
            borderRadius: "var(--cam-radius-sm, 6px)",
            padding: "11px 26px",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            cursor: complete ? "pointer" : "not-allowed",
          }}
        >
          {isEn ? "Validate and continue →" : "Valider et continuer →"}
        </button>
      </div>
    </div>
  );
}
