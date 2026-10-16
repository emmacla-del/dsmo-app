"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { NOT_PROVIDED, stamp } from "@/lib/admin-data-state";
import { entityTypeDisplayName, referencePeriodLabel, referencePeriodPhrases } from "@/lib/onefop-period-label";

export interface OnefopSubmissionSuccessProps {
  /** Raw result message string, often in format "Déclaration enregistrée avec succès (ID: 12345)" */
  rawResult?: string | null;
  /**
   * The submission reference the server returned (OnefopSubmission.submissionId,
   * the one staff search by). Pass it whenever the submit response is at hand.
   */
  submissionId?: string | null;
  /** Entity type (enterprise, vocationalTraining, cooperative, ctd, etc.) */
  entityType?: string;
  /** Entity/establishment name (e.g. ACME Corp) */
  establishmentName?: string;
  /** Tax ID / NIU */
  niu?: string;
  /** Reference period code (e.g. "QUARTERLY_2026_T4_001") */
  quarterCode?: string;
  /** Submission date/time; now when absent (the receipt shows right after submitting). */
  submittedAt?: Date | string;
  /** Language of the period wording; the rest follows the interface language. */
  locale?: "fr" | "en";
  /** Downloads a PDF copy of the answers sent. */
  onDownloadPdf?: () => void;
  /** While that PDF is being prepared. */
  isGeneratingPdf?: boolean;
  onPrint?: () => void;
  /** Leaves the wizard for the respondent's home. */
  onReturnToDashboard?: () => void;
  /** Shows or hides the answers sent, below the receipt. */
  onToggleReview?: () => void;
  isReviewing?: boolean;
}

/**
 * Confirmation shown once a declaration is submitted.
 *
 * At this moment the declaration is received and awaiting ONEFOP's review,
 * nothing more, so that is all the receipt says. It used to say the
 * declaration was "validated by the system", call itself a "valid receipt"
 * and "proof for inspection", cite the Labour Inspectorate and the CNPS, and
 * quote a thank-you signed by the ONEFOP Directorate. None of that was true
 * before review or signed off by MINEFOP; it is gone until MINEFOP approves
 * a wording (defect 2 of the 2026-10-15 VT run).
 */
export function OnefopSubmissionSuccess({
  rawResult,
  submissionId: explicitSubmissionId,
  entityType = "enterprise",
  establishmentName,
  niu,
  quarterCode = "",
  submittedAt,
  locale = "fr",
  onDownloadPdf,
  isGeneratingPdf = false,
  onPrint,
  onReturnToDashboard,
  onToggleReview,
  isReviewing = false,
}: OnefopSubmissionSuccessProps) {
  const t = useTranslations("onefopReceipt");
  const periodLabel = referencePeriodLabel(quarterCode, locale);
  const periodPhrases = referencePeriodPhrases(quarterCode, locale);

  // The reference the server returned. Read from the result message only as a
  // fallback for a caller that does not pass it. Never invented: a reference
  // a declarant may quote to MINEFOP must exist in the register, so an absent
  // one shows as absent.
  const reference = useMemo(() => {
    if (explicitSubmissionId) return explicitSubmissionId;
    const match = rawResult ? /\b(?:ID|id):\s*([a-zA-Z0-9_-]+)/i.exec(rawResult) : null;
    return match && match[1] !== "undefined" && match[1] !== "null" ? match[1] : null;
  }, [explicitSubmissionId, rawResult]);

  // Captured once, when the receipt first shows.
  const when = useMemo(() => (submittedAt ? new Date(submittedAt) : new Date()).toISOString(), [submittedAt]);

  const rows: [string, string][] = [
    [t("reference"), reference ?? NOT_PROVIDED],
    [t("submittedOn"), stamp(when, true, locale)],
    [t("period"), periodLabel || NOT_PROVIDED],
    [t("questionnaire"), entityTypeDisplayName(entityType, locale)],
    [t("establishment"), establishmentName || NOT_PROVIDED],
    ...(niu ? ([[t("niu"), niu]] as [string, string][]) : []),
    [t("status"), t("statusPending")],
  ];

  const print = () => {
    if (onPrint) onPrint();
    else if (typeof window !== "undefined") window.print();
  };

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--cam-space-5)",
        maxWidth: "var(--cam-container-wizard)",
        margin: "0 auto",
        padding: "var(--cam-space-6) 0",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--cam-font-size-xl)" }}>{t("title")}</h2>
        <p style={{ margin: 0 }}>
          {periodPhrases ? t("receivedFor", { period: periodPhrases.forPeriod }) : t("received")}
        </p>
      </div>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
          gap: "var(--cam-space-2) var(--cam-space-4)",
          margin: 0,
        }}
      >
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={{ color: "var(--cam-text-muted)" }}>{label}</dt>
            <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
          </div>
        ))}
      </dl>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--cam-space-2)" }}>
        <h3 style={{ margin: 0, fontSize: "var(--cam-font-size-lg)" }}>{t("nextTitle")}</h3>
        <ul style={{ margin: 0, paddingInlineStart: "var(--cam-space-5)" }}>
          <li>{t("nextReview")}</li>
          <li>{t("nextFollow")}</li>
          <li>{t("nextCorrection")}</li>
        </ul>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--cam-space-3)" }}>
        {onReturnToDashboard && (
          <button type="button" className="cam-button cam-button-primary" onClick={onReturnToDashboard}>
            {t("home")}
          </button>
        )}
        {onDownloadPdf && (
          <button
            type="button"
            className="cam-button cam-button-secondary"
            onClick={onDownloadPdf}
            disabled={isGeneratingPdf}
          >
            {isGeneratingPdf ? t("downloading") : t("download")}
          </button>
        )}
        <button type="button" className="cam-text-button" onClick={print}>
          {t("print")}
        </button>
        {onToggleReview && (
          <button type="button" className="cam-text-button" onClick={onToggleReview}>
            {isReviewing ? t("hideAnswers") : t("showAnswers")}
          </button>
        )}
      </div>
    </section>
  );
}
