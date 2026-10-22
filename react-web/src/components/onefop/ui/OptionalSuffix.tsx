"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { OnefopField } from "@/lib/onefop-schema";
import { isOptionalField } from "@/lib/onefop-validation";
import { VT_ADMIN_ONLY_IDS } from "@/components/onefop/vt-wizard-utils";
import { InfoTooltip } from "./InfoTooltip";

/**
 * " (facultatif)" after a question label, in muted text, for questions a
 * respondent may leave blank. Required questions carry no mark: each section
 * says once that every question is required unless marked optional
 * (RequiredQuestionsNote), and the control itself exposes aria-required.
 */
export function OptionalSuffix({ field }: { field: Pick<OnefopField, "id" | "required"> }) {
  const t = useTranslations("onefopUi");
  // Administrative fields the respondent never fills (1.1 Code de la
  // Structure, read-only) are not "optional" questions: no suffix.
  if (!isOptionalField(field) || VT_ADMIN_ONLY_IDS.has(field.id)) return null;
  return (
    <span style={{ color: "var(--cam-text-muted)", fontWeight: "var(--cam-font-weight-regular)" }}>
      {" "}
      {t("optionalSuffix")}
    </span>
  );
}

/**
 * The same sentence as RequiredQuestionsNote, behind an ⓘ beside a section
 * heading, where a line of its own under the heading pushed the first table
 * down (owner, 2026-10-22). The button's name is the sentence itself, so a
 * screen reader hears it without opening the tooltip.
 */
export function RequiredQuestionsInfo() {
  const t = useTranslations("onefopUi");
  return <InfoTooltip content={t("requiredQuestionsNote")} ariaLabel={t("requiredQuestionsNote")} />;
}

/** The one sentence under a section heading that explains OptionalSuffix. */
export function RequiredQuestionsNote({ style }: { style?: CSSProperties }) {
  const t = useTranslations("onefopUi");
  return (
    <p
      style={{
        fontFamily: "var(--cam-font-sans)",
        fontSize: "var(--cam-microcopy-size)",
        color: "var(--cam-microcopy-color)",
        lineHeight: 1.4,
        margin: "var(--cam-microcopy-margin-top) 0 0",
        ...style,
      }}
    >
      {t("requiredQuestionsNote")}
    </p>
  );
}
