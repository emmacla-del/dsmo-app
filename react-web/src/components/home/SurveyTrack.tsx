"use client";

// The four steps a campaign's survey goes through, from the respondent's
// side: registration, data entry, filing, ONEFOP's endorsement (owner,
// 2026-11-11). Derived from the same state the home card already shows; it
// adds where the survey stands in the whole process, not a new status.
//
// A group of labelled steps, not a list: the home page's lists are its
// earlier filings and messages, and each step reads « Saisie : En cours ».

import { useTranslations } from "next-intl";

export type SurveyTrackState = "none" | "draft" | "correction" | "pending" | "approved" | "rejected";
type StepState = "done" | "ready" | "current" | "todo" | "correction" | "rejected";

function stepsFor(state: SurveyTrackState): StepState[] {
  switch (state) {
    case "none":
      return ["done", "ready", "todo", "todo"];
    case "draft":
      return ["done", "current", "todo", "todo"];
    case "correction":
      return ["done", "correction", "todo", "todo"];
    case "pending":
      return ["done", "done", "done", "current"];
    case "approved":
      return ["done", "done", "done", "done"];
    case "rejected":
      return ["done", "done", "done", "rejected"];
  }
}

const STEP_KEYS = ["trackRegistration", "trackEntry", "trackFiling", "trackEndorsement"] as const;
const STATE_KEYS: Record<StepState, string> = {
  done: "trackDone",
  ready: "trackReady",
  current: "trackCurrent",
  todo: "trackTodo",
  correction: "trackCorrection",
  rejected: "trackRejected",
};

export function SurveyTrack({ state }: { state: SurveyTrackState }) {
  const t = useTranslations("homeLandingPage");
  const steps = stepsFor(state);

  return (
    <div className="cam-home-track" role="group" aria-label={t("trackLabel")}>
      {STEP_KEYS.map((key, i) => (
        <div
          key={key}
          className={`cam-home-track-step is-${steps[i]}`}
          aria-current={steps[i] === "ready" || steps[i] === "current" || steps[i] === "correction" ? "step" : undefined}
        >
          <span className="cam-home-track-bar" aria-hidden="true" />
          <span className="cam-home-track-name">{t(key)}</span>
          <span className="cam-home-track-state">{t(STATE_KEYS[steps[i]])}</span>
        </div>
      ))}
    </div>
  );
}
