"use client";

import type { ReactNode } from "react";

/**
 * Shared styling for instructional/helper text under a field — field hints
 * ("Not to be filled in"), group instructions ("Select all that apply").
 * Replaces the ~9 call sites in VtWizardFields.tsx that each hand-rolled
 * their own <p style={{fontSize:12, color:..., margin:...}}> with slightly
 * different values (some used --vt-ink-soft with a 6px top margin, others
 * --cam-text-muted with 4px — same resolved color, inconsistent spacing).
 */
export function Microcopy({
  children,
  variant = "hint",
  id,
}: {
  children: ReactNode;
  variant?: "hint" | "instruction";
  /** Lets a control reference this text with aria-describedby. */
  id?: string;
}) {
  return (
    <p
      id={id}
      style={{
        fontSize: "var(--cam-microcopy-size)",
        color: "var(--cam-microcopy-color)",
        fontStyle: variant === "instruction" ? "italic" : "normal",
        margin: variant === "instruction" ? "0 0 10px" : "var(--cam-microcopy-margin-top) 0 0",
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  );
}
