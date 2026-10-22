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
 * and the campaign centred between them; the auto-save status, PDF preview and workspace on
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

  // "des entreprises" / "of enterprises", inside the survey sentence. VT's
  // title already names the entity, and PP is identified by its PP prefix
  // and project/programme name, so neither repeats it.
  const entityOf = (() => {
    switch (entityType.toLowerCase()) {
      case "cooperative":
        return t("entityOf.cooperative");
      case "enterprise":
      case "entreprise":
        return t("entityOf.enterprise");
      case "administration":
        return t("entityOf.administration");
      case "ong":
      case "ngo":
        return t("entityOf.ong");
      case "ctd":
        return t("entityOf.ctd");
      default:
        return null;
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
  // One sentence names the declaration: "Recensement emplois modernes des
  // entreprises pour le 4e trimestre 2026". The round is named, not dated:
  // its bounds repeated what the name already says (owner, 2026-10-22,
  // revising 2026-10-18). An unknown code keeps "· Campagne <code>".
  const survey = isVt ? t("vtSurveyTitle") : t("surveyTitle");
  const forPeriod = referencePeriodPhrases(quarterCode, asUiLocale(locale))?.forPeriod;
  // What follows the survey's name, which is painted on its own.
  const surveyRest = forPeriod
    ? [entityOf, forPeriod].filter(Boolean).join(" ")
    : `${entityOf ? `${entityOf} ` : ""}· ${t("campaign", { code: quarterCode || "—" })}`;

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    // The border is declared here, transparent, so that a button setting
    // only borderColor below actually paints one: borderColor alone leaves
    // border-width at 0 and the outline never appears, which is why the PDF
    // preview and the workspace button were reading as the same weight.
    border: "1px solid transparent",
    borderRadius: 6,
    // One height and size for every control on the bar, the entry-mode
    // button included (.cam-mode-switch), so they line up on one baseline;
    // the padding no longer decides the height. 13px, not 14: at 14 the
    // three crowded the title on a laptop (owner, 2026-10-22).
    height: 32,
    padding: "0 10px",
    fontSize: "var(--cam-font-size-xs)",
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
        /* Wordmark | establishment and survey | actions. The title starts
           after the wordmark and takes what the two leave (owner,
           2026-10-22): held at the true centre by two equal side columns,
           it ran into the actions while the wordmark's side stood empty. */
        .cam-masthead-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-template-areas: "brand title actions";
          align-items: center;
          gap: 24px;
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
        /* Centred in the room between wordmark and actions (owner,
           2026-10-22), not on the bar's own centre: that needs equal side
           columns, which push the title into the actions on a laptop. */
        .cam-masthead-title { grid-area: title; min-width: 0; text-align: center; }
        /* « Mon espace » keeps its words down to a phone, where it shows the
           house alone; its name stays in aria-label. */
        @media (max-width: 599px) {
          .cam-masthead-workspace-label { display: none; }
        }
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
      {/* Two sizes: 18 for who is declaring, 13 for the survey line and the
          buttons. The name is
          semibold, not bold: the page's own title is the one bold anchor. */}
      <div className="cam-masthead-row">
        {/* A working screen: the CAMLEAP logo alone, ONEFOP as a line of
            text under it, not a second logo (docs/standards/brand.md). */}
        <div className="cam-masthead-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/camleap-logo.svg" alt="CAMLEAP" width={270} height={38} />
          <span>{tLanding("endorsement")}</span>
        </div>

        {/* After the wordmark: who is declaring, in which survey, for which round */}
        <div className="cam-masthead-title" style={{ lineHeight: 1.35 }}>
          {establishmentName && (
            <div>
              <span style={{ fontSize: "var(--cam-font-size-lg)", fontWeight: "var(--cam-font-weight-semibold)", color: "var(--cam-text)" }}>{establishmentName}</span>
              {establishmentId && (
                <span style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text)" }}>{` · ${establishmentId}`}</span>
              )}
            </div>
          )}
          {/* The survey and the round on one line, not two: both answer the
              same question -- which declaration is this -- and the
              establishment above is the fact the respondent reads first
              (owner, 2026-10-12). In --cam-text, not muted: at 13px the
              muted slate read as blurred (owner, 2026-10-22); size alone
              ranks it under the name. The survey's name is the one touch of
              colour, brand teal semibold: it says which form this is
              (owner, 2026-10-22). */}
          <div className="cam-masthead-survey" style={{ fontSize: "var(--cam-font-size-xs)", color: "var(--cam-text)" }}>
            <span style={{ color: "var(--cam-primary-dark)", fontWeight: "var(--cam-font-weight-semibold)" }}>{survey}</span>
            {` ${surveyRest}`}
          </div>
        </div>

        {/* Right: entry mode, a save that did not land, PDF preview, workspace */}
        <div className="cam-masthead-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

          {/* The way back to the respondent's workspace, named as such on
              every ONEFOP form (owner, 2026-10-20). It replaces the
              icon-only « Quitter » of 2026-10-12, which went to the same
              place but did not say so. onExit saves what the server does not
              have yet, then goes to /home; without one, it goes there
              directly. */}
          <button
            type="button"
            onClick={onExit ? onExit : () => window.location.assign("/home")}
            className="cam-hoverable"
            aria-label={t("workspace")}
            style={{
              ...buttonStyle,
              background: "var(--cam-surface)",
              borderColor: "var(--cam-border)",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5 12 3l9 7.5M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
            </svg>
            <span className="cam-masthead-workspace-label">{t("workspace")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
