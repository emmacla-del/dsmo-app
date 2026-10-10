"use client";

import React, { useMemo } from "react";
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
  /** Reference quarter code (e.g. "2026-T1") */
  quarterCode?: string;
  /** Submission date/time */
  submittedAt?: Date | string;
  /** UI language */
  locale?: "fr" | "en";
  /** Callback to trigger official PDF download */
  onDownloadPdf?: () => void;
  /** Loading state for PDF generation */
  isGeneratingPdf?: boolean;
  /** Callback to trigger print */
  onPrint?: () => void;
  /** Callback to return to dashboard or exit wizard */
  onReturnToDashboard?: () => void;
  /** Optional secondary toggle to review submitted data */
  onToggleReview?: () => void;
  /** Whether the user is viewing the review drawer/accordion */
  isReviewing?: boolean;
}

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
  const isFr = locale === "fr";
  // The campaign's own period: a declaration may be quarterly, half-yearly or
  // annual (the training-centre census), so the copy never assumes a quarter.
  const periodLabel = referencePeriodLabel(quarterCode, locale);
  const periodPhrases = referencePeriodPhrases(quarterCode, locale);

  // The reference the server returned. Read from the result message only as a
  // fallback for a caller that does not pass it. Never invented: a reference
  // a declarant may quote to MINEFOP must exist in the register, so an absent
  // one shows as absent. (It used to fall back to "ONEFOP-SUB-<time>", a slug
  // of the message, or "ONEFOP-REF-VALID".)
  const effectiveSubmissionId = useMemo(() => {
    if (explicitSubmissionId) return explicitSubmissionId;
    const match = rawResult ? /\b(?:ID|id):\s*([a-zA-Z0-9_-]+)/i.exec(rawResult) : null;
    return match && match[1] !== "undefined" && match[1] !== "null" ? match[1] : null;
  }, [explicitSubmissionId, rawResult]);

  // Formatted date
  const formattedDate = useMemo(() => {
    const d = submittedAt ? new Date(submittedAt) : new Date();
    try {
      return new Intl.DateTimeFormat(isFr ? "fr-CM" : "en-CM", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(d);
    } catch {
      // The shared formatter, in the receipt's language, if Intl rejects fr-CM / en-CM.
      return stamp(d.toISOString(), true, isFr ? "fr" : "en");
    }
  }, [submittedAt, isFr]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full max-w-3xl mx-auto my-4 sm:my-8 bg-[var(--cam-surface)] rounded-2xl border border-[var(--cam-border)] shadow-lg overflow-hidden transition-all text-[var(--cam-text)]"
      style={{
        boxShadow: "0 10px 30px -5px rgba(20, 74, 40, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Official Header Banner (Republic of Cameroon / MINEFOP Branding) */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{
          background: "linear-gradient(135deg, #123d24 0%, #1e6b3a 65%, #0f331e 100%)",
          color: "#ffffff",
          borderColor: "rgba(0, 0, 0, 0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold shadow-xs select-none"
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
            }}
            aria-hidden="true"
          >
            🇨🇲
          </div>
          <div>
            <div
              className="text-[11px] font-semibold tracking-wide uppercase"
              style={{ color: "rgba(255, 255, 255, 0.82)" }}
            >
              {isFr ? "République du Cameroun • MINEFOP" : "Republic of Cameroon • MINEFOP"}
            </div>
            <div className="text-sm sm:text-base font-bold tracking-tight text-white">
              {isFr
                ? "Observatoire National de l'Emploi et de la Formation Professionnelle (ONEFOP)"
                : "National Employment and Vocational Training Observatory (ONEFOP)"}
            </div>
          </div>
        </div>

        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs border"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            borderColor: "rgba(255, 255, 255, 0.3)",
            color: "#ffffff",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          <span>{isFr ? "Dépôt Enregistré" : "Filing Recorded"}</span>
        </div>
      </div>

      <div className="p-6 sm:p-10 space-y-8">
        {/* Feedback Section: Badge + Header + Subtitle */}
        <div className="text-center space-y-3">
          <div className="relative inline-flex items-center justify-center mb-1">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg text-white"
              style={{
                background: "linear-gradient(135deg, #1e6b3a 0%, #15572e 100%)",
                boxShadow: "0 8px 24px -4px rgba(30, 107, 58, 0.4)",
              }}
            >
              <svg className="w-10 h-10 stroke-current" fill="none" strokeWidth="2.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--cam-text)]">
            {isFr ? "Déclaration Soumise avec Succès !" : "Declaration Successfully Submitted!"}
          </h2>

          <p className="text-sm sm:text-base text-[var(--cam-text-muted)] max-w-xl mx-auto leading-relaxed">
            {isFr
              ? `Votre déclaration statistique${periodPhrases ? ` ${periodPhrases.forPeriod}` : ""} a été validée par le système et transmise avec succès aux services du MINEFOP.`
              : `Your statistical declaration${periodPhrases ? ` ${periodPhrases.forPeriod}` : ""} has been validated by the system and successfully transmitted to MINEFOP services.`}
          </p>

          {/* Reference Badge Card */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <div
              className="px-4 py-2.5 rounded-xl border text-left shadow-xs"
              style={{
                background: "var(--cam-success-bg)",
                borderColor: "rgba(30, 107, 58, 0.25)",
              }}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--cam-green)]">
                {isFr ? "Identifiant officiel de dépôt" : "Official Filing Reference ID"}
              </span>
              <span className="font-mono text-sm sm:text-base font-extrabold text-[var(--cam-green-dark)] select-all">
                {effectiveSubmissionId ?? NOT_PROVIDED}
              </span>
            </div>

            <div
              className="px-4 py-2.5 rounded-xl border text-left shadow-xs"
              style={{
                background: "var(--cam-bg)",
                borderColor: "var(--cam-border)",
              }}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--cam-text-muted)]">
                {isFr ? "Date & Heure d'enregistrement" : "Registration Date & Time"}
              </span>
              <span className="text-sm font-semibold text-[var(--cam-text)]">
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Institutional Appreciation Card */}
        <div
          className="rounded-2xl border p-5 sm:p-6 shadow-xs relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(254, 249, 231, 0.95) 0%, rgba(240, 253, 244, 0.95) 100%)",
            borderColor: "rgba(200, 157, 45, 0.4)",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="space-y-2.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#634806] flex items-center gap-2">
                  <span>{isFr ? "Message de Remerciements & Reconnaissance Civique" : "Appreciation Message & Civic Recognition"}</span>
                </h3>
                <span
                  className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wide"
                  style={{
                    background: "rgba(200, 157, 45, 0.15)",
                    borderColor: "rgba(200, 157, 45, 0.4)",
                    color: "#634806",
                  }}
                >
                  {isFr ? "Officiel MINEFOP" : "Official MINEFOP"}
                </span>
              </div>

              <blockquote
                className="text-xs sm:text-sm leading-relaxed italic pl-3 border-l-2 text-[#3b3014]"
                style={{ borderColor: "rgba(200, 157, 45, 0.7)" }}
              >
                {isFr
                  ? "« Le Ministère de l'Emploi et de la Formation Professionnelle (MINEFOP) et l'Observatoire National (ONEFOP) vous remercient chaleureusement pour votre engagement citoyen et votre collaboration exemplaire. Les informations renseignées par votre structure constituent un levier stratégique pour mesurer la vitalité de notre marché du travail, anticiper les compétences d'avenir et bâtir des politiques publiques inclusives et adaptées aux réalités de nos bassins d'emploi. »"
                  : "“The Ministry of Employment and Vocational Training (MINEFOP) and the National Employment and Vocational Training Observatory (ONEFOP) warmly thank you for your civic commitment and exemplary collaboration. The data provided by your organization serves as a strategic cornerstone to assess labor market dynamism, anticipate emerging skill requirements, and shape inclusive public policies aligned with our regional economic realities.”"}
              </blockquote>

              <div className="text-[11px] sm:text-xs font-bold text-[#634806]">
                {isFr
                  ? "— Direction de l'Observatoire National de l'Emploi et de la Formation Professionnelle (MINEFOP / ONEFOP)"
                  : "— Directorate of the National Employment and Vocational Training Observatory (MINEFOP / ONEFOP)"}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Snapshot of the Dossier */}
        <div
          className="rounded-xl border p-4 sm:p-5 space-y-3"
          style={{
            background: "var(--cam-bg)",
            borderColor: "var(--cam-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--cam-text-muted)] flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--cam-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 7.5V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isFr ? "Récapitulatif du Dossier Transmis" : "Summary of Submitted Dossier"}</span>
            </h4>
            {onToggleReview && (
              <button
                type="button"
                onClick={onToggleReview}
                className="text-xs font-bold text-[var(--cam-green)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isReviewing ? (isFr ? "Masquer les données" : "Hide details") : (isFr ? "Vérifier les données" : "Inspect details")}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="bg-[var(--cam-surface)] p-3 rounded-lg border border-[var(--cam-border)] shadow-2xs">
              <div className="text-[var(--cam-text-muted)] font-medium">
                {isFr ? "Structure / Établissement" : "Organization / Facility"}
              </div>
              <div className="font-bold text-sm text-[var(--cam-text)] mt-0.5 truncate" title={establishmentName}>
                {establishmentName || (isFr ? "Non spécifié" : "Unspecified")}
              </div>
              {niu && (
                <div className="text-[11px] text-[var(--cam-green)] font-medium mt-0.5 truncate">
                  NIU: {niu}
                </div>
              )}
            </div>

            <div className="bg-[var(--cam-surface)] p-3 rounded-lg border border-[var(--cam-border)] shadow-2xs">
              <div className="text-[var(--cam-text-muted)] font-medium">
                {isFr ? "Période de référence" : "Reference period"}
              </div>
              <div className="font-bold text-sm text-[var(--cam-text)] mt-0.5">
                {periodLabel || "—"}
              </div>
              <div className="text-[11px] text-[var(--cam-text-muted)] mt-0.5">
                {entityTypeDisplayName(entityType, locale)}
              </div>
            </div>

            <div className="bg-[var(--cam-surface)] p-3 rounded-lg border border-[var(--cam-border)] shadow-2xs">
              <div className="text-[var(--cam-text-muted)] font-medium">
                {isFr ? "Statut Juridique" : "Legal Status"}
              </div>
              <div className="font-bold text-sm text-[var(--cam-green)] mt-0.5 flex items-center gap-1">
                <span>✓</span>
                <span>{isFr ? "Récépissé Valide" : "Valid Receipt"}</span>
              </div>
              <div className="text-[11px] text-[var(--cam-text-muted)] mt-0.5">
                {isFr ? "Fait foi pour contrôles" : "Proof for inspection"}
              </div>
            </div>

            {/* A "Certification Numérique" card stood here: "SHA256:" over the
                first 8 characters of the submission reference, captioned
                "Intégrité certifiée ✓". Nothing was hashed or verified, so it
                is gone rather than kept as a claim an official receipt cannot
                back. */}
          </div>
        </div>

        {/* Action Buttons: Download PDF, Print, Dashboard */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[var(--cam-border)]">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {onDownloadPdf && (
              <button
                type="button"
                onClick={onDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-white font-bold text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  background: "var(--cam-green)",
                }}
              >
                {isGeneratingPdf ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>{isFr ? "Génération en cours..." : "Generating receipt..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span>{isFr ? "Télécharger le Récépissé Officiel (PDF)" : "Download Official Receipt (PDF)"}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--cam-surface)] hover:bg-[var(--cam-bg)] font-semibold text-sm border border-[var(--cam-border)] text-[var(--cam-text)] transition-colors cursor-pointer shadow-2xs"
            >
              <svg className="w-4 h-4 text-[var(--cam-text-muted)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.03-.48-2.072-.48-3.13 0-3.037 2.463-5.5 5.5-5.5 1.547 0 2.943.639 3.95 1.666m3.59 7.02c.48 1.058.72 2.1.72 3.115 0 4.142-3.358 7.5-7.5 7.5a7.48 7.48 0 01-5.303-2.197M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
              </svg>
              <span>{isFr ? "Imprimer" : "Print"}</span>
            </button>
          </div>

          {onReturnToDashboard && (
            <button
              type="button"
              onClick={onReturnToDashboard}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[var(--cam-green)] font-bold text-sm hover:underline cursor-pointer"
            >
              <span>{isFr ? "Retourner au Tableau de Bord" : "Return to Dashboard"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          )}
        </div>

        {/* Legal Evidentiary Value Notice */}
        <div
          className="rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed border"
          style={{
            background: "rgba(224, 242, 254, 0.5)",
            borderColor: "rgba(186, 230, 253, 0.8)",
            color: "#0369a1",
          }}
        >
          <svg className="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div>
            <strong>{isFr ? "Valeur probante légale :" : "Legal Evidentiary Value:"}</strong>{" "}
            {isFr
              ? `Ce récépissé fait foi auprès de l'Inspection du Travail et des organismes de sécurité sociale (CNPS) attestant du respect de vos obligations légales de déclaration statistique ${periodPhrases ? periodPhrases.inRespectOf : "au titre de la période de collecte en cours"}, conformément aux dispositions régissant l'ONEFOP.`
              : `This receipt serves as official proof of compliance for Labor Inspectorate audits and social security bodies (CNPS), attesting to your compliance with statistical declaration requirements ${periodPhrases ? periodPhrases.inRespectOf : "for the current collection period"} under ONEFOP regulations.`}
          </div>
        </div>
      </div>
    </div>
  );
}
