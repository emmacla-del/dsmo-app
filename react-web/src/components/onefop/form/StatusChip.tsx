"use client";

export type FormStatus = "not-started" | "in-progress" | "complete" | "has-errors";

const STATUS_STYLE: Record<FormStatus, { bg: string; border: string; fg: string; icon: string }> = {
  "has-errors": { bg: "var(--cam-error-bg)", border: "var(--cam-error)", fg: "var(--cam-error)", icon: "⚠" },
  complete: { bg: "var(--cam-success-bg)", border: "var(--cam-green)", fg: "var(--cam-green)", icon: "✓" },
  "in-progress": { bg: "var(--cam-bg)", border: "var(--cam-border)", fg: "var(--cam-text-muted)", icon: "●" },
  "not-started": { bg: "transparent", border: "var(--cam-border)", fg: "var(--cam-text-muted)", icon: "○" },
};

/**
 * Explicit status prop instead of inferring styling from a subsection's
 * French title (the old VtWizardBlockStatusChip suppressed itself entirely
 * on Section 1/2 because their headings matched a "plainHeading" string
 * list). Status is communicated by icon + text together, not color alone,
 * so it survives color-blindness and screen readers.
 */
export function StatusChip({ status, label }: { status: FormStatus; label: string }) {
  if (status === "not-started") return null;
  const s = STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--cam-radius-sm)",
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        color: s.fg,
        fontSize: 11,
        fontFamily: "var(--cam-font-sans)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>{s.icon}</span>
      {label}
    </span>
  );
}
