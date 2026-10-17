"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";
import { getVtSectionShortLabel, isVtSectionComplete, vtWizardSectionStats } from "./vt-wizard-utils";
import { getZeroedTablesList } from "@/components/modern-jobs/scope/QuizSemantics";
import { vtSectionTableCounts } from "@/lib/vt-review-counts";
import { VtSectionAnswers } from "./VtSectionAnswers";
import { coherenceWarningText } from "@/lib/coherence-warning-text";
import type { CoherenceFlag } from "@/lib/onefop-submission";

/** The Validation heading, focused by WizardShell when this stage opens. */
export const VT_VALIDATION_HEADING_ID = "vt-validation-heading";

interface VtValidationScreenProps {
  entity: OnefopEntity;
  data: FormData;
  onOpenSection: (index: number) => void;
  onBack: () => void;
  onSaveDraft?: () => void;
  onSubmitFinal?: () => void;
  isSubmitting?: boolean;
  /**
   * False only when the backend has confirmed the collection period is
   * closed. Defaults to true so the submit button is never disabled while
   * GET /onefop/active-quarter is still in flight — same convention as
   * WizardShell's own canSubmit and ModernJobsWizard's.
   */
  canSubmit?: boolean;
  /** The backend's reason for the closure, shown under the banner title. */
  quarterStatusMessage?: string;
  /** The preliminary quiz, when it applies (absent for a closed centre). */
  quiz?: { isComplete: boolean; onOpen: () => void };
  /**
   * The server's advisory coherence flags for these answers (defect 25).
   * Asked before the review copy opens; flags are shown with a way to
   * correct them or to confirm and continue. Never blocking (§7): a failed
   * check lets the respondent continue.
   */
  checkCoherence?: () => Promise<CoherenceFlag[]>;
}

const COHERENCE_PANEL_ID = "vt-coherence-warnings";
/** The section a coherence rule sends the respondent back to: 8 for trainers, else 4. */
function coherenceSectionId(code: string): string {
  return code.startsWith("VT_TRAINER_") ? "section8_vocationalTraining" : "section4_vocationalTraining";
}

type SectionState = "notStarted" | "inProgress" | "done";

/** Whether any cell of the section's tables holds a value. */
function sectionHasTableData(section: OnefopSection, data: FormData): boolean {
  return section.fields.some((f) =>
    (f.table?.matrix ?? []).some((row) =>
      row.some((id) => data[id] !== undefined && data[id] !== null && data[id] !== ""),
    ),
  );
}

// Same counting as the sidebar (vt-wizard-utils): required, visible,
// non-table questions; tables are covered by the validator. A section a
// closed or non-functional centre does not answer counts as done, and so
// does a valid section made only of tables (Section 4: 0 questions) —
// isVtSectionComplete, the sidebar's own rule. Tables are counted apart
// (vtSectionTableCounts): counting questions only, Section 4 read "0 / 0".
function getSectionStats(section: OnefopSection, data: FormData) {
  const { filled, total } = vtWizardSectionStats(section, data);
  const issues = validateSectionData(section, data);
  const tables = vtSectionTableCounts(section, data, issues);

  let state: SectionState = "notStarted";
  if (isVtSectionComplete(section, data)) {
    state = "done";
  } else if (filled > 0 || (total === 0 && sectionHasTableData(section, data))) {
    state = "inProgress";
  }

  return {
    filled,
    total,
    tables,
    fraction: total + tables.total > 0 ? (filled + tables.complete) / (total + tables.total) : 0,
    state,
    issuesCount: issues.length,
  };
}

/**
 * Port of lib/screens/onefop/wizard/vt_wizard_validation_screen.dart:
 * - Confidentiality notice (Law N° 91/023)
 * - Incomplete warning banner when sections have missing required fields
 * - One row per section (name, status, counts, answers, change link)
 * - Navigation: Back to Section 9, Save draft, and one primary action that
 *   opens the review copy, where the declaration is finally submitted
 */
const SUBMIT_BLOCKED_ERRORS_ID = "vt-submit-blocked-errors";
const SUBMIT_BLOCKED_PERIOD_ID = "vt-submit-blocked-period";

export function VtValidationScreen({
  entity,
  data,
  onOpenSection,
  onBack,
  onSaveDraft,
  onSubmitFinal,
  isSubmitting = false,
  canSubmit = true,
  quarterStatusMessage,
  quiz,
  checkCoherence,
}: VtValidationScreenProps) {
  const t = useTranslations();
  const tDossier = useTranslations("adminDossierPage");
  // null: not checked for these answers yet; []: checked, nothing to report.
  const [coherenceFlags, setCoherenceFlags] = useState<CoherenceFlag[] | null>(null);
  const [checkingCoherence, setCheckingCoherence] = useState(false);
  const coherencePanelRef = useRef<HTMLDivElement | null>(null);
  // Answers changed: the flags shown no longer describe them.
  useEffect(() => setCoherenceFlags(null), [data]);
  useEffect(() => {
    if (coherenceFlags && coherenceFlags.length > 0) coherencePanelRef.current?.focus();
  }, [coherenceFlags]);

  const continueToSubmission = async () => {
    if (!onSubmitFinal) return;
    // Flags already shown for these answers: continuing is the confirmation.
    if (!checkCoherence || coherenceFlags !== null) {
      onSubmitFinal();
      return;
    }
    setCheckingCoherence(true);
    const flags = await checkCoherence().catch(() => [] as CoherenceFlag[]);
    setCheckingCoherence(false);
    if (flags.length === 0) {
      setCoherenceFlags([]);
      onSubmitFinal();
      return;
    }
    setCoherenceFlags(flags);
  };
  const showCoherence = !!coherenceFlags && coherenceFlags.length > 0;
  const locale = useLocale();
  const isFr = locale === "fr";
  const sections = entity.sections;

  const [showZeroedDetails, setShowZeroedDetails] = useState(false);
  const zeroedTables = useMemo(() => getZeroedTablesList(entity, data), [entity, data]);

  const sectionSummaries = useMemo(() => {
    return sections.map((sec, idx) => ({
      index: idx + 1,
      section: sec,
      stats: getSectionStats(sec, data),
    }));
  }, [sections, data]);

  const hasIncomplete = sectionSummaries.some((s) => s.stats.state !== "done");
  /** "12 / 14 questions · 8 / 11 tables", leaving out a part the section does not have. */
  const progressLine = (stats: ReturnType<typeof getSectionStats>) =>
    [
      stats.total > 0 ? t("vtValidationScreen.questionsProgress", { filled: stats.filled, total: stats.total }) : null,
      stats.tables.total > 0
        ? t("vtValidationScreen.tablesProgress", { complete: stats.tables.complete, total: stats.tables.total })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  // W1 fix: task-rail navigation can bypass sections entirely (goToSection has
  // no validation gate). Block final submission when any section still has
  // outstanding validation errors — this includes never-visited sections
  // whose required fields are all absent.
  // The preliminary quiz decides which tables apply: submission waits for it.
  const quizIncomplete = !!quiz && !quiz.isComplete;
  const hasErrors = quizIncomplete || sectionSummaries.some((s) => s.stats.issuesCount > 0);
  // Why Submit cannot proceed, if it cannot: errors first, then a closed
  // period (the one condition the respondent cannot fix by editing).
  const submitBlockedReasonId = hasErrors
    ? SUBMIT_BLOCKED_ERRORS_ID
    : !canSubmit
      ? SUBMIT_BLOCKED_PERIOD_ID
      : null;

  // Defect 15 (2026-10-16 run): a "check your answers" page, GOV.UK style.
  // One heading, plain notices, one row per section with its answers and a
  // change link, then one primary action. No eyebrows, accent rule, boxed
  // cards or progress bars.
  const secondaryButton = {
    height: "var(--cam-form-field-height)",
    padding: "0 20px",
    borderRadius: "var(--cam-radius-sm)",
    fontSize: "var(--cam-font-size-sm)",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid var(--cam-border)",
    background: "var(--cam-surface)",
    color: "var(--cam-text)",
    fontFamily: "var(--cam-font-sans)",
  } as const;
  const linkButton = {
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--cam-green-dark)",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "var(--cam-font-size-sm)",
    fontFamily: "var(--cam-font-sans)",
  } as const;
  const noticeStyle = {
    padding: "var(--cam-space-3) var(--cam-space-4)",
    borderRadius: "var(--cam-radius-sm)",
    fontSize: "var(--cam-font-size-sm)",
    color: "var(--cam-text)",
    marginBottom: "var(--cam-space-4)",
    lineHeight: 1.45,
  } as const;

  return (
    <div style={{ fontFamily: "var(--cam-font-sans)", paddingBottom: "var(--cam-space-7)" }}>
      <h1
        // Focus target of WizardShell when Validation opens (useStepFocus).
        id={VT_VALIDATION_HEADING_ID}
        tabIndex={-1}
        style={{
          fontSize: "22px",
          fontWeight: 700,
          color: "var(--cam-text)",
          margin: "0 0 var(--cam-space-3)",
          outline: "none",
        }}
      >
        {/* Not "Thank you": nothing is submitted yet (audit R1). */}
        {t("vtValidationScreen.checkAnswersTitle")}
      </h1>

      {/* Statistical secrecy: plain text, as the paper form prints it. */}
      <p style={{ margin: "0 0 var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--cam-text)" }}>{t("vtValidationScreen.confidentialityTitle")}.</strong>{" "}
        {t("vtValidationScreen.confidentialityText")}
      </p>

      {/* Tables the preliminary questionnaire zero-filled (D10 transparency). */}
      {zeroedTables.length > 0 && (
        <div style={{ margin: "0 0 var(--cam-space-5)", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)", lineHeight: 1.45 }}>
          {isFr
            ? `${zeroedTables.length} tableau(x) certifié(s) à néant (0) conformément au questionnaire préliminaire.`
            : `${zeroedTables.length} table(s) certified as null (0) according to the preliminary questionnaire.`}{" "}
          <button type="button" onClick={() => setShowZeroedDetails((prev) => !prev)} style={linkButton} aria-expanded={showZeroedDetails}>
            {showZeroedDetails
              ? isFr
                ? "Masquer le détail"
                : "Hide details"
              : isFr
                ? "Voir le détail"
                : "View details"}
          </button>
          {showZeroedDetails && (
            <ul style={{ margin: "var(--cam-space-2) 0 0", paddingLeft: "var(--cam-space-5)" }}>
              {zeroedTables.map((t) => (
                <li key={t.code || t.tableId} style={{ marginTop: "var(--cam-space-1)" }}>
                  <strong>{t.code || t.tableId}</strong>: {isFr ? t.nameFr : t.nameEn}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Validation error banner — blocks submission (W1 fix) */}
      {hasErrors && (
        <div
          id={SUBMIT_BLOCKED_ERRORS_ID}
          tabIndex={-1}
          style={{ ...noticeStyle, background: "var(--cam-error-bg)", border: "1px solid var(--cam-error-border)" }}
        >
          {t("vtValidationScreen.errorsBlockingSubmit")}
        </div>
      )}

      {quizIncomplete && (
        <div role="alert" style={{ ...noticeStyle, background: "var(--cam-error-bg)", border: "1px solid var(--cam-error-border)" }}>
          {isFr
            ? "Le questionnaire préliminaire n'est pas terminé : il détermine les tableaux à renseigner."
            : "The preliminary questionnaire is not finished: it decides which tables to fill."}{" "}
          <button type="button" onClick={quiz!.onOpen} style={{ ...linkButton, color: "inherit", fontWeight: 600 }}>
            {isFr ? "Ouvrir le questionnaire préliminaire" : "Open the preliminary questionnaire"}
          </button>
        </div>
      )}

      {/* Collection period closed — warns here and disables the submit
          button below, matching the treatment ModernJobsWizard already gives
          non-VT flows. Rendered above the advisory notice because it is the
          one condition the respondent cannot resolve by editing the form. */}
      {!canSubmit && (
        <div
          id={SUBMIT_BLOCKED_PERIOD_ID}
          tabIndex={-1}
          style={{ ...noticeStyle, background: "var(--cam-notice-surface)", border: "1px solid var(--cam-gold)" }}
        >
          <div style={{ fontWeight: 600 }}>{t("vtValidationScreen.periodClosedTitle")}</div>
          {quarterStatusMessage && (
            <div style={{ marginTop: "var(--cam-space-1)", color: "var(--cam-text-muted)" }}>{quarterStatusMessage}</div>
          )}
        </div>
      )}

      {/* Incomplete notice (advisory only — does not block) */}
      {!hasErrors && hasIncomplete && (
        <div style={{ ...noticeStyle, background: "var(--cam-notice-surface)", border: "1px solid var(--cam-gold)" }}>
          {t("vtValidationScreen.incompleteWarning")}
        </div>
      )}

      {/* Advisory coherence flags (§7): shown, never blocking. */}
      {showCoherence && (
        <div
          id={COHERENCE_PANEL_ID}
          ref={coherencePanelRef}
          tabIndex={-1}
          role="region"
          aria-labelledby={`${COHERENCE_PANEL_ID}-title`}
          style={{ ...noticeStyle, background: "var(--cam-notice-surface)", border: "1px solid var(--cam-gold)", outline: "none" }}
        >
          <h2 id={`${COHERENCE_PANEL_ID}-title`} style={{ margin: "0 0 var(--cam-space-2)", fontSize: "15px", fontWeight: 600 }}>
            {t("vtValidationScreen.coherence.title")}
          </h2>
          <p style={{ margin: "0 0 var(--cam-space-3)" }}>{t("vtValidationScreen.coherence.intro")}</p>
          <ul style={{ margin: 0, paddingLeft: "var(--cam-space-5)", display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
            {coherenceFlags!.map((flag, i) => {
              const sectionIndex = sections.findIndex((sec) => sec.id === coherenceSectionId(flag.code));
              return (
                <li key={`${flag.code}-${i}`}>
                  {coherenceWarningText(tDossier, flag.code, flag.message)}{" "}
                  {sectionIndex >= 0 && (
                    <button type="button" onClick={() => onOpenSection(sectionIndex)} style={linkButton}>
                      {t("vtValidationScreen.coherence.correct")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* One row per section: name, status, counts, answers, change link. */}
      <ol style={{ listStyle: "none", margin: "0 0 var(--cam-space-6)", padding: 0, borderBottom: "1px solid var(--cam-border)" }}>
        {sectionSummaries.map(({ index, section, stats }) => (
          <li key={section.id} style={{ borderTop: "1px solid var(--cam-border)", padding: "var(--cam-space-4) 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "var(--cam-space-2) var(--cam-space-4)" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--cam-text)" }}>
                {t("vtValidationScreen.sectionLabel", {
                  number: index,
                  name: getVtSectionShortLabel(section.id, locale) ?? localized(section.title, locale.startsWith("en") ? "en" : "fr"),
                })}
              </h2>
              <span
                style={{
                  fontSize: "var(--cam-font-size-sm)",
                  fontWeight: 600,
                  color:
                    stats.state === "done"
                      ? "var(--cam-green)"
                      : stats.state === "inProgress"
                        ? "var(--cam-notice-text)"
                        : "var(--cam-text-muted)",
                }}
              >
                {stats.state === "done"
                  ? t("vtValidationScreen.badgeCompleted")
                  : stats.state === "inProgress"
                    ? t("vtValidationScreen.badgeInProgress")
                    : t("vtValidationScreen.badgeNotStarted")}
              </span>
            </div>
            <div style={{ marginTop: "var(--cam-space-1)", fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text-muted)" }}>
              {progressLine(stats)}
              {stats.issuesCount > 0 && (
                <span style={{ color: "var(--cam-error)", fontWeight: 600 }}>
                  {progressLine(stats) ? " · " : ""}
                  {t("vtValidationScreen.issuesCount", { count: stats.issuesCount })}
                </span>
              )}
            </div>
            <div style={{ marginTop: "var(--cam-space-2)", display: "flex", flexWrap: "wrap", gap: "var(--cam-space-2) var(--cam-space-5)", alignItems: "flex-start" }}>
              {/* The answers themselves, read-only (defect 3 of 2026-10-15). */}
              <details style={{ flex: "1 1 320px", minWidth: 0 }}>
                <summary style={{ cursor: "pointer", color: "var(--cam-green-dark)", fontSize: "var(--cam-font-size-sm)" }}>
                  {t("vtValidationScreen.answers.show")}
                </summary>
                <div style={{ paddingTop: "var(--cam-space-3)" }}>
                  <VtSectionAnswers entity={entity} section={section} data={data} />
                </div>
              </details>
              <button type="button" onClick={() => onOpenSection(index - 1)} style={linkButton}>
                {t("vtValidationScreen.answers.change")}
              </button>
            </div>
          </li>
        ))}
      </ol>

      {/* Actions: Back and Save draft are secondary; one primary action. */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--cam-space-3)" }}>
        <button type="button" onClick={onBack} style={secondaryButton}>
          ← {t("vtValidationScreen.backButton")}
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--cam-space-3)" }}>
          {onSaveDraft && (
            <button type="button" onClick={onSaveDraft} style={secondaryButton}>
              {t("vtValidationScreen.saveDraftButton")}
            </button>
          )}
          {onSubmitFinal && (
            <button
              type="button"
              // Blocked, not disabled: a disabled button cannot be focused, so a
              // keyboard or screen-reader user could not learn why it does not
              // work. It stays reachable, is described by the reason, and
              // pressing it moves focus to that reason.
              onClick={() => {
                if (submitBlockedReasonId) {
                  const reason = document.getElementById(submitBlockedReasonId);
                  reason?.scrollIntoView({ block: "center" });
                  reason?.focus({ preventScroll: true });
                  return;
                }
                void continueToSubmission();
              }}
              disabled={isSubmitting || checkingCoherence}
              aria-disabled={submitBlockedReasonId ? true : undefined}
              aria-describedby={submitBlockedReasonId ?? undefined}
              style={{
                ...secondaryButton,
                padding: "0 32px",
                cursor: isSubmitting || hasErrors || !canSubmit ? "not-allowed" : "pointer",
                border: "none",
                background: "var(--cam-green)",
                color: "var(--cam-surface)",
                opacity: isSubmitting || hasErrors || !canSubmit ? 0.55 : 1,
              }}
            >
              {isSubmitting
                ? t("vtValidationScreen.submitting")
                : checkingCoherence
                  ? t("vtValidationScreen.coherence.checking")
                  : showCoherence
                    ? t("vtValidationScreen.coherence.confirmButton")
                    : t("vtValidationScreen.continueButton")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
