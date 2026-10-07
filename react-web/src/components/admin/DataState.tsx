"use client";

// Renders the non-ready states of an administrative data panel: loading,
// error, authorization refusal, not found, "the system has no source for this"
// and successful-but-empty. Each is visually distinct, because conflating them
// is how an API failure ends up looking like "there are no records".
//
// Deliberately has no "fallback rows" prop. A panel either shows authoritative
// data or shows the absence of it.
//
// Appearance comes entirely from the shared classes — .cam-admin-empty for the
// neutral states, .cam-admin-notice--error / --warn for the two that report a
// failure. It carried its own inline slate palette until Step 0 of the UI
// tidy: a component that every admin page uses to say "something is wrong"
// cannot also be the component that breaks the colour rule.

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import {
  dataStateMessage,
  errorDetail,
  type DataState as State,
} from "@/lib/admin-data-state";

// Which of the six states reads as a failure, and in which notice tone.
// `error` is the server or network failing; `forbidden` is the server
// answering correctly that this account may not see the record, which is a
// warning about scope, not a fault. The remaining four are neutral — there is
// simply nothing to show — so they render as .cam-admin-empty with no box.
const NOTICE_TONE: Partial<Record<Exclude<State, "ready">, "error" | "warn">> = {
  error: "error",
  forbidden: "warn",
};

export interface DataStateProps {
  state: State;
  /**
   * Lower-case noun phrase, e.g. "les dossiers", used in the message. Pass it
   * in the console locale; it is interpolated as-is.
   */
  resource: string;
  /** Overrides the default headline for this state. */
  title?: string;
  /** Second line: what the reader should expect or do. */
  hint?: ReactNode;
  /** The query error, so a server message can be surfaced verbatim. */
  error?: unknown;
  /** Retry handler, rendered only for the `error` state. */
  onRetry?: () => void;
  /**
   * Compact variant for small cards. Applies to the neutral states, which are
   * otherwise centred in a generous block. The error and forbidden states
   * ignore it: .cam-admin-notice is already at this density, and a notice
   * carrying a server message is always left-aligned.
   */
  dense?: boolean;
}

export function DataState({ state, resource, title, hint, error, onRetry, dense }: DataStateProps) {
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  if (state === "ready") return null;

  const tone = NOTICE_TONE[state];
  const headline = title ?? dataStateMessage(state, resource, locale) ?? "";
  const detail = state === "error" ? errorDetail(error) : null;

  // Neutral: nothing to report but the absence itself. No box, no fill — a
  // bordered grey panel around "aucun dossier" reads as an error.
  if (!tone) {
    return (
      <div
        role="status"
        className={`cam-admin-empty${dense ? " cam-admin-empty--dense" : ""}`}
      >
        <strong>{headline}</strong>
        {hint && <div className="cam-admin-state-hint">{hint}</div>}
      </div>
    );
  }

  return (
    <div
      role={state === "error" ? "alert" : "status"}
      className={`cam-admin-notice cam-admin-notice--${tone}`}
    >
      <div className="cam-admin-state-stack">
        <strong>
          {state === "error" ? "! " : ""}
          {headline}
        </strong>
        {hint && <div className="cam-admin-state-hint">{hint}</div>}
        {detail && <div className="cam-admin-state-detail">{detail}</div>}
        {state === "error" && onRetry && (
          <button type="button" onClick={onRetry} className="cam-admin-state-retry">
            {tCommon("retry")}
          </button>
        )}
      </div>
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
      <td colSpan={colSpan} className="cam-admin-state-cell">
        <DataState state={state} resource={resource} title={title} hint={hint} error={error} onRetry={onRetry} />
      </td>
    </tr>
  );
}
