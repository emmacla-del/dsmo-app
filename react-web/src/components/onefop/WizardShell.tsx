"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { VtWizardSectionScreen, vtSectionHeadingId, type VtSectionRevealHandle } from "./VtWizardSectionScreen";
import { VtWizardSidebar } from "./VtWizardSidebar";
import { VT_VALIDATION_HEADING_ID, VtValidationScreen } from "./VtValidationScreen";
import { VT_QUIZ_HEADING_ID, VtQuizContext, VtScopeQuiz } from "./VtScopeQuiz";
import { isVtCentreClosed, isVtQuizComplete, readVtQuiz } from "@/lib/vt-quiz";
import { isVtSectionComplete, type VtWizardSectionOutlineModel } from "./vt-wizard-utils";
import { ModernJobsWizard } from "./ModernJobsWizard";
import { ModernJobsHeader } from "./ModernJobsHeader";
import { OnefopPdfPreviewModal } from "./OnefopPdfPreviewModal";
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
  onSaveNow?: () => Promise<void> | void;

  /** Persistent save state supplied by the parent/autosave layer. */
  saving?: boolean;
  saveFailed?: boolean;
  lastSavedAt?: Date | null;

  establishmentName?: string;
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

const buttonStyle: React.CSSProperties = {
  minHeight: "var(--cam-form-field-height)",
  padding: "0 var(--cam-space-5)",
  borderRadius: "var(--cam-radius-sm)",
  fontSize: "var(--cam-font-size-base)",
  fontWeight: 600,
  cursor: "pointer",
  border: "var(--cam-border-width) solid var(--cam-border)",
  background: "var(--cam-surface)",
  color: "var(--cam-text)",
};

function useViewportWidth() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return width;
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
 * - the section navigation bar is fixed to the bottom of the content pane;
 * - Save & exit is available in that bottom bar when the callbacks exist.
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
  establishmentName,
  niu,
  quarterCode,
  formId,
  onSubmitted,
  positionKey = null,
}: WizardShellProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isVt = entity.entityType === "vocationalTraining";
  const viewportWidth = useViewportWidth();

  const [sectionIndex, setSectionIndex] = useState(0);
  const [isValidationStage, setIsValidationStage] = useState(false);
  // Training centres: the preliminary quiz stage, between Sections 1 and 2.
  const [isVtQuizStage, setIsVtQuizStage] = useState(false);
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<string | null>(null);
  // The reference the server returned, passed to the receipt as is rather
  // than read back out of the message string.
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<"saved" | "failed" | null>(null);

  const [vtSectionOutline, setVtSectionOutline] = useState<VtWizardSectionOutlineModel | null>(null);

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

  const handlePreviewPdf = async (targetLocale?: "fr" | "en") => {
    const loc = targetLocale || formLocale;
    let previewTab: Window | null = null;
    try {
      previewTab = window.open("", "_blank");
      if (previewTab) {
        previewTab.document.write(
          `<!DOCTYPE html><html><head><title>${loc === "en" ? "PDF preview..." : "Aperçu PDF..."}</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1e6b3a;"><p style="font-size:16px;font-weight:600;">${loc === "en" ? "Generating official PDF preview..." : "Génération de l'aperçu PDF officiel en cours..."}</p></body></html>`
        );
      }
    } catch {
      // Ignore if direct window.open was blocked
    }

    try {
      const blob = await pdfMutation.mutateAsync(loc);
      const url = URL.createObjectURL(blob);
      if (previewTab && !previewTab.closed) {
        previewTab.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.download = `declaration-${entityType}-${effectiveQuarter}-${loc.toUpperCase()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (previewTab && !previewTab.closed) {
        previewTab.close();
      }
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

  // ── A1: focus, scroll and announcement on every VT step change ──────────
  // (non-VT entities render ModernJobsWizard, which does its own.)
  const vtStepKey = !isVt
    ? ""
    : isValidationStage
      ? "validation"
      : isVtQuizStage
        ? "quiz"
        : `section:${currentSection?.id ?? clampedSectionIndex}`;
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
  // The section content scrolls inside its own pane (overflowY: auto), so a
  // window reset alone would leave a new section opened half-way down.
  const contentPaneRef = useRef<HTMLDivElement | null>(null);
  useOnStepChange(vtStepKey, () => {
    contentPaneRef.current?.scrollTo({ top: 0, behavior: "instant" });
    resetScroll(0);
  });
  const vtStepAnnouncement = !isVt || submissionResult
    ? ""
    : wizardStepAnnouncement(
        isValidationStage
          ? { kind: "label", label: t("vtWizardSidebar.validationLink") }
          : isVtQuizStage
            ? { kind: "label", label: t("wizardShell.quizAnnouncement") }
            : currentSection
              ? {
                  kind: "section",
                  index: clampedSectionIndex,
                  total: sections.length,
                  title: localized(currentSection.title, formLocale) || currentSection.id,
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
    }
  }
  const vtStoredStage = isValidationStage ? "review" : isVtQuizStage ? "quiz" : "section";
  useEffect(() => {
    if (!isVt || !positionKey || restoredPositionKey !== positionKey || submissionResult) return;
    writeWizardPosition(positionKey, { stage: vtStoredStage, sectionIndex: clampedSectionIndex });
  }, [isVt, positionKey, restoredPositionKey, submissionResult, vtStoredStage, clampedSectionIndex]);

  if (!currentSection) return null;

  const showFullRail = viewportWidth !== null && viewportWidth >= 1280;
  const showCompactRail =
    viewportWidth !== null &&
    viewportWidth >= 900 &&
    viewportWidth < 1280;
  const isMobile = viewportWidth !== null && viewportWidth < 900;

  // Same 3-step gutter Flutter uses for the content column (16 / 24 / 40),
  // shared by the scrollable content pane and the fixed bottom bar so their
  // horizontal padding always lines up.
  const contentGutter =
    viewportWidth !== null && viewportWidth < 768 ? 16 : showFullRail ? 40 : 24;

  /**
   * VT uses the same "every visible field filled, not just the required
   * ones" definition as Flutter's vt_wizard_shell.dart _isComplete (see
   * isVtSectionComplete). Non-VT entities have no such stats model, so
   * validation passing is the closest equivalent there.
   */
  const isSectionComplete = (section: OnefopEntity["sections"][number]) =>
    isVt ? isVtSectionComplete(section, data) : validateSectionData(section, data).length === 0;

  /** Shows a section — the wizard's own quiz Continue / Back transitions,
   *  which follow their own rules (Back from Validation goes through
   *  goToSection, so it stops at the first incomplete step). */
  function showSection(index: number) {
    const nextIndex = Math.min(
      Math.max(index, 0),
      Math.max(0, sections.length - 1),
    );

    setSectionIndex(nextIndex);
    setIsValidationStage(false);
    setIsVtQuizStage(false);
    setAttemptedAdvance(false);
    setTaskListOpen(false);
    setVtSectionOutline(null);
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
    setVtSectionOutline(null);
    requestStepFocus();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goToValidation() {
    setIsValidationStage(true);
    setIsVtQuizStage(false);
    setAttemptedAdvance(false);
    setTaskListOpen(false);
    setVtSectionOutline(null);
    requestStepFocus();
  }

  function handleNext() {
    // VT is section-level pagination. Do not introduce React's generic unit
    // progression into VT; the Flutter shell delegates the section document's
    // internal pagination to VtWizardSectionScreen.
    if (sectionIssues.length > 0) {
      setAttemptedAdvance(true);
      // Auto-scroll to first invalid field (Gap #9, matching Flutter _scrollToFirstError).
      // A2: a cell or table-level issue has no element of its own id, and a
      // tabbed section only mounts its active tab — so show the owning tab
      // first, then (once rendered) walk the lookup chain down to the
      // owning table's wrapper.
      const firstIssue = sectionIssues[0];
      if (firstIssue?.fieldId) {
        const owner = findIssueOwner(currentSection?.fields ?? [], firstIssue.fieldId);
        vtRevealRef.current?.showIssue(firstIssue.fieldId);
        requestAnimationFrame(() => {
          revealIssueElement(firstIssue.fieldId, owner?.id);
        });
      }
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
      setVtSectionOutline(null);
      requestStepFocus();
      return;
    }

    goToValidation();
  }

  function handlePrev() {
    setAttemptedAdvance(false);

    // Section 2 → back to the preliminary quiz.
    if (vtQuizApplies && clampedSectionIndex === 1) {
      openVtQuiz();
      return;
    }

    if (clampedSectionIndex > 0) {
      setSectionIndex((index) => index - 1);
      setVtSectionOutline(null);
      requestStepFocus();
      return;
    }

    // Flutter explicitly exits from Section 1 rather than creating an
    // internal "overview" stage.
    onCancel?.();
  }

  async function handleSaveAndExit() {
    if (!onSaveNow || !onCancel) return;
    await onSaveNow();
    onCancel();
  }

  function renderTaskRail() {
    if (!isVt || isValidationStage) {
      return null;
    }

    if (showFullRail) {
      return (
        <VtWizardSidebar
          entity={entity}
          data={data}
          currentSectionIndex={clampedSectionIndex}
          onSelectSection={goToSection}
          sectionLockReason={(index) => vtLockReason({ kind: "section", index })}
          isValidationStage={false}
          onGoToValidation={goToValidation}
          outline={isVtQuizStage ? null : vtSectionOutline}
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

    if (showCompactRail) {
      return (
        <aside
          aria-label={t("vtWizardSidebar.navAriaLabel")}
          style={{
            width: 68,
            flex: "0 0 68px",
            background: "var(--cam-green-dark)",
            borderRight: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "16px 0",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              margin: "0 auto 12px",
              display: "grid",
              placeItems: "center",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 18,
            }}
            title="MINEFOP / ONEFOP"
          >
            🏫
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(255, 255, 255, 0.12)",
              paddingTop: 8,
            }}
          >
            {sections.map((section, index) => {
              // The schema titles already start with "SECTION n.", so no number prefix.
              const label = localized(section.title, locale.startsWith("en") ? "en" : "fr");
              const sectionItem = renderCompactRailItem({
                key: section.id,
                label,
                current: !isVtQuizStage && index === clampedSectionIndex,
                done: isSectionComplete(section),
                lockReason: vtLockReason({ kind: "section", index }),
                onOpen: () => goToSection(index),
                badge: index + 1,
              });
              // The preliminary quiz sits between Section 1 and Section 2,
              // as in the full sidebar.
              if (index !== 0 || !vtQuizApplies) return sectionItem;
              return (
                <Fragment key={section.id}>
                  {sectionItem}
                  {renderCompactRailItem({
                    key: "vt-quiz",
                    label: t("wizardShell.quizAnnouncement"),
                    current: isVtQuizStage,
                    done: vtQuizComplete,
                    lockReason: vtLockReason({ kind: "quiz" }),
                    onOpen: selectVtQuiz,
                    badge: "?",
                  })}
                </Fragment>
              );
            })}
          </div>
        </aside>
      );
    }

    return null;
  }

  /** One item of the compact (68px) rail: a section or the preliminary quiz. */
  function renderCompactRailItem({
    key,
    label,
    current,
    done,
    lockReason,
    onOpen,
    badge,
  }: {
    key: string;
    label: string;
    current: boolean;
    done: boolean;
    lockReason: string | null;
    onOpen: () => void;
    badge: ReactNode;
  }) {
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={lockReason ? `${label} — ${lockReason}` : label}
                  aria-current={current ? "step" : undefined}
                  aria-disabled={lockReason ? true : undefined}
                  title={lockReason ? `${label} — ${lockReason}` : label}
                  onClick={lockReason ? undefined : onOpen}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 40,
                    height: 40,
                    margin: "4px auto",
                    padding: 0,
                    borderRadius: "50%",
                    border: current
                      ? "2px solid #ffffff"
                      : done
                        ? "1px solid var(--cam-green)"
                        : "1px solid rgba(255, 255, 255, 0.2)",
                    background: current
                      ? "#ffffff"
                      : done
                        ? "var(--cam-green)"
                        : "rgba(255, 255, 255, 0.08)",
                    color: current ? "var(--cam-green-dark)" : "#ffffff",
                    fontWeight: 800,
                    cursor: lockReason ? "not-allowed" : "pointer",
                    opacity: lockReason ? 0.5 : undefined,
                  }}
                >
                  {done && !current ? "✓" : badge}
                </button>
              );
  }

  /** One entry of the mobile section drawer: a section or the preliminary quiz. */
  function renderDrawerItem({
    key,
    title,
    current,
    done,
    lockReason,
    onOpen,
    badge,
  }: {
    key: string;
    title: string;
    current: boolean;
    done: boolean;
    lockReason: string | null;
    onOpen: () => void;
    badge: ReactNode;
  }) {
                return (
                  <button
                    key={key}
                    type="button"
                    aria-current={current ? "step" : undefined}
                    aria-disabled={lockReason ? true : undefined}
                    title={lockReason ?? undefined}
                    onClick={lockReason ? undefined : onOpen}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      padding: 12,
                      marginBottom: 6,
                      borderRadius: "var(--cam-radius-md)",
                      border: current
                        ? "1px solid var(--vt-accent, #1e6b3a)"
                        : "1px solid transparent",
                      background: current
                        ? "var(--vt-accent-soft, #eaf3ec)"
                        : "transparent",
                      color: current
                        ? "var(--vt-accent, #1e6b3a)"
                        : lockReason
                          ? "var(--cam-rail-upcoming)"
                          : "var(--vt-ink, #1c1f1d)",
                      fontWeight: current ? 700 : 500,
                      cursor: lockReason ? "not-allowed" : "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        boxSizing: "border-box",
                        flex: "0 0 24px",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "var(--cam-radius-sm)",
                        // Same current-vs-done distinction as the full
                        // sidebar: current stays solid, done drops to a soft
                        // outline fill instead of sharing the solid color.
                        background: current
                          ? "var(--vt-accent, #1e6b3a)"
                          : done
                            ? "var(--vt-accent-soft, #eaf3ec)"
                            : "var(--cam-bg)",
                        border: done && !current ? "1px solid var(--vt-accent, #1e6b3a)" : "1px solid transparent",
                        color: current ? "#fff" : done ? "var(--vt-accent, #1e6b3a)" : "var(--vt-ink-soft, #4e5451)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {done ? "✓" : badge}
                    </span>
                    <span>
                      {title}
                      {lockReason && <span className="sr-only"> — {lockReason}</span>}
                    </span>
                  </button>
                );
  }

  function renderMobileTaskList() {
    if (!isVt || !isMobile) return null;

    return (
      <>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "var(--cam-space-4)",
          }}
        >
          <button
            type="button"
            style={{
              ...buttonStyle,
              padding: "0 14px",
              border: "1px solid var(--vt-card-border, #e5eae7)",
              color: "var(--vt-ink-soft, #4e5451)",
            }}
            onClick={() => setTaskListOpen(true)}
          >
            ☰ {t("wizardShell.sectionsListLabel")}
          </button>
        </div>

        {taskListOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("wizardShell.sectionsListLabel")}
            onClick={() => setTaskListOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,.28)",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              ref={taskListSheetRef}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "100%",
                maxHeight: "82vh",
                overflow: "auto",
                background: "#ffffff",
                borderRadius: "18px 18px 0 0",
                padding: "20px",
                boxShadow: "0 -8px 30px rgba(0,0,0,.14)",
                outline: "none",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--vt-card-border, #e5eae7)",
                  margin: "0 auto 18px",
                }}
              />

              {/* Same title row + close button as ModernJobsWizard's drawer. */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cam-space-3)" }}>
                <h3 style={{ margin: 0, fontSize: "var(--cam-font-size-base)", fontWeight: 700 }}>{t("wizardShell.sectionsListLabel")}</h3>
                <button
                  type="button"
                  onClick={() => setTaskListOpen(false)}
                  className="cam-hoverable"
                  aria-label={t("modernJobs.wizard.close")}
                  style={{ background: "none", border: "none", fontSize: "var(--cam-font-size-lg)", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {sections.map((section, index) => {
                const sectionItem = renderDrawerItem({
                  key: section.id,
                  title: localized(section.title, locale.startsWith("en") ? "en" : "fr"),
                  current: !isVtQuizStage && index === clampedSectionIndex,
                  done: isSectionComplete(section),
                  lockReason: vtLockReason({ kind: "section", index }),
                  onOpen: () => goToSection(index),
                  badge: index + 1,
                });
                // The preliminary quiz sits between Section 1 and Section 2,
                // as in the full sidebar.
                if (index !== 0 || !vtQuizApplies) return sectionItem;
                return (
                  <Fragment key={section.id}>
                    {sectionItem}
                    {renderDrawerItem({
                      key: "vt-quiz",
                      title: t("wizardShell.quizAnnouncement"),
                      current: isVtQuizStage,
                      done: vtQuizComplete,
                      lockReason: vtLockReason({ kind: "quiz" }),
                      onOpen: selectVtQuiz,
                      badge: "?",
                    })}
                  </Fragment>
                );
              })}
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
          onPreviewPdf={() => setPreviewModalOpen(true)}
          isGeneratingPdf={pdfMutation.isPending}
          establishmentName={effectiveEstablishment}
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
          submissionId={submissionId}
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
          quarterCode={effectiveQuarter}
          saving={saving}
          lastSavedAt={lastSavedAt}
          onSaveNow={onSaveNow ? () => void onSaveNow() : undefined}
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
              outline={null}
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
                onDownloadPdf={() => handlePreviewPdf(formLocale)}
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
                  onOpenSection={goToSection}
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
              submissionId={submissionId}
              submissionError={submissionError}
              establishmentName={effectiveEstablishment}
            />
          </div>
        </div>
      </div>
    );
  }

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
          quarterCode={effectiveQuarter}
          saving={saving}
          lastSavedAt={lastSavedAt}
          onSaveNow={onSaveNow ? () => void onSaveNow() : undefined}
          onExit={onCancel}
          onPreviewPdf={handlePreviewPdf}
          isGeneratingPdf={pdfMutation.isPending}
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
              overflowY: "auto",
              paddingTop: contentGutter,
              paddingLeft: contentGutter,
              paddingRight: contentGutter,
              paddingBottom: "calc(var(--cam-space-6) + 92px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "var(--vt-content-max)",
                margin: "0 auto",
              }}
            >
              {renderMobileTaskList()}

              {/* VT keeps no top-of-section header or error banner (as in
                  Flutter): progress is the rail and the section outline,
                  errors are inline plus the block "à corriger" text. */}
              {isVtQuizStage ? (
                <VtScopeQuiz
                  entity={entity}
                  data={data}
                  onChange={onChange}
                  // The quiz's own Continue / Back: VtScopeQuiz has already
                  // checked the answers (and they are not in `data` yet).
                  onComplete={() => showSection(1)}
                  onBack={() => showSection(0)}
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
                  onSaveAndExit={onSaveNow && onCancel ? async () => { await onSaveNow(); onCancel(); } : undefined}
                  showBottomBar={false}
                  saving={saving}
                  onOutlineChange={setVtSectionOutline}
                />
              )}
            </div>
          </div>

          {!isVtQuizStage && (
          <>
          {/* Fixed bottom navigation bar pinned to the bottom of the shell.
              Matches Flutter vt_wizard_shell.dart:426-520. */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 20,
              background: "#ffffff",
              borderTop: "1px solid var(--cam-border)",
              boxShadow: "0 -3px 10px rgba(0,0,0,.08)",
              padding: `12px ${contentGutter}px`,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "var(--vt-content-max)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {/* Left: Section Indicator & Save */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                  {`Section ${clampedSectionIndex + 1} / ${sections.length}`}
                </span>

                {onSaveNow && onCancel && (
                  <button
                    type="button"
                    className="cam-hoverable"
                    style={{
                      padding: "4px 8px",
                      background: "none",
                      border: "none",
                      color: "#0e4d29",
                      fontWeight: 600,
                      fontSize: 12,
                      textDecoration: "underline",
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    onClick={handleSaveAndExit}
                    disabled={saving}
                  >
                    {saving ? "Sauvegarde..." : `💾 ${t("wizardShell.saveAndExitButton")}`}
                  </button>
                )}
              </div>

              {/* Right: Grouped Navigation Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  className="cam-hoverable"
                  style={{
                    padding: "10px 18px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    background: "#ffffff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                  onClick={handlePrev}
                >
                  <span>←</span>
                  <span>
                    {clampedSectionIndex === 0 && !!onCancel
                      ? t("common.cancel")
                      : t("wizardShell.previousStepButton")}
                  </span>
                </button>

                <button
                  type="button"
                  className="cam-hoverable"
                  style={{
                    padding: "10px 24px",
                    borderRadius: 6,
                    border: "none",
                    background: "#0e4d29",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 1px 3px rgba(14, 77, 41, 0.2)",
                    transition: "all 0.15s ease",
                  }}
                  onClick={handleNext}
                >
                  <span>
                    {clampedSectionIndex === sections.length - 1
                      ? t("wizardShell.proceedToValidationButton")
                      : t("wizardShell.nextButton")}
                  </span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </main>
        </VtQuizContext.Provider>
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
        submissionId={submissionId}
        submissionError={submissionError}
        establishmentName={effectiveEstablishment}
      />
    </div>
  );
}
