"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * One block of a wizard section's questions. Not a card: blocks are told
 * apart by their heading and the rule between them (.cam-wizard-block in
 * globals.css), not by a box (owner, 2026-10-10; UI grammar G4/G14).
 */
export function FormSection({ children }: { children: ReactNode }) {
  return <section className="cam-wizard-block">{children}</section>;
}

export type FormSectionVariant = "plain" | "accent";

/** The group heading stays at the viewport top while its own block is on screen. */
export const pinnedSubsectionHeadStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "var(--cam-surface)",
  paddingBottom: "var(--cam-space-4)",
};

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
        gap: title ? 0 : 16,
        marginTop: bordered ? 18 : 0,
        paddingTop: bordered ? 18 : 0,
        borderTop: bordered ? "1px solid var(--vt-card-border)" : undefined,
      }}
    >
      {title && (
        <div
          style={{
            ...pinnedSubsectionHeadStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* The in-page group heading, now that the section name lives in
                the rail: 24px bold, over the table question (18px bold) and
                the field question (15px medium). Owner, 2026-10-22. */}
            <h3
              style={{
                fontFamily: "var(--cam-font-sans)",
                fontWeight: "var(--cam-font-weight-bold)",
                fontSize: "var(--cam-font-size-xl)",
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
