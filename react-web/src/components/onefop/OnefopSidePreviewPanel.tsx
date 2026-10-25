"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { fetchDeclarationPreviewHtml } from "@/lib/onefop-submission";
import type { OnefopEntity } from "@/lib/onefop-schema";

interface OnefopSidePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExpandModal: () => void;
  entityType: string;
  data: Record<string, unknown>;
  quarterCode?: string | null;
  locale: "fr" | "en";
  entity?: OnefopEntity | null;
  establishmentName?: string;
}

/** How long the declaration must sit still before the preview refreshes. */
const REFRESH_IDLE_MS = 800;

/**
 * The text field the respondent is currently inside, if any.
 *
 * A refresh replaces the preview's document, so it waits for the field to be
 * left rather than firing on a pause mid-answer. A committed value — a
 * checkbox, a radio, a select, a stepper button — does not wait: there is no
 * half-typed answer to interrupt.
 */
function focusedTextField(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return null;
  if (active.isContentEditable) return active;
  if (active instanceof HTMLTextAreaElement) return active;
  if (active instanceof HTMLInputElement) {
    const type = active.type.toLowerCase();
    const committed =
      type === "checkbox" || type === "radio" || type === "button" || type === "submit";
    return committed ? null : active;
  }
  return null;
}

/** The preview's own scroll offset, or 0 when the frame cannot be read. */
function readFrameScroll(frame: HTMLIFrameElement | null): number {
  try {
    const win = frame?.contentWindow;
    if (!win) return 0;
    return win.scrollY || win.document?.documentElement?.scrollTop || 0;
  } catch {
    return 0;
  }
}

export function OnefopSidePreviewPanel({
  isOpen,
  onClose,
  onExpandModal,
  entityType,
  data,
  quarterCode,
  locale,
  entity,
  establishmentName,
}: OnefopSidePreviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  // The data a load was last started for: the open effect and the refresh
  // effect run in the same commit, and only one of them should fetch.
  const loadedDataRef = useRef<Record<string, unknown> | null>(null);
  // Only the newest request may paint: an earlier one resolving late would
  // otherwise put a staler declaration back on screen.
  const requestIdRef = useRef(0);
  // Where the respondent was reading, to put back once the refreshed
  // document has loaded.
  const restoreScrollRef = useRef(0);

  const isFr = locale === "fr";

  const loadPreview = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    loadedDataRef.current = data;
    restoreScrollRef.current = readFrameScroll(iframeRef.current);
    setLoading(true);
    setLoadError(null);
    try {
      const html = await fetchDeclarationPreviewHtml(
        entityType,
        data,
        quarterCode,
        locale,
        entity,
      );
      if (requestId !== requestIdRef.current) return;
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      activeBlobRef.current = url;
      setBlobUrl(url);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(
        msg || (isFr ? "Erreur lors du chargement de l'aperçu" : "Error loading preview"),
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [entityType, data, quarterCode, locale, entity, isFr]);

  // Initial load when opened
  useEffect(() => {
    if (isOpen) {
      loadPreview();
    } else {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      // Reopening must fetch again, however the declaration has moved on.
      loadedDataRef.current = null;
      restoreScrollRef.current = 0;
      setBlobUrl(null);
    }
  }, [isOpen]);

  /**
   * Auto-update as the declaration is filled — but never under the
   * respondent's hands. Refreshing swaps the iframe's document, so firing on
   * every thinking pause cost them a round-trip and their place in the
   * document. The refresh waits for the field to be left, then for the form
   * to settle.
   */
  useEffect(() => {
    if (!isOpen) return;
    // The open effect already loaded exactly this data.
    if (loadedDataRef.current === data) return;

    const schedule = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void loadPreview();
      }, REFRESH_IDLE_MS);
    };

    const editing = focusedTextField();
    if (editing) {
      editing.addEventListener("blur", schedule, { once: true });
      return () => editing.removeEventListener("blur", schedule);
    }

    schedule();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [data, isOpen, loadPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
    };
  }, []);

  /** Put the respondent back where they were in the refreshed document. */
  const handleFrameLoad = () => {
    const offset = restoreScrollRef.current;
    if (offset <= 0) return;
    try {
      iframeRef.current?.contentWindow?.scrollTo(0, offset);
    } catch {
      // A frame we cannot reach into keeps whatever position it loaded at.
    }
  };

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // Fallback if cross-origin or blocked
      }
    }
    window.print();
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label={isFr ? "Panneau d'aperçu officiel" : "Official Preview Panel"}
      style={{
        width: "50%",
        minWidth: "420px",
        maxWidth: "760px",
        height: "auto",
        position: "static",
        borderLeft: "1px solid var(--cam-border)",
        background: "var(--cam-bg-subtle)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 15,
        boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
        transition: "width 0.2s ease",
      }}
    >
      {/* ── Top Bar ── */}
      <header
        style={{
          padding: "var(--cam-space-2) var(--cam-space-3)",
          background: "var(--cam-surface)",
          borderBottom: "1px solid var(--cam-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: loading ? "var(--cam-alert-orange)" : "var(--cam-green)",
              boxShadow: loading ? "0 0 6px var(--cam-alert-orange)" : "0 0 6px var(--cam-green)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "var(--cam-font-size-xs)",
              fontWeight: "var(--cam-font-weight-bold)",
              color: "var(--cam-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {isFr ? "Aperçu officiel (Temps réel)" : "Live Official Preview"}
          </span>
          {loading && (
            <span
              style={{
                fontSize: "var(--cam-font-size-3xs)",
                color: "var(--cam-text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              ({isFr ? "actualisation..." : "updating..."})
            </span>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--cam-space-2)" }}>
          {/* Refresh button */}
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="cam-hoverable"
            title={isFr ? "Actualiser l'aperçu" : "Refresh preview"}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--cam-border)",
              background: "var(--cam-surface)",
              color: "var(--cam-text-muted)",
              cursor: "pointer",
              fontSize: "var(--cam-font-size-2xs)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>↻</span>
          </button>

          {/* Imprimer / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !blobUrl}
            className="cam-hoverable"
            title={isFr ? "Imprimer / Enregistrer en PDF" : "Print / Save as PDF"}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--cam-border)",
              background: "var(--cam-surface)",
              color: "var(--cam-text)",
              cursor: "pointer",
              fontSize: "var(--cam-font-size-2xs)",
              fontWeight: "var(--cam-font-weight-semibold)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>PDF</span>
          </button>

          {/* Full-screen expand button */}
          <button
            type="button"
            onClick={onExpandModal}
            className="cam-hoverable"
            title={isFr ? "Agrandir en plein écran" : "Expand to Full Screen"}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--cam-border)",
              background: "var(--cam-surface)",
              color: "var(--cam-text)",
              cursor: "pointer",
              fontSize: "var(--cam-font-size-2xs)",
              fontWeight: "var(--cam-font-weight-semibold)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>⛶</span>
          </button>

          {/* Close side preview (re-expands sidebar) */}
          <button
            type="button"
            onClick={onClose}
            className="cam-hoverable"
            title={isFr ? "Fermer l'aperçu latéral" : "Close side preview"}
            aria-label={isFr ? "Fermer l'aperçu" : "Close preview"}
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              border: "1px solid var(--cam-border)",
              background: "transparent",
              color: "var(--cam-text-muted)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: "var(--cam-font-size-xs)",
              fontWeight: "var(--cam-font-weight-bold)",
            }}
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── Document Container ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          background: "var(--cam-viewer-backdrop)",
        }}
      >
        {loadError && (
          <div
            style={{
              margin: 16,
              padding: 12,
              borderRadius: 6,
              background: "var(--cam-surface)",
              border: "1px solid var(--cam-border)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: "var(--cam-font-size-xs)", color: "var(--cam-alert-orange)" }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={loadPreview}
              style={{
                marginTop: 8,
                padding: "4px 12px",
                borderRadius: 4,
                border: "none",
                background: "var(--cam-green)",
                color: "var(--cam-surface)",
                fontSize: "var(--cam-font-size-2xs)",
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
            onLoad={handleFrameLoad}
            title="Live Official Declaration Preview"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              background: "var(--cam-surface)",
            }}
          />
        )}
      </div>
    </aside>
  );
}
