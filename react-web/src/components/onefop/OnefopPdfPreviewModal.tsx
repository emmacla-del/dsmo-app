"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchDeclarationPreviewHtml, fetchDeclarationPreviewPdf } from "@/lib/onefop-submission";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";
import { getZeroedTablesList, type ZeroedTableInfo } from "@/components/modern-jobs/scope/QuizSemantics";
import { referencePeriodLabel } from "@/lib/onefop-period-label";

interface OnefopPdfPreviewModalProps {
  /** Entity schema, so the preview shows the same quiz-derived data as the submission. */
  entity?: OnefopEntity | null;
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  data: Record<string, unknown>;
  quarterCode?: string | null;
  locale: "fr" | "en";
  onSubmitFinal?: () => Promise<void> | void;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  hasErrors?: boolean;
  validationErrorCount?: number;
  submissionResult?: string | null;
  /** The submission reference the server returned, for the receipt. */
  submissionId?: string | null;
  submissionError?: { summary: string; items: string[] } | null;
  establishmentName?: string;
}

export function OnefopPdfPreviewModal({
  isOpen,
  onClose,
  entityType,
  entity,
  data,
  quarterCode,
  locale,
  onSubmitFinal,
  isSubmitting = false,
  canSubmit = true,
  hasErrors = false,
  validationErrorCount = 0,
  submissionResult,
  submissionId,
  submissionError,
  establishmentName,
}: OnefopPdfPreviewModalProps) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<"fr" | "en">(locale);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isFr = activeLocale === "fr";

  const zeroedTables = useMemo(() => {
    if (!entity) return [];
    return getZeroedTablesList(entity, data as any);
  }, [entity, data]);
  const [showZeroedDetails, setShowZeroedDetails] = useState(false);

  // Keep activeLocale synced with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveLocale(locale);
    }
  }, [isOpen, locale]);

  // Load preview whenever modal is open or activeLocale changes
  const loadPreview = useCallback(async (targetLocale: "fr" | "en") => {
    setLoading(true);
    setLoadError(null);
    try {
      const html = await fetchDeclarationPreviewHtml(
        entityType,
        data,
        quarterCode,
        targetLocale,
        entity,
      );
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      activeBlobRef.current = url;
      setBlobUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg || (targetLocale === "fr" ? "Erreur lors de la génération de l'aperçu" : "Error generating preview"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entity, data, quarterCode]);

  useEffect(() => {
    if (isOpen) {
      loadPreview(activeLocale);
    } else {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      setBlobUrl(null);
    }
  }, [isOpen, activeLocale, loadPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
    };
  }, []);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        console.warn("iframe print threw, falling back to window.print", e);
      }
    }
    window.print();
  };

  const handleDownload = async () => {
    setDownloadingPdf(true);
    try {
      const pdfBlob = await fetchDeclarationPreviewPdf(
        entityType,
        data,
        quarterCode,
        activeLocale,
        entity,
      );
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `declaration-${entityType}${quarterCode ? `-${quarterCode}` : ""}-${activeLocale.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Direct PDF download unavailable, triggering browser print-to-PDF:", err);
      handlePrint();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSwitchLocale = (newLocale: "fr" | "en") => {
    if (newLocale === activeLocale) return;
    setActiveLocale(newLocale);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(11, 31, 20, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(8px, 2vw, 24px)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1280px",
          height: "94vh",
          maxHeight: "960px",
          background: "var(--cam-surface)",
          borderRadius: "12px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--cam-border)",
        }}
      >
        {/* ── HEADER ── */}
        <header
          style={{
            padding: "12px 20px",
            background: "var(--cam-surface)",
            borderBottom: "1px solid var(--cam-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <h2
                id="preview-modal-title"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--cam-text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {isFr ? "Vérification officielle avant soumission" : "Official Review before Final Submission"}
              </h2>
              <div style={{ fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)", marginTop: "var(--cam-space-1)" }}>
                {establishmentName ? `${establishmentName} • ` : ""}
                {referencePeriodLabel(quarterCode, activeLocale) || (isFr ? "Période active" : "Active period")}
              </div>
            </div>
          </div>

          {/* Right controls: Language toggle + Close */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-3)" }}>
            {/* Language toggle: FR / EN */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--cam-bg)",
                borderRadius: "6px",
                padding: "var(--cam-space-1)",
                border: "1px solid var(--cam-border)",
              }}
            >
              <button
                type="button"
                onClick={() => handleSwitchLocale("fr")}
                style={{
                  border: "none",
                  background: activeLocale === "fr" ? "var(--cam-green)" : "transparent",
                  color: activeLocale === "fr" ? "var(--cam-surface)" : "var(--cam-text)",
                  fontWeight: activeLocale === "fr" ? 700 : 500,
                  fontSize: "var(--cam-font-size-2xs)",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLocale("en")}
                style={{
                  border: "none",
                  background: activeLocale === "en" ? "var(--cam-green)" : "transparent",
                  color: activeLocale === "en" ? "var(--cam-surface)" : "var(--cam-text)",
                  fontWeight: activeLocale === "en" ? 700 : 500,
                  fontSize: "var(--cam-font-size-2xs)",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                EN
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label={isFr ? "Fermer" : "Close"}
              style={{
                background: "transparent",
                border: "1px solid var(--cam-border)",
                color: "var(--cam-text-muted)",
                borderRadius: "6px",
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              ✕
            </button>
          </div>
        </header>

        {/* ── LEGAL REVIEW BANNER ── */}
        <div
          style={{
            padding: "var(--cam-space-3) var(--cam-space-5)",
            background: "rgba(230, 81, 0, 0.07)",
            borderBottom: "1px solid rgba(230, 81, 0, 0.22)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--cam-font-size-xs)",
              lineHeight: 1.4,
              color: "var(--cam-text)",
            }}
          >
            <strong>
              {isFr
                ? "Vérifiez attentivement les informations ci-dessous avant de soumettre définitivement."
                : "Review the information below carefully before submitting permanently."}
            </strong>{" "}
            <span style={{ color: "var(--cam-text-muted)" }}>
              {isFr
                ? "Ce document représente la version officielle qui sera archivée et transmise aux services statistiques du MINEFOP."
                : "This document represents the official legal copy that will be archived and filed with MINEFOP statistical services."}
            </span>
          </p>
        </div>
        {zeroedTables.length > 0 && (
          <div
            style={{
              padding: "var(--cam-space-3) var(--cam-space-5)",
              background: "var(--cam-success-surface)",
              borderBottom: "1px solid var(--cam-success-border-soft)",
              fontSize: "var(--cam-font-size-xs)",
              color: "var(--cam-success-text-strong)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--cam-space-2)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>
                <strong>
                  {isFr
                    ? `${zeroedTables.length} tableau(x) certifié(s) à néant (0) conformément à vos réponses au questionnaire préliminaire.`
                    : `${zeroedTables.length} table(s) certified as null (0) according to your preliminary questionnaire responses.`}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setShowZeroedDetails((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--cam-success-text-strong)",
                  fontSize: "var(--cam-font-size-2xs)",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showZeroedDetails
                  ? isFr ? "Masquer le détail" : "Hide details"
                  : isFr ? "Voir le détail" : "Show details"}
              </button>
            </div>
            {showZeroedDetails && (
              <div style={{ background: "var(--cam-surface)", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--cam-success-border-faint)", marginTop: 4 }}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--cam-font-size-2xs)" }}>
                  {zeroedTables.map((t: ZeroedTableInfo) => (
                    <li key={t.code} style={{ marginBottom: "var(--cam-space-1)" }}>
                      <strong>{t.code}</strong> — {isFr ? t.nameFr : t.nameEn} (<em>{isFr ? "Certifié néant" : "Certified none"}</em>)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── PDF PREVIEW VIEWER AREA ── */}
        <div
          style={{
            flex: 1,
            position: "relative",
            background: "var(--cam-pdf-viewer-bg)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255, 255, 255, 0.94)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--cam-space-4)",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid var(--cam-border)",
                  borderTopColor: "var(--cam-green)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "var(--cam-font-size-sm)", fontWeight: 700, color: "var(--cam-text)" }}>
                  {isFr ? "Génération de l'aperçu officiel..." : "Generating official preview..."}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "var(--cam-font-size-2xs)", color: "var(--cam-text-muted)" }}>
                  {isFr
                    ? "Mise en page réglementaire officielle en direct"
                    : "Official regulatory layout rendering"}
                </p>
              </div>
            </div>
          )}

          {loadError && !loading && (
            <div
              style={{
                background: "var(--cam-surface)",
                padding: "24px 32px",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                textAlign: "center",
                maxWidth: 440,
              }}
            >
              <h3 style={{ margin: "var(--cam-space-3) 0 var(--cam-space-2)", fontSize: "var(--cam-font-size-base)", fontWeight: 700, color: "var(--cam-alert-orange)" }}>
                {isFr ? "Erreur de chargement de l'aperçu" : "Preview Loading Error"}
              </h3>
              <p style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", margin: "0 0 16px" }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => loadPreview(activeLocale)}
                style={{
                  background: "var(--cam-green)",
                  color: "var(--cam-surface)",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 20px",
                  fontSize: "var(--cam-font-size-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {isFr ? "Réessayer" : "Retry"}
              </button>
            </div>
          )}

          {blobUrl && !loadError && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="Official Declaration Preview"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                background: "var(--cam-surface)",
              }}
            />
          )}

          {/* Submission Success Overlay */}
          {submissionResult && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255, 255, 255, 0.98)",
                overflowY: "auto",
                zIndex: 20,
                padding: "24px 16px",
              }}
            >
              <OnefopSubmissionSuccess
                rawResult={submissionResult}
                submissionId={submissionId}
                entityType={entityType}
                establishmentName={establishmentName}
                quarterCode={quarterCode || undefined}
                locale={isFr ? "fr" : "en"}
                onDownloadPdf={handleDownload}
                isGeneratingPdf={loading}
                onPrint={() => window.print()}
                onReturnToDashboard={() => router.push("/home/declarations")}
              />
            </div>
          )}
        </div>

        {/* Error notification if submission failed */}
        {submissionError && !submissionResult && (
          <div
            style={{
              padding: "var(--cam-space-3) var(--cam-space-5)",
              background: "rgba(217, 83, 15, 0.1)",
              borderTop: "1px solid rgba(217, 83, 15, 0.3)",
              fontSize: "var(--cam-font-size-xs)",
              color: "var(--cam-alert-orange-text)",
            }}
          >
            <strong>{submissionError.summary}</strong>
            {submissionError.items?.length > 0 && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {submissionError.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── STICKY FOOTER ACTIONS BAR ── */}
        <footer
          style={{
            padding: "12px 20px",
            background: "var(--cam-surface)",
            borderTop: "1px solid var(--cam-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Left action: Modifier (Return to edit form) */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "transparent",
              border: "1px solid var(--cam-border)",
              color: "var(--cam-text)",
              borderRadius: "6px",
              padding: "var(--cam-space-3) var(--cam-space-5)",
              fontSize: "var(--cam-font-size-sm)",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.15s ease",
            }}
          >
            <span>{isFr ? "Modifier les informations" : "Edit information"}</span>
          </button>

          {/* Right actions: Imprimer / Enregistrer en PDF + Télécharger PDF + Confirmer et soumettre */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !blobUrl || isSubmitting}
              style={{
                background: "var(--cam-surface)",
                border: "1px solid var(--cam-border)",
                color: "var(--cam-text)",
                borderRadius: "6px",
                padding: "var(--cam-space-3) var(--cam-space-5)",
                fontSize: "var(--cam-font-size-sm)",
                fontWeight: 600,
                cursor: loading || !blobUrl || isSubmitting ? "not-allowed" : "pointer",
                opacity: loading || !blobUrl || isSubmitting ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              title={isFr ? "Imprimer directement ou enregistrer en PDF via votre navigateur" : "Print directly or save as PDF via your browser"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>{isFr ? "Imprimer / Enregistrer en PDF" : "Print / Save as PDF"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !blobUrl || isSubmitting || downloadingPdf}
              style={{
                background: "var(--cam-surface)",
                border: "1px solid var(--cam-border)",
                color: "var(--cam-text)",
                borderRadius: "6px",
                padding: "var(--cam-space-3) var(--cam-space-5)",
                fontSize: "var(--cam-font-size-sm)",
                fontWeight: 600,
                cursor: loading || !blobUrl || isSubmitting || downloadingPdf ? "not-allowed" : "pointer",
                opacity: loading || !blobUrl || isSubmitting || downloadingPdf ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{downloadingPdf ? (isFr ? "Téléchargement..." : "Downloading...") : (isFr ? "Télécharger le PDF" : "Download PDF")}</span>
            </button>

            {onSubmitFinal && !submissionResult && (
              <button
                type="button"
                onClick={() => {
                  if (!canSubmit || hasErrors) return;
                  onSubmitFinal();
                }}
                disabled={loading || isSubmitting || !canSubmit || hasErrors}
                style={{
                  background: !canSubmit || hasErrors ? "var(--cam-border-strong)" : "var(--cam-green)",
                  border: "none",
                  color: "var(--cam-surface)",
                  borderRadius: "6px",
                  padding: "var(--cam-space-3) var(--cam-space-6)",
                  fontSize: "var(--cam-font-size-sm)",
                  fontWeight: 700,
                  cursor: loading || isSubmitting ? "wait" : (!canSubmit || hasErrors ? "not-allowed" : "pointer"),
                  opacity: loading || isSubmitting || !canSubmit || hasErrors ? 0.65 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--cam-space-3)",
                  boxShadow: !canSubmit || hasErrors ? "none" : "0 2px 6px rgba(30, 107, 58, 0.28)",
                  transition: "background 0.15s ease",
                }}
                title={
                  !canSubmit
                    ? (isFr ? "La période de soumission est clôturée" : "Submission period is closed")
                    : hasErrors
                    ? (isFr ? `${validationErrorCount} erreur(s) à corriger avant la soumission` : `${validationErrorCount} error(s) must be resolved before submission`)
                    : undefined
                }
              >
                <span>
                  {isSubmitting
                    ? (isFr ? "Soumission en cours..." : "Submitting...")
                    : (!canSubmit
                      ? (isFr ? "Période clôturée" : "Period Closed")
                      : hasErrors
                      ? (isFr ? `Corriger les erreurs (${validationErrorCount})` : `Resolve Errors (${validationErrorCount})`)
                      : (isFr ? "Confirmer et soumettre" : "Confirm & Submit"))}
                </span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
