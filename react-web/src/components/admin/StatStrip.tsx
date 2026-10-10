import Link from "next/link";
import type { ReactNode } from "react";

export interface StatItem {
  key: string;
  /** Already formatted (count / percent from lib/admin-data-state). */
  value: string;
  label: string;
  /** The longer explanation the old KPI card printed under the figure; now a tooltip. */
  hint?: string;
  /** Optional: the figure links to the list it counts. */
  href?: string;
}

// A label inside the line starts lower-case ("3 comptes actifs"), unless it
// opens with an acronym ("ONEFOP", "VT"), which keeps its capitals.
function inLine(label: string): string {
  return label.length > 1 && label[1] === label[1].toLowerCase() ? label[0].toLowerCase() + label.slice(1) : label;
}

// One line of figures above a page's content, "3 établissements · 3 actifs ·
// 0 en attente": the replacement for rows of large KPI cards (owner,
// 2026-10-10). Plain text on the page background: no card, border or colour.
//
// G10: while loading it shows one muted status line, never a placeholder
// figure; an error is the caller's notice, shown instead of the strip.
export function StatStrip({
  items,
  label,
  loading = false,
  loadingLabel,
}: {
  items: StatItem[];
  /** Accessible name of the list, e.g. "Chiffres clés". */
  label: string;
  loading?: boolean;
  loadingLabel: string;
}) {
  if (loading) {
    return (
      <p className="cam-admin-meta cam-admin-statline-loading" role="status">
        {loadingLabel}
      </p>
    );
  }
  return (
    <ul className="cam-admin-statline" aria-label={label}>
      {items.map((item) => {
        const body: ReactNode = (
          <>
            <span className="cam-admin-statline-value">{item.value}</span> {inLine(item.label)}
          </>
        );
        return (
          <li key={item.key} title={item.hint}>
            {item.href ? <Link href={item.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ul>
  );
}
