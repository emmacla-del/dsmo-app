// src/lib/register-rail.ts
//
// What each item of the progress rail says about its section.
//
// The rail is the wizard's only navigation -- there is no Suivant/Retour pair
// and no collapsed summary line to click -- so the state it shows is the one
// thing telling the respondent which sections are answered, which they may go
// back to, and which are not open yet. That makes it worth deriving in one
// pure function rather than in JSX conditionals: the same function decides the
// circle, the label colour, the title, the aria-label and whether the button
// is clickable at all, and it is unit-testable without a DOM.
//
// Two invariants this encodes:
//
//   * a check mark means complete, and nothing else. "Recapitulatif" is never
//     complete from field state (isSectionComplete returns false for it), so
//     it cannot show one before the registration has actually been sent.
//   * an item past `reached` is locked. Progressive disclosure is the
//     questionnaire's own mechanism; the rail must not offer a way around it.
import type { RegistrationStepId } from "./register-constants";

export type RailItemState =
  // Complete, and not the section in hand: green circle, check mark.
  | "done"
  // The section in hand, still missing something: gold ring.
  | "current"
  // The section in hand, complete -- the respondent came back to it: gold
  // ring over a soft green fill, so "I am here" and "this is answered" are
  // both legible at once.
  | "currentComplete"
  // Revealed, incomplete, not in hand: dashed gold ring. Clicking returns.
  | "revealed"
  // Not revealed yet: disabled and grey.
  | "locked";

export interface RailContext {
  // The section showing in the frame.
  currentIndex: number;
  // The furthest section revealed so far; everything past it is locked.
  reached: number;
  // Per-section completeness, in REGISTRATION_STEPS order.
  completed: readonly boolean[];
}

export function railItemState(index: number, ctx: RailContext): RailItemState {
  if (index > ctx.reached) return "locked";
  if (index === ctx.currentIndex) {
    return ctx.completed[index] ? "currentComplete" : "current";
  }
  return ctx.completed[index] ? "done" : "revealed";
}

export function railItemEnabled(state: RailItemState): boolean {
  return state !== "locked";
}

// Only a complete section carries a check mark -- see the invariant above.
export function railItemShowsCheck(state: RailItemState): boolean {
  return state === "done";
}

// next-intl keys for the state half of an item's accessible name. The section
// name is prefixed by the caller, so a screen reader announces
// "Declarant, termine, modifier" rather than a bare state word.
const RAIL_STATE_LABEL_KEYS: Record<RailItemState, string> = {
  done: "railStateDone",
  current: "railStateCurrent",
  currentComplete: "railStateCurrent",
  revealed: "railStateInProgress",
  locked: "railStateLocked",
};

export function railStateLabelKey(state: RailItemState): string {
  return RAIL_STATE_LABEL_KEYS[state];
}

// The furthest-revealed index a section sequence should rest on, and the
// section the respondent should land on inside it: the first revealed section
// that is not complete, or the furthest revealed one when they all are. Used
// when a draft comes back and when the rail has nowhere else to put them.
export function firstIncompleteWithin(
  steps: readonly RegistrationStepId[],
  reached: number,
  isComplete: (step: RegistrationStepId) => boolean
): number {
  for (let i = 0; i <= reached && i < steps.length; i++) {
    if (!isComplete(steps[i])) return i;
  }
  return reached;
}
