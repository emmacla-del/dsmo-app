"use client";

import type { ReactNode } from "react";

/**
 * One block of a wizard section's questions. Not a card: blocks are told
 * apart by their heading and the rule between them (.cam-wizard-block in
 * globals.css), not by a box (owner, 2026-10-10; UI grammar G4/G14).
 */
export function FormSection({ children }: { children: ReactNode }) {
  return <section className="cam-wizard-block">{children}</section>;
}

export type FormSectionVariant = "plain" | "accent";

/**
 * One heading + field group inside a FormSection. `variant` is an explicit
 * prop rather than the old French-title string match
 * (headingText === "Localisation administrative et Milieu d'implantation"
 * etc. in VtWizardSectionScreen.tsx) — styling no longer depends on which
 * language the title happens to be in.
 */
export function FormSubsection({
  title,
  trailing,
  bordered = false,
  children,
}: {
  title?: ReactNode;
  /** Kept for callers; both variants now draw the same title. */
  variant?: FormSectionVariant;
  /** Status chip or similar, rendered opposite the title. */
  trailing?: ReactNode;
  /** Adds a top divider — set on every subsection after the first within a card. */
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        marginTop: bordered ? 18 : 0,
        paddingTop: bordered ? 18 : 0,
        borderTop: bordered ? "1px solid var(--vt-card-border, #e5eae7)" : undefined,
      }}
    >
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* One recipe for both variants: 18px bold in text colour,
                one step under the section title (24px) and over the
                questions (15px semibold): the block's one bold level (owner,
                2026-10-11). The accent bar and capitals were decoration
                (owner, 2026-10-10). */}
            <h3
              style={{
                fontFamily: "var(--cam-font-sans)",
                fontWeight: "var(--cam-font-weight-bold)",
                fontSize: "var(--cam-font-size-lg)",
                lineHeight: "var(--cam-line-height-title)",
                color: "var(--cam-text)",
                margin: 0,
              }}
            >
              {title}
            </h3>
          </div>
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}
