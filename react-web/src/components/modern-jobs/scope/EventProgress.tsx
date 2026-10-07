"use client";

import { useTranslations } from "next-intl";
import React from "react";

export interface ProgressGroup {
  id: "emploi" | "primo" | "departs" | "stages";
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

export interface EventProgressProps {
  groups: ProgressGroup[];
  onSelectGroup?: (groupId: "emploi" | "primo" | "departs" | "stages") => void;
  locale?: "fr" | "en";
  inCard?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Navigation tabs for the factual interview:
 * QUIZ PRÉALABLE  ● Emploi  ✓ Primo-emploi  ○ Départs  ○ Stages
 */
export function EventProgress({
  groups,
  onSelectGroup,
  inCard = false,
  className,
  style,
}: EventProgressProps) {
  const t = useTranslations("modernJobs.eventProgress");
  const rootLabel = t("rootLabel");

  return (
    <nav
      aria-label={t("ariaLabel")}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: inCard ? "var(--cam-space-3, 12px) var(--cam-space-4, 16px)" : "8px 12px",
        paddingBottom: inCard ? "var(--cam-space-3, 12px)" : 14,
        marginBottom: inCard ? "var(--cam-space-3, 12px)" : 20,
        borderBottom: "1px solid var(--cam-border)",
        fontSize: 13,
        ...style,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 800,
          color: "var(--cam-green)",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          fontSize: 11.5,
          paddingRight: 4,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13 }} aria-hidden="true">
          📋
        </span>
        <span>{rootLabel}</span>
      </div>

      <div
        className={inCard ? "cam-quiz-tabs" : undefined}
        style={
          inCard
            ? undefined
            : {
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                minWidth: 0,
              }
        }
      >
        {groups.map((grp) => {
          const bullet = grp.isActive ? "●" : grp.isComplete ? "✓" : "○";
          const color = grp.isActive
            ? "var(--cam-green)"
            : grp.isComplete
              ? "var(--cam-text)"
              : "var(--cam-text-muted)";
          const fontWeight = grp.isActive ? 700 : grp.isComplete ? 600 : 500;
          const background = grp.isActive
            ? "var(--cam-success-bg)"
            : grp.isComplete
              ? "var(--cam-surface-subtle)"
              : "transparent";
          const border = grp.isActive
            ? "1px solid var(--cam-success-border)"
            : grp.isComplete
              ? "1px solid var(--cam-border)"
              : "1px solid transparent";

          return (
            <button
              key={grp.id}
              type="button"
              onClick={() => onSelectGroup?.(grp.id)}
              title={`${grp.label} (${grp.isActive ? t("stateActive") : grp.isComplete ? t("stateCompleted") : t("stateUpcoming")})`}
              style={{
                background,
                border,
                boxSizing: "border-box",
                padding: inCard ? "8px 12px" : "3px 9px",
                minHeight: inCard ? 40 : undefined,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                color,
                fontWeight,
                fontSize: 12.5,
                lineHeight: 1.3,
                textAlign: "center",
                cursor: onSelectGroup ? "pointer" : "default",
                borderRadius: "var(--cam-radius-control, 6px)",
                transition: "all 0.15s ease",
                whiteSpace: inCard ? undefined : "nowrap",
              }}
            >
              <span
                style={{
                  fontSize: grp.isComplete && !grp.isActive ? 11 : 12,
                  color: grp.isActive ? "var(--cam-green)" : grp.isComplete ? "var(--cam-success)" : "inherit",
                }}
              >
                {bullet}
              </span>
              <span>{grp.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
