"use client";

import { useTranslations } from "next-intl";

// Shared with app/register/page.tsx: this rail used to carry its own copy of
// the step list, which nothing kept in step with the page's navigation order.
import { REGISTRATION_STEPS } from "@/lib/register-constants";
import {
  railItemEnabled,
  railItemShowsCheck,
  railItemState,
  railStateLabelKey,
} from "@/lib/register-rail";

interface RegistrationProgressProps {
  // The section showing in the frame.
  currentIndex: number;
  // The furthest revealed section. Items past it are locked.
  reached: number;
  // Per-section completeness, same order as REGISTRATION_STEPS.
  completed: readonly boolean[];
  // One line per section, derived by the caller from summaryRows() -- the
  // same source the review card uses, so the rail's tooltip and the review
  // can never disagree. Empty for a section with nothing answered.
  summaries: readonly string[];
  onSelect: (index: number) => void;
}

// The rail IS the navigation.
//
// There is no Suivant/Retour pair and no collapsed summary line any more: the
// six circles are what moves the respondent between sections, which is why
// every item is a real <button> rather than a decorative <div> in a list. A
// locked item is a disabled button, not a missing one -- "there are six steps
// and I have reached three" is information worth keeping on screen.
//
// Every visual state comes from railItemState() so the circle, the label, the
// tooltip and the accessible name cannot disagree about what a section is.
export function RegistrationProgress({
  currentIndex,
  reached,
  completed,
  summaries,
  onSelect,
}: RegistrationProgressProps) {
  const t = useTranslations("registerPage");
  const total = REGISTRATION_STEPS.length;
  const activeIdx = Math.min(Math.max(currentIndex, 0), total - 1);
  const currentItem = REGISTRATION_STEPS[activeIdx];

  return (
    <div className="registration-progress">
      {/* The one line that always says where the respondent is. Below 560px
          the rail's labels are hidden, so this is the only thing naming the
          step; it is announced on change for the same reason. */}
      <p className="progress-caption" aria-live="polite">
        {t("stepIndicator", { current: activeIdx + 1, total })}
        {" — "}
        {t(currentItem.labelKey)}
      </p>

      <div className="progress-rail" aria-label={t("railLabel")}>
        {REGISTRATION_STEPS.map((s, idx) => {
          const state = railItemState(idx, { currentIndex: activeIdx, reached, completed });
          const enabled = railItemEnabled(state);
          const name = t(s.labelKey);
          const stateText = t(railStateLabelKey(state));
          const summary = summaries[idx] ?? "";

          return (
            <button
              key={s.id}
              type="button"
              className={`progress-step-item is-${state}`}
              disabled={!enabled}
              aria-current={idx === activeIdx ? "step" : undefined}
              aria-label={`${name} — ${stateText}`}
              // Native tooltip rather than a custom popover: it is a
              // convenience on a control whose accessible name already says
              // everything it says.
              title={
                state === "done" && summary
                  ? `${name} — ${summary} ${t("railEditHint")}`
                  : `${name} — ${stateText}`
              }
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
              <span className="progress-step-label" aria-hidden="true">
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
