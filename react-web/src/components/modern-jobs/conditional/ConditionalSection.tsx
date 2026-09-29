"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SkipLogicBanner } from "@/components/onefop/SkipLogicBanner";

export interface ConditionalSectionProps {
  /** If false, section is hidden or skipped */
  condition: boolean;
  /** Optional title for the skip reassurance banner */
  title?: string;
  /** Optional message explaining why this section was skipped */
  skipMessage?: string;
  /** Reassurance badge text, e.g. "Section validée (sans objet)" */
  reassurance?: string;
  /** If true, do not render a banner when skipped, completely unmount */
  silent?: boolean;
  children: React.ReactNode;
}

/**
 * Conditionally renders a section or subsection based on entity conditions or skip logic.
 * When skipped and not silent, renders an explicit SkipLogicBanner reassuring the respondent
 * that the section is accounted for and validly excluded.
 */
export function ConditionalSection({
  condition,
  title,
  skipMessage,
  reassurance,
  silent = false,
  children,
}: ConditionalSectionProps) {
  const t = useTranslations("modernJobs.conditionalSection");
  if (!condition) {
    if (silent) return null;
    return (
      <SkipLogicBanner
        title={title ?? t("title")}
        message={skipMessage ?? t("message")}
        reassurance={reassurance ?? t("reassurance")}
        style={{ marginBottom: "var(--cam-space-5, 20px)" }}
      />
    );
  }

  return <>{children}</>;
}
