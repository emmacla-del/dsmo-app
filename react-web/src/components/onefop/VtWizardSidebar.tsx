"use client";

import { WizardRail } from "@/components/wizard/WizardRail";
import { WizardStepList, type WizardStep, type WizardStepState } from "@/components/wizard/WizardStepList";
import { useTranslations, useLocale } from "next-intl";
import type { FormData, OnefopEntity } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { getVtSectionShortLabel, vtWizardSectionProgress } from "./vt-wizard-utils";
import type { SectionProgressStatus } from "@/lib/section-progress";

interface VtWizardSidebarProps {
  entity: OnefopEntity;
  data: FormData;
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
  /** N2: why a section cannot be opened from the rail yet, or null. A locked
   *  item stays readable and focusable but does nothing (aria-disabled). */
  sectionLockReason?: (index: number) => string | null;
  isValidationStage?: boolean;
  onGoToValidation?: () => void;
  /** The preliminary quiz, listed right after Section 1 (absent for a closed centre). */
  quiz?: { isCurrent: boolean; isComplete: boolean; onOpen: () => void; lockReason?: string | null };
  /** Inside the phone drawer: no panel frame of its own. */
  sheet?: boolean;
}

/**
 * The VT wizard's side navigation: the shared WizardRail and WizardStepList,
 * so it looks and behaves like the registration and Modern Jobs wizards.
 * It lists the sections only (plus the quiz and the review step), never a
 * section's subsections: the list stays short enough to sit pinned beside
 * the form without scrolling on its own. `sheet` renders it inside the
 * phone drawer.
 */
export function VtWizardSidebar({
  entity,
  data,
  currentSectionIndex,
  onSelectSection,
  sectionLockReason,
  isValidationStage = false,
  onGoToValidation,
  quiz,
  sheet = false,
}: VtWizardSidebarProps) {
  const t = useTranslations("wizardRail");
  const tVt = useTranslations("vtWizardSidebar");
  const locale = useLocale();
  const sections = entity.sections;

  const sectionProgress = sections.map((section) => vtWizardSectionProgress(section, data, isValidationStage));
  const doneCount = sectionProgress.filter((summary) => summary.status === "complete").length;

  const stateLabel = (state: WizardStepState) =>
    t(
      state === "done"
        ? "stateDone"
        : state === "current" || state === "currentComplete"
          ? "stateCurrent"
          : state === "inProgress"
            ? "stateInProgress"
            : state === "error"
              ? "stateError"
              : state === "locked"
                ? "stateLocked"
                : "stateTodo",
    );

  const stepState = (current: boolean, status: SectionProgressStatus, lockReason: string | null): WizardStepState => {
    if (current) {
      if (status === "complete") return "currentComplete";
      if (status === "has-errors") return "error";
      return "current";
    }
    if (lockReason) return "locked";
    if (status === "complete") return "done";
    if (status === "has-errors") return "error";
    if (status === "in-progress") return "inProgress";
    return "todo";
  };

  const steps: WizardStep[] = [];
  sections.forEach((sec, idx) => {
    const isCurrent = !isValidationStage && !quiz?.isCurrent && idx === currentSectionIndex;
    const lockReason = sectionLockReason?.(idx) ?? null;
    const state = stepState(isCurrent, sectionProgress[idx].status, lockReason);
    steps.push({
      key: sec.id,
      marker: idx + 1,
      name: getVtSectionShortLabel(sec.id, locale) ?? localized(sec.title, locale.startsWith("en") ? "en" : "fr"),
      state,
      stateLabel: stateLabel(state),
      lockReason,
      onSelect: lockReason ? undefined : () => onSelectSection(idx),
    });

    if (idx === 0 && quiz) {
      const quizLock = quiz.lockReason ?? null;
      const quizState = stepState(quiz.isCurrent, quiz.isComplete ? "complete" : "not-started", quizLock);
      steps.push({
        key: "vt-quiz",
        marker: "?",
        name: t("quiz"),
        state: quizState,
        stateLabel: stateLabel(quizState),
        lockReason: quizLock,
        onSelect: quizLock ? undefined : quiz.onOpen,
      });
    }
  });

  if (onGoToValidation) {
    const reviewState: WizardStepState = isValidationStage ? "current" : "todo";
    steps.push({
      key: "validation",
      marker: sections.length + 1,
      // The page it opens is "Check your answers" (defect 15), not "Review and submission".
      name: tVt("validationLink"),
      state: reviewState,
      stateLabel: stateLabel(reviewState),
      onSelect: onGoToValidation,
    });
  }

  return (
    <WizardRail sheet={sheet} progress={{ done: doneCount, total: sections.length }}>
      {/* No per-step "Edit" word: it repeated on every finished section
          (eight of them on a full VT outline) and the step is already a
          button carrying the section name. The span was aria-hidden, so
          nothing is lost to a screen reader (owner, 2026-10-11). */}
      <WizardStepList label={tVt("navAriaLabel")} steps={steps} />
    </WizardRail>
  );
}
