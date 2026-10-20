"use client";

// The advisory disagreements of the tables on screen (4.2/4.7, 4.2/4.8,
// 4.7/4.10: lib/vt-advisory-coherence.ts), shown the moment both tables of
// a pair are complete, while the respondent is still filling the section.
//
// Advisory (CLAUDE.md §7): it never blocks Next or submission, so it must
// not look like the blocking cross-table list above it (VtCrossTableNotice,
// red, role="alert"). It is an amber left rule, the wizard's
// .section-notice shape, with no box and no fill, and role="status". Each
// disagreement is one short line with the figures and a link to each of its
// two tables, as the blocking list has (a section stands in one column, so
// neither table is "the other one", and both are a scroll away);
// "Pourquoi ?" opens the explanation in place (a disclosure rather than a
// hover tooltip, which a finger or a keyboard cannot reach).

import { useContext } from "react";
import { useLocale, useTranslations } from "next-intl";
import { VtQuizContext } from "./VtScopeQuiz";
import type { VtAdvisoryIssue } from "@/lib/vt-advisory-coherence";
import { VT_ADVISORY_TABLE_CODES } from "@/lib/vt-advisory-coherence";

export const VT_ADVISORY_NOTICE_ATTR = "data-vt-advisory-coherence";

export function VtAdvisoryCoherenceNotice({
  issues,
  tableFieldIds,
  onOpenTable,
}: {
  /** Every advisory disagreement of the section (vtAdvisoryIssues). */
  issues: VtAdvisoryIssue[];
  /** The tables on screen: only their disagreements are shown. */
  tableFieldIds: string[];
  /** Brings the table with this field id into view. */
  onOpenTable: (fieldId: string) => void;
}) {
  const t = useTranslations("vtWizard");
  const lang = useLocale().startsWith("en") ? "en" : "fr";
  const { openQuiz } = useContext(VtQuizContext);
  const onScreen = new Set(tableFieldIds);
  const shown = issues.filter((issue) => issue.tables.some((id) => onScreen.has(id)));
  if (shown.length === 0) return null;
  // A table the preliminary questionnaire switched off counts 0 and says so.
  const label = (issue: VtAdvisoryIssue, i: 0 | 1) =>
    issue.offTables.includes(issue.tables[i]) ? `${issue.labels[i][lang]} ${t("advisoryOff")}` : issue.labels[i][lang];

  return (
    <ul
      {...{ [VT_ADVISORY_NOTICE_ATTR]: "" }}
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--cam-space-3)",
        margin: "var(--cam-space-4) 0 0",
        padding: "var(--cam-space-1) 0 var(--cam-space-1) var(--cam-space-3)",
        listStyle: "none",
        borderLeft: "4px solid var(--cam-warning)",
        fontFamily: "var(--cam-font-sans)",
        fontSize: "var(--cam-font-size-xs)",
        lineHeight: "var(--cam-line-height-copy)",
        color: "var(--cam-text)",
      }}
    >
      {shown.map((issue) => {
        const figures = issue.bySex
          .map((s) =>
            t("advisoryFigures", {
              sex: t(s.sex === "male" ? "advisoryMen" : "advisoryWomen"),
              first: label(issue, 0),
              firstValue: s.first,
              second: label(issue, 1),
              secondValue: s.second,
            }),
          )
          .join(lang === "fr" ? " ; " : "; ");
        // A table the questionnaire switched off is not filled in by hand:
        // the answer to change, if any, is in the questionnaire.
        const askable = issue.tables.filter((id) => !issue.offTables.includes(id));
        const anyOff = issue.offTables.some((id) => issue.tables.includes(id));
        const codes = issue.tables.map((id) => VT_ADVISORY_TABLE_CODES[id]).join(lang === "en" ? " and " : " et ");
        return (
          <li key={issue.code}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--cam-warning)" }}>{t("advisoryTitle")}</strong>
              {lang === "fr" ? " : " : ": "}
              {figures}
              {askable.map((id) => (
                <span key={id}>
                  {" "}
                  <button
                    type="button"
                    className="cam-text-button"
                    // A table named in two disagreements gets two links:
                    // each says which comparison it belongs to, so no two
                    // links read alike (the blocking list's own rule).
                    aria-label={t("crossTableOpenFull", { code: VT_ADVISORY_TABLE_CODES[id], tables: codes })}
                    onClick={() => onOpenTable(id)}
                  >
                    {t("crossTableOpen", { code: VT_ADVISORY_TABLE_CODES[id] })}
                  </button>
                </span>
              ))}
              {anyOff && openQuiz && (
                <>
                  {" "}
                  <button type="button" className="cam-text-button" onClick={openQuiz}>
                    {t("advisoryOpenQuiz")}
                  </button>
                </>
              )}
            </p>
            <details>
              <summary className="cam-text-button" style={{ cursor: "pointer", width: "fit-content" }}>
                {t("advisoryWhy")}
              </summary>
              <p style={{ margin: "var(--cam-space-1) 0 0", color: "var(--cam-text-muted)" }}>{issue.why[lang]}</p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
