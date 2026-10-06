"use client";

import Link from "next/link";

// In-page view switch: the views or filters of one page, below the header's
// hub tabs. It is deliberately not tab-styled — the hub tabs above are the
// navigation, and two identical rows read as two levels of the same thing.
// Plain text items, the active one underlined (.cam-admin-views).
//
// Two forms, by what an item does:
//  * href    — a view held in the URL: a link, `aria-current` on the active one.
//  * onClick — a filter of the list below: a button, `aria-pressed`.
// No ARIA role is claimed: these are links and buttons, not tabs (there are
// no tab panels behind them). A row of links is a labelled <nav>; a row of
// filter buttons is a plain container — each button's own text and
// aria-pressed state say what it does.

export interface ViewSwitchItem {
  key: string;
  label: string;
  active: boolean;
  /** Row count for this view or filter; null renders nothing (not "0"). */
  count?: number | null;
  href?: string;
  onClick?: () => void;
}

/** `label` names the <nav> when the items are links; a button row has no landmark to name. */
export function ViewSwitch({ label, items }: { label: string; items: ViewSwitchItem[] }) {
  const children = items.map((item) => {
    const content = (
      <>
        {item.label}
        {item.count != null && <span className="cam-admin-views-count">{item.count}</span>}
      </>
    );
    return item.href ? (
      <Link
        key={item.key}
        href={item.href}
        className="cam-admin-views-item"
        aria-current={item.active ? "page" : undefined}
      >
        {content}
      </Link>
    ) : (
      <button
        key={item.key}
        type="button"
        className="cam-admin-views-item"
        aria-pressed={item.active}
        onClick={item.onClick}
      >
        {content}
      </button>
    );
  });

  return items.some((item) => item.href) ? (
    <nav className="cam-admin-views" aria-label={label}>
      {children}
    </nav>
  ) : (
    <div className="cam-admin-views">{children}</div>
  );
}
