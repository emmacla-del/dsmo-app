"use client";

export type KpiTone = "neutral" | "warning" | "info" | "success" | "danger";

export interface KpiItem {
  key: string;
  label: string;
  /** Already formatted (count / percent from lib/admin-data-state). */
  value: string;
  hint?: string;
  /** warning: waits on an officer · info: a time signal or a wait on the
   *  declarant · success: decided · danger: refused or blocking only. */
  tone?: KpiTone;
  /** When set, the figure is a button that filters the list below. */
  onSelect?: () => void;
  /** The list below is filtered on this figure. */
  pressed?: boolean;
  /** Accessible description of what selecting does. */
  selectHint?: string;
}

/**
 * The row of key figures above a list (canvas board 0 §1, owner 2026-11-08).
 * One bordered strip, at most four figures, each optionally a filter. It
 * replaces the floating « Statut des inscriptions » summary and the lone
 * response-rate card.
 *
 * G10: while the source loads it shows one status line, never a placeholder
 * figure; when the source failed it says the figures are unavailable.
 */
export function AdminKpiStrip({
  items,
  label,
  loading = false,
  loadingLabel,
  error = false,
  errorLabel,
  note,
}: {
  items: KpiItem[];
  /** Accessible name, e.g. « Chiffres de la file d’inscriptions ». */
  label: string;
  loading?: boolean;
  loadingLabel: string;
  error?: boolean;
  errorLabel: string;
  /** One line under the strip: what the figures cover. */
  note?: string;
}) {
  if (error || loading) {
    return (
      <p className="cam-kpi-strip-status" role="status">
        {error ? errorLabel : loadingLabel}
      </p>
    );
  }
  // No figures to show (e.g. the territory filter is invalid): no empty frame.
  if (items.length === 0) return null;
  return (
    <div>
      <ul className="cam-kpi-strip" aria-label={label}>
        {items.map((item) => {
          const className = `cam-kpi is-${item.tone ?? "neutral"}`;
          const body = (
            <>
              <span className="cam-kpi-label">
                <span className="cam-kpi-swatch" aria-hidden="true" />
                {item.label}
              </span>
              <span className="cam-kpi-value">{item.value}</span>
              {item.hint && <span className="cam-kpi-hint">{item.hint}</span>}
            </>
          );
          return (
            <li key={item.key}>
              {item.onSelect ? (
                <button
                  type="button"
                  className={className}
                  aria-pressed={item.pressed ?? false}
                  onClick={item.onSelect}
                >
                  {body}
                  {/* Read with the figure; a title attribute is not announced
                      reliably and never shows on touch. */}
                  {item.selectHint && <span className="sr-only">{item.selectHint}</span>}
                </button>
              ) : (
                <div className={className}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {note && <p className="cam-kpi-strip-note">{note}</p>}
    </div>
  );
}
