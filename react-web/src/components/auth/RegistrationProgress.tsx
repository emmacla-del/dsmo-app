"use client";

import { useTranslations } from "next-intl";

// Shared with app/register/page.tsx: this rail used to carry its own copy of
// the step list, which nothing kept in step with the page's navigation order.
import { REGISTRATION_STEPS } from "@/lib/register-constants";

interface RegistrationProgressProps {
  // Index of the section the respondent is working in.
  currentIndex: number;
  // Per-section completeness, same order as REGISTRATION_STEPS. A section's
  // badge shows a checkmark from this, not from "is behind the cursor": on a
  // single-page flow the respondent can be editing section 2 while 4 is
  // already answered, and the rail has to say so.
  completed: readonly boolean[];
}

export function RegistrationProgress({ currentIndex, completed }: RegistrationProgressProps) {
  const t = useTranslations("registerPage");
  const total = REGISTRATION_STEPS.length;
  const activeIdx = Math.min(Math.max(currentIndex, 0), total - 1);
  const currentItem = REGISTRATION_STEPS[activeIdx];

  function stateClass(idx: number): string {
    if (completed[idx]) return "is-completed";
    if (idx === activeIdx) return "is-current";
    return "is-upcoming";
  }

  return (
    <div className="registration-progress">
      {/* The one line that always says where the respondent is. Announced on
          change, because on a scrolling single-page flow the rail is the only
          thing that reports the move from one section to the next. */}
      <p className="progress-caption" aria-live="polite">
        {t("stepIndicator", { current: activeIdx + 1, total })}
        {" — "}
        {t(currentItem.labelKey)}
      </p>

      {/* Wide: numbered badges with their section names. */}
      <div
        className="progress-rail-desktop"
        role="list"
        aria-label={t("stepIndicator", { current: activeIdx + 1, total })}
      >
        {REGISTRATION_STEPS.map((s, idx) => (
          <div
            key={s.id}
            className={`progress-step-item ${stateClass(idx)}`}
            role="listitem"
            aria-current={idx === activeIdx ? "step" : undefined}
          >
            <div className="progress-step-circle" aria-hidden="true">
              {completed[idx] ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className="progress-step-label">{t(s.labelKey)}</span>
          </div>
        ))}
      </div>

      {/* Narrow: the same six states as discrete segments. Replaces a single
          filled bar, which could only express "how far along" and never which
          sections were actually answered. */}
      <div className="progress-segments" aria-hidden="true">
        {REGISTRATION_STEPS.map((s, idx) => (
          <span key={s.id} className={`progress-segment ${stateClass(idx)}`} />
        ))}
      </div>
    </div>
  );
}
