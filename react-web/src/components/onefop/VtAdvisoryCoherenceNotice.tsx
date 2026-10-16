"use client";

// The server's advisory coherence flags for the table on screen
// (4.2/4.7, 4.2/4.8, 4.7/4.10: lib/vt-advisory-coherence.ts), shown while
// the respondent fills Section 4 rather than only on the review screen.
//
// Advisory (CLAUDE.md §7): it never blocks Next or submission, so it must
// not look like the blocking cross-table list above it (VtCrossTableNotice,
// red, role="alert"). It is an amber left rule — the wizard's
// .section-notice shape, no box and no fill — with role="status", a
// sentence that says it does not stop the respondent, and one link to the
// other table compared.

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { CoherenceFlag } from "@/lib/onefop-submission";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import { vtAdvisoryItemsForTables } from "@/lib/vt-advisory-coherence";

export const VT_ADVISORY_NOTICE_ATTR = "data-vt-advisory-coherence";

export function VtAdvisoryCoherenceNotice({
  flags,
  tableFieldIds,
  onOpenTable,
}: {
  /** The advisory flags of the answers as they stand (useVtAdvisoryCoherence). */
  flags: CoherenceFlag[];
  /** The tables on screen: only their flags are shown. */
  tableFieldIds: string[];
  /** Opens the table with this field id (its step, in Section 4). */
  onOpenTable: (fieldId: string) => void;
}) {
  const t = useTranslations();
  const tDossier = useTranslations("adminDossierPage");
  const headingId = useId();
  const items = vtAdvisoryItemsForTables(flags, tableFieldIds);
  if (items.length === 0) return null;

  return (
    <section
      {...{ [VT_ADVISORY_NOTICE_ATTR]: "" }}
      aria-labelledby={headingId}
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--cam-space-2)",
        marginTop: "var(--cam-space-4)",
        padding: "var(--cam-space-1) 0 var(--cam-space-1) var(--cam-space-3)",
        borderLeft: "4px solid var(--cam-warning)",
        fontFamily: "var(--cam-font-sans)",
        fontSize: "var(--cam-font-size-xs)",
        lineHeight: "var(--cam-line-height-copy)",
        color: "var(--cam-text)",
      }}
    >
      <h3 id={headingId} style={{ margin: 0, fontSize: "inherit", fontWeight: "var(--cam-font-weight-bold)", color: "var(--cam-warning)" }}>
        {t("vtWizard.advisoryTitle", { count: items.length })}
      </h3>
      <p style={{ margin: 0, color: "var(--cam-text-muted)" }}>{t("vtWizard.advisoryIntro")}</p>
      <ul style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-3)", margin: 0, padding: 0, listStyle: "none" }}>
        {items.map(({ flag, otherTables }, i) => (
          <li key={`${flag.code}-${i}`}>
            <p style={{ margin: 0 }}>{coherenceWarningText(tDossier, flag.code, flag.message)}</p>
            {otherTables.length > 0 && (
              <p style={{ margin: "var(--cam-space-1) 0 0", display: "flex", gap: "var(--cam-space-3)", flexWrap: "wrap" }}>
                {otherTables.map((tb) => (
                  <button key={tb.fieldId} type="button" className="cam-text-button" onClick={() => onOpenTable(tb.fieldId)}>
                    {t("vtWizard.crossTableOpen", { code: tb.code })}
                  </button>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
