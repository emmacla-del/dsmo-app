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
  /** Room left at the right for the live PDF preview beside the form, so
   *  the bar ends where the form does instead of covering the preview. */
  rightInset?: string;
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
  rightInset,
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
        right: rightInset ?? 0,
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
            {/* Previous and Next: the .cam-button pair the VT wizard uses
                (WizardShell), so every form's buttons share one size. */}
            <button
              type="button"
              onClick={onPrev}
              disabled={isFirst}
              className="cam-button cam-button-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                ...(isFirst ? { opacity: 0.6, cursor: "not-allowed" } : null),
              }}
            >
              <span aria-hidden="true">←</span>
              <span>{prevLabel ?? t("previous")}</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!canAdvance || isSubmitting}
              className="cam-button cam-button-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
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
