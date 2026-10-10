"use client";

import { WizardRail } from "@/components/wizard/WizardRail";
import { WizardStepList, type WizardStep, type WizardStepState } from "@/components/wizard/WizardStepList";
import type { CSSProperties, ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { localized, computeSubsectionLayout } from "@/lib/onefop-schema";
import {
  isVtSectionComplete,
  getVtSectionShortLabel,
  type VtWizardSectionOutlineModel,
  type VtWizardSectionOutlineItem,
} from "./vt-wizard-utils";
import { VT_TABBED_SECTION_IDS } from "./vt-wizard-section-utils";

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
  outline?: VtWizardSectionOutlineModel | null;
  /** The preliminary quiz, listed right after Section 1 (absent for a closed centre). */
  quiz?: { isCurrent: boolean; isComplete: boolean; onOpen: () => void; lockReason?: string | null };
  /** Inside the phone drawer: no panel frame of its own. */
  sheet?: boolean;
}

/**
 * The VT wizard's side navigation: the shared WizardRail and WizardStepList,
 * so it looks and behaves like the registration and Modern Jobs wizards.
 * Under the section in hand it lists that section's subsections, with
 * their status when the wizard supplies an outline. `sheet` renders it
 * inside the phone drawer.
 */
export function VtWizardSidebar({
  entity,
  data,
  currentSectionIndex,
  onSelectSection,
  sectionLockReason,
  isValidationStage = false,
  onGoToValidation,
  outline,
  quiz,
  sheet = false,
}: VtWizardSidebarProps) {
  const t = useTranslations("wizardRail");
  const tVt = useTranslations("vtWizardSidebar");
  const locale = useLocale();
  const sections = entity.sections;

  const isSectionComplete = (sec: OnefopSection): boolean => isVtSectionComplete(sec, data);
  const doneCount = sections.filter(isSectionComplete).length;

  const activeSection = sections[currentSectionIndex];
  const { startsHeadingFieldIds, headingByFieldId } = activeSection
    ? computeSubsectionLayout(activeSection, locale.startsWith("en") ? "en" : "fr")
    : { startsHeadingFieldIds: new Set<string>(), headingByFieldId: new Map<string, string>() };

  // Distinct subsection titles for the active section -- skipped for tabbed
  // sections (4, 8): only the active tab's fields are mounted in the DOM, so
  // a scroll-to-field link for a subsection in a different tab would
  // silently do nothing. VtWizardCategoryTabs already provides equivalent
  // (and functional) navigation between those subsections.
  const activeSubsections: { id: string; title: string }[] = [];
  if (activeSection && !VT_TABBED_SECTION_IDS.has(activeSection.id)) {
    for (const field of activeSection.fields) {
      if (startsHeadingFieldIds.has(field.id)) {
        const title = headingByFieldId.get(field.id);
        if (title) activeSubsections.push({ id: field.id, title });
      }
    }
  }

  const scrollToField = (fieldId: string) => {
    document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const stateLabel = (state: WizardStepState) =>
    t(
      state === "done"
        ? "stateDone"
        : state === "current" || state === "currentComplete"
          ? "stateCurrent"
          : state === "locked"
            ? "stateLocked"
            : "stateTodo",
    );

  const stepState = (current: boolean, done: boolean, lockReason: string | null): WizardStepState =>
    current ? (done ? "currentComplete" : "current") : lockReason ? "locked" : done ? "done" : "todo";

  const steps: WizardStep[] = [];
  sections.forEach((sec, idx) => {
    const isCurrent = !isValidationStage && !quiz?.isCurrent && idx === currentSectionIndex;
    const lockReason = sectionLockReason?.(idx) ?? null;
    const state = stepState(isCurrent, isSectionComplete(sec), lockReason);
    steps.push({
      key: sec.id,
      marker: idx + 1,
      name: getVtSectionShortLabel(sec.id, locale) ?? localized(sec.title, locale.startsWith("en") ? "en" : "fr"),
      state,
      stateLabel: stateLabel(state),
      lockReason,
      onSelect: lockReason ? undefined : () => onSelectSection(idx),
      children: !isCurrent ? undefined : outline && outline.items.length > 0 ? (
        <VtWizardSidebarOutline outline={outline} />
      ) : activeSubsections.length > 0 ? (
        <ul className="cam-step-outline" aria-label={t("outlineLabel")}>
          {activeSubsections.map((sub) => (
            <li key={sub.id}>
              <button type="button" className="cam-step-outline-row" onClick={() => scrollToField(sub.id)}>
                <span className="cam-step-outline-icon" aria-hidden="true">›</span>
                <span className="cam-step-outline-label">{sub.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : undefined,
    });

    if (idx === 0 && quiz) {
      const quizLock = quiz.lockReason ?? null;
      const quizState = stepState(quiz.isCurrent, quiz.isComplete, quizLock);
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
      name: t("review"),
      state: reviewState,
      stateLabel: stateLabel(reviewState),
      onSelect: onGoToValidation,
    });
  }

  return (
    <WizardRail sheet={sheet} progress={{ done: doneCount, total: sections.length }}>
      <WizardStepList label={tVt("navAriaLabel")} steps={steps} editLabel={t("edit")} />
    </WizardRail>
  );
}

/**
 * The section in hand's outline: one row per subsection with its status,
 * and how much of the section is filled. Rows come from the wizard
 * (VtWizardSectionOutlineModel).
 */
function VtWizardSidebarOutline({ outline }: { outline: VtWizardSectionOutlineModel }) {
  const t = useTranslations("vtWizard");
  const tRail = useTranslations("wizardRail");
  const total = outline.items.reduce((sum, item) => sum + item.total, 0);
  const filled = outline.items.reduce((sum, item) => sum + item.filled, 0);
  const coverage = total === 0 ? 0 : Math.round((filled / total) * 100);

  return (
    <>
      <div
        className="cam-wizard-rail-bar cam-step-outline-progress"
        role="progressbar"
        aria-label={`${t("outlineProgressLabel")} ${coverage}%`}
        aria-valuenow={coverage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="cam-wizard-rail-bar-fill" style={{ width: `${coverage}%` }} />
      </div>
      <ul className="cam-step-outline" aria-label={tRail("outlineLabel")}>
        {outline.items.map((item, i) => (
          <li key={i}>
            <VtWizardSidebarOutlineRow item={item} selected={i === outline.activeIndex} onTap={() => outline.onSelect(i)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function VtWizardSidebarOutlineRow({
  item,
  selected,
  onTap,
}: {
  item: VtWizardSectionOutlineItem;
  selected: boolean;
  onTap: () => void;
}) {
  const t = useTranslations("vtWizard");

  let iconNode: ReactNode;
  let color: string;
  let detail: string;

  switch (item.status) {
    case "complete":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      );
      color = "var(--vt-accent)";
      detail = t("statusComplete");
      break;
    case "inProgress":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
        </svg>
      );
      color = "var(--cam-status-in-progress)";
      detail = t("statusInProgress");
      break;
    case "needsAttention":
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
      color = "var(--vt-red)";
      detail = t("statusNeedsAttention", { count: item.errors });
      break;
    case "notStarted":
    default:
      iconNode = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
      color = "var(--cam-status-not-started)";
      detail = t("statusNotStarted");
      break;
  }

  return (
    <button
      type="button"
      className="cam-step-outline-row"
      onClick={onTap}
      aria-label={`${item.label}, ${detail}`}
      aria-current={selected ? "true" : undefined}
      style={{ "--cam-step-outline-tone": color } as CSSProperties}
    >
      <span className="cam-step-outline-icon">{iconNode}</span>
      <span>
        <span className="cam-step-outline-label">{item.label}</span>
        <span className="cam-step-outline-status">{detail}</span>
      </span>
    </button>
  );
}
