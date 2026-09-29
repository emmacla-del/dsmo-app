"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface SovereignMastheadProps {
  entityTypeName?: string;
  establishmentName?: string;
  taxNumber?: string;
  cnpsNumber?: string;
  quarterCode?: string;
  compact?: boolean;
}

/**
 * Sovereign Government Masthead & Institutional Context Bar.
 * Faithfully ported from lib/screens/onefop/widgets/sovereign_masthead.dart
 * following USWDS and GDS government portal standards for the Republic of Cameroon
 * (MINEFOP / ONEFOP / DSMO).
 */
export function SovereignMasthead({
  entityTypeName,
  establishmentName = "",
  taxNumber = "",
  cnpsNumber = "",
  quarterCode = "",
  compact = false,
}: SovereignMastheadProps) {
  const t = useTranslations();
  const [expandedLegal, setExpandedLegal] = useState(false);
  const resolvedEntityTypeName = entityTypeName ?? t("sovereignMasthead.defaultEntityType");

  return (
    <header style={{ width: "100%", marginBottom: "var(--cam-space-4)" }}>
      {/* ── 1. Official Government Disclosure Banner (USWDS Style) ── */}
      <div
        style={{
          background: "var(--cam-green-dark, #144a28)",
          color: "#E2E8F0",
          padding: "4px 16px",
          display: "flex",
          alignItems: "center",
          fontSize: "11px",
          fontWeight: 500,
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {/* National Tricolor Ribbon */}
        <div
          aria-hidden="true"
          style={{
            width: 20,
            height: 12,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.3)",
            display: "flex",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, background: "var(--cam-flag-green, #0e5c2b)" }} />
          <div
            style={{
              flex: 1,
              background: "var(--cam-flag-red, #b3202c)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "var(--cam-flag-yellow, #f0b429)", fontSize: "7px", lineHeight: 1 }}>★</span>
          </div>
          <div style={{ flex: 1, background: "var(--cam-flag-yellow, #f0b429)" }} />
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>{t("sovereignMasthead.officialPortalNotice")}</div>

        <button
          type="button"
          onClick={() => setExpandedLegal((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--cam-gold, #e8a020)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            whiteSpace: "nowrap",
          }}
        >
          {expandedLegal ? t("sovereignMasthead.hideLegalNoticeButton") : t("sovereignMasthead.showLegalNoticeButton")}
        </button>
      </div>

      {/* ── Expandable Legal / Statistical Secrecy Notice ── */}
      {expandedLegal && (
        <div
          style={{
            background: "rgba(20, 74, 40, 0.95)",
            color: "#CBD5E1",
            padding: "12px 20px",
            fontSize: "12px",
            lineHeight: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>
            {t("sovereignMasthead.legalNoticeHeading")}
          </div>
          <div>{t("sovereignMasthead.legalNoticeBody")}</div>
        </div>
      )}

      {/* ── 2. Sovereign Bilateral Header (Republic of Cameroon / Ministries) ── */}
      <div
        style={{
          background: "var(--cam-green-dark, #144a28)",
          color: "#FFFFFF",
          padding: compact ? "8px 16px" : "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* French Official Heading */}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase" }}>
            {t("sovereignMasthead.republicHeadingFr")}
          </div>
          <div style={{ fontSize: "10px", fontStyle: "italic", color: "#E2E8F0" }}>{t("sovereignMasthead.mottoFr")}</div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--cam-gold, #e8a020)", marginTop: "2px" }}>
            {t("sovereignMasthead.ministryHeadingFr")}
          </div>
        </div>

        {/* Center Emblem / Brand */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 900, letterSpacing: "1.2px" }}>{t("sovereignMasthead.brandCenter")}</div>
          <div
            style={{
              fontSize: "8px",
              fontWeight: 800,
              background: "var(--cam-green, #1e6b3a)",
              color: "#FFFFFF",
              border: "1px solid var(--cam-gold, #e8a020)",
              borderRadius: "3px",
              padding: "1px 8px",
              marginTop: "2px",
              letterSpacing: "0.5px",
            }}
          >
            {t("sovereignMasthead.portalBadge")}
          </div>
        </div>

        {/* English Official Heading */}
        <div style={{ flex: 1, minWidth: 220, textAlign: "right" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase" }}>
            {t("sovereignMasthead.republicHeadingEn")}
          </div>
          <div style={{ fontSize: "10px", fontStyle: "italic", color: "#E2E8F0" }}>{t("sovereignMasthead.mottoEn")}</div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--cam-gold, #e8a020)", marginTop: "2px" }}>
            {t("sovereignMasthead.ministryHeadingEn")}
          </div>
        </div>
      </div>

      {/* ── 3. Establishment Identification Bar ── */}
      <div
        style={{
          background: "var(--cam-surface-subtle, #fbfbf9)",
          borderBottom: "1px solid var(--cam-border, #d8ddd3)",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "12px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--cam-text, #0b1f14)", display: "flex", alignItems: "center", gap: "6px" }}>
          <span aria-hidden="true">🏛️</span>
          {establishmentName || t("sovereignMasthead.currentDeclarationFallback")}
        </span>

        {taxNumber && (
          <span
            style={{
              background: "var(--cam-surface, #ffffff)",
              border: "1px solid var(--cam-border, #d8ddd3)",
              borderRadius: "3px",
              padding: "1px 6px",
              fontSize: "11px",
              fontFamily: "var(--cam-font-mono)",
            }}
          >
            <strong>{t("sovereignMasthead.niuLabel")}</strong> {taxNumber}
          </span>
        )}

        {cnpsNumber && (
          <span
            style={{
              background: "var(--cam-surface, #ffffff)",
              border: "1px solid var(--cam-border, #d8ddd3)",
              borderRadius: "3px",
              padding: "1px 6px",
              fontSize: "11px",
              fontFamily: "var(--cam-font-mono)",
            }}
          >
            <strong>{t("sovereignMasthead.cnpsLabel")}</strong> {cnpsNumber}
          </span>
        )}

        <span
          style={{
            background: "var(--cam-surface, #ffffff)",
            border: "1px solid var(--cam-border, #d8ddd3)",
            borderRadius: "3px",
            padding: "1px 6px",
            fontSize: "11px",
          }}
        >
          <strong>{t("sovereignMasthead.periodLabel")}</strong> {quarterCode || "—"}
        </span>

        <span
          style={{
            marginLeft: "auto",
            background: "var(--cam-green, #1e6b3a)",
            color: "#FFFFFF",
            fontWeight: 800,
            fontSize: "10px",
            borderRadius: "4px",
            padding: "2px 8px",
            letterSpacing: "0.5px",
          }}
        >
          {resolvedEntityTypeName.toUpperCase()}
        </span>
      </div>
    </header>
  );
}
