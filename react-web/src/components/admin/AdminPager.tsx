import type { ReactNode } from "react";

export interface AdminPagerProps {
  page: number;
  pageCount: number;
  /** « Page 2 sur 5 », already worded for the list it belongs to. */
  status: string;
  previousLabel: string;
  nextLabel: string;
  onPage: (next: number) => void;
}

/** Previous / next for a list. Goes in the `footer` of its AdminTablePanel. */
export function AdminPager({ page, pageCount, status, previousLabel, nextLabel, onPage }: AdminPagerProps) {
  return (
    <div className="cam-audit-pager">
      <button
        type="button"
        className="cam-button cam-button-secondary cam-button-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {previousLabel}
      </button>
      <span>{status}</span>
      <button
        type="button"
        className="cam-button cam-button-secondary cam-button-sm"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        {nextLabel}
      </button>
    </div>
  );
}

export interface AdminNumberedPagerProps {
  page: number;
  pageCount: number;
  /** « Affichage 1-25 sur 148 », already worded (an AdminLiveResultCount
   *  when the list announces its results). */
  range: ReactNode;
  previousLabel: string;
  nextLabel: string;
  /** Accessible name of the pager, e.g. « Pagination des inscriptions ». */
  label: string;
  pageLabel: (page: number) => string;
  disabled?: boolean;
  onPage: (next: number) => void;
}

/** Page numbers to show: first, last, the current page and its neighbours. */
export function pagerWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/**
 * Range, then numbered pages with previous / next (canvas board 0 §6). For a
 * list's footer; the range is the live result count the list announces.
 */
export function AdminNumberedPager({ page, pageCount, range, previousLabel, nextLabel, label, pageLabel, disabled = false, onPage }: AdminNumberedPagerProps) {
  return (
    <div className="cam-pager">
      <span>{range}</span>
      {pageCount > 1 && (
        <nav className="cam-pager-pages" aria-label={label}>
          <button type="button" className="cam-pager-button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
            {previousLabel}
          </button>
          {pagerWindow(page, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="cam-pager-gap" aria-hidden="true">…</span>
            ) : (
              <button
                key={entry}
                type="button"
                className="cam-pager-button"
                aria-label={pageLabel(entry)}
                aria-current={entry === page ? "page" : undefined}
                disabled={disabled && entry !== page}
                onClick={() => entry !== page && onPage(entry)}
              >
                {entry}
              </button>
            ),
          )}
          <button type="button" className="cam-pager-button" disabled={disabled || page >= pageCount} onClick={() => onPage(page + 1)}>
            {nextLabel}
          </button>
        </nav>
      )}
    </div>
  );
}
