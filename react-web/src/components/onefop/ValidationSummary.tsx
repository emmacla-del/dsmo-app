"use client";

import { useTranslations } from "next-intl";
import type { ValidationIssue } from "@/lib/onefop-validation";

interface ValidationSummaryProps {
  issues: ValidationIssue[];
}

/**
 * GOV.UK-style error summary (interaction reference only, per the plan's
 * binding constraints — not a dependency, just the established a11y
 * pattern): a focusable, linked list of problems shown after a submit
 * attempt, each entry jumping to and focusing its field so keyboard/screen
 * reader users don't have to hunt through the form.
 */
export function ValidationSummary({ issues }: ValidationSummaryProps) {
  const t = useTranslations();
  if (issues.length === 0) return null;

  return (
    <div
      role="alert"
      aria-labelledby="onefop-validation-summary-title"
      style={{
        border: "2px solid var(--cam-error)",
        borderRadius: "var(--cam-radius-md)",
        padding: "var(--cam-space-4)",
        marginBottom: "var(--cam-space-4)",
        background: "var(--cam-error-bg)",
      }}
    >
      <h2
        id="onefop-validation-summary-title"
        style={{ fontSize: "var(--cam-font-size-base)", fontWeight: 700, margin: "0 0 var(--cam-space-2)", color: "var(--cam-error)" }}
      >
        {t("validationSummary.title", { count: issues.length })}
      </h2>
      <ul style={{ margin: 0, paddingLeft: "var(--cam-space-5)" }}>
        {issues.map((issue) => (
          <li key={issue.fieldId}>
            <a
              href={`#${issue.fieldId}`}
              style={{ color: "var(--cam-error)", textDecoration: "underline" }}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(issue.fieldId);
                el?.focus();
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
