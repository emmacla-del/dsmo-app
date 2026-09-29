"use client";

import type { ReactNode } from "react";

/**
 * Card/surface wrapper for a wizard section's content. Padding responds to
 * viewport via Tailwind breakpoints instead of a useViewportSize() read.
 */
export function FormSection({ children }: { children: ReactNode }) {
  return (
    <div
      className="p-4 md:p-6"
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        border: "1px solid var(--vt-card-border, #e5eae7)",
        borderRadius: "var(--vt-card-radius, 4px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
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
  variant = "accent",
  trailing,
  bordered = false,
  children,
}: {
  title?: ReactNode;
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
            {variant === "plain" ? (
              <h3
                style={{
                  fontFamily: "var(--cam-font-sans)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--cam-green-dark)",
                  margin: 0,
                }}
              >
                {title}
              </h3>
            ) : (
              <h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                <span aria-hidden="true" style={{ width: 3.5, height: 18, backgroundColor: "var(--cam-green)", borderRadius: 2 }} />
                <span
                  style={{
                    fontFamily: "var(--cam-font-sans)",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: 0.5,
                    color: "var(--cam-green)",
                    textTransform: "uppercase",
                  }}
                >
                  {title}
                </span>
              </h3>
            )}
          </div>
          {trailing}
        </div>
      )}
      {children}
    </div>
  );
}
