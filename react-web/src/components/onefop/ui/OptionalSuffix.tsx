"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { OnefopField } from "@/lib/onefop-schema";
import { isOptionalField } from "@/lib/onefop-validation";
import { VT_ADMIN_ONLY_IDS } from "@/components/onefop/vt-wizard-utils";

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
    <span style={{ color: "var(--cam-text-muted)", fontWeight: 400 }}>
      {" "}
      {t("optionalSuffix")}
    </span>
  );
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
