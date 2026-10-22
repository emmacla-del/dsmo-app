"use client";

import { useTranslations } from "next-intl";
import { WizardNavigation } from "./WizardNavigation";

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

/** Resolves the six-type wizard's stage labels and delegates shared rendering. */
export function ModernJobsNavigation({
  currentSectionIndex,
  totalSections,
  onPrev,
  onNext,
  isSubmitting = false,
  canAdvance = true,
  isScopeStage = false,
  isValidationStage = false,
  isWideLayout = false,
  isDesktop = false,
  nextLabel,
  prevLabel,
}: ModernJobsNavigationProps) {
  const t = useTranslations("modernJobs.nav");
  const isFirst = !isScopeStage && !isValidationStage && currentSectionIndex === 0;
  const isLast = isValidationStage || (!isScopeStage && currentSectionIndex === totalSections - 1);

  return (
    <WizardNavigation
      ariaLabel={t("ariaLabel")}
      onPrevious={onPrev}
      previousLabel={prevLabel ?? t("previous")}
      previousDisabled={isFirst}
      onNext={onNext}
      nextLabel={nextLabel ?? (
        isScopeStage
          ? t("proceedToEntry")
          : isLast
            ? t("reviewSubmit")
            : t("continue")
      )}
      nextDisabled={!canAdvance || isSubmitting}
      nextIcon={isLast ? "\u2713" : "\u2192"}
      desktopSidebar={isDesktop}
      contentMaxWidth={(isScopeStage || isWideLayout)
        ? "min(1360px, 100%)"
        : "var(--vt-content-max, 940px)"}
    />
  );
}
