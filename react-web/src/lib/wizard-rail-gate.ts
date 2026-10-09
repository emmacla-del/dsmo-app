// Section-rail gating (N2) and restored-position validation (N3) for the
// ONEFOP declaration wizards (ModernJobsWizard and WizardShell's training-
// centre flow). Pure logic, no React or DOM — unit-tested with `npm test`
// (wizard-rail-gate.test.ts).
//
// The rule mirrors Continue, which never leaves an incomplete section:
//   - a step at or before the current one is always reachable (going back);
//   - going forward reaches up to and including the FIRST incomplete step
//     (an incomplete section, or the preliminary quiz while it is unanswered);
//   - anything after that step is locked.
// "Complete" is whatever the caller's Continue already uses — the wizard
// supplies one boolean per section; this module never decides it.

/** A place in the section sequence the rail can send the respondent to. */
export type WizardStep = { kind: "section"; index: number } | { kind: "quiz" };

/** A wizard position, including the review/validation stage. */
export type WizardPosition = WizardStep | { kind: "review" };

export interface RailGateModel {
  /** One entry per section: whether it passes the check Continue uses. */
  sectionComplete: readonly boolean[];
  /** The section the preliminary quiz follows, or null when no quiz applies
   *  (no quiz slot, or a training centre declared closed). */
  quizAfterIndex: number | null;
  /** Whether the preliminary quiz is answered (ignored without a quiz). */
  quizComplete: boolean;
}

/** Why a step is locked: the first incomplete step the respondent must finish. */
export type RailLock = { reason: "section"; sectionIndex: number } | { reason: "quiz" };

/**
 * Position of a step in the sequence. Section i sits at 2i and the quiz at
 * 2q + 1 (between section q and section q + 1). A quiz step without a quiz
 * is placed after its absent slot's start, i.e. treated as section 0.
 */
export function stepOrdinal(step: WizardStep, quizAfterIndex: number | null): number {
  if (step.kind === "quiz") return quizAfterIndex === null ? 0 : 2 * quizAfterIndex + 1;
  return 2 * step.index;
}

/** The first incomplete step in sequence order, or null when everything is complete. */
export function firstIncompleteStep(model: RailGateModel): RailLock | null {
  const sectionIndex = model.sectionComplete.findIndex((complete) => !complete);
  const quizBlocks = model.quizAfterIndex !== null && !model.quizComplete;
  if (sectionIndex === -1) return quizBlocks ? { reason: "quiz" } : null;
  if (quizBlocks && stepOrdinal({ kind: "quiz" }, model.quizAfterIndex) < 2 * sectionIndex) {
    return { reason: "quiz" };
  }
  return { reason: "section", sectionIndex };
}

/** The step a lock points at (where the respondent has to go first). */
export function lockStep(lock: RailLock): WizardStep {
  return lock.reason === "quiz" ? { kind: "quiz" } : { kind: "section", index: lock.sectionIndex };
}

/**
 * Why `target` cannot be reached from `current`, or null when it can.
 *
 * `current` is the step being shown; pass null on the review stage or when
 * restoring a position, where there is no step to go back from — only the
 * forward rule applies then.
 */
export function railLock(model: RailGateModel, target: WizardStep, current: WizardStep | null): RailLock | null {
  if (target.kind === "quiz" && model.quizAfterIndex === null) return null;
  const targetOrdinal = stepOrdinal(target, model.quizAfterIndex);
  if (current && stepOrdinal(current, model.quizAfterIndex) >= targetOrdinal) return null;
  const blocker = firstIncompleteStep(model);
  if (!blocker) return null;
  return targetOrdinal > stepOrdinal(lockStep(blocker), model.quizAfterIndex) ? blocker : null;
}

/** Where a jump to `target` lands: the target itself, or the step that locks it. */
export function gatedStep(model: RailGateModel, target: WizardStep, current: WizardStep | null): WizardStep {
  const lock = railLock(model, target, current);
  return lock ? lockStep(lock) : target;
}

/** A stored wizard position as read back from storage (shape already checked). */
export interface StoredPositionLike {
  stage: "section" | "quiz" | "review";
  sectionIndex: number;
}

/**
 * The position to restore after a reload. The section index is clamped to
 * the current section list; a quiz position without a quiz falls back to
 * the section the quiz followed (or the first one); a position that is now
 * locked falls back to the first incomplete step. The review stage is not
 * gated (the respondent sees there what is missing) and is restored as is.
 */
export function resolveRestoredPosition(
  model: RailGateModel,
  stored: StoredPositionLike,
): WizardPosition {
  const count = model.sectionComplete.length;
  if (count === 0) return { kind: "section", index: 0 };
  if (stored.stage === "review") return { kind: "review" };
  const clamp = (i: number) => Math.min(Math.max(Math.trunc(i), 0), count - 1);
  const wanted: WizardStep =
    stored.stage === "quiz"
      ? model.quizAfterIndex === null
        ? { kind: "section", index: clamp(stored.sectionIndex) }
        : { kind: "quiz" }
      : { kind: "section", index: clamp(stored.sectionIndex) };
  return gatedStep(model, wanted, null);
}
