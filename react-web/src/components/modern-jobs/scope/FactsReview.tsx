"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { TrackerRow, BeatDefinition } from "./ScopeTypes";
import { FactsTracker } from "./FactsTracker";

interface FactsReviewProps {
  rows: TrackerRow[];
  activeBeat: BeatDefinition;
  onSelectBeat: (beat: BeatDefinition) => void;
  hasDroppedDataWarning: boolean;
  onModify: () => void;
  onConfirmProceed: () => void;
  locale?: "fr" | "en";
}

/**
 * Final review screen of the factual interview:
 * - Renders full-width (the side column is hidden).
 * - Displays the same 7-column labelled tracker table full width.
 * - Shrink warning if previously typed figures will not be submitted.
 * - Actions: Modifier · Passer à la saisie.
 */
export function FactsReview({
  rows,
  activeBeat,
  onSelectBeat,
  hasDroppedDataWarning,
  onModify,
  onConfirmProceed,
  locale = "fr",
}: FactsReviewProps) {
  const t = useTranslations("modernJobs.factsReview");
  const title = t("title");
  const lead = t("lead");
  const warningText = t("warning");
  const btnModify = t("modify");
  const btnProceed = t("proceed");

  return (
    <div
      style={{
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "clamp(20px, 4vw, 36px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          borderBottom: "2px solid var(--cam-green)",
          paddingBottom: 12,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            margin: "0 0 6px",
            color: "var(--cam-text)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--cam-text-muted)",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {lead}
        </p>
      </div>

      {/* Warning banner if figures were typed for tables that are now omitted */}
      {hasDroppedDataWarning && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "var(--cam-radius-sm, 6px)",
            color: "#92400e",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>{warningText}</span>
        </div>
      )}

      {/* Full-width Labelled Tracker Table */}
      <div style={{ marginBottom: 32 }}>
        <FactsTracker
          rows={rows}
          activeBeat={activeBeat}
          onSelectBeat={onSelectBeat}
          locale={locale}
          fullWidth={true}
        />
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 16,
          borderTop: "1px solid var(--cam-border)",
        }}
      >
        <button
          type="button"
          onClick={onModify}
          style={{
            background: "transparent",
            border: "1px solid var(--cam-border)",
            borderRadius: "var(--cam-radius-sm, 6px)",
            padding: "9px 20px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cam-text)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {btnModify}
        </button>
        <button
          type="button"
          onClick={onConfirmProceed}
          className="cam-hoverable"
          style={{
            background: "var(--cam-green)",
            border: "none",
            borderRadius: "var(--cam-radius-sm, 6px)",
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 700,
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(30, 107, 58, 0.2)",
          }}
        >
          {btnProceed} →
        </button>
      </div>
    </div>
  );
}
