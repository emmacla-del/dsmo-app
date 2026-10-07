"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("adminError");

  useEffect(() => {
    // Log the error to client console for diagnostics
    console.error("Admin route error caught by boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--cam-space-2)",
        padding: "var(--cam-space-6)",
        textAlign: "center",
      }}
    >
      <div className="cam-admin-error-mark">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 className="cam-admin-h1">{t("title")}</h1>

      <p className="cam-admin-lede" style={{ marginBottom: "var(--cam-space-4)" }}>
        {error?.message || t("fallbackMessage")}
      </p>

      <div style={{ display: "flex", gap: "var(--cam-space-3)", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => {
            // First try resetting error boundary; if chunk error, reload the window
            reset();
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
          className="cam-button cam-button-primary"
        >
          {t("retryButton")}
        </button>

        <Link href="/admin/pilotage" className="cam-button cam-button-secondary">
          {t("backToSupervision")}
        </Link>
      </div>

      {error?.digest && (
        <span className="cam-admin-meta cam-admin-code" style={{ marginTop: "var(--cam-space-5)" }}>
          {t("diagnosticCode", { digest: error.digest })}
        </span>
      )}
    </div>
  );
}
