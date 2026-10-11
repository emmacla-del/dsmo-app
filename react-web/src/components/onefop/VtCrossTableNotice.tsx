"use client";

// Every §7 cross-table disagreement in the section, listed at once
// (audit R5). Each one names the two tables that count the same people
// differently and offers to open either, because the figure to correct may
// be in either: the respondent decides which one is wrong.
//
// Before this, a mismatch was only reported on the later table of its pair,
// so in Sections 4 and 8 — one table per screen — the respondent met them
// one press of Suivant at a time (4.1 ↔ 4.2, then 4.2 ↔ 4.5, then
// 4.5 ↔ 4.6) and had to guess what else was coming.
//
// The list replaces those tables' own inline message rather than adding to
// it, so nothing is said twice (VtWizardSectionScreen).

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { VtCrossTableIssue } from "@/lib/vt-cross-table";

export function VtCrossTableNotice({
  issues,
  locale,
  onOpenTable,
}: {
  issues: VtCrossTableIssue[];
  locale: "fr" | "en";
  /** Opens the table that holds `fieldId` (its step, in Sections 4 and 8). */
  onOpenTable: (fieldId: string) => void;
}) {
  const t = useTranslations();
  const headingId = useId();
  if (issues.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      role="alert"
      style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)", marginTop: "var(--cam-space-4)" }}
    >
      <h3
        id={headingId}
        style={{
          margin: 0,
          fontFamily: "var(--cam-font-sans)",
          fontSize: "var(--cam-font-size-xs)",
          fontWeight: 700,
          color: "var(--cam-error)",
        }}
      >
        {t("vtWizard.crossTableTitle", { count: issues.length })}
      </h3>
      <ul style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)", margin: 0, padding: 0, listStyle: "none" }}>
        {issues.map((issue) => (
          <li key={`${issue.fieldId}-${issue.tables.map((tb) => tb.code).join("-")}`}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--cam-font-sans)",
                fontSize: "var(--cam-font-size-xs)",
                fontWeight: 600,
                color: "var(--cam-error)",
                lineHeight: 1.5,
              }}
            >
              {locale === "en" ? issue.en : issue.fr}
            </p>
            <p style={{ margin: "4px 0 0", display: "flex", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
              {issue.tables.map((tb) => (
                <button
                  key={tb.fieldId}
                  type="button"
                  className="cam-text-button"
                  // A table named in two mismatches gets two links: each says
                  // which comparison it belongs to, so no two links read
                  // alike, and the visible label is part of that name.
                  aria-label={t("vtWizard.crossTableOpenFull", {
                    code: tb.code,
                    tables: issue.tables.map((o) => o.code).join(locale === "en" ? " and " : " et "),
                  })}
                  onClick={() => onOpenTable(tb.fieldId)}
                >
                  {t("vtWizard.crossTableOpen", { code: tb.code })}
                </button>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
