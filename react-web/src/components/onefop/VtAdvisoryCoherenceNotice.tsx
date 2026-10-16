"use client";

// The advisory disagreements of the table on screen (4.2/4.7, 4.2/4.8,
// 4.7/4.10: lib/vt-advisory-coherence.ts), shown the moment both tables of
// a pair are complete, while the respondent is still on the table.
//
// Advisory (CLAUDE.md §7): it never blocks Next or submission, so it must
// not look like the blocking cross-table list above it (VtCrossTableNotice,
// red, role="alert"). It is an amber left rule, the wizard's
// .section-notice shape, with no box and no fill, and role="status". Each
// disagreement is one short line with the figures and a link to the other
// table; "Pourquoi ?" opens the explanation in place (a disclosure rather
// than a hover tooltip, which a finger or a keyboard cannot reach).

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
  /** Opens the table with this field id (its step, in Section 4). */
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
        const other = issue.tables.find((id) => !onScreen.has(id));
        return (
          <li key={issue.code}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--cam-warning)" }}>{t("advisoryTitle")}</strong>
              {lang === "fr" ? " : " : ": "}
              {figures}
              {other && !issue.offTables.includes(other) && (
                <>
                  {" "}
                  <button type="button" className="cam-text-button" onClick={() => onOpenTable(other)}>
                    {t("crossTableOpen", { code: VT_ADVISORY_TABLE_CODES[other] })}
                  </button>
                </>
              )}
              {/* The other table is not asked: the answer to change, if any, is in the questionnaire. */}
              {other && issue.offTables.includes(other) && openQuiz && (
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
