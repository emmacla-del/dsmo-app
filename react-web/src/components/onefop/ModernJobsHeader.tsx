"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";
import type { ServerSaveState } from "@/lib/use-onefop-server-save";

export interface ModernJobsHeaderProps {
  entityType: string;
  establishmentName?: string;
  /** The establishment's CAM-LEAP number, e.g. VT26000103. */
  establishmentId?: string;
  quarterCode?: string;
  /** Kept for the autosave layer's shape; the bar no longer reports a
   * save that worked (owner, 2026-10-11). */
  saving?: boolean;
  lastSavedAt?: Date | null;
  /**
   * The draft's state on the server (audit R2). Given it, the masthead
   * reports that — never the local buffer — as saved; without it, it keeps
   * reporting the local autosave as before.
   */
  serverSave?: {
    state: ServerSaveState;
    savedAt: Date | null;
    hasUnsavedChanges: boolean;
    onRetry: () => void;
  };
  /**
   * The wizard's entry-mode slot (Tableau / Guidé). It lives in the app
   * bar because the choice is one persisted setting for the whole
   * declaration, and because the pod below needs its height for the
   * declaration itself (owner, 2026-10-11). It is empty, and takes no
   * room, on a screen with no table.
   */
  entryModeSlot?: ReactNode;
  onExit?: () => void;
  onPreviewPdf?: () => void;
  isGeneratingPdf?: boolean;
  isPreviewActive?: boolean;
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
  serverSave,
  entryModeSlot,
  onExit,
  onPreviewPdf,
  isGeneratingPdf = false,
  isPreviewActive = false,
}: ModernJobsHeaderProps) {
  const locale = useLocale();
  const t = useTranslations("modernJobs.header");
  const tLanding = useTranslations("landingPage");

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

  // Publish this sticky header's height as --mj-header-h and
  // --cam-wizard-rail-top on the wizard root
  // (its parent), so the side rail and the table tab strips pin just below
  // it. Both wizards render the header there: Modern Jobs and VT. Below
  // 1024px the header is not pinned (.cam-masthead), so it publishes 0.
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const header = headerRef.current;
    const root = header?.parentElement;
    if (!header || !root || typeof ResizeObserver === "undefined") return;
    const publish = () => {
      const pinned = getComputedStyle(header).position === "sticky";
      const height = pinned ? header.offsetHeight : 0;
      root.style.setProperty("--mj-header-h", `${height}px`);
      root.style.setProperty("--cam-wizard-rail-top", `${height}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    const wide = window.matchMedia("(min-width: 1024px)");
    wide.addEventListener("change", publish);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", publish);
    };
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
      className="cam-masthead"
      style={{
        background: "var(--cam-surface)",
        borderBottom: "1px solid var(--cam-border)",
      }}
    >
      <style>{`
        /* Pinned beside the side rail (1024px and up). Below that there is
           no rail, and a pinned two-line masthead took a sixth of a tablet
           screen; it scrolls away with the page. */
        .cam-masthead { position: sticky; top: 0; z-index: 50; }
        @media (max-width: 1023px) {
          .cam-masthead { position: static; }
        }
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
        .cam-masthead-brand {
          grid-area: brand;
          justify-self: start;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--cam-space-1);
        }
        .cam-masthead-brand img { display: block; width: 120px; height: auto; }
        .cam-masthead-brand span {
          font-size: var(--cam-font-size-2xs);
          line-height: var(--cam-line-height-ui);
          color: var(--cam-text-muted);
          white-space: nowrap;
        }
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
          survey and the buttons, 13 for the secondary facts. The name is
          semibold, not bold: the page's own title is the one bold anchor. */}
      <div className="cam-masthead-row">
        {/* A working screen: the CAMLEAP logo alone, ONEFOP as a line of
            text under it, not a second logo (docs/standards/brand.md). */}
        <div className="cam-masthead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap_logo.png" alt="CAMLEAP" width={120} height={20} />
          <span>{tLanding("endorsement")}</span>
        </div>

        {/* Centre: who is declaring, in which survey, for which round */}
        <div className="cam-masthead-title" style={{ lineHeight: 1.35 }}>
          {establishmentName && (
            <div>
              <span style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-semibold)", color: "var(--cam-text)" }}>{establishmentName}</span>
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

        {/* Right: entry mode, a save that did not land, PDF preview, exit */}
        <div className="cam-masthead-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {entryModeSlot}
          {/* Saving is automatic and the respondent does not need telling it
              worked (owner, 2026-10-11) — the PDF preview shows them what
              the declaration holds. A save that did NOT land still shows,
              with its retry: it is the only way back from one, and no
              preview can report it. */}
          <div role="status" style={{ fontSize: "var(--cam-font-size-xs)", whiteSpace: "nowrap" }}>
            {serverSave?.state === "failed" && (
              <span style={{ color: "var(--cam-error)" }}>
                {t("notSaved")}{" "}
                <button type="button" className="cam-text-button is-danger" onClick={serverSave.onRetry}>
                  {t("retrySave")}
                </button>
              </span>
            )}
          </div>

          {onPreviewPdf && (
            <button
              type="button"
              onClick={onPreviewPdf}
              disabled={isGeneratingPdf}
              className="cam-hoverable"
              style={{
                ...buttonStyle,
                background: isPreviewActive ? "var(--cam-green-active-wash)" : "var(--cam-surface)",
                borderColor: isPreviewActive ? "var(--cam-green-active-ink)" : "var(--cam-border)",
                color: isPreviewActive ? "var(--cam-green-active-ink)" : "var(--cam-text)",
                cursor: isGeneratingPdf ? "wait" : "pointer",
                opacity: isGeneratingPdf ? 0.7 : 1,
              }}
              title={isEn ? "Official PDF Preview" : "Aperçu PDF officiel"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
              </svg>
              {isGeneratingPdf ? "PDF..." : isEn ? (isPreviewActive ? "Hide Preview" : "PDF Preview") : (isPreviewActive ? "Masquer l'aperçu" : "Aperçu PDF")}
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
