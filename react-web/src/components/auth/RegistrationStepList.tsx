"use client";

import { useTranslations } from "next-intl";

import { REGISTRATION_STEPS } from "@/lib/register-constants";
import {
  railItemEnabled,
  railItemShowsCheck,
  railItemState,
  railStateLabelKey,
} from "@/lib/register-rail";

interface RegistrationStepListProps {
  // The section showing in the frame.
  currentIndex: number;
  // The furthest revealed section. Items past it are locked.
  reached: number;
  // Per-section completeness, same order as REGISTRATION_STEPS.
  completed: readonly boolean[];
  // One line per section from summaryRows() -- the same source the review
  // tables use, so the list and the review can never disagree.
  summaries: readonly string[];
  onSelect: (index: number) => void;
}

// The wizard's navigation on a wide screen: the six steps as a vertical list
// in the side panel, each finished step showing what it holds.
//
// The same navigation as RegistrationProgress (the horizontal rail, kept for
// narrow screens), drawn differently: the state of every item comes from the
// same railItemState(), the names from the same REGISTRATION_STEPS catalogue
// keys, and a locked item is aria-disabled rather than disabled for the same
// reason -- its click is how the respondent asks what is still missing.
//
// What the vertical layout adds is room for the summary. On the rail it was a
// native tooltip, which touch users and most screen-reader users never see;
// here it is a visible line under the step name, and part of the button's
// accessible name.
export function RegistrationStepList({
  currentIndex,
  reached,
  completed,
  summaries,
  onSelect,
}: RegistrationStepListProps) {
  const t = useTranslations("registerPage");
  const activeIdx = Math.min(Math.max(currentIndex, 0), REGISTRATION_STEPS.length - 1);

  return (
    <nav className="step-list" aria-label={t("railLabel")}>
      <ol className="step-list-items">
        {REGISTRATION_STEPS.map((s, idx) => {
          const state = railItemState(idx, { currentIndex: activeIdx, reached, completed });
          const enabled = railItemEnabled(state);
          const name = t(s.labelKey);
          const stateText = t(railStateLabelKey(state));
          // A locked step has nothing to summarise yet.
          const summary = state === "locked" ? "" : (summaries[idx] ?? "");

          return (
            <li key={s.id} className={`step-list-item is-${state}`}>
              <button
                type="button"
                className="step-list-button"
                aria-disabled={!enabled || undefined}
                aria-current={idx === activeIdx ? "step" : undefined}
                aria-label={summary ? `${name} — ${stateText} : ${summary}` : `${name} — ${stateText}`}
                onClick={() => onSelect(idx)}
              >
                <span className="progress-step-circle" aria-hidden="true">
                  {railItemShowsCheck(state) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="step-list-name" aria-hidden="true">
                  {name}
                </span>
                {state === "done" && (
                  <span className="step-list-edit" aria-hidden="true">
                    {t("editSectionButton")}
                  </span>
                )}
                {summary && (
                  <span className="step-list-summary" aria-hidden="true">
                    {summary}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
