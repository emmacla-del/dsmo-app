"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FormData, OnefopEntity, OnefopSection } from "@/lib/onefop-schema";
import { isVtSectionWaived, localized } from "@/lib/onefop-schema";
import { validateSectionData } from "@/lib/onefop-validation";
import { getVtSectionShortLabel, vtWizardSectionStats } from "./vt-wizard-utils";
import { getZeroedTablesList } from "@/components/modern-jobs/scope/QuizSemantics";

/** The Validation heading, focused by WizardShell when this stage opens. */
export const VT_VALIDATION_HEADING_ID = "vt-validation-heading";

interface VtValidationScreenProps {
  entity: OnefopEntity;
  data: FormData;
  onOpenSection: (index: number) => void;
  onBack: () => void;
  onPreviewPdf?: () => void;
  isGeneratingPdf?: boolean;
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
}

type SectionState = "notStarted" | "inProgress" | "done";

// Same counting as the sidebar (vt-wizard-utils): required, visible,
// non-table questions; tables are covered by the validator. A section a
// closed or non-functional centre does not answer counts as done.
function getSectionStats(section: OnefopSection, data: FormData) {
  const { filled, total } = vtWizardSectionStats(section, data);
  const issues = validateSectionData(section, data);
  const isValid = issues.length === 0;

  let state: SectionState = "notStarted";
  if (isVtSectionWaived(section.id, data) || (isValid && filled === total && total > 0)) {
    state = "done";
  } else if (filled > 0) {
    state = "inProgress";
  }

  return {
    filled,
    total,
    fraction: total > 0 ? filled / total : 0,
    state,
    issuesCount: issues.length,
  };
}

/**
 * Port of lib/screens/onefop/wizard/vt_wizard_validation_screen.dart:
 * - Confidentiality notice (Law N° 91/023)
 * - Incomplete warning banner when sections have missing required fields
 * - 9-section status card grid (SECTION N, label, badge, filled/total progress)
 * - Navigation: Return to Section 9 or proceed to PDF review & final submission
 */
const SUBMIT_BLOCKED_ERRORS_ID = "vt-submit-blocked-errors";
const SUBMIT_BLOCKED_PERIOD_ID = "vt-submit-blocked-period";

export function VtValidationScreen({
  entity,
  data,
  onOpenSection,
  onBack,
  onPreviewPdf,
  isGeneratingPdf = false,
  onSaveDraft,
  onSubmitFinal,
  isSubmitting = false,
  canSubmit = true,
  quarterStatusMessage,
  quiz,
}: VtValidationScreenProps) {
  const t = useTranslations();
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

  return (
    <div style={{ fontFamily: "var(--cam-font-sans)", paddingBottom: "var(--cam-space-7)" }}>
      {/* Title */}
      <div
        style={{
          borderLeft: "4px solid var(--cam-green-dark)",
          paddingLeft: "var(--cam-space-3, 12px)",
          borderBottom: "1px solid var(--cam-border)",
          paddingBottom: "var(--cam-space-2, 8px)",
          marginBottom: "var(--cam-space-5, 20px)",
        }}
      >
        <h2
          // Focus target of WizardShell when Validation opens (useStepFocus).
          id={VT_VALIDATION_HEADING_ID}
          tabIndex={-1}
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "var(--cam-text)",
            margin: 0,
            letterSpacing: "-0.01em",
            outline: "none",
          }}
        >
          {t("vtValidationScreen.thankYouTitle")}
        </h2>
      </div>

      {/* Confidentiality Notice */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
          background: "var(--cam-success-bg)",
          border: "1px solid var(--cam-border)",
          borderRadius: "var(--cam-radius-md)",
          padding: "16px 20px",
          marginBottom: "var(--cam-space-4)",
        }}
      >
        <span style={{ fontSize: "20px", color: "var(--cam-green)", lineHeight: 1 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--cam-font-size-sm)", color: "var(--cam-green)", marginBottom: "4px" }}>
            {t("vtValidationScreen.confidentialityTitle")}
          </div>
          <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text)", lineHeight: 1.5 }}>
            {t("vtValidationScreen.confidentialityText")}
          </div>
        </div>
      </div>

      {/* Zeroed Tables Summary Notice (D10 Transparency) */}
      {zeroedTables.length > 0 && (
        <div
          style={{
            background: "var(--cam-success-surface)",
            border: "1px solid var(--cam-success-border-soft)",
            borderRadius: "var(--cam-radius-md)",
            padding: "14px 18px",
            fontSize: "13.5px",
            color: "var(--cam-success-text-strong)",
            marginBottom: "var(--cam-space-4)",
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>
              ℹ️{" "}
              <strong>
                {isFr
                  ? `${zeroedTables.length} tableau(x) certifié(s) à néant (0) conformément au questionnaire préliminaire.`
                  : `${zeroedTables.length} table(s) certified as null (0) according to preliminary scoping answers.`}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowZeroedDetails((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--cam-success-link)",
                fontWeight: 600,
                fontSize: "var(--cam-font-size-2xs)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showZeroedDetails
                ? isFr
                  ? "Masquer le détail"
                  : "Hide details"
                : isFr
                  ? "Voir le détail"
                  : "View details"}
            </button>
          </div>
          {showZeroedDetails && (
            <ul style={{ margin: "8px 0 0 16px", padding: 0, fontSize: 12, color: "var(--cam-success-text-deep)" }}>
              {zeroedTables.map((t) => (
                <li key={t.code || t.tableId} style={{ marginTop: 3 }}>
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
          style={{
            background: "rgba(192, 57, 43, 0.06)",
            border: "1px solid rgba(192, 57, 43, 0.35)",
            borderRadius: "var(--cam-radius-md)",
            padding: "14px 18px",
            fontSize: "13.5px",
            color: "var(--cam-text)",
            marginBottom: "var(--cam-space-4)",
            lineHeight: 1.4,
          }}
        >
          {t("vtValidationScreen.errorsBlockingSubmit")}
        </div>
      )}

      {quizIncomplete && (
        <div
          role="alert"
          style={{
            marginBottom: "var(--cam-space-4)",
            padding: "var(--cam-space-3)",
            background: "var(--cam-error-bg)",
            border: "1px solid var(--cam-error-border)",
            borderRadius: "var(--cam-radius-sm)",
            color: "var(--cam-error)",
            fontSize: "var(--cam-font-size-sm)",
          }}
        >
          {isFr
            ? "Le questionnaire préliminaire n'est pas terminé : il détermine les tableaux à renseigner."
            : "The preliminary questionnaire is not finished: it decides which tables to fill."}
          <button
            type="button"
            onClick={quiz!.onOpen}
            style={{ marginLeft: 8, background: "none", border: "none", padding: 0, color: "inherit", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}
          >
            {isFr ? "Ouvrir le questionnaire préliminaire" : "Open the preliminary questionnaire"}
          </button>
        </div>
      )}

      {/* Collection period closed — warns here and disables the submit
          button below, matching the treatment ModernJobsWizard already gives
          non-VT flows. Rendered above the advisory banners because it is the
          one condition the respondent cannot resolve by editing the form. */}
      {!canSubmit && (
        <div
          id={SUBMIT_BLOCKED_PERIOD_ID}
          tabIndex={-1}
          style={{
            background: "rgba(230, 81, 0, 0.08)",
            border: "1px solid rgba(230, 81, 0, 0.3)",
            borderRadius: "var(--cam-radius-md)",
            padding: "14px 18px",
            fontSize: "13.5px",
            color: "var(--cam-text)",
            marginBottom: "var(--cam-space-4)",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700 }}>{t("vtValidationScreen.periodClosedTitle")}</div>
            {quarterStatusMessage && (
              <div style={{ marginTop: "2px", color: "var(--cam-text-muted)" }}>{quarterStatusMessage}</div>
            )}
          </div>
        </div>
      )}

      {/* Incomplete Warning if any (advisory only — does not block) */}
      {!hasErrors && hasIncomplete && (
        <div
          style={{
            background: "rgba(232, 160, 32, 0.08)",
            border: "1px solid var(--cam-gold)",
            borderRadius: "var(--cam-radius-md)",
            padding: "14px 18px",
            fontSize: "13.5px",
            color: "var(--cam-text)",
            marginBottom: "var(--cam-space-6)",
            lineHeight: 1.4,
          }}
        >
          {t("vtValidationScreen.incompleteWarning")}
        </div>
      )}

      {/* Summary Header */}
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--cam-text-muted)",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          marginBottom: "var(--cam-space-3)",
        }}
      >
        {t("vtValidationScreen.summaryHeader")}
      </div>

      {/* 9-Section Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "14px",
          marginBottom: "var(--cam-space-6)",
        }}
      >
        {sectionSummaries.map(({ index, section, stats }) => {
          const isHighlighted = stats.state !== "notStarted";
          const borderColor =
            stats.state === "done"
              ? "var(--cam-green)"
              : isHighlighted
                ? "var(--cam-border-strong)"
                : "var(--cam-border)";

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onOpenSection(index - 1)}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                textAlign: "left",
                background: "var(--cam-surface)",
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--cam-radius-md)",
                padding: "14px 16px",
                cursor: "pointer",
                boxShadow: "var(--cam-shadow-row)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--cam-green)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = borderColor;
                e.currentTarget.style.boxShadow = "var(--cam-shadow-row)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", marginBottom: "10px" }}>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isHighlighted ? "var(--cam-green)" : "var(--cam-text-muted)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {t("vtValidationScreen.sectionLabel", { number: index })}
                  </div>
                  <div
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 700,
                      color: "var(--cam-text)",
                      marginTop: "2px",
                      maxWidth: "260px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getVtSectionShortLabel(section.id, locale) ?? localized(section.title, locale.startsWith("en") ? "en" : "fr")}
                  </div>
                </div>

                {/* Badge */}
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "var(--cam-radius-sm)",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    background:
                      stats.state === "done"
                        ? "var(--cam-success-bg)"
                        : stats.state === "inProgress"
                        ? "var(--cam-notice-surface)"
                        : "var(--cam-bg)",
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

              {/* Progress bar and champ count */}
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "var(--cam-text-muted)",
                    marginBottom: "4px",
                  }}
                >
                  <span>
                    {t("vtValidationScreen.fieldsProgress", { filled: stats.filled, total: stats.total })}
                  </span>
                  {stats.issuesCount > 0 && (
                    <span style={{ color: "var(--cam-error)", fontWeight: 600 }}>
                      {t("vtValidationScreen.issuesCount", { count: stats.issuesCount })}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    background: "var(--cam-border)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(stats.fraction * 100)}%`,
                      height: "100%",
                      background: stats.state === "done" ? "var(--cam-green)" : "var(--cam-gold)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation and Action Bar — Back alone on the left, Preview + Save
          Draft as a secondary pair, Submit as the large primary action
          below, matching vt_wizard_validation_screen.dart's layout. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--cam-space-5)",
          paddingTop: "var(--cam-space-5)",
          borderTop: "1px solid var(--cam-border)",
        }}
      >
        <div style={{ width: "100%", display: "flex" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              height: "var(--cam-form-field-height)",
              padding: "0 20px",
              borderRadius: "var(--cam-radius-sm)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--cam-border)",
              background: "var(--cam-surface)",
              color: "var(--cam-text)",
              fontFamily: "var(--cam-font-sans)",
            }}
          >
            ← {t("vtValidationScreen.backButton")}
          </button>
        </div>

        {(onPreviewPdf || onSaveDraft) && (
          <div style={{ display: "flex", gap: "var(--cam-space-3)" }}>
            {onPreviewPdf && (
              <button
                type="button"
                onClick={onPreviewPdf}
                disabled={isGeneratingPdf}
                style={{
                  height: "var(--cam-form-field-height)",
                  padding: "0 20px",
                  borderRadius: "var(--cam-radius-sm)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isGeneratingPdf ? "wait" : "pointer",
                  border: "1px solid var(--cam-border)",
                  background: "var(--cam-surface)",
                  color: "var(--cam-text)",
                  fontFamily: "var(--cam-font-sans)",
                  opacity: isGeneratingPdf ? 0.7 : 1,
                }}
              >
                {isGeneratingPdf ? "⏳ " : "📄 "}
                {isGeneratingPdf
                  ? (locale.startsWith("en") ? "Generating..." : "Génération en cours...")
                  : t("vtValidationScreen.previewPdfButton")}
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenSection(0)}
              style={{
                height: "var(--cam-form-field-height)",
                padding: "0 20px",
                borderRadius: "var(--cam-radius-sm)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--cam-border)",
                background: "var(--cam-surface)",
                color: "var(--cam-text)",
                fontFamily: "var(--cam-font-sans)",
              }}
            >
              ✏️ {locale.startsWith("en") ? "Edit" : "Corriger"}
            </button>

            {onSaveDraft && (
              <button
                type="button"
                onClick={onSaveDraft}
                style={{
                  height: "var(--cam-form-field-height)",
                  padding: "0 20px",
                  borderRadius: "var(--cam-radius-sm)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--cam-border)",
                  background: "var(--cam-surface)",
                  color: "var(--cam-text)",
                  fontFamily: "var(--cam-font-sans)",
                }}
              >
                💾 {t("vtValidationScreen.saveDraftButton")}
              </button>
            )}
          </div>
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
              onSubmitFinal();
            }}
            disabled={isSubmitting}
            aria-disabled={submitBlockedReasonId ? true : undefined}
            aria-describedby={submitBlockedReasonId ?? undefined}
            style={{
              height: "var(--cam-form-field-height)",
              padding: "0 48px",
              borderRadius: "var(--cam-radius-sm)",
              fontSize: 15,
              fontWeight: 600,
              cursor: isSubmitting || hasErrors || !canSubmit ? "not-allowed" : "pointer",
              border: "none",
              background: "var(--cam-green)",
              color: "var(--cam-surface)",
              fontFamily: "var(--cam-font-sans)",
              opacity: isSubmitting || hasErrors || !canSubmit ? 0.55 : 1,
            }}
          >
            {isSubmitting ? (
              t("vtValidationScreen.submitting")
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span>👁️</span>
                <span>{locale.startsWith("en") ? "Review & Submit" : "Vérifier & Soumettre"}</span>
                <span>→</span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
