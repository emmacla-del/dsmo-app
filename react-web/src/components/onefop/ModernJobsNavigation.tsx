"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface ModernJobsNavigationProps {
  currentSectionIndex: number;
  totalSections: number;
  onPrev: () => void;
  onNext: () => void;
  onSave?: () => void;
  isSubmitting?: boolean;
  saving?: boolean;
  canAdvance?: boolean;
  isScopeStage?: boolean;
  isValidationStage?: boolean;
  isWideLayout?: boolean;
  isDesktop?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  stepIndicator?: string;
}

/**
 * Sticky Bottom Navigation for the Modern Jobs Wizard.
 * Features content-aligned container, high-contrast actions, and grouped navigation buttons.
 */
export function ModernJobsNavigation({
  currentSectionIndex,
  totalSections,
  onPrev,
  onNext,
  onSave,
  isSubmitting = false,
  saving = false,
  canAdvance = true,
  isScopeStage = false,
  isValidationStage = false,
  isWideLayout = false,
  isDesktop = false,
  nextLabel,
  prevLabel,
  stepIndicator,
}: ModernJobsNavigationProps) {
  const t = useTranslations("modernJobs.nav");
  const isFirst = !isScopeStage && !isValidationStage && currentSectionIndex === 0;
  const isLast = isValidationStage || (!isScopeStage && currentSectionIndex === totalSections - 1);

  return (
    <nav
      aria-label={t("ariaLabel")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: "var(--cam-surface)",
        borderTop: "1px solid var(--cam-border)",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: isDesktop ? "grid" : "flex",
          gridTemplateColumns: isDesktop ? "var(--vt-sidebar-width, 280px) 1fr" : undefined,
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Column 1: Spacer aligned with sidebar */}
        {isDesktop && (
          <div
            aria-hidden="true"
            style={{
              borderRight: "1px solid var(--cam-border)",
              height: "100%",
              minHeight: 64,
            }}
          />
        )}

        {/* Column 2: Content-aligned navigation container */}
        <div
          style={{
            flex: 1,
            padding: "12px clamp(12px, 3vw, 24px)",
            display: "flex",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: (isScopeStage || isWideLayout) ? "min(1360px, 100%)" : "var(--vt-content-max, 940px)",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Left Action: Plain text Previous button aligned under card left edge */}
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              className="cam-hoverable"
              style={{
                background: "transparent",
                border: "none",
                color: isFirst ? "var(--cam-border-strong)" : "var(--cam-text-muted)",
                fontSize: "var(--cam-font-size-sm, 14px)",
                fontWeight: 600,
                fontFamily: "var(--cam-font-sans)",
                cursor: isFirst ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 4px",
                transition: "color 0.15s ease",
              }}
            >
              <span aria-hidden="true">←</span>
              <span>{prevLabel ?? t("previous")}</span>
            </button>

            {/* Right Action: Primary Continue button aligned under card right edge */}
            <button
              type="button"
              onClick={onNext}
              disabled={!canAdvance || isSubmitting}
              className="cam-hoverable"
              style={{
                background: "var(--cam-green)",
                border: "none",
                color: "#ffffff",
                borderRadius: "var(--cam-radius-control, 6px)",
                height: "var(--cam-button-height, 44px)",
                padding: "0 24px",
                fontSize: "var(--cam-font-size-sm, 14px)",
                fontWeight: 600,
                fontFamily: "var(--cam-font-sans)",
                cursor: (!canAdvance || isSubmitting) ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                opacity: (!canAdvance || isSubmitting) ? 0.6 : 1,
                boxShadow: "0 1px 3px rgba(30, 107, 58, 0.2)",
                transition: "background-color 0.15s ease, opacity 0.15s ease",
              }}
            >
              <span>
                {nextLabel ?? (
                  isScopeStage
                    ? t("proceedToEntry")
                    : isLast
                      ? t("reviewSubmit")
                      : t("continue")
                )}
              </span>
              <span aria-hidden="true">{isLast ? "✓" : "→"}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
