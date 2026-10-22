import type { CSSProperties, ReactNode } from "react";
import type { SectionProgressStatus } from "@/lib/section-progress";

/** Shared status styling; callers supply the entity's translated label. */
export function SectionProgressText({
  status,
  children,
  style,
}: {
  status: SectionProgressStatus;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        color:
          status === "complete"
            ? "var(--cam-green)"
            : status === "has-errors"
              ? "var(--cam-error)"
              : "var(--cam-text-muted)",
        fontWeight: status === "complete" || status === "has-errors" ? 600 : 400,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
