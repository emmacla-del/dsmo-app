"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localized, type FormData, type OnefopEntity, type OnefopField } from "@/lib/onefop-schema";
import type { ValidationIssue } from "@/lib/onefop-validation";
import { ModernJobsHeader } from "./ModernJobsHeader";
import { ModernJobsSidebar, getSectionStatus } from "./ModernJobsSidebar";
import { ModernJobsNavigation } from "./ModernJobsNavigation";
import { SectionRenderer, type SectionTableNavState } from "./SectionRenderer";
import { EventFactInterview } from "@/components/modern-jobs";
import { ProjectProgramScopeQuiz } from "@/components/modern-jobs/scope/ProjectProgramScopeQuiz";
import { useViewportSize } from "./useViewportSize";
import { CoherenceReviewList, useCoherence } from "./coherence/Coherence";
import { resetScroll } from "@/lib/reset-scroll";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";

export interface ModernJobsWizardProps {
  entity: OnefopEntity;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  validationIssues?: ValidationIssue[];
  saving?: boolean;
  lastSavedAt?: Date | null;
  onSaveNow?: () => void;
  onCancel?: () => void;
  onSubmitFinal?: () => void;
  isSubmitting?: boolean;
  submissionResult?: string | null;
  submissionError?: { summary: string; items: string[] } | null;
  onPreviewPdf?: (locale?: "fr" | "en") => void;
  isGeneratingPdf?: boolean;
  canSubmit?: boolean;
  quarterStatusMessage?: string;
  establishmentName?: string;
  quarterCode?: string;
}

/**
 * ModernJobsWizard is the unified, canonical declaration wizard for the seven non-VT
 * entity types (Administration, CTD, Coopérative, Entreprise, ONG, Project/Program).
 *
 * Provides a self-respondent-first experience:
 * - 940px maximum content width preventing horizontal stretching
 * - Institutional sidebar outline with completion chips (Complété, En cours, Non entamé, À corriger)
 * - Structured FormSectionCard modules and responsive 1/2/3 column FormGrids
 * - Dual-mode [ Tableau | Guidé ] adaptive statistical tables with zero-fill helpers
 * - Explicit skip logic reassurance banners
 * - Live draft status with save & resume confidence
 */
export function ModernJobsWizard({
  entity,
  data,
  onChange,
  validationIssues = [],
  saving = false,
  lastSavedAt = null,
  onSaveNow,
  onCancel,
  onSubmitFinal,
  isSubmitting = false,
  submissionResult = null,
  submissionError = null,
  onPreviewPdf,
  isGeneratingPdf = false,
  canSubmit = true,
  quarterStatusMessage,
  establishmentName,
  quarterCode,
}: ModernJobsWizardProps) {
  const locale: "fr" | "en" = useLocale().startsWith("en") ? "en" : "fr";

  const t = useTranslations("modernJobs.wizard");
  const viewportWidth = useViewportSize() ?? 1024;
  const isDesktop = viewportWidth >= 1024;

  const effectiveEstablishment =
    establishmentName ||
    (data["S1Q02"] as string) ||
    (data["S0Q01"] as string) ||
    (data["VT1_2"] as string) ||
    undefined;

  const [sectionIndex, setSectionIndex] = useState(0);
  const [activeTableId, setActiveTableId] = useState<string | undefined>(undefined);
  const [isScopeStage, setIsScopeStage] = useState(false);
  const [isValidationStage, setIsValidationStage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Mirrors mobileMenuOpen but stays true for one extra animation frame after
  // an explicit close (backdrop click / ✕ button), so the drawer's slide-down
  // + fade-out can actually play before the node unmounts — a plain
  // `mobileMenuOpen && (...)` conditional has no way to animate an exit,
  // since React removes the DOM the instant the flag flips.
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const closeMobileMenu = useCallback(() => {
    setMobileMenuClosing(true);
    window.setTimeout(() => {
      setMobileMenuOpen(false);
      setMobileMenuClosing(false);
    }, 200);
  }, []);

  const handleSelectTable = useCallback((tableId: string) => {
    setActiveTableId(tableId);
    setMobileMenuOpen(false);
  }, []);
  // Respondent Identification (Section 0): which fields the user has
  // actually left (blurred) at least once — SectionRenderer's section0
  // branch only reveals a field's validation error once it's in this set,
  // instead of every required field showing "Champ obligatoire" from the
  // very first render. Never reset/cleared, same as Flutter's own _touched
  // set — once shown, a field's error stays live-updating as they correct
  // it. Other sections are unaffected: SectionRenderer only consults this
  // for section0.
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [attemptedContinue, setAttemptedContinue] = useState(false);
  const [showReviewAfterSubmit, setShowReviewAfterSubmit] = useState(false);

  useEffect(() => {
    if (submissionResult) {
      resetScroll(0);
    }
  }, [submissionResult]);

  const handleFieldTouch = useCallback((fieldId: string) => {
    setTouchedFields((prev) => (prev.has(fieldId) ? prev : new Set(prev).add(fieldId)));
  }, []);

  const sections = entity.sections;

  // Lets an anomaly tooltip / the review list open the section and table
  // that holds a given cell (see components/onefop/coherence).
  const coherence = useCoherence();
  const registerCoherenceNavigator = coherence?.registerNavigator;
  useEffect(() => {
    if (!registerCoherenceNavigator) return;
    registerCoherenceNavigator((tableFieldId: string) => {
      const target = tableFieldId.toLowerCase();
      const idx = sections.findIndex((sec) => sec.fields.some((f) => f.id.toLowerCase() === target));
      if (idx === -1) return;
      setIsValidationStage(false);
      setIsScopeStage(false);
      setSectionIndex(idx);
      setActiveTableId(tableFieldId);
    });
    return () => registerCoherenceNavigator(null);
  }, [registerCoherenceNavigator, sections]);

  const clampedSectionIndex = Math.min(Math.max(0, sectionIndex), sections.length - 1);
  const currentSection = sections[clampedSectionIndex];

  // Filter issues for current section (matches direct fieldId, paperCode, or table cell keys)
  const currentSectionFields = currentSection?.fields ?? [];
  const currentSectionFieldIds = new Set(currentSectionFields.map((f) => f.id));
  const sectionIssues = validationIssues.filter((issue) =>
    currentSectionFields.some(
      (f) =>
        f.id === issue.fieldId ||
        (f.paperCode && f.paperCode === issue.fieldId) ||
        issue.fieldId.toLowerCase().startsWith(f.id.toLowerCase() + "_") ||
        (f.paperCode && issue.fieldId.toLowerCase().startsWith(f.paperCode.toLowerCase() + "_"))
    )
  );

  const interviewNavRef = useRef<{ onPrev: () => boolean; onNext: () => boolean } | null>(null);
  const sectionNavRef = useRef<{ onNext: () => boolean; onPrev: () => boolean } | null>(null);
  const [tableNavState, setTableNavState] = useState<SectionTableNavState | null>(null);

  const handlePrev = () => {
    if (isValidationStage) {
      setIsValidationStage(false);
      setSectionIndex(sections.length - 1);
      setActiveTableId(undefined);
      setTableNavState(null);
      resetScroll(0);
      return;
    }
    if (isScopeStage) {
      if (interviewNavRef.current) {
        const handled = interviewNavRef.current.onPrev();
        if (handled) return;
      }
      setIsScopeStage(false);
      setSectionIndex(1);
      setActiveTableId(undefined);
      setTableNavState(null);
      resetScroll(0);
      return;
    }

    // Try table-level navigation within active section first
    if (sectionNavRef.current) {
      const handled = sectionNavRef.current.onPrev();
      if (handled) return;
    }

    if (clampedSectionIndex === 2) {
      setIsScopeStage(true);
      setActiveTableId(undefined);
      setTableNavState(null);
      resetScroll(0);
      return;
    }
    if (clampedSectionIndex > 0) {
      setSectionIndex(clampedSectionIndex - 1);
      setActiveTableId(undefined);
      setTableNavState(null);
      resetScroll(0);
    }
  };

  const handleNext = () => {
    if (isScopeStage) {
      if (interviewNavRef.current) {
        const handled = interviewNavRef.current.onNext();
        if (handled) return;
      }
      setIsScopeStage(false);
      setSectionIndex(2);
      setActiveTableId(undefined);
      setTableNavState(null);
      setAttemptedContinue(false);
      resetScroll(0);
      return;
    }

    // If current section has validation issues, mark attemptedContinue and touch all section fields
    if (!isScopeStage && !isValidationStage && sectionIssues.length > 0) {
      setAttemptedContinue(true);
      setTouchedFields((prev) => {
        const next = new Set(prev);
        currentSectionFieldIds.forEach((id) => next.add(id));
        return next;
      });
    }

    // Try table-level navigation within active section first
    if (sectionNavRef.current) {
      const handled = sectionNavRef.current.onNext();
      if (handled) return;
    }

    if (clampedSectionIndex === 1) {
      setIsScopeStage(true);
      setActiveTableId(undefined);
      setTableNavState(null);
      setAttemptedContinue(false);
      resetScroll(0);
      return;
    }
    if (clampedSectionIndex < sections.length - 1) {
      setSectionIndex(clampedSectionIndex + 1);
      setActiveTableId(undefined);
      setTableNavState(null);
      setAttemptedContinue(false);
      resetScroll(0);
    } else if (!isValidationStage) {
      setIsValidationStage(true);
      setActiveTableId(undefined);
      setTableNavState(null);
      setAttemptedContinue(false);
      resetScroll(0);
    } else {
      // Already on validation stage: primary button triggers final submission
      if (validationIssues.length > 0) {
        setAttemptedContinue(true);
        const summaryEl = document.getElementById("validation-summary-card");
        if (summaryEl) {
          summaryEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      if (onSubmitFinal) {
        onSubmitFinal();
      }
    }
  };

  const handleSelectSection = (index: number) => {
    setIsValidationStage(false);
    setIsScopeStage(false);
    setSectionIndex(index);
    setActiveTableId(undefined);
    setTableNavState(null);
    setAttemptedContinue(false);
    setMobileMenuOpen(false);
    resetScroll(0);
  };

  const handleSelectScope = () => {
    setIsValidationStage(false);
    setIsScopeStage(true);
    setActiveTableId(undefined);
    setTableNavState(null);
    setMobileMenuOpen(false);
    resetScroll(0);
  };

  const handleCorriger = () => {
    if (validationIssues.length > 0) {
      const firstIssue = validationIssues[0];
      // Quiz issues (QUIZ_ISSUE_FIELD_ID) are fixed in the preliminary quiz.
      if (firstIssue.fieldId === "_scopeConfig") {
        handleSelectScope();
        return;
      }
      const secIdx = sections.findIndex((sec) =>
        sec.fields.some((f) => f.id === firstIssue.fieldId)
      );
      if (secIdx !== -1) {
        handleSelectSection(secIdx);
        return;
      }
    }
    handleSelectSection(0);
  };

  const handleSubmitClick = () => {
    if (isSubmitting) return;
    if (validationIssues.length > 0) {
      setAttemptedContinue(true);
      const summaryEl = document.getElementById("validation-summary-card");
      if (summaryEl) {
        summaryEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (onSubmitFinal) {
      onSubmitFinal();
    }
  };

  const canAdvance = true;

  // Tableau / Guidé: one choice for the whole declaration — every section and
  // table follows it until the user switches again. Remembered in this
  // browser (a convenience only; never part of the declaration data).
  // First visit: Guidé on phones, Tableau otherwise.
  const ENTRY_MODE_KEY = "camleap.onefop.entryMode";
  const [entryMode, setEntryMode] = useState<"grid" | "guided">(() => {
    if (typeof window === "undefined") return "grid";
    try {
      const saved = window.localStorage.getItem(ENTRY_MODE_KEY);
      if (saved === "grid" || saved === "guided") return saved;
    } catch {
      /* storage unavailable — fall through to the default */
    }
    return window.matchMedia?.("(max-width: 767px)").matches ? "guided" : "grid";
  });
  const handleEntryModeChange = useCallback((mode: "grid" | "guided") => {
    setEntryMode(mode);
    try {
      window.localStorage.setItem(ENTRY_MODE_KEY, mode);
    } catch {
      /* storage unavailable — the choice still applies for this session */
    }
  }, []);

  // Publish the sticky header's height as --mj-header-h so the sidebar and
  // the table tab strips can pin just below it while tables scroll.
  const [wizardRoot, setWizardRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const header = wizardRoot?.firstElementChild as HTMLElement | null;
    if (!wizardRoot || !header || typeof ResizeObserver === "undefined") return;
    const publish = () => wizardRoot.style.setProperty("--mj-header-h", `${header.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, [wizardRoot]);

  return (
    <div
      ref={setWizardRoot}
      data-mj-root=""
      style={{
        minHeight: "100vh",
        background: "var(--cam-bg, #f4f6f5)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Masthead ── */}
      <ModernJobsHeader
        entityType={entity.entityType}
        establishmentName={establishmentName}
        quarterCode={quarterCode}
        saving={saving}
        lastSavedAt={lastSavedAt}
        onSaveNow={onSaveNow}
        onExit={onCancel}
        onPreviewPdf={onPreviewPdf ? () => onPreviewPdf(locale) : undefined}
        isGeneratingPdf={isGeneratingPdf}
      />

      <div style={{ flex: 1, display: "flex", alignItems: "stretch", minHeight: 0 }}>
        {/* ── Desktop Sidebar Outline ── */}
        {isDesktop && (
          <ModernJobsSidebar
            entity={entity}
            data={data}
            currentSectionIndex={clampedSectionIndex}
            onSelectSection={handleSelectSection}
            issues={validationIssues}
            isValidationStage={isValidationStage}
            onGoToValidation={() => {
              setIsValidationStage(true);
              setIsScopeStage(false);
            }}
            isScopeStage={isScopeStage}
            onSelectScope={handleSelectScope}
            activeTableId={activeTableId}
            onSelectTable={handleSelectTable}
          />
        )}

        {/* ── Main Questionnaire Stage ── */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            paddingTop: "var(--cam-space-5, 20px)",
            paddingLeft: "clamp(12px, 3vw, 24px)",
            paddingRight: "clamp(12px, 3vw, 24px)",
            paddingBottom: "calc(var(--cam-space-6, 24px) + 90px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth:
                !isScopeStage && clampedSectionIndex >= 2 && !isValidationStage
                  ? "min(1360px, 100%)"
                  : "var(--vt-content-max, 940px)",
              margin: "0 auto",
            }}
          >
            {/* Mobile Sections Menu Button */}
            {!isDesktop && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="cam-hoverable"
                  style={{
                    background: "var(--cam-surface, #ffffff)",
                    border: "1px solid var(--vt-card-border, #e5eae7)",
                    borderRadius: "var(--cam-radius-sm, 6px)",
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--cam-text, #1c1f1d)",
                    cursor: "pointer",
                  }}
                >
                  ☰ {t("mobileSectionsButton", {
                    stage: isScopeStage
                      ? t("stageQuiz")
                      : isValidationStage
                        ? t("stageReview")
                        : `${clampedSectionIndex + 1}/${sections.length}`,
                  })}
                </button>
              </div>
            )}

            {/* Mobile Sections Drawer */}
            {!isDesktop && (mobileMenuOpen || mobileMenuClosing) && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("sectionsListAria")}
                onClick={closeMobileMenu}
                className={mobileMenuClosing ? "cam-drawer-backdrop-out" : "cam-drawer-backdrop-in"}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 100,
                  background: "rgba(0, 0, 0, 0.4)",
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={mobileMenuClosing ? "cam-drawer-sheet-out" : "cam-drawer-sheet-in"}
                  style={{
                    width: "100%",
                    maxHeight: "80vh",
                    background: "var(--cam-surface, #ffffff)",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    padding: 16,
                    overflowY: "auto",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("sectionsDrawerTitle")}</h3>
                    <button
                      type="button"
                      onClick={closeMobileMenu}
                      className="cam-hoverable"
                      aria-label={t("close")}
                      style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                  <ModernJobsSidebar
                    entity={entity}
                    data={data}
                    currentSectionIndex={clampedSectionIndex}
                    onSelectSection={handleSelectSection}
                    issues={validationIssues}
                    isValidationStage={isValidationStage}
                    onGoToValidation={() => {
                      setIsValidationStage(true);
                      setIsScopeStage(false);
                      setMobileMenuOpen(false);
                    }}
                    isScopeStage={isScopeStage}
                    onSelectScope={handleSelectScope}
                    activeTableId={activeTableId}
                    onSelectTable={handleSelectTable}
                  />
                </div>
              </div>
            )}

            {submissionError && (
              <div
                role="alert"
                style={{
                  padding: "12px 16px",
                  background: "var(--cam-error-bg, #fef2f2)",
                  border: "1px solid var(--cam-error, #dc2626)",
                  borderRadius: "var(--cam-radius-sm, 6px)",
                  color: "var(--cam-error, #dc2626)",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{submissionError.summary}</div>
                {submissionError.items.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {submissionError.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Content Switch: Submitted Success Screen vs Scope Stage vs Final Review Stage vs Active Section */}
            {submissionResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <OnefopSubmissionSuccess
                  rawResult={submissionResult}
                  entityType={entity.entityType}
                  establishmentName={effectiveEstablishment}
                  niu={(data["S1Q01"] as string) || (data["VT1_1"] as string) || (data["NIU"] as string)}
                  quarterCode={quarterCode}
                  locale={locale.startsWith("en") ? "en" : "fr"}
                  onDownloadPdf={() => onPreviewPdf?.(locale.startsWith("en") ? "en" : "fr")}
                  isGeneratingPdf={isGeneratingPdf}
                  onPrint={() => window.print()}
                  onReturnToDashboard={onCancel}
                  onToggleReview={() => setShowReviewAfterSubmit((prev) => !prev)}
                  isReviewing={showReviewAfterSubmit}
                />

                {showReviewAfterSubmit && (
                  <div
                    style={{
                      background: "var(--cam-surface, #ffffff)",
                      border: "1px solid var(--cam-border, #d8ddd3)",
                      borderRadius: "var(--cam-radius-md, 8px)",
                      padding: "clamp(20px, 4vw, 32px)",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        borderLeft: "4px solid var(--cam-green-dark, #144a28)",
                        paddingLeft: "var(--cam-space-3, 12px)",
                        borderBottom: "1px solid var(--cam-border, #d8ddd3)",
                        paddingBottom: 12,
                        marginBottom: 20,
                      }}
                    >
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "var(--cam-text, #0b1f14)" }}>
                        {locale === "fr" ? "Copie conforme des données transmises" : "Certified copy of submitted data"}
                      </h3>
                      <p style={{ fontSize: 13, color: "var(--cam-text-muted, #4a5a50)", margin: 0 }}>
                        {locale === "fr"
                          ? "Ces données sont désormais archivées et enregistrées auprès de l'ONEFOP."
                          : "These data are now archived and officially recorded with ONEFOP."}
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sections.map((sec, sIdx) => (
                        <div
                          key={sec.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "var(--cam-radius-sm, 4px)",
                            background: "var(--cam-bg, #fafaf7)",
                            border: "1px solid var(--cam-border, #d8ddd3)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                display: "grid",
                                placeItems: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                background: "var(--cam-green, #1e6b3a)",
                                color: "#ffffff",
                              }}
                            >
                              ✓
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cam-text, #0b1f14)" }}>
                              {(sec.title && localized(sec.title, locale)) || sec.id}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--cam-green, #1e6b3a)" }}>
                            {locale === "fr" ? "Transmis ✓" : "Submitted ✓"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : isScopeStage ? (
              entity.entityType === "projectProgram" ? (
                <ProjectProgramScopeQuiz
                  entity={entity}
                  data={data}
                  onChange={onChange}
                  onComplete={() => {
                    setIsScopeStage(false);
                    setSectionIndex(2);
                    resetScroll(0);
                  }}
                  onBack={() => {
                    setIsScopeStage(false);
                    setSectionIndex(1);
                    resetScroll(0);
                  }}
                  locale={locale}
                  establishmentName={establishmentName}
                  navigationRef={interviewNavRef}
                />
              ) : (
                <EventFactInterview
                  entity={entity}
                  data={data}
                  onChange={onChange}
                  onComplete={() => {
                    setIsScopeStage(false);
                    setSectionIndex(2);
                    resetScroll(0);
                  }}
                  onBack={() => {
                    setIsScopeStage(false);
                    setSectionIndex(1);
                    resetScroll(0);
                  }}
                  locale={locale}
                  establishmentName={establishmentName}
                  navigationRef={interviewNavRef}
                />
              )
            ) : isValidationStage ? (
              <div
                style={{
                  background: "var(--cam-surface, #ffffff)",
                  border: "1px solid var(--vt-card-border, #e5eae7)",
                  borderRadius: "var(--cam-radius-md, 8px)",
                  padding: "clamp(20px, 4vw, 32px)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div
                  style={{
                    borderLeft: "4px solid var(--cam-green-dark, #144a28)",
                    paddingLeft: "var(--cam-space-3, 12px)",
                    borderBottom: "1px solid var(--cam-border, #d8ddd3)",
                    paddingBottom: 12,
                    marginBottom: 20,
                  }}
                >
                  <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "var(--cam-text, #0b1f14)" }}>
                    {t("reviewHeading")}
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--cam-text-muted, #4a5a50)", margin: 0 }}>
                    {t("reviewIntro")}
                  </p>
                </div>

                {/* Section Review Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {sections.map((sec, sIdx) => {
                    const status = getSectionStatus(sec, data, validationIssues);
                    const isDone = status === "complete";
                    const isErr = status === "has-errors";
                    return (
                      <div
                        key={sec.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "var(--cam-radius-sm, 4px)",
                          background: "var(--cam-bg, #fafaf7)",
                          border: "1px solid var(--cam-border, #d8ddd3)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              background: isDone
                                ? "var(--cam-green, #1e6b3a)"
                                : isErr
                                  ? "var(--cam-error, #b3261e)"
                                  : "rgba(11, 31, 20, 0.15)",
                              color: isDone || isErr ? "#ffffff" : "var(--cam-text, #0b1f14)",
                            }}
                          >
                            {isDone ? "✓" : isErr ? "!" : sIdx + 1}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cam-text, #0b1f14)" }}>
                            {(sec.title && localized(sec.title, locale)) || sec.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSection(sIdx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--cam-green, #1e6b3a)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {t("edit")}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Validation summary card if blocking issues exist */}
                {validationIssues.length > 0 && (
                  <div
                    id="validation-summary-card"
                    style={{
                      marginBottom: 20,
                      padding: "16px 20px",
                      borderRadius: "var(--cam-radius-sm, 6px)",
                      background: "rgba(179, 38, 30, 0.06)",
                      border: "1px solid rgba(179, 38, 30, 0.3)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 18, color: "var(--cam-error, #b3261e)" }}>⚠️</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--cam-error, #b3261e)" }}>
                          {locale === "fr"
                            ? `${validationIssues.length} point(s) à corriger avant la soumission`
                            : `${validationIssues.length} issue(s) require attention before submission`}
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--cam-text-muted, #4a5a50)" }}>
                          {locale === "fr"
                            ? "Veuillez renseigner les champs obligatoires ou corriger les formats invalides ci-dessous."
                            : "Please fill required fields or correct invalid formats below."}
                        </p>
                      </div>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                      {validationIssues.map((issue) => {
                        let matchingField: OnefopField | undefined;
                        const secIdx = sections.findIndex((sec) => {
                          const found = sec.fields.find(
                            (f) =>
                              f.id === issue.fieldId ||
                              (f.paperCode && f.paperCode === issue.fieldId) ||
                              issue.fieldId.toLowerCase().startsWith(f.id.toLowerCase() + "_") ||
                              (f.paperCode && issue.fieldId.toLowerCase().startsWith(f.paperCode.toLowerCase() + "_"))
                          );
                          if (found) {
                            matchingField = found;
                            return true;
                          }
                          return false;
                        });
                        const secTitle =
                          secIdx !== -1
                            ? (sections[secIdx].title ? localized(sections[secIdx].title, locale) : `Section ${secIdx + 1}`)
                            : null;
                        return (
                          <li key={issue.fieldId} style={{ fontSize: 13, color: "var(--cam-text, #0b1f14)" }}>
                            <span style={{ fontWeight: 600 }}>{issue.message}</span>
                            {secTitle && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectSection(secIdx);
                                  if (matchingField) {
                                    setActiveTableId(matchingField.id);
                                  }
                                }}
                                style={{
                                  marginLeft: 8,
                                  background: "none",
                                  border: "none",
                                  color: "var(--cam-green, #1e6b3a)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  padding: 0,
                                }}
                              >
                                ({secTitle})
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Quarter Closed Warning if applicable */}
                {!canSubmit && (
                  <div
                    style={{
                      marginBottom: 20,
                      padding: "14px 18px",
                      borderRadius: "var(--cam-radius-sm, 6px)",
                      background: "rgba(230, 81, 0, 0.08)",
                      border: "1px solid rgba(230, 81, 0, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>🔒</span>
                    <div style={{ fontSize: 13, color: "var(--cam-text, #0b1f14)" }}>
                      <span style={{ fontWeight: 700 }}>
                        {locale === "fr" ? "Période de déclaration fermée" : "Declaration period closed"}
                      </span>
                      {quarterStatusMessage && (
                        <div style={{ marginTop: 2, color: "var(--cam-text-muted, #4a5a50)" }}>
                          {quarterStatusMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-blocking coherence anomalies still open */}
                <CoherenceReviewList />

                {/* Actions: Navigation, PDF Preview & Final Submit */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 24,
                    paddingTop: 16,
                    borderTop: "1px solid var(--cam-border, #d8ddd3)",
                  }}
                >
                  <button
                    type="button"
                    onClick={handlePrev}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--cam-text-muted, #4a5a50)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 4px",
                    }}
                  >
                    <span>←</span>
                    <span>{locale === "fr" ? "Précédent" : "Previous"}</span>
                  </button>

                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {onPreviewPdf && (
                      <button
                        type="button"
                        onClick={() => onPreviewPdf(locale)}
                        disabled={isGeneratingPdf}
                        style={{
                          background: "var(--cam-surface, #ffffff)",
                          border: "1px solid var(--cam-border, #d8ddd3)",
                          borderRadius: "var(--cam-radius-sm, 4px)",
                          padding: "10px 18px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isGeneratingPdf ? "wait" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--cam-text, #0b1f14)",
                          opacity: isGeneratingPdf ? 0.7 : 1,
                        }}
                      >
                        <span>{isGeneratingPdf ? "⏳" : "📄"}</span>
                        <span>
                          {isGeneratingPdf
                            ? (locale === "fr" ? "Génération en cours..." : "Generating...")
                            : t("pdfPreview")}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCorriger}
                      style={{
                        background: "var(--cam-surface, #ffffff)",
                        border: "1px solid var(--cam-border, #d8ddd3)",
                        borderRadius: "var(--cam-radius-sm, 4px)",
                        padding: "10px 18px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--cam-text, #0b1f14)",
                      }}
                    >
                      <span>✏️</span>
                      <span>
                        {locale === "fr"
                          ? (validationIssues.length > 0 ? `Corriger (${validationIssues.length})` : "Corriger")
                          : (validationIssues.length > 0 ? `Edit (${validationIssues.length})` : "Edit")}
                      </span>
                    </button>

                    {onSubmitFinal && (
                      <button
                        type="button"
                        onClick={handleSubmitClick}
                        disabled={isSubmitting}
                        style={{
                          background: "var(--cam-green, #1e6b3a)",
                          border: "none",
                          color: "#ffffff",
                          borderRadius: "var(--cam-radius-sm, 4px)",
                          padding: "10px 24px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: isSubmitting ? "wait" : "pointer",
                          opacity: isSubmitting ? 0.7 : 1,
                          boxShadow: "0 2px 6px rgba(20, 74, 40, 0.25)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {isSubmitting ? (
                          t("submitting")
                        ) : (
                          <>
                            <span>👁️</span>
                            <span>{locale === "fr" ? "Vérifier & Soumettre" : "Review & Submit"}</span>
                            <span>→</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              currentSection && (
                <SectionRenderer
                  // Fresh instance per section: state (current table, deck index)
                  // starts clean on the first frame instead of rendering the old
                  // table and then snapping to table 1 a frame later.
                  key={currentSection.id}
                  section={currentSection}
                  data={data}
                  onChange={onChange}
                  issues={sectionIssues}
                  touchedFields={touchedFields}
                  onFieldTouch={handleFieldTouch}
                  attemptedContinue={attemptedContinue}
                  onOpenScope={handleSelectScope}
                  activeTableId={activeTableId}
                  onSelectTable={setActiveTableId}
                  onSectionComplete={handleNext}
                  onTableNavStateChange={setTableNavState}
                  sectionNavRef={sectionNavRef}
                  entryMode={entryMode}
                  onEntryModeChange={handleEntryModeChange}
                />
              )
            )}
          </div>
        </main>
      </div>

      {/* ── Sticky Bottom Navigation Bar ──
          Suppressed during the preliminary quiz (isScopeStage): EventQuestion
          (rendered inside EventFactInterview above) already has its own
          Précédent/Continuer pair at the bottom of the quiz card, wired to
          the same handlePrev/handleContinue logic via the onPrev/onContinue
          props passed down through ScopeConfigurationWizard. Rendering this
          bar too just duplicated it. */}
      {!submissionResult && !isScopeStage && !isValidationStage && (() => {
        const isTableSection = clampedSectionIndex >= 2 && !isValidationStage && !isScopeStage;
        const isTableDeckActive = Boolean(
          !isScopeStage && !isValidationStage && tableNavState?.hasMultiple && tableNavState?.isDeckFocus
        );

        let navStepIndicator: string | undefined = undefined;
        let navNextLabel: string | undefined = undefined;
        let navPrevLabel: string | undefined = undefined;

        if (isScopeStage) {
          navStepIndicator = t("stageQuiz");
          navNextLabel = t("continue");
          navPrevLabel = t("previous");
        } else if (isTableDeckActive && tableNavState) {
          // Extract official section number (e.g. "2" from "section2" or "SECTION 2...")
          const sectionNumMatch =
            currentSection?.id.match(/section(\d+)/i) ||
            (currentSection?.title ? localized(currentSection.title, locale).match(/section\s*(\d+)/i) : null);
          const officialSectionNum = sectionNumMatch ? sectionNumMatch[1] : String(clampedSectionIndex + 1);

          navStepIndicator = t(entryMode === "guided" ? "stepIndicatorGuided" : "stepIndicatorTable", {
            section: officialSectionNum,
            current: tableNavState.current,
            total: tableNavState.total,
          });

          const cleanTargetTitle = (raw?: string) => {
            if (!raw) return "";
            const trimmed = raw.trim();
            return trimmed.length > 28 ? trimmed.slice(0, 27) + "…" : trimmed;
          };

          if (tableNavState.current < tableNavState.total) {
            const nextTarget = cleanTargetTitle(tableNavState.nextTitle);
            navNextLabel = nextTarget
              ? t("continueTo", { target: nextTarget })
              : (entryMode === "guided" ? t("nextStep") : t("nextTable"));
          } else {
            navNextLabel =
              clampedSectionIndex < sections.length - 1
                ? t("nextSection")
                : t("reviewSubmit");
          }

          if (tableNavState.current > 1) {
            const prevTarget = cleanTargetTitle(tableNavState.prevTitle);
            navPrevLabel = prevTarget
              ? t("backTo", { target: prevTarget })
              : (entryMode === "guided" ? t("previousStep") : t("previousTable"));
          } else {
            navPrevLabel = t("previous");
          }
        }

        return (
          <ModernJobsNavigation
            currentSectionIndex={clampedSectionIndex}
            totalSections={sections.length}
            onPrev={handlePrev}
            onNext={handleNext}
            onSave={onSaveNow}
            saving={saving}
            isSubmitting={isSubmitting}
            canAdvance={canAdvance}
            isScopeStage={isScopeStage}
            isValidationStage={isValidationStage}
            isWideLayout={isTableSection}
            isDesktop={isDesktop}
            stepIndicator={navStepIndicator}
            nextLabel={navNextLabel}
            prevLabel={navPrevLabel}
          />
        );
      })()}
    </div>
  );
}
