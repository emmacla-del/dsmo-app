"use client";

// Start page shown before a declaration: the questionnaire title, who is
// answering, the confidentiality notice (Law N° 2020/010), consent, then
// Begin. A short logo beat precedes it. Styling lives in globals.css
// (.cam-welcome-*); inline style here would break UI grammar G14.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export interface OnefopLegalAcknowledgmentProps {
  entityType: string;
  respondentName?: string;
  respondentFunction?: string;
  onAcknowledged: () => void;
  onCancel: () => void;
}

export function OnefopLegalAcknowledgment({
  entityType: _entityType,
  respondentName,
  respondentFunction,
  onAcknowledged,
  onCancel,
}: OnefopLegalAcknowledgmentProps) {
  const t = useTranslations();
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
  const functionDisplay = respondentFunction?.trim() || t("onefopLegalAcknowledgment.defaultRespondentFunction");

  return (
    <main data-entity-type={_entityType} className="cam-welcome">
      {flowState === "loading" && (
        <div className="cam-welcome-splash cam-pulsing-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/onefop_logo.png"
            alt={t("onefopLegalAcknowledgment.logoAlt")}
            width={110}
            height={110}
            style={{ objectFit: "contain" }}
          />
        </div>
      )}

      {(flowState === "card" || flowState === "exiting") && (
        <div className={`cam-welcome-body${flowState === "exiting" ? " is-exiting" : ""}`}>
          <p className="cam-welcome-respondent">
            {t("onefopLegalAcknowledgment.welcomeGreeting", { name: nameDisplay })} · {functionDisplay}
          </p>
          <h1 className="cam-welcome-title">
            {t(isVocationalTraining ? "onefopLegalAcknowledgment.formTitleVt" : "onefopLegalAcknowledgment.formTitle")}
          </h1>
          <p className="cam-welcome-time cam-hint">{t("onefopLegalAcknowledgment.estimatedTime")}</p>

          <section className="cam-welcome-notice" aria-labelledby="cam-welcome-notice-title">
            <h2 id="cam-welcome-notice-title">{t("onefopLegalAcknowledgment.confidentialNoticeTitle")}</h2>
            <p>{t("onefopLegalAcknowledgment.confidentialNoticeBody")}</p>
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
      )}
    </main>
  );
}
