"use client";

import React from "react";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { quizQuestionForTable } from "@/components/modern-jobs/scope/QuizSemantics";
import {
  S21Q01_ADMIN_GATEWAY_COPY,
  canonicalGatewayId,
  getGatewayCopy,
  resolveTableStatusFieldId,
} from "./gateway-catalog";

export { isCompanionHiddenByGateway, resolveTableStatusFieldId } from "./gateway-catalog";

export interface ConditionalTableProps {
  tableField: OnefopField;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  locale?: "fr" | "en";
  errorMessage?: string;
  /** Opens the preliminary quiz, where the respondent says whether the event occurred. */
  onOpenScope?: () => void;
  children: React.ReactNode;
}

/**
 * Whether the preliminary quiz decides this table. Administration's staff
 * census (S21Q01) shares a paper code with the quiz's "applications" table
 * but is always filled, so the quiz never governs it.
 */
function isQuizGovernedTable(tableField: OnefopField): boolean {
  if (getGatewayCopy(tableField) === S21Q01_ADMIN_GATEWAY_COPY) return false;
  return quizQuestionForTable(canonicalGatewayId(tableField.id)) !== null;
}

/**
 * A statistical table whose applicability comes from the preliminary quiz.
 * The respondent never chooses a status here: the quiz writes "REPORTED"
 * (Oui) or "NONE" (Non — the system records zeros). A table the quiz said
 * "Non" to is not shown; one it has not answered yet sends the respondent to
 * the quiz instead of offering a side door around it. Tables the quiz does
 * not govern are always shown. A "NOT_APPLICABLE" left in an old draft is no
 * longer a respondent answer and is treated as unanswered.
 */
export function ConditionalTable({
  tableField,
  data,
  locale = "fr",
  errorMessage,
  onOpenScope,
  children,
}: ConditionalTableProps) {
  const catalog = getGatewayCopy(tableField);
  const status = data[resolveTableStatusFieldId(tableField, data)];
  const followUp = catalog ? localized(catalog.followUp, locale) : null;

  if (status === "NONE") return null;

  const frameStyle: React.CSSProperties = {
    marginBottom: "var(--cam-space-6, 32px)",
    paddingBottom: "var(--cam-space-5, 24px)",
    borderBottom: "1px solid var(--cam-border)",
  };
  const errorBox = errorMessage && (
    <div
      role="alert"
      style={{
        padding: "8px 12px",
        marginBottom: 12,
        borderRadius: "var(--cam-radius-sm, 4px)",
        background: "var(--cam-error-bg)",
        border: "1px solid var(--cam-error-border)",
        color: "var(--cam-error)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {errorMessage}
    </div>
  );

  if (status === "REPORTED" || !isQuizGovernedTable(tableField)) {
    return (
      <div style={frameStyle}>
        {followUp && (
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--cam-text)", margin: "0 0 12px", lineHeight: 1.4 }}>
            {followUp}
          </p>
        )}
        {errorBox}
        {children}
      </div>
    );
  }

  const question = catalog ? localized(catalog.question, locale) : null;
  return (
    <div style={frameStyle}>
      {question && (
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--cam-text)", margin: "0 0 8px", lineHeight: 1.4 }}>
          {question}
        </p>
      )}
      {errorBox}
      <p style={{ fontSize: 13, color: "var(--cam-text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {locale === "en"
          ? "Answer this question in the preliminary questionnaire first: the table appears if the answer is Yes."
          : "Répondez d'abord à cette question dans le questionnaire préliminaire : le tableau s'affiche si la réponse est Oui."}
      </p>
      {onOpenScope && (
        <button
          type="button"
          onClick={onOpenScope}
          style={{
            background: "var(--cam-surface)",
            border: "1px solid var(--cam-border)",
            borderRadius: "var(--cam-radius-sm, 4px)",
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cam-green)",
            cursor: "pointer",
          }}
        >
          {locale === "en" ? "Open the preliminary questionnaire" : "Ouvrir le questionnaire préliminaire"}
        </button>
      )}
    </div>
  );
}
