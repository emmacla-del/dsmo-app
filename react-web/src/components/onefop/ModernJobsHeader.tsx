"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { clockTime } from "@/lib/admin-data-state";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";

interface ModernJobsHeaderProps {
  entityType: string;
  establishmentName?: string;
  /** The establishment's CAM-LEAP number, e.g. VT26000103. */
  establishmentId?: string;
  quarterCode?: string;
  saving?: boolean;
  lastSavedAt?: Date | null;
  onExit?: () => void;
  onPreviewPdf?: () => void;
  isGeneratingPdf?: boolean;
}

/**
 * The sticky masthead of both respondent wizards (Modern Jobs and VT), on
 * white: the ONEFOP wordmark on the left; the establishment, the survey
 * and the campaign centred; the auto-save status, PDF preview and exit on
 * the right. Saving on demand lives in each wizard's footer, and the
 * language is chosen before the wizard (login page, or the browser's
 * language), so the masthead carries neither.
 */
export function ModernJobsHeader({
  entityType,
  establishmentName,
  establishmentId,
  quarterCode = "",
  saving = false,
  lastSavedAt,
  onExit,
  onPreviewPdf,
  isGeneratingPdf = false,
}: ModernJobsHeaderProps) {
  const locale = useLocale();
  const t = useTranslations("modernJobs.header");

  const isVt = ["vt", "vocationaltraining", "vocational_training"].includes(entityType.toLowerCase());

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

  const isEn = locale.startsWith("en");
  const campaign =
    // "Campagne du 4e trimestre 2026"; an unknown code keeps the plain "Campagne <code>".
    referencePeriodPhrases(quarterCode, asUiLocale(locale))?.campaign ?? t("campaign", { code: quarterCode || "—" });

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: "var(--cam-font-size-sm)",
    fontWeight: 600,
    color: "var(--cam-text)",
    whiteSpace: "nowrap",
  } as const;

  return (
    <header
      ref={headerRef}
      style={{
        background: "var(--cam-surface)",
        borderBottom: "1px solid var(--cam-border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <style>{`
        /* Wordmark | establishment and survey | actions. The two side columns
           share the leftover width equally, so the centre block sits at the
           true centre of the bar. */
        .cam-masthead-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          grid-template-areas: "brand title actions";
          align-items: center;
          gap: 16px;
          padding: 10px 24px;
        }
        .cam-masthead-brand { grid-area: brand; justify-self: start; }
        .cam-masthead-title { grid-area: title; min-width: 0; text-align: center; }
        .cam-masthead-actions { grid-area: actions; justify-self: end; }
        /* Narrow viewports: wordmark and actions on the first line, the centre block below. */
        @media (max-width: 899px) {
          .cam-masthead-row {
            grid-template-columns: auto 1fr;
            grid-template-areas: "brand actions" "title title";
            gap: 8px 16px;
            padding: 8px 16px;
          }
          .cam-masthead-actions { flex-wrap: wrap; justify-content: flex-end; }
        }
      `}</style>
      {/* Three sizes: 18 for who is declaring (and the wordmark), 14 for the
          survey and the buttons, 13 for the secondary facts. */}
      <div className="cam-masthead-row">
        <div className="cam-masthead-brand" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, color: "var(--cam-green-dark)", letterSpacing: "0.02em" }}>
            ONEFOP
          </span>
          <span style={{ fontSize: "var(--cam-font-size-2xs)", fontWeight: 600, color: "var(--cam-text-muted)" }}>CamLEAP</span>
        </div>

        {/* Centre: who is declaring, in which survey, for which round */}
        <div className="cam-masthead-title" style={{ lineHeight: 1.35 }}>
          {establishmentName && (
            <div>
              <span style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: 700, color: "var(--cam-text)" }}>{establishmentName}</span>
              {establishmentId && (
                <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>{` · ${establishmentId}`}</span>
              )}
            </div>
          )}
          <div style={{ fontSize: "var(--cam-font-size-sm)", color: "var(--cam-text)" }}>
            {isVt ? t("vtSurveyTitle") : t("surveyTitle")}
          </div>
          <div style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)" }}>
            {/* VT's title already names the entity; the other surveys name it here. */}
            {!isVt && `${entityLabel} · `}
            {campaign}
          </div>
        </div>

        {/* Right: save status, PDF preview, exit */}
        <div className="cam-masthead-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div role="status" style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text-muted)", whiteSpace: "nowrap" }}>
            {saving
              ? t("saving")
              : formattedSaveTime
                ? t("savedAt", { time: formattedSaveTime })
                : t("draftSaved")}
          </div>

          {onPreviewPdf && (
            <button
              type="button"
              onClick={onPreviewPdf}
              disabled={isGeneratingPdf}
              className="cam-hoverable"
              style={{
                ...buttonStyle,
                background: "var(--cam-surface)",
                border: "1px solid var(--cam-border)",
                cursor: isGeneratingPdf ? "wait" : "pointer",
                opacity: isGeneratingPdf ? 0.7 : 1,
              }}
              title={isEn ? "Official PDF Preview" : "Aperçu PDF officiel"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
              </svg>
              {isGeneratingPdf ? "PDF..." : isEn ? "PDF Preview" : "Aperçu PDF"}
            </button>
          )}

          <button
            type="button"
            onClick={onExit ? onExit : () => window.history.back()}
            className="cam-hoverable"
            style={{ ...buttonStyle, background: "transparent", border: "1px solid transparent", cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {t("exit")}
          </button>
        </div>
      </div>
    </header>
  );
}
