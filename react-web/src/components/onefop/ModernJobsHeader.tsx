"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { clockTime } from "@/lib/admin-data-state";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

interface ModernJobsHeaderProps {
  entityType: string;
  establishmentName?: string;
  quarterCode?: string;
  saving?: boolean;
  lastSavedAt?: Date | null;
  onSaveNow?: () => void;
  onExit?: () => void;
  onPreviewPdf?: () => void;
  isGeneratingPdf?: boolean;
}

/**
 * Institutional Masthead & Header for the Modern Jobs Wizard.
 * Reinforces official Cameroon identity, displays live auto-save status,
 * and provides clear "Sauvegarder et reprendre plus tard" for self-respondents.
 */
export function ModernJobsHeader({
  entityType,
  establishmentName,
  quarterCode = "",
  saving = false,
  lastSavedAt,
  onSaveNow,
  onExit,
  onPreviewPdf,
  isGeneratingPdf = false,
}: ModernJobsHeaderProps) {
  const locale = useLocale();
  const t = useTranslations("modernJobs.header");

  const entityLabel = (() => {
    switch (entityType.toLowerCase()) {
      case "cooperative":
        return t("entity.cooperative");
      case "enterprise":
        return t("entity.enterprise");
      case "administration":
        return t("entity.administration");
      case "ong":
        return t("entity.ong");
      case "ctd":
        return t("entity.ctd");
      case "project":
      case "projectprogram":
      case "project_program":
        return t("entity.project");
      case "vt":
      case "vocationaltraining":
      case "vocational_training":
        return t("entity.vt");
      default:
        return entityType.toUpperCase();
    }
  })();

  const formattedSaveTime = lastSavedAt
    ? clockTime(lastSavedAt, asUiLocale(locale))
    : null;

  // Publish this sticky header's height as --mj-header-h and
  // --cam-wizard-rail-top on the wizard root
  // (its parent), so the side rail and the table tab strips pin just below
  // it. Both wizards render the header there: Modern Jobs and VT.
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const header = headerRef.current;
    const root = header?.parentElement;
    if (!header || !root || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      root.style.setProperty("--mj-header-h", `${header.offsetHeight}px`);
      root.style.setProperty("--cam-wizard-rail-top", `${header.offsetHeight}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      style={{
        background: "var(--cam-green-dark)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 2px 8px rgba(11, 31, 20, 0.15)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <style>{`
        .cam-masthead-row {
          flex-wrap: nowrap;
        }
        .cam-masthead-save {
          min-width: 220px;
          flex-shrink: 0;
        }
        /* Narrow viewports: put the status on its own line so the 220px slot cannot crush the title. */
        @media (max-width: 1099px) {
          .cam-masthead-row {
            flex-wrap: wrap;
          }
          .cam-masthead-actions {
            flex: 1 1 100%;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          .cam-masthead-save {
            flex: 1 0 100%;
            min-width: 0;
            justify-content: flex-start;
          }
        }
      `}</style>
      <div
        className="cam-masthead-row"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          gap: 16,
        }}
      >
        {/* Left: Sovereign Identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.75)",
                lineHeight: 1.2,
                marginBottom: 2,
              }}
            >
              {t("republicLine")}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
                color: "#ffffff",
                lineHeight: 1.2,
              }}
            >
              ONEFOP · DSMO
            </div>
          </div>
        </div>

        {/* Center: Survey Mission & Entity Target */}
        <div
          style={{
            textAlign: "center",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
          }}
          className="hidden md:flex"
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              maxWidth: "100%",
            }}
          >
            {t("surveyTitle")}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 2,
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--cam-gold)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {entityLabel}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.4)" }}>•</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.85)",
              }}
            >
              {/* "Campagne du 4e trimestre 2026"; an unknown code keeps the plain "Campagne <code>". */}
              {referencePeriodPhrases(quarterCode, asUiLocale(locale))?.campaign ?? t("campaign", { code: quarterCode || "—" })}
            </span>
          </div>
        </div>

        {/* Right: Actions & Auto-save feedback */}
        <div className="cam-masthead-actions" style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {/* Real-time Draft Save Status */}
          <div
            className="cam-masthead-save"
            style={{
              fontSize: "var(--cam-font-size-xs, 0.8125rem)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              color: "#ffffff",
              fontWeight: 500,
              fontFamily: "var(--cam-font-sans)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: saving ? "var(--cam-gold)" : "var(--cam-success)", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>
              {saving ? "●" : "✓"}
            </span>
            <span style={{ opacity: 0.9 }}>
              {saving
                ? t("saving")
                : formattedSaveTime
                  ? t("savedAt", { time: formattedSaveTime })
                  : t("draftSaved")}
            </span>
          </div>

          <LocaleSwitcher variant="masthead" />

          {/* Quick PDF Preview from any section */}
          {onPreviewPdf && (
            <button
              type="button"
              onClick={onPreviewPdf}
              disabled={isGeneratingPdf}
              className="cam-hoverable"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: isGeneratingPdf ? "wait" : "pointer",
                opacity: isGeneratingPdf ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
              title={locale.startsWith("en") ? "Official PDF Preview" : "Aperçu PDF officiel"}
            >
              <span>{isGeneratingPdf ? (locale.startsWith("en") ? "PDF..." : "PDF...") : (locale.startsWith("en") ? "PDF Preview" : "Aperçu PDF")}</span>
            </button>
          )}

          {/* Explicit Save Action if passed */}
          {onSaveNow && (
            <button
              type="button"
              onClick={onSaveNow}
              disabled={saving}
              className="cam-hoverable"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <span>{t("save")}</span>
            </button>
          )}

          {/* Exit / Return to Dashboard */}
          <button
            type="button"
            onClick={onExit ? onExit : () => window.history.back()}
            className="cam-hoverable"
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              color: "#ffffff",
              borderRadius: 6,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {t("exit")}
          </button>
        </div>
      </div>
    </header>
  );
}
