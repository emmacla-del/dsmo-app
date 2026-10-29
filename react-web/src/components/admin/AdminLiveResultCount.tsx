import type { ReactNode } from "react";

/** Announces the single visible result range when committed results change. */
export function AdminLiveResultCount({
  children,
  className,
  announce = true,
}: {
  children: ReactNode;
  className?: string;
  /** False while retained placeholder data still belongs to the prior query. */
  announce?: boolean;
}) {
  return (
    <span
      className={className}
      aria-live={announce ? "polite" : undefined}
      aria-atomic={announce ? "true" : undefined}
    >
      {children}
    </span>
  );
}
