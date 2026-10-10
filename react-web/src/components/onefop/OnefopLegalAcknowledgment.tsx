"use client";

// Welcome card shown before a declaration: greeting, confidentiality notice
// (Law N° 2020/010), consent checkbox, then Begin. A short logo beat
// precedes the card.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export interface OnefopLegalAcknowledgmentProps {
  entityType: string;
  respondentName?: string;
  respondentFunction?: string;
  onAcknowledged: () => void;
  onCancel: () => void;
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--cam-green)", flexShrink: 0 }}
    >
      <path d="M12 2 4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
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
    <div
      data-entity-type={_entityType}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--cam-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--cam-space-5) var(--cam-space-4)",
        paddingTop: "calc(var(--cam-space-5) + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(var(--cam-space-5) + env(safe-area-inset-bottom, 0px))",
        fontFamily: "var(--cam-font-sans)",
        boxSizing: "border-box",
      }}
    >
      {flowState === "loading" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--cam-space-4)",
          }}
        >
          <div
            className="cam-pulsing-logo"
            style={{
              width: 120,
              height: 120,
              borderRadius: "var(--cam-radius-full)",
              backgroundColor: "var(--cam-surface)",
              boxShadow: "0 0 40px rgba(30, 107, 58, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/onefop_logo.png"
              alt={t("onefopLegalAcknowledgment.logoAlt")}
              width={110}
              height={110}
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
      )}

      {(flowState === "card" || flowState === "exiting") && (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: "var(--cam-surface)",
            border: "var(--cam-border-width) solid var(--cam-border)",
            borderRadius: "var(--cam-radius-lg)",
            boxShadow: "var(--cam-shadow-sm)",
            padding: "var(--cam-space-6) var(--cam-space-5)",
            textAlign: "center",
            transition: "opacity 0.3s ease, transform 0.3s ease",
            opacity: flowState === "exiting" ? 0 : 1,
            transform: flowState === "exiting" ? "scale(0.97)" : "scale(1)",
          }}
        >
          <div style={{ position: "relative", padding: "0 var(--cam-space-6)" }}>
            <p
              style={{
                fontSize: "var(--cam-font-size-lg)",
                fontWeight: 600,
                color: "var(--cam-text)",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {t("onefopLegalAcknowledgment.welcomeGreeting", { name: nameDisplay })}
            </p>
            <p
              style={{
                fontSize: "var(--cam-font-size-xs)",
                color: "var(--cam-text-muted)",
                margin: "var(--cam-space-1) 0 0",
                lineHeight: 1.4,
              }}
            >
              {functionDisplay}
            </p>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t("onefopLegalAcknowledgment.closeButtonTitle")}
              title={t("onefopLegalAcknowledgment.closeButtonTitle")}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 30,
                height: 30,
                borderRadius: "var(--cam-radius-control)",
                border: "none",
                background: "transparent",
                color: "var(--cam-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CloseIcon />
            </button>
          </div>

          <p
            style={{
              fontSize: "var(--cam-font-size-sm)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--cam-text)",
              lineHeight: 1.4,
              margin: "var(--cam-space-4) 0 var(--cam-space-5)",
            }}
          >
            {t(isVocationalTraining ? "onefopLegalAcknowledgment.formTitleVt" : "onefopLegalAcknowledgment.formTitle")}
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--cam-space-2)",
              textAlign: "center",
              background: "var(--cam-success-bg)",
              borderRadius: "var(--cam-radius-lg)",
              padding: "var(--cam-space-4)",
              marginBottom: "var(--cam-space-5)",
            }}
          >
            <ShieldIcon />
            <div>
              <p
                style={{
                  fontSize: "var(--cam-font-size-xs)",
                  fontWeight: 600,
                  color: "var(--cam-text)",
                  margin: "0 0 var(--cam-space-1)",
                }}
              >
                {t("onefopLegalAcknowledgment.confidentialNoticeTitle")}
              </p>
              <p
                style={{
                  fontSize: "var(--cam-font-size-xs)",
                  color: "var(--cam-text-muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {t("onefopLegalAcknowledgment.confidentialNoticeBody")}
              </p>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: "var(--cam-space-2)",
              fontSize: "var(--cam-answer-size)",
              color: "var(--cam-text-muted)",
              margin: "0 auto var(--cam-space-5)",
              cursor: "pointer",
              lineHeight: 1.4,
              textAlign: "left",
              maxWidth: "100%",
            }}
          >
            <input
              type="checkbox"
              checked={isAcknowledged}
              onChange={(e) => setIsAcknowledged(e.target.checked)}
              style={{
                marginTop: 2,
                flexShrink: 0,
                width: 16,
                height: 16,
                accentColor: "var(--cam-green)",
                cursor: "pointer",
              }}
            />
            <span>{t("onefopLegalAcknowledgment.acknowledgeCheckboxLabel")}</span>
          </label>

          <button
            type="button"
            onClick={handleBegin}
            disabled={!isAcknowledged}
            style={{
              width: "100%",
              height: "var(--cam-button-height)",
              borderRadius: "var(--cam-radius-lg)",
              background: isAcknowledged ? "var(--cam-green)" : "var(--cam-border)",
              color: isAcknowledged ? "#ffffff" : "var(--cam-text-muted)",
              border: "none",
              fontSize: "var(--cam-font-size-base)",
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: isAcknowledged ? "pointer" : "not-allowed",
            }}
          >
            {t("onefopLegalAcknowledgment.beginButton")}
          </button>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--cam-space-2)",
              marginTop: "var(--cam-space-4)",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                fontSize: "var(--cam-font-size-xs)",
                fontFamily: "inherit",
                color: "var(--cam-text-muted)",
                cursor: "pointer",
              }}
            >
              {t("onefopLegalAcknowledgment.goBackButton")}
            </button>
            <span
              style={{
                fontSize: "var(--cam-font-size-3xs)",
                color: "var(--cam-text-muted)",
              }}
            >
              {t("onefopLegalAcknowledgment.estimatedTime")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
