"use client";

import { useTranslations } from "next-intl";

import { REGISTRATION_STEPS } from "@/lib/register-constants";
import { railItemState, railStateLabelKey } from "@/lib/register-rail";
import { WizardStepList, type WizardStep } from "@/components/wizard/WizardStepList";

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

  const steps: WizardStep[] = REGISTRATION_STEPS.map((s, idx) => {
    const state = railItemState(idx, { currentIndex: activeIdx, reached, completed });
    return {
      key: s.id,
      marker: idx + 1,
      name: t(s.labelKey),
      // "revealed" is the shared list's "inProgress": started, not finished.
      state: state === "revealed" ? "inProgress" : state,
      stateLabel: t(railStateLabelKey(state)),
      // A locked step has nothing to summarise yet.
      detail: state === "locked" ? undefined : summaries[idx] || undefined,
      // A locked item still takes the click: it is how the respondent asks
      // what is still missing.
      onSelect: () => onSelect(idx),
    };
  });

  return <WizardStepList label={t("railLabel")} steps={steps} editLabel={t("editSectionButton")} />;
}
