"use client";

// Renders the non-ready states of an administrative data panel: loading,
// error, authorization refusal, not found, "the system has no source for this"
// and successful-but-empty. Each is visually distinct, because conflating them
// is how an API failure ends up looking like "there are no records".
//
// Deliberately has no "fallback rows" prop. A panel either shows authoritative
// data or shows the absence of it.

import type { ReactNode } from "react";
import {
  dataStateMessage,
  errorDetail,
  type DataState as State,
} from "@/lib/admin-data-state";

const TONES: Record<Exclude<State, "ready">, { bg: string; border: string; color: string; icon: string }> = {
  loading: { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b", icon: "" },
  empty: { bg: "#f8fafc", border: "#e2e8f0", color: "#475569", icon: "" },
  unavailable: { bg: "#f8fafc", border: "#e2e8f0", color: "#64748b", icon: "" },
  error: { bg: "#fef2f2", border: "#fecaca", color: "#b91c1c", icon: "!" },
  forbidden: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "" },
  notFound: { bg: "#f8fafc", border: "#e2e8f0", color: "#475569", icon: "" },
};

export interface DataStateProps {
  state: State;
  /** Lower-case noun phrase, e.g. "les dossiers", used in the message. */
  resource: string;
  /** Overrides the default headline for this state. */
  title?: string;
  /** Second line: what the reader should expect or do. */
  hint?: ReactNode;
  /** The query error, so a server message can be surfaced verbatim. */
  error?: unknown;
  /** Retry handler, rendered only for the `error` state. */
  onRetry?: () => void;
  /** Compact variant for small cards. */
  dense?: boolean;
}

export function DataState({ state, resource, title, hint, error, onRetry, dense }: DataStateProps) {
  if (state === "ready") return null;

  const tone = TONES[state];
  const headline = title ?? dataStateMessage(state, resource) ?? "";
  const detail = state === "error" ? errorDetail(error) : null;

  return (
    <div
      role={state === "error" ? "alert" : "status"}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: 8,
        padding: dense ? "12px 14px" : "28px 24px",
        textAlign: dense ? "left" : "center",
        color: tone.color,
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        alignItems: dense ? "flex-start" : "center",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: dense ? 13 : 14 }}>
        {tone.icon ? `${tone.icon} ` : ""}
        {headline}
      </div>
      {hint && <div style={{ fontSize: 12, opacity: 0.85, maxWidth: 520 }}>{hint}</div>}
      {detail && (
        <div style={{ fontSize: 12, opacity: 0.9, maxWidth: 520, fontFamily: "ui-monospace, monospace" }}>
          {detail}
        </div>
      )}
      {state === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${tone.border}`,
            background: "#ffffff",
            color: tone.color,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

/**
 * Same states, rendered as a single full-width table row so a table keeps its
 * header and column semantics while reporting why it has no rows.
 */
export function DataStateRow({
  state,
  resource,
  colSpan,
  title,
  hint,
  error,
  onRetry,
}: DataStateProps & { colSpan: number }) {
  if (state === "ready") return null;
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 16 }}>
        <DataState state={state} resource={resource} title={title} hint={hint} error={error} onRetry={onRetry} />
      </td>
    </tr>
  );
}
