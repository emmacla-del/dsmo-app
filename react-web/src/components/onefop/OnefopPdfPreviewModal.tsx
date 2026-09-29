"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchDeclarationPreviewPdf } from "@/lib/onefop-submission";
import type { OnefopEntity } from "@/lib/onefop-schema";
import { OnefopSubmissionSuccess } from "./OnefopSubmissionSuccess";

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
  submissionResult?: string | null;
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
  submissionResult,
  submissionError,
  establishmentName,
}: OnefopPdfPreviewModalProps) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<"fr" | "en">(locale);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);

  const isFr = activeLocale === "fr";

  // Keep activeLocale synced with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveLocale(locale);
    }
  }, [isOpen, locale]);

  // Load PDF whenever modal is open or activeLocale changes
  const loadPdf = useCallback(async (targetLocale: "fr" | "en") => {
    setLoading(true);
    setLoadError(null);
    try {
      const blob = await fetchDeclarationPreviewPdf(
        entityType,
        data,
        quarterCode,
        targetLocale,
        entity,
      );
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      const url = URL.createObjectURL(blob);
      activeBlobRef.current = url;
      setBlobUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg || (targetLocale === "fr" ? "Erreur lors de la génération du PDF" : "Error generating PDF"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entity, data, quarterCode]);

  useEffect(() => {
    if (isOpen) {
      loadPdf(activeLocale);
    } else {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      setBlobUrl(null);
    }
  }, [isOpen, activeLocale, loadPdf]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
    };
  }, []);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `declaration-${entityType}-${quarterCode || "T3"}-${activeLocale.toUpperCase()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--cam-border, #d8ddd3)",
        }}
      >
        {/* ── HEADER ── */}
        <header
          style={{
            padding: "12px 20px",
            background: "var(--cam-surface, #ffffff)",
            borderBottom: "1px solid var(--cam-border, #e5eae7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div>
              <h2
                id="preview-modal-title"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--cam-text, #0b1f14)",
                  letterSpacing: "-0.01em",
                }}
              >
                {isFr ? "Vérification officielle avant soumission" : "Official Review before Final Submission"}
              </h2>
              <div style={{ fontSize: 12, color: "var(--cam-text-muted, #4a5a50)", marginTop: 2 }}>
                {establishmentName ? `${establishmentName} • ` : ""}
                {quarterCode || (isFr ? "Période active" : "Active period")}
              </div>
            </div>
          </div>

          {/* Right controls: Language toggle + Close */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Language toggle: FR / EN */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--cam-bg, #f3f5f1)",
                borderRadius: "6px",
                padding: "2px",
                border: "1px solid var(--cam-border, #d8ddd3)",
              }}
            >
              <button
                type="button"
                onClick={() => handleSwitchLocale("fr")}
                style={{
                  border: "none",
                  background: activeLocale === "fr" ? "var(--cam-green, #1e6b3a)" : "transparent",
                  color: activeLocale === "fr" ? "#ffffff" : "var(--cam-text, #0b1f14)",
                  fontWeight: activeLocale === "fr" ? 700 : 500,
                  fontSize: 12,
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
                  background: activeLocale === "en" ? "var(--cam-green, #1e6b3a)" : "transparent",
                  color: activeLocale === "en" ? "#ffffff" : "var(--cam-text, #0b1f14)",
                  fontWeight: activeLocale === "en" ? 700 : 500,
                  fontSize: 12,
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
                border: "1px solid var(--cam-border, #d8ddd3)",
                color: "var(--cam-text-muted, #4a5a50)",
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
            padding: "10px 20px",
            background: "rgba(230, 81, 0, 0.07)",
            borderBottom: "1px solid rgba(230, 81, 0, 0.22)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18, color: "#d9530f", flexShrink: 0 }}>⚠️</span>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--cam-text, #0b1f14)",
            }}
          >
            <strong>
              {isFr
                ? "Vérifiez attentivement les informations ci-dessous avant de soumettre définitivement."
                : "Review the information below carefully before submitting permanently."}
            </strong>{" "}
            <span style={{ color: "var(--cam-text-muted, #4a5a50)" }}>
              {isFr
                ? "Ce document représente la version officielle qui sera archivée et transmise aux services statistiques du MINEFOP."
                : "This document represents the official legal copy that will be archived and filed with MINEFOP statistical services."}
            </span>
          </p>
        </div>

        {/* ── PDF PREVIEW VIEWER AREA ── */}
        <div
          style={{
            flex: 1,
            position: "relative",
            background: "#525659",
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
                gap: 14,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: "3px solid #d8ddd3",
                  borderTopColor: "var(--cam-green, #1e6b3a)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--cam-text, #0b1f14)" }}>
                  {isFr ? "Génération de l'aperçu PDF officiel..." : "Generating official PDF preview..."}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--cam-text-muted, #4a5a50)" }}>
                  {isFr
                    ? "Mise en page réglementaire Handlebars & Puppeteer"
                    : "Official Handlebars & Puppeteer layout rendering"}
                </p>
              </div>
            </div>
          )}

          {loadError && !loading && (
            <div
              style={{
                background: "#ffffff",
                padding: "24px 32px",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                textAlign: "center",
                maxWidth: 440,
              }}
            >
              <span style={{ fontSize: 32 }}>⚠️</span>
              <h3 style={{ margin: "10px 0 6px", fontSize: 15, fontWeight: 700, color: "#d9530f" }}>
                {isFr ? "Erreur de chargement de l'aperçu" : "Preview Loading Error"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--cam-text-muted, #4a5a50)", margin: "0 0 16px" }}>
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => loadPdf(activeLocale)}
                style={{
                  background: "var(--cam-green, #1e6b3a)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 20px",
                  fontSize: 13,
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
              src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              title="Official Declaration PDF Preview"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
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
              padding: "10px 20px",
              background: "rgba(217, 83, 15, 0.1)",
              borderTop: "1px solid rgba(217, 83, 15, 0.3)",
              fontSize: 13,
              color: "#b03e08",
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
            background: "var(--cam-surface, #ffffff)",
            borderTop: "1px solid var(--cam-border, #e5eae7)",
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
              border: "1px solid var(--cam-border, #d8ddd3)",
              color: "var(--cam-text, #0b1f14)",
              borderRadius: "6px",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.15s ease",
            }}
          >
            <span>✏️</span>
            <span>{isFr ? "Modifier les informations" : "Edit information"}</span>
          </button>

          {/* Right actions: Télécharger PDF + Confirmer et soumettre */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !blobUrl || isSubmitting}
              style={{
                background: "var(--cam-surface, #ffffff)",
                border: "1px solid var(--cam-border, #d8ddd3)",
                color: "var(--cam-text, #0b1f14)",
                borderRadius: "6px",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !blobUrl || isSubmitting ? "not-allowed" : "pointer",
                opacity: loading || !blobUrl || isSubmitting ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📥</span>
              <span>{isFr ? "Télécharger le PDF" : "Download PDF"}</span>
            </button>

            {onSubmitFinal && !submissionResult && (
              <button
                type="button"
                onClick={() => onSubmitFinal()}
                disabled={loading || isSubmitting}
                style={{
                  background: "var(--cam-green, #1e6b3a)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "6px",
                  padding: "10px 28px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading || isSubmitting ? "wait" : "pointer",
                  opacity: loading || isSubmitting ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 2px 6px rgba(30, 107, 58, 0.28)",
                  transition: "background 0.15s ease",
                }}
              >
                <span>{isSubmitting ? "⏳" : "🚀"}</span>
                <span>
                  {isSubmitting
                    ? (isFr ? "Soumission en cours..." : "Submitting...")
                    : (isFr ? "Confirmer et soumettre" : "Confirm & Submit")}
                </span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
