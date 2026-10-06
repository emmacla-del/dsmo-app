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
        padding: "var(--cam-space-6)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "rgba(179, 38, 30, 0.12)",
          color: "var(--cam-error, #b3261e)",
          display: "grid",
          placeItems: "center",
          marginBottom: "var(--cam-space-4)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--cam-green-dark)",
          margin: "0 0 var(--cam-space-2)",
        }}
      >
        {t("title")}
      </h1>

      <p
        style={{
          maxWidth: 520,
          color: "var(--cam-text-muted)",
          fontSize: "0.9375rem",
          lineHeight: 1.5,
          margin: "0 0 var(--cam-space-5)",
        }}
      >
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
          style={{ padding: "0.625rem 1.25rem" }}
        >
          {t("retryButton")}
        </button>

        <Link
          href="/admin/pilotage"
          className="cam-button cam-button-secondary"
          style={{ textDecoration: "none", padding: "0.625rem 1.25rem" }}
        >
          {t("backToSupervision")}
        </Link>
      </div>

      {error?.digest && (
        <span
          style={{
            marginTop: "var(--cam-space-6)",
            fontSize: "0.75rem",
            color: "var(--cam-text-muted)",
            fontFamily: "monospace",
          }}
        >
          {t("diagnosticCode", { digest: error.digest })}
        </span>
      )}
    </div>
  );
}
