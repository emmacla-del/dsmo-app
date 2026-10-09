// Focus management for the ONEFOP declaration wizards (ModernJobsWizard and
// WizardShell), lifted from the registration wizard's pattern
// (app/register/page.tsx headingFocusPendingRef + StepHeader's tabIndex -1
// heading):
//
// - a transition handler calls `requestStepFocus()`;
// - once the new step has rendered, its heading (tabIndex -1, so a focus
//   target but not a Tab stop) receives focus with preventScroll, so a
//   keyboard or screen-reader user is not left on <body> when the old
//   content unmounts.
//
// Only handler-driven transitions move focus: a step change from anywhere
// else (an anomaly link, a restored draft) leaves focus where it is.
import { useCallback, useEffect, useRef } from "react";
import { issueFocusCandidates, resolveFirstCandidate } from "./wizard-navigation";

/**
 * @param stepKey   changes on every wizard step (section, quiz, review)
 * @param headingId the id of the heading of the step being shown
 * @returns requestStepFocus — call it in every transition handler
 */
export function useStepFocus(stepKey: string, headingId: string | null): () => void {
  const pendingRef = useRef(false);
  const requestStepFocus = useCallback(() => {
    pendingRef.current = true;
  }, []);

  useEffect(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    if (!headingId) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
  }, [stepKey, headingId]);

  return requestStepFocus;
}

/**
 * Runs `reset` whenever the step changes, but not on the first render (a
 * restored position is left alone on load).
 */
export function useOnStepChange(stepKey: string, reset: () => void): void {
  const previousRef = useRef(stepKey);
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });
  useEffect(() => {
    if (previousRef.current === stepKey) return;
    previousRef.current = stepKey;
    resetRef.current();
  }, [stepKey]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The element itself when it can take focus, otherwise its first focusable descendant. */
function focusTarget(el: HTMLElement): HTMLElement {
  if (el.matches(FOCUSABLE) || el.hasAttribute("tabindex")) return el;
  return el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
}

/**
 * The element to bring into view for a validation issue: the issue's own
 * control, cell input or guided table, else the owning table's wrapper (see
 * issueFocusCandidates for the order).
 */
export function findIssueElement(issueFieldId: string, ownerId?: string | null): HTMLElement | null {
  return resolveFirstCandidate(issueFocusCandidates(issueFieldId, ownerId), (c) => {
    const el =
      c.kind === "id"
        ? document.getElementById(c.value)
        : document.querySelector(`[name="${CSS.escape(c.value)}"]`);
    return el instanceof HTMLElement ? el : null;
  });
}

/** Scrolls the issue's element into view and focuses it. Returns whether one was found. */
export function revealIssueElement(issueFieldId: string, ownerId?: string | null): boolean {
  const el = findIssueElement(issueFieldId, ownerId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  focusTarget(el).focus({ preventScroll: true });
  return true;
}
