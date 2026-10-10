"use client";

import type { ReactNode } from "react";

/**
 * Every respondent wizard's step list: registration, Modern Jobs, VT (owner,
 * 2026-10-10). The classes, and what each state looks like, are in
 * globals.css under "Wizard rail". This component only lays the steps out:
 * each wizard decides a step's state from its own data.
 */
export type WizardStepState =
  | "done"
  | "current"
  | "currentComplete"
  | "inProgress"
  | "todo"
  | "error"
  | "locked";

export interface WizardStep {
  key: string;
  /** What the circle shows when the step is not done: a number, or "?" for the quiz. */
  marker: ReactNode;
  name: string;
  state: WizardStepState;
  /** The state, in words, for the accessible name ("terminée, modifier"). */
  stateLabel: string;
  /** One line under the name: a summary, or a status such as "À corriger". */
  detail?: string;
  /** Why the step cannot be opened yet. The step stays focusable and says so. */
  lockReason?: string | null;
  /** Absent: the step does nothing on click (locked, or nowhere to go). */
  onSelect?: () => void;
  /** Shown under the step, e.g. the VT section outline of the step in hand. */
  children?: ReactNode;
}

const CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function WizardStepList({
  label,
  steps,
  editLabel,
}: {
  /** Accessible name of the navigation. */
  label: string;
  steps: readonly WizardStep[];
  /** Visible word on a finished step that can be reopened ("Modifier"). */
  editLabel?: string;
}) {
  return (
    <nav className="cam-steps" aria-label={label}>
      <ol className="cam-steps-items">
        {steps.map((step) => {
          const isCurrent = step.state === "current" || step.state === "currentComplete";
          const nameParts = [step.name, step.stateLabel, step.detail, step.lockReason].filter(Boolean);
          return (
            <li key={step.key} className={`cam-step is-${step.state}`}>
              <button
                type="button"
                className="cam-step-button"
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={step.state === "locked" || step.lockReason ? true : undefined}
                aria-label={nameParts.join(" — ")}
                title={step.lockReason ?? undefined}
                data-inert={step.onSelect ? undefined : ""}
                onClick={step.onSelect}
              >
                <span className="cam-step-marker" aria-hidden="true">
                  {step.state === "done" ? CHECK : step.state === "error" ? "!" : step.marker}
                </span>
                <span className="cam-step-name" aria-hidden="true">
                  {step.name}
                </span>
                {step.state === "done" && editLabel && step.onSelect && (
                  <span className="cam-step-edit" aria-hidden="true">
                    {editLabel}
                  </span>
                )}
                {step.detail && (
                  <span className="cam-step-detail" aria-hidden="true">
                    {step.detail}
                  </span>
                )}
              </button>
              {step.children}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
