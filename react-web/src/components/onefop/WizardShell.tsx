"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FormData, OnefopEntity } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";
import {
  fetchDeclarationPreviewPdf,
  formatSubmissionError,
  submitDeclaration,
  supportsBackendSubmission,
} from "@/lib/onefop-submission";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { clearDraft } from "@/lib/onefop-drafts";
import {
  VtWizardSectionScreen,
  vtSectionHeadingId,
  vtWizardSectionGroups,
  type VtSectionRevealHandle,
} from "./VtWizardSectionScreen";
import {
  VT_STEPPED_SECTION_IDS,
  vtFirstStep,
  vtLastStep,
  vtNextStep,
  vtPreviousStep,
  vtStepForIssue,
  vtStepIssues,
  vtStepPosition,
} from "@/lib/vt-table-steps";
import { VtWizardSidebar } from "./VtWizardSidebar";
import { getVtSectionShortLabel } from "./vt-wizard-utils";
import { VT_VALIDATION_HEADING_ID, VtValidationScreen } from "./VtValidationScreen";
import { VT_QUIZ_HEADING_ID, VtQuizContext, VtScopeQuiz } from "./VtScopeQuiz";
import { isVtCentreClosed, isVtQuizComplete, readVtQuiz } from "@/lib/vt-quiz";
import { ModernJobsWizard } from "./ModernJobsWizard";
import { ModernJobsHeader, type ModernJobsHeaderProps } from "./ModernJobsHeader";
import { EntryModeSlotProvider, useEntryModeSlot } from "./EntryModeSwitch";
import { TABLE_MAX_WIDTH_PX, widestTableWidthPx } from "./tables/tableLayout";
import { OnefopPdfPreviewModal } from "./OnefopPdfPreviewModal";
import { OnefopSidePreviewPanel } from "./OnefopSidePreviewPanel";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";
import { findIssueOwner, wizardStepAnnouncement } from "@/lib/wizard-navigation";
import { revealIssueElement, useOnStepChange, useStepFocus } from "@/lib/use-step-focus";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { resetScroll } from "@/lib/reset-scroll";
import {
  gatedStep,
  railLock,
  resolveRestoredPosition,
  type RailGateModel,
  type WizardStep,
} from "@/lib/wizard-rail-gate";
import { clearWizardSession, readWizardPosition, writeWizardPosition } from "@/lib/wizard-position";
import { activeQuarterQueryOptions } from "@/lib/shared-queries";

interface WizardShellProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;

  validationIssues?: ValidationIssue[];
  attemptedSubmit?: boolean;
  onAttemptSubmit?: () => void;

  /**
   * VT shell actions. These mirror the Flutter shell's outer-shell callbacks.
   * They are optional so existing non-VT call sites remain source compatible.
   */
  onCancel?: () => void;
  /** Saves the draft to the server; false means it did not land. */
  onSaveNow?: () => Promise<boolean | void> | boolean | void;

  /** Persistent save state supplied by the parent/autosave layer. */
  saving?: boolean;
  saveFailed?: boolean;
  lastSavedAt?: Date | null;
  /** The draft's state on the server, shown in the masthead (audit R2). */
  serverSave?: ModernJobsHeaderProps["serverSave"];

  establishmentName?: string;
  /** The establishment's CAM-LEAP number (e.g. VT26000103), shown in the masthead. */
  establishmentId?: string;
  /** The company's real taxpayer number (NIU), or undefined when it has none. */
  niu?: string;
  quarterCode?: string;
  /** Stable per-session idempotency key from useOnefopDraft (P4 fix). */
  formId?: string;
  /** Deletes the local draft after a successful submission (useOnefopDraft's
   *  clearLocalDraft, which knows the user/establishment-scoped key). */
  onSubmitted?: () => Promise<void> | void;
  /** N3: the tenant-scoped draft key, once its draft is loaded. The wizard
   *  position is restored from / kept in sessionStorage under it; null or
   *  absent keeps the position in memory only. */
  positionKey?: string | null;
}

function useViewportSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return size;
}

/**
 * React counterpart of Flutter's VtWizardShell.
 *
 * VT deliberately follows the Flutter shell rather than behaving like the
 * generic React wizard:
 *   Section 1 -> ... -> final VT section -> Validation
 *
 * The important behavioral rules are:
 * - section navigation is validation-gated;
 * - jumping from the task list is browse navigation and is not validation-gated;
 * - the first Back invokes the outer Cancel/Exit callback;
 * - VT currently remains section-level; in-wizard Guided/Tableur switching is
 *   intentionally delegated to the VT-specific table components rather than
 *   invented in this generic shell;
 * - Validation is a distinct terminal stage;
 * - the task rail is desktop-only at full width and becomes compact/mobile
 *   navigation at smaller widths;
 * - Previous / Next sit after the section's last question, in flow.
 */
export function WizardShell({
  entity,
  data,
  onChange,
  validationIssues = [],
  attemptedSubmit = false,
  onAttemptSubmit = () => { },
  onCancel,
  onSaveNow,
  saving = false,
  saveFailed = false,
  lastSavedAt = null,
  serverSave,
  establishmentName,
  establishmentId,
  niu,
  quarterCode,
  formId,
  onSubmitted,
  positionKey = null,
}: WizardShellProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isVt = entity.entityType === "vocationalTraining";
  const viewportSize = useViewportSize();
  const viewportWidth = viewportSize?.width ?? null;
  const showFullRail = viewportWidth !== null && viewportWidth >= 1024;
  const isMobile = viewportWidth !== null && viewportWidth < 1024;

  const [sectionIndex, setSectionIndex] = useState(0);
  // Sections 4 and 8, one table per screen (vt-table-steps.ts): the table
  // shown, or where to land on entering the section — its first table, or
  // its last when coming back from the next section.
  const [vtStepTarget, setVtStepTarget] = useState<number | "first" | "last">("first");
  const [isValidationStage, setIsValidationStage] = useState(false);
  // Training centres: the preliminary quiz stage, between Sections 1 and 2.
  const [isVtQuizStage, setIsVtQuizStage] = useState(false);
  // The quiz's validate, for the bottom bar's Suivant.
  const vtQuizValidateRef = useRef<(() => void) | null>(null);
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<string | null>(null);
  // The reference the server returned, passed to the receipt as is rather
  // than read back out of the message string.
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [sidePreviewOpen, setSidePreviewOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<"saved" | "failed" | null>(null);
  // The one Tableau/Guidé control, filled by whichever screen offers the
  // choice (see EntryModeSwitch).
  const entryModeSlot = useEntryModeSlot();
  // The page is the one scroller at every size: the pod grows with the
  // declaration instead of holding the viewport and scrolling inside
  // itself (owner, 2026-10-12; a fixed pod since 2026-10-11). Beside the
  // rail it continues the app bar, with side edges only, down to the
  // bottom of the page.
  const podFlush = showFullRail;

  useEffect(() => {
    if (isMobile && sidePreviewOpen) {
      setSidePreviewOpen(false);
    }
  }, [isMobile, sidePreviewOpen]);

  const entityType = entity.entityType;

  const quarterQuery = useQuery({
    ...activeQuarterQueryOptions,
  });

  // Null until the backend confirms the active period — never substitute a
  // hardcoded string, which would attribute submissions to the wrong campaign.
  const effectiveQuarter: string | undefined = (quarterCode ?? quarterQuery.data?.code) ?? undefined;
  const effectiveEstablishment =
    establishmentName ||
    (data["VT1_2"] as string) ||
    (data["S0Q01"] as string) ||
    undefined;

  const formLocale: "fr" | "en" = locale.startsWith("en") ? "en" : "fr";

  const pdfMutation = useMutation({
    mutationFn: (targetLocale?: "fr" | "en") =>
      fetchDeclarationPreviewPdf(
        entityType,
        data,
        effectiveQuarter,
        targetLocale || formLocale,
        entity,
      ),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });

  const handlePreviewPdf = (_targetLocale?: "fr" | "en") => {
    if (showFullRail && !isValidationStage) {
      setSidePreviewOpen((prev) => !prev);
    } else {
      setPreviewModalOpen(true);
    }
  };

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!effectiveQuarter) {
        return Promise.reject(new Error(
          formLocale === "en"
            ? "Active period not available — reload the page."
            : "Période active non disponible — rechargez la page.",
        ));
      }
      return submitDeclaration(entityType, effectiveQuarter, data, false, entity, formId);
    },
    onSuccess: (result) => {
      // Clear the local IndexedDB draft so the respondent does not see the
      // submitted data again the next time they open this entity type.
      Promise.resolve(onSubmitted?.()).catch(() => {});
      if (effectiveQuarter) clearDraft(entityType, effectiveQuarter).catch(() => {});
      // N3: the stored position and legal acknowledgment go with the draft.
      if (positionKey) clearWizardSession(positionKey);
      setSubmissionResult(`${result.message} (ID: ${result.submissionId})`);
      setSubmissionId(result.submissionId || null);
      // The receipt shows on the page, never inside the review window,
      // which is closed: its "Edit information" no longer applies. A
      // training centre moves to its final screen, where the receipt is.
      setPreviewModalOpen(false);
      if (isVt) {
        setIsVtQuizStage(false);
        setIsValidationStage(true);
      }
    },
  });

  // Period-closed check: canSubmit is false only when the backend explicitly
  // returns isOpen===false; it stays true while the query is loading so the
  // submit button is not disabled during the initial fetch.
  const canSubmit = supportsBackendSubmission(entityType) && (quarterQuery.data?.isOpen !== false);

  // Shared by both terminal screens — ModernJobsWizard (non-VT) and
  // VtValidationScreen — so a closed period reads identically whichever
  // flow the respondent is in. Prefers the backend's own reason when it
  // sends one.
  const quarterStatusMessage =
    quarterQuery.data?.isOpen === false
      ? (quarterQuery.data?.message ||
        (locale.startsWith("en")
          ? "The submission period for this quarter is currently closed."
          : "La période de soumission pour ce trimestre est actuellement fermée."))
      : undefined;

  const submissionError =
    pdfMutation.isError || submitMutation.isError
      ? formatSubmissionError(
        pdfMutation.error ?? submitMutation.error,
        locale.startsWith("en") ? "en" : "fr",
      )
      : null;

  // Match Flutter: show feedback when an active save finishes. A failure
  // remains visible until the next successful save; success fades after 2.2s.
  // The toast is adjusted during render when `saving` flips, rather than in
  // an effect (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevSaving, setPrevSaving] = useState(saving);
  if (saving !== prevSaving) {
    setPrevSaving(saving);
    setSaveToast(saving ? null : saveFailed ? "failed" : "saved");
  }

  useEffect(() => {
    if (saveToast !== "saved") return;
    const timer = window.setTimeout(() => setSaveToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [saveToast]);

  const sections = entity.sections;
  const clampedSectionIndex = Math.min(
    Math.max(sectionIndex, 0),
    Math.max(0, sections.length - 1),
  );
  const currentSection = sections[clampedSectionIndex];
  const sectionIssues = useMemo(
    () =>
      currentSection
        ? validateSectionData(currentSection, data, formLocale)
        : [],
    [currentSection, data, formLocale],
  );

  const showErrors = attemptedAdvance || attemptedSubmit;

  const vtStepped = isVt && !!currentSection && VT_STEPPED_SECTION_IDS.has(currentSection.id);
  const vtSteps = useMemo(
    () => (vtStepped && currentSection ? vtWizardSectionGroups(currentSection, data, formLocale === "en" ? "en" : "fr") : []),
    [vtStepped, currentSection, data, formLocale],
  );
  const vtStepIndex = !vtStepped
    ? 0
    : vtStepTarget === "first"
      ? vtFirstStep(vtSteps, data)
      : vtStepTarget === "last"
        ? vtLastStep(vtSteps, data)
        : Math.min(Math.max(vtStepTarget, 0), Math.max(0, vtSteps.length - 1));
  const vtStepPos = vtStepped ? vtStepPosition(vtSteps, vtStepIndex, data) : null;

  // The column hugs what is actually on this screen (owner, 2026-10-11):
  // the reading measure (--vt-content-max, 760px: 600px answers plus
  // padding) as a floor, growing only as far as the table shown needs now
  // that tables take their columns' own width, and never past the table
  // frame's own cap. It used to jump to a flat 1100px for any section
  // holding a table. Sections 4 and 8 show one table per screen, so this
  // follows the step rather than the section: sizing section 4 by its
  // widest table left 4.1's 610px grid in a 1071px pod.
  const contentMax = useMemo(() => {
    const visible = vtStepped ? new Set(vtSteps[vtStepIndex]?.fieldIds ?? []) : null;
    const widest = widestTableWidthPx(
      (currentSection?.fields ?? [])
        .filter((f) => f.type === "table" || f.type === "repeating_table")
        .filter((f) => !visible || visible.has(f.id))
        .map((f) => f.table?.matrix?.[0]?.length ?? 0),
    );
    return widest === 0
      ? "var(--vt-content-max)"
      : `clamp(var(--vt-content-max), ${widest}px, ${TABLE_MAX_WIDTH_PX}px)`;
  }, [currentSection, vtStepped, vtSteps, vtStepIndex]);

  // ── A1: focus, scroll and announcement on every VT step change ──────────
  // (non-VT entities render ModernJobsWizard, which does its own.)
  const vtStepKey = !isVt
    ? ""
    : isValidationStage
      ? "validation"
      : isVtQuizStage
        ? "quiz"
        : `section:${currentSection?.id ?? clampedSectionIndex}${vtStepped ? `:${vtStepIndex}` : ""}`;
  const vtHeadingId = !isVt
    ? null
    : isValidationStage
      ? VT_VALIDATION_HEADING_ID
      : isVtQuizStage
        ? VT_QUIZ_HEADING_ID
        : currentSection
          ? vtSectionHeadingId(currentSection.id)
          : null;
  const requestStepFocus = useStepFocus(vtStepKey, vtHeadingId);
  // The document is the only scroller; the pane reset is kept for safety.
  const contentPaneRef = useRef<HTMLDivElement | null>(null);
  useOnStepChange(vtStepKey, () => {
    contentPaneRef.current?.scrollTo({ top: 0, behavior: "instant" });
    resetScroll(0);
  });
  // The name the section's heading shows ("Trainers"), not the paper title
  // in capitals ("SECTION 8. DETAILS ON TRAINERS").
  const vtSectionName = currentSection
    ? getVtSectionShortLabel(currentSection.id, formLocale) ?? (localized(currentSection.title, formLocale) || currentSection.id)
    : "";
  const vtStepAnnouncement = !isVt || submissionResult
    ? ""
    : wizardStepAnnouncement(
        isValidationStage
          ? { kind: "label", label: t("vtWizardSidebar.validationLink") }
          : isVtQuizStage
            ? { kind: "label", label: t("wizardShell.quizAnnouncement") }
            : currentSection && vtStepPos
              ? {
                  // "Trainees, table 3 of 9"
                  kind: "label",
                  label: `${vtSectionName}, ${
                    formLocale === "en"
                      ? `table ${vtStepPos.number} of ${vtStepPos.total}`
                      : `tableau ${vtStepPos.number} sur ${vtStepPos.total}`
                  }`,
                }
              : currentSection
                ? {
                    kind: "section",
                    index: clampedSectionIndex,
                    total: sections.length,
                    title: vtSectionName,
                  }
                : { kind: "none" },
        (values) => t("wizardShell.stepAnnouncement", values),
      );
  // Rendered first in both the section tree and the Validation tree below,
  // so React keeps the same node across the isValidationStage early return
  // (a live region that mounts together with its text announces nothing).
  const stepLiveRegion = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {vtStepAnnouncement}
    </p>
  );

  // Lets handleNext switch a tabbed section to the tab holding an issue.
  const vtRevealRef = useRef<VtSectionRevealHandle | null>(null);

  // Mobile task list: Escape, focus in on open, Tab contained, focus back to
  // the opener on close.
  const taskListSheetRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(taskListOpen, taskListSheetRef, () => setTaskListOpen(false));

  // The training-centre quiz decides which tables apply. A centre declared
  // non-functional or closed in 1.12 answers Section 1 only and has no quiz.
  const vtQuizApplies = isVt && !isVtCentreClosed(data);
  const vtQuizComplete = isVtQuizComplete(readVtQuiz(data));

  // ── N2: section-rail gating (training centres) ──────────────────────────
  // "Complete" is the check Continue applies (sectionIssues above:
  // validateSectionData, which waives Sections 2-9 of a closed centre).
  const vtSectionComplete = useMemo(
    () => (isVt ? sections.map((section) => validateSectionData(section, data, formLocale).length === 0) : []),
    [isVt, sections, data, formLocale],
  );
  const vtGateModel: RailGateModel = {
    sectionComplete: vtSectionComplete,
    quizAfterIndex: vtQuizApplies ? 0 : null,
    quizComplete: vtQuizComplete,
  };
  const vtCurrentStep: WizardStep | null = isValidationStage
    ? null
    : isVtQuizStage
      ? { kind: "quiz" }
      : { kind: "section", index: clampedSectionIndex };

  // ── N3: restore the stored position once this declaration's draft is
  // loaded (adjusting state during render, once per key), then keep it.
  const [restoredPositionKey, setRestoredPositionKey] = useState<string | null>(null);
  if (isVt && positionKey && restoredPositionKey !== positionKey) {
    setRestoredPositionKey(positionKey);
    const stored = readWizardPosition(positionKey);
    if (stored && sections.length > 0) {
      const position = resolveRestoredPosition(vtGateModel, stored);
      setIsValidationStage(position.kind === "review");
      setIsVtQuizStage(position.kind === "quiz");
      setSectionIndex(
        position.kind === "section"
          ? position.index
          : Math.min(Math.max(stored.sectionIndex, 0), sections.length - 1),
      );
      // A position stored before tables were steps has none: the first table.
      setVtStepTarget(
        position.kind === "section" && position.index === stored.sectionIndex && stored.stepIndex !== undefined
          ? stored.stepIndex
          : "first",
      );
    }
  }
  const vtStoredStage = isValidationStage ? "review" : isVtQuizStage ? "quiz" : "section";
  useEffect(() => {
    if (!isVt || !positionKey || restoredPositionKey !== positionKey || submissionResult) return;
    writeWizardPosition(positionKey, {
      stage: vtStoredStage,
      sectionIndex: clampedSectionIndex,
      ...(vtStepped && vtStoredStage === "section" ? { stepIndex: vtStepIndex } : {}),
    });
  }, [isVt, positionKey, restoredPositionKey, submissionResult, vtStoredStage, clampedSectionIndex, vtStepped, vtStepIndex]);

  if (!currentSection) return null;


  // Same 3-step gutter Flutter uses for the content column (16 / 24 / 40),
  // used by the content pane.
  const contentGutter =
    viewportWidth !== null && viewportWidth < 768 ? 16 : showFullRail ? 40 : 24;

  /** Shows a section — the wizard's own quiz Continue / Back transitions,
   *  which follow their own rules (Back from Validation goes through
   *  goToSection, so it stops at the first incomplete step). */
  function showSection(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      Math.max(0, sections.length - 1),
    );

    setSectionIndex(nextIndex);
    setVtStepTarget("first");
    setIsValidationStage(false);
    setIsVtQuizStage(false);
    setAttemptedAdvance(false);
    setTaskListOpen(false);
    requestStepFocus();
  }

  /**
   * N2: a jump from the rail, the drawer or the Validation screen. Earlier
   * steps are always reachable; going forward stops at the first incomplete
   * step (section or quiz), which is where a locked target lands instead.
   */
  function goToSection(index: number) {
    const target: WizardStep = {
      kind: "section",
      index: Math.min(Math.max(index, 0), Math.max(0, sections.length - 1)),
    };
    const step = gatedStep(vtGateModel, target, vtCurrentStep);
    if (step.kind === "quiz") openVtQuiz();
    else showSection(step.index);
  }

  /**
   * A section card on the Validation screen. In Sections 4 and 8 it opens the
   * table holding the section's first problem, with the problems shown, so
   * the respondent lands where the fix is rather than on the first table.
   */
  function openSectionFromReview(index: number) {
    goToSection(index);
    const section = sections[index];
    if (!isVt || !section || !VT_STEPPED_SECTION_IDS.has(section.id)) return;
    const step = gatedStep(vtGateModel, { kind: "section", index }, vtCurrentStep);
    if (step.kind !== "section" || step.index !== index) return;
    const issues = validateSectionData(section, data, formLocale);
    if (issues.length === 0) return;
    const steps = vtWizardSectionGroups(section, data, formLocale === "en" ? "en" : "fr");
    setVtStepTarget(vtStepForIssue(steps, issues[0].fieldId, data));
    setAttemptedAdvance(true);
  }

  /** The quiz from the rail or the Validation screen, gated like a section. */
  function selectVtQuiz() {
    const step = gatedStep(vtGateModel, { kind: "quiz" }, vtCurrentStep);
    if (step.kind === "quiz") openVtQuiz();
    else showSection(step.index);
  }

  /** Why a rail item is locked (shown as its title and read by AT), or null. */
  function vtLockReason(target: WizardStep): string | null {
    const lock = railLock(vtGateModel, target, vtCurrentStep);
    if (!lock) return null;
    return lock.reason === "quiz"
      ? t("wizardShell.railLockedQuiz")
      : t("wizardShell.railLockedSection", { number: lock.sectionIndex + 1 });
  }

  function openVtQuiz() {
    setIsVtQuizStage(true);
    setIsValidationStage(false);
    setAttemptedAdvance(false);
    setTaskListOpen(false);
    requestStepFocus();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goToValidation() {
    setIsValidationStage(true);
    setIsVtQuizStage(false);
    setAttemptedAdvance(false);
    setTaskListOpen(false);
    setSidePreviewOpen(false);
    requestStepFocus();
  }

  function handleNext() {
    // VT is section-level pagination, except in Sections 4 and 8, where Next
    // checks the table on screen only and moves on to the next table
    // (vt-table-steps.ts). The section check below still runs before leaving
    // the section, so a table skipped with the table list cannot be passed.
    if (vtStepped) {
      const stepIssues = vtStepIssues(vtSteps, vtStepIndex, sectionIssues, data);
      if (stepIssues.length > 0) {
        setAttemptedAdvance(true);
        revealIssue(stepIssues[0].fieldId);
        return;
      }
      const next = vtNextStep(vtSteps, vtStepIndex, data);
      if (next !== null) {
        setAttemptedAdvance(false);
        setVtStepTarget(next);
        requestStepFocus();
        return;
      }
    }

    if (sectionIssues.length > 0) {
      setAttemptedAdvance(true);
      revealIssue(sectionIssues[0].fieldId);
      return;
    }

    setAttemptedAdvance(false);

    // Section 1 → the preliminary quiz → Section 2.
    if (vtQuizApplies && clampedSectionIndex === 0) {
      openVtQuiz();
      return;
    }

    if (clampedSectionIndex < sections.length - 1) {
      setSectionIndex((index) => index + 1);
      setVtStepTarget("first");
      requestStepFocus();
      return;
    }

    goToValidation();
  }

  /**
   * Auto-scroll to the first invalid field (Gap #9, matching Flutter
   * _scrollToFirstError). A2: a cell or table-level issue has no element of
   * its own id, and Sections 4 and 8 only mount the table on screen — so show
   * the owning table first, then (once rendered) walk the lookup chain down
   * to the owning table's wrapper.
   */
  function revealIssue(fieldId: string | undefined) {
    if (!fieldId) return;
    const owner = findIssueOwner(currentSection?.fields ?? [], fieldId);
    vtRevealRef.current?.showIssue(fieldId);
    requestAnimationFrame(() => {
      revealIssueElement(fieldId, owner?.id);
    });
  }

  function handlePrev() {
    setAttemptedAdvance(false);

    // Sections 4 and 8: the previous table first.
    if (vtStepped) {
      const previous = vtPreviousStep(vtSteps, vtStepIndex, data);
      if (previous !== null) {
        setVtStepTarget(previous);
        requestStepFocus();
        return;
      }
    }

    // Section 2 → back to the preliminary quiz.
    if (vtQuizApplies && clampedSectionIndex === 1) {
      openVtQuiz();
      return;
    }

    if (clampedSectionIndex > 0) {
      setSectionIndex((index) => index - 1);
      // Back into Section 4 from Section 5 lands on its last table.
      setVtStepTarget("last");
      requestStepFocus();
      return;
    }

    // Flutter explicitly exits from Section 1 rather than creating an
    // internal "overview" stage.
    onCancel?.();
  }

  /** The VT side rail (WizardRail + WizardStepList), beside the form on a
   *  wide screen and inside the drawer (`sheet`) below 1024px. */
  function renderVtSidebar(sheet: boolean) {
    return (
      <VtWizardSidebar
        sheet={sheet}
        entity={entity}
        data={data}
        currentSectionIndex={clampedSectionIndex}
        onSelectSection={goToSection}
        sectionLockReason={(index) => vtLockReason({ kind: "section", index })}
        isValidationStage={false}
        onGoToValidation={goToValidation}
        quiz={
          vtQuizApplies
            ? {
                isCurrent: isVtQuizStage,
                isComplete: vtQuizComplete,
                onOpen: selectVtQuiz,
                lockReason: vtLockReason({ kind: "quiz" }),
              }
            : undefined
        }
      />
    );
  }

  function renderTaskRail() {
    if (!isVt || isValidationStage || !showFullRail || sidePreviewOpen) {
      return null;
    }
    return renderVtSidebar(false);
  }

  function renderMobileTaskList() {
    if (!isVt || !isMobile) return null;

    return (
      <>
        {/* Named as the rail it opens ("Contents"): one name for one list. */}
        <div className="cam-sheet-opener">
          <button
            type="button"
            className="cam-button cam-button-secondary"
            onClick={() => setTaskListOpen(true)}
          >
            {t("wizardRail.title")}
          </button>
        </div>

        {taskListOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vt-sheet-title"
            onClick={() => setTaskListOpen(false)}
            className="cam-sheet-scrim"
          >
            <div
              ref={taskListSheetRef}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="cam-sheet"
            >
              <div className="cam-sheet-head">
                <h2 id="vt-sheet-title" className="cam-sheet-title">{t("wizardRail.title")}</h2>
                <button
                  type="button"
                  onClick={() => setTaskListOpen(false)}
                  className="cam-text-button"
                >
                  {t("modernJobs.wizard.close")}
                </button>
              </div>

              {renderVtSidebar(true)}
            </div>
          </div>
        )}
      </>
    );
  }

  if (!isVt) {
    return (
      <>
        <ModernJobsWizard
          entity={entity}
          data={data}
          onChange={onChange}
          validationIssues={validationIssues}
          saving={saving}
          lastSavedAt={lastSavedAt}
          onSaveNow={onSaveNow}
          onCancel={onCancel}
          onSubmitFinal={() => setPreviewModalOpen(true)}
          canSubmit={canSubmit}
          quarterStatusMessage={quarterStatusMessage}
          isSubmitting={submitMutation.isPending}
          submissionResult={submissionResult}
          submissionId={submissionId}
          submissionError={submissionError}
          onPreviewPdf={submissionResult ? () => pdfMutation.mutate(formLocale) : () => setPreviewModalOpen(true)}
          isGeneratingPdf={pdfMutation.isPending}
          establishmentName={effectiveEstablishment}
          establishmentId={establishmentId}
          niu={niu}
          quarterCode={effectiveQuarter}
          positionKey={positionKey}
        />
        <OnefopPdfPreviewModal
          entity={entity}
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          entityType={entityType}
          data={data}
          quarterCode={effectiveQuarter}
          locale={formLocale}
          onSubmitFinal={() => submitMutation.mutate()}
          isSubmitting={submitMutation.isPending}
          canSubmit={canSubmit}
          hasErrors={validationIssues.length > 0}
          validationErrorCount={validationIssues.length}
          submissionResult={submissionResult}
          submissionError={submissionError}
          establishmentName={effectiveEstablishment}
        />
      </>
    );
  }

  /**
   * Terminal VT recap. The Flutter shell keeps this stage visually separate
   * from the section navigation and does not render the section bottom bar.
   */
  // Flutter and React both return from Validation to the final section.
  // Keep that behavior; do not restore an earlier section here.
  if (isVt && isValidationStage) {
    return (
      <div
        className="vt-wizard"
        style={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--cam-bg)",
        }}
      >
        {stepLiveRegion}
        <ModernJobsHeader
          entityType={entity.entityType}
          establishmentName={effectiveEstablishment}
          establishmentId={establishmentId}
          quarterCode={effectiveQuarter}
          saving={saving}
          lastSavedAt={lastSavedAt}
          serverSave={serverSave}
          onExit={onCancel}
          onPreviewPdf={handlePreviewPdf}
          isGeneratingPdf={pdfMutation.isPending}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: "var(--cam-space-6)",
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          {showFullRail ? (
            <VtWizardSidebar
              entity={entity}
              data={data}
              currentSectionIndex={clampedSectionIndex}
              onSelectSection={goToSection}
              sectionLockReason={(index) => vtLockReason({ kind: "section", index })}
              isValidationStage={true}
              onGoToValidation={goToValidation}
            />
          ) : null}

          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: "var(--vt-content-max)",
              margin: "0 auto",
              padding: contentGutter,
            }}
          >
            {submissionResult ? (
              <OnefopSubmissionSuccess
                rawResult={submissionResult}
                submissionId={submissionId}
                entityType={entity.entityType}
                establishmentName={effectiveEstablishment}
                niu={niu}
                quarterCode={effectiveQuarter}
                locale={formLocale}
                // A copy of the answers sent, straight away: the review window
                // would bring back "Edit information" after submission.
                onDownloadPdf={() => pdfMutation.mutate(formLocale)}
                isGeneratingPdf={pdfMutation.isPending}
                onPrint={() => window.print()}
                onReturnToDashboard={onCancel}
              />
            ) : (
              <>
                {submissionError && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "var(--cam-space-4)",
                      padding: "var(--cam-space-3)",
                      background: "var(--cam-error-bg)",
                      color: "var(--cam-error)",
                      borderRadius: "var(--cam-radius-sm)",
                      fontSize: "var(--cam-font-size-sm)",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {submissionError.summary}
                    </p>
                    {submissionError.items.length > 0 && (
                      <ul
                        style={{
                          margin: "var(--cam-space-2) 0 0",
                          paddingLeft: "var(--cam-space-5)",
                        }}
                      >
                        {submissionError.items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <VtValidationScreen
                  entity={entity}
                  data={data}
                  onOpenSection={openSectionFromReview}
                  onBack={() => goToSection(sections.length - 1)}
                  onPreviewPdf={() => setPreviewModalOpen(true)}
                  isGeneratingPdf={pdfMutation.isPending}
                  onSaveDraft={onSaveNow ? () => onSaveNow() : undefined}
                  onSubmitFinal={() => setPreviewModalOpen(true)}
                  isSubmitting={submitMutation.isPending}
                  canSubmit={canSubmit}
                  quarterStatusMessage={quarterStatusMessage}
                  quiz={vtQuizApplies ? { isComplete: vtQuizComplete, onOpen: selectVtQuiz } : undefined}
                />
              </>
            )}

            <OnefopPdfPreviewModal
              entity={entity}
              isOpen={previewModalOpen}
              onClose={() => setPreviewModalOpen(false)}
              entityType={entityType}
              data={data}
              quarterCode={effectiveQuarter}
              locale={formLocale}
              onSubmitFinal={() => submitMutation.mutate()}
              isSubmitting={submitMutation.isPending}
              canSubmit={canSubmit}
              hasErrors={validationIssues.length > 0}
              validationErrorCount={validationIssues.length}
              submissionResult={submissionResult}
              submissionError={submissionError}
              establishmentName={effectiveEstablishment}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <EntryModeSlotProvider element={entryModeSlot.element}>
    <div
      className="vt-wizard"
      style={{
        // The viewport, not 100%: the page wrapper only has a min-height.
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--cam-bg)",
      }}
    >
      {stepLiveRegion}
        <ModernJobsHeader
          entityType={entity.entityType}
          establishmentName={effectiveEstablishment}
          establishmentId={establishmentId}
          quarterCode={effectiveQuarter}
          saving={saving}
          lastSavedAt={lastSavedAt}
          serverSave={serverSave}
          onExit={onCancel}
          onPreviewPdf={handlePreviewPdf}
          isGeneratingPdf={pdfMutation.isPending}
          isPreviewActive={sidePreviewOpen}
          entryModeSlot={entryModeSlot.row}
        />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        {renderTaskRail()}

        <VtQuizContext.Provider value={{ openQuiz: vtQuizApplies ? selectVtQuiz : undefined }}>
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            ref={contentPaneRef}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              // The pod takes the height that is left; the nav under it
              // takes what it needs.
              display: "flex",
              flexDirection: "column",
              // Flush with the app bar: the pod continues it rather than
              // floating under it, and the height goes to the declaration.
              paddingTop: podFlush ? 0 : contentGutter,
              paddingLeft: contentGutter,
              paddingRight: contentGutter,
              // A flush pod runs to the bottom of the page and carries its
              // own room under Previous / Next.
              paddingBottom: podFlush ? 0 : "var(--cam-space-7)",
            }}
          >
            <div
              className={`cam-wizard-pod${podFlush ? " cam-wizard-pod--flush" : ""}`}
              style={{
                width: "100%",
                // The body's padding sits inside this, so the content keeps
                // exactly the measure contentMax asked for.
                maxWidth: `calc(${contentMax} + 2 * var(--cam-wizard-pod-pad))`,
                margin: "0 auto",
              }}
            >
              <div className="cam-wizard-pod-body">
              {renderMobileTaskList()}

              {/* VT keeps no top-of-section header or error banner (as in
                  Flutter): progress is the rail and the section outline,
                  errors are inline plus the block "à corriger" text. */}
              {isVtQuizStage ? (
                <VtScopeQuiz
                  entity={entity}
                  data={data}
                  onChange={onChange}
                  // The bottom bar's Suivant validates the quiz (VtScopeQuiz
                  // checks and records the answers, then continues).
                  onComplete={() => showSection(1)}
                  validateRef={vtQuizValidateRef}
                  quarterCode={effectiveQuarter}
                  locale={formLocale}
                />
              ) : (
                <VtWizardSectionScreen
                  // Fresh instance per section: the active tab and outlined
                  // block of one section must not carry over to the next.
                  key={currentSection.id}
                  revealRef={vtRevealRef}
                  section={currentSection}
                  data={data}
                  onChange={onChange}
                  issues={showErrors ? sectionIssues : []}
                  isFirst={clampedSectionIndex === 0}
                  isLast={clampedSectionIndex === sections.length - 1}
                  onBack={handlePrev}
                  onNext={handleNext}
                  onSaveAndExit={onSaveNow && onCancel ? async () => {
                    // A failed save keeps the respondent here, with the
                    // masthead's "Not saved — retry" (audit R2).
                    if (await onSaveNow() !== false) onCancel();
                  } : undefined}
                  showBottomBar={false}
                  saving={saving}
                  activeStep={vtStepped ? vtStepIndex : undefined}
                  onStepChange={(index) => setVtStepTarget(index)}
                />
              )}

              </div>

              {/* Previous and Next after the last question, inside the pod
                  and in the flow of the page (owner, 2026-10-12): Next is
                  met when the section is done, and the pod's edges run past
                  it. Saving is automatic; the PDF preview is the app bar's. */}
              <div className="cam-wizard-pod-nav">
                <div className="cam-wizard-actions">
                  <button
                    type="button"
                    className="cam-button cam-button-secondary"
                    // On the quiz: back to Section 1, as the quiz sits after it.
                    onClick={isVtQuizStage ? () => showSection(0) : handlePrev}
                  >
                    {!isVtQuizStage && clampedSectionIndex === 0 && !!onCancel
                      ? t("common.cancel")
                      : t("wizardShell.previousStepButton")}
                  </button>
                  <button
                    type="button"
                    className="cam-button cam-button-primary"
                    // On the quiz: validate it. It records the answers and opens
                    // Section 2, or marks the questions still unanswered.
                    onClick={isVtQuizStage ? () => vtQuizValidateRef.current?.() : handleNext}
                  >
                    {!isVtQuizStage && clampedSectionIndex === sections.length - 1
                      ? t("wizardShell.proceedToValidationButton")
                      : t("wizardShell.nextButton")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
        </VtQuizContext.Provider>

        {sidePreviewOpen && (
          <OnefopSidePreviewPanel
            isOpen={sidePreviewOpen}
            onClose={() => setSidePreviewOpen(false)}
            onExpandModal={() => {
              setSidePreviewOpen(false);
              setPreviewModalOpen(true);
            }}
            entityType={entityType}
            data={data}
            quarterCode={effectiveQuarter}
            locale={formLocale}
            entity={entity}
            establishmentName={effectiveEstablishment}
          />
        )}
      </div>

      {saveToast && (
        <div
          role={saveToast === "failed" ? "alert" : "status"}
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 20,
            padding: "7px 12px",
            borderRadius: 999,
            border: `1px solid ${
                saveToast === "failed" ? "var(--cam-error-border)" : "var(--cam-success-border)"
              }`,
            background:
              saveToast === "failed" ? "var(--cam-error-bg)" : "var(--cam-success-bg)",
            color:
              saveToast === "failed" ? "var(--cam-error)" : "var(--cam-success)",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--vt-font)",
            boxShadow: "0 2px 6px rgba(0,0,0,.08)",
          }}
        >
          {saveToast === "failed"
            ? t("wizardShell.saveFailedToast")
            : t("wizardShell.savedJustNowToast")}
        </div>
      )}

      <OnefopPdfPreviewModal
        entity={entity}
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        entityType={entityType}
        data={data}
        quarterCode={effectiveQuarter}
        locale={formLocale}
        onSubmitFinal={() => submitMutation.mutate()}
        isSubmitting={submitMutation.isPending}
        canSubmit={canSubmit}
        hasErrors={validationIssues.length > 0}
        validationErrorCount={validationIssues.length}
        submissionResult={submissionResult}
        submissionError={submissionError}
        establishmentName={effectiveEstablishment}
      />
    </div>
    </EntryModeSlotProvider>
  );
}
