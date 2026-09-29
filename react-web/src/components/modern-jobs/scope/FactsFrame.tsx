"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { ScopeState } from "./ScopeTypes";

export interface FactLine {
  questionId: string;
  title: string;
  detail: string;
  isAnswered: boolean;
}

interface FactsFrameProps {
  lines: FactLine[];
  activeQuestionId: string | null;
  onSelectQuestion: (questionId: string) => void;
  onReset?: () => void;
  locale?: "fr" | "en";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sticky right rail displaying 'Ce que vous avez indiqué' in plain human language.
 * On desktop (>=1100px): sticky 340px column.
 * Below 1100px: list under Continuer.
 */
export function FactsFrame({
  lines,
  activeQuestionId,
  onSelectQuestion,
  onReset,
  className,
  style,
}: FactsFrameProps) {
  const t = useTranslations("modernJobs.facts");
  const title = t("title");
  const emptyPlaceholder = t("empty");

  return (
    <aside
      aria-label={title}
      className={className}
      style={{
        background: "var(--cam-surface, #ffffff)",
        border: "1px solid var(--cam-border, #cbd5e1)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        ...style,
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--cam-border, #e2e8f0)",
          paddingBottom: 10,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cam-text, #1c1f1d)",
          }}
        >
          {title}
        </h3>
        {onReset && (
          <button
            type="button"
            onClick={() => {
              const confirmMsg = t("resetConfirm");
              if (typeof window !== "undefined" && window.confirm(confirmMsg)) {
                onReset();
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--cam-green, #1a5c3a)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {t("reset")}
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--cam-text-muted, #64748b)",
            fontStyle: "italic",
            lineHeight: 1.4,
            padding: "8px 0",
          }}
        >
          {emptyPlaceholder}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lines.map((line) => {
            const isActive = line.questionId === activeQuestionId;
            return (
              <button
                key={line.questionId}
                type="button"
                onClick={() => onSelectQuestion(line.questionId)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: isActive
                    ? "1px solid var(--cam-green, #1a5c3a)"
                    : "1px solid transparent",
                  background: isActive
                    ? "var(--vt-accent-soft, #eaf3ec)"
                    : "transparent",
                  color: isActive
                    ? "var(--cam-green, #1a5c3a)"
                    : "var(--cam-text, #1c1f1d)",
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: line.isAnswered ? "var(--cam-green, #1a5c3a)" : "var(--cam-text-muted, #94a3b8)",
                    }}
                  >
                    {line.isAnswered ? "✓" : "○"}
                  </span>
                  <span>{line.title}</span>
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: isActive
                      ? "var(--cam-green, #1a5c3a)"
                      : line.isAnswered
                        ? "var(--cam-text-muted, #4b5563)"
                        : "var(--cam-text-muted, #94a3b8)",
                    fontStyle: line.isAnswered ? "normal" : "italic",
                    lineHeight: 1.35,
                    paddingLeft: 14,
                  }}
                >
                  {line.detail}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
