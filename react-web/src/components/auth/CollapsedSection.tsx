"use client";

// The resting state of a finished section: one line instead of a form.
//
// On a six-section single page, every completed section left open costs the
// respondent a screen of scrolling to reach the one they are actually filling.
// Collapsed, a section still says what it holds -- its title, the first few
// answers, and a check badge -- and offers the way back in.
//
// The whole row is the control, so there is no small target to hit, and the
// visible "Modifier" text is a label inside it rather than a nested button
// (a button inside a button is invalid HTML and the inner one would swallow
// the row's own click).
export function CollapsedSection({
  title,
  summary,
  editLabel,
  completeLabel,
  onEdit,
}: {
  title: string;
  // Derived from summaryRows at the moment of rendering, never cached -- so
  // an edit elsewhere cannot leave a stale line behind.
  summary: string;
  editLabel: string;
  // Describes the badge for a screen reader; the badge itself is decorative.
  completeLabel: string;
  onEdit: () => void;
}) {
  return (
    <button type="button" className="section-collapsed" onClick={onEdit}>
      <span className="section-collapsed-badge" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span className="section-collapsed-text">
        <span className="section-collapsed-title">
          {title}
          <span className="sr-only"> — {completeLabel}</span>
        </span>
        {summary && <span className="section-collapsed-summary">{summary}</span>}
      </span>
      <span className="section-collapsed-edit" aria-hidden="true">
        {editLabel}
      </span>
    </button>
  );
}
