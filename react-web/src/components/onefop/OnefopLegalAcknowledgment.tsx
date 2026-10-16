"use client";

// Start page shown before a declaration: the questionnaire title, who is
// answering, the confidentiality notice (Law N° 2020/010), consent, then
// Begin. A short CAMLEAP logo beat precedes it. Styling lives in globals.css
// (.cam-welcome-*); inline style here would break UI grammar G14.

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale } from "@/lib/register-i18n";
import { RESPONDENT_FUNCTION_OPTIONS, registerOptionLabel } from "@/lib/register-options";
import { CamleapOvalMark } from "@/components/brand/CamleapOvalMark";

export interface OnefopLegalAcknowledgmentProps {
  entityType: string;
  respondentName?: string;
  respondentFunction?: string;
  /** The establishment the declaration is made for, and its ONEFOP code. */
  establishmentName?: string;
  establishmentId?: string;
  onAcknowledged: () => void;
  onCancel: () => void;
}

export function OnefopLegalAcknowledgment({
  entityType: _entityType,
  respondentName,
  respondentFunction,
  establishmentName,
  establishmentId,
  onAcknowledged,
  onCancel,
}: OnefopLegalAcknowledgmentProps) {
  const t = useTranslations();
  const locale = asUiLocale(useLocale());
  // Training centres answer the annual vocational-training census (ASFOP),
  // not the modern-economy jobs survey the other entities answer.
  const isVocationalTraining = ["vocationaltraining", "vocational_training", "vt"].includes(
    _entityType.toLowerCase(),
  );
  const [flowState, setFlowState] = useState<"loading" | "card" | "exiting">("loading");
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFlowState("card");
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  function handleBegin() {
    if (!isAcknowledged) return;
    setFlowState("exiting");
    setTimeout(() => {
      onAcknowledged();
    }, 300);
  }

  const nameDisplay = respondentName?.trim() || t("onefopLegalAcknowledgment.defaultRespondentName");
  // Who declares, in what role, for which establishment: the facts the
  // acknowledgment is given under. A part that is not known is left out,
  // never filled with a stand-in role.
  // A role picked from the registration list is stored in French ("Directeur
  // Général"); it is shown in the reader's language. A role typed by hand
  // is shown as typed.
  const storedRole = respondentFunction?.trim();
  const role = storedRole ? registerOptionLabel(RESPONDENT_FUNCTION_OPTIONS, storedRole, locale) : undefined;
  const establishment = establishmentName?.trim();
  const declarationKey = establishment
    ? role ? "declaringAsFor" : "declaringFor"
    : role ? "declaringAs" : null;
  const declaration = declarationKey
    ? t.rich(`onefopLegalAcknowledgment.${declarationKey}`, {
        function: role ?? "",
        establishment: establishment ?? "",
        code: establishmentId ? ` (${establishmentId})` : "",
        b: (chunks) => <strong>{chunks}</strong>,
      })
    : null;

  return (
    <main data-entity-type={_entityType} className="cam-welcome">
      {flowState === "loading" && (
        // The platform opens on its own name; the ONEFOP emblem then heads
        // the notice as the issuing institution (owner, 2026-10-12).
        <div className="cam-welcome-splash">
          {/* The oval launch mark, not the flat wordmark: the opening beat
              traces its frame and raises the name inside it, which needs the
              SVG inline (owner, 2026-10-12). */}
          <CamleapOvalMark />
        </div>
      )}

      {(flowState === "card" || flowState === "exiting") && (
        <div className={`cam-welcome-body${flowState === "exiting" ? " is-exiting" : ""}`}>
          {/* The issuing authority over the panel, as on the paper form's
              letterhead: the notice is the State's, not the platform's. */}
          <header className="cam-welcome-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/onefop_logo.png" alt={t("onefopLegalAcknowledgment.logoAlt")} width={56} height={56} />
            <p className="cam-welcome-authority">{t("sovereignMasthead.officialPortalNotice")}</p>
          </header>

          {/* One panel, an app's start screen: the declaration, the notice,
              then consent and Begin (owner, 2026-10-12). A hairline edge,
              no fill or shadow. */}
          <div className="cam-welcome-panel">
            <h1 className="cam-welcome-title">
              {t(isVocationalTraining ? "onefopLegalAcknowledgment.formTitleVt" : "onefopLegalAcknowledgment.formTitle")}
            </h1>
            <p className="cam-welcome-greeting">
              {t("onefopLegalAcknowledgment.welcomeGreeting", { name: nameDisplay })}
            </p>
            {declaration ? <p className="cam-welcome-respondent">{declaration}</p> : null}
            <p className="cam-welcome-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {t("onefopLegalAcknowledgment.estimatedTime")}
            </p>

            {/* The notice, with the law it rests on cited under its title. */}
            <section className="cam-welcome-notice" aria-labelledby="cam-welcome-notice-title">
              <h2 id="cam-welcome-notice-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                {t("onefopLegalAcknowledgment.confidentialNoticeTitle")}
              </h2>
              <p className="cam-welcome-notice-basis">{t("onefopLegalAcknowledgment.lawReference")}</p>
              <p className="cam-welcome-notice-text">{t("onefopLegalAcknowledgment.confidentialNoticeBody")}</p>
            </section>

            <label className="cam-welcome-consent cam-answer">
              <input
                type="checkbox"
                checked={isAcknowledged}
                onChange={(e) => setIsAcknowledged(e.target.checked)}
              />
              <span>{t("onefopLegalAcknowledgment.acknowledgeCheckboxLabel")}</span>
            </label>

            <div className="cam-welcome-actions">
              <button
                type="button"
                className="cam-button cam-button-primary"
                onClick={handleBegin}
                disabled={!isAcknowledged}
              >
                {t("onefopLegalAcknowledgment.beginButton")}
              </button>
              <button type="button" className="cam-text-button" onClick={onCancel}>
                {t("onefopLegalAcknowledgment.goBackButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
