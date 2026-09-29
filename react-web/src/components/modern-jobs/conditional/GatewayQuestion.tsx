"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { LocalizedText } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { RadioGroup } from "@/components/onefop/form/Radio";
import { getGatewayCopy, type ResponseStatus } from "./gateway-catalog";

export type { ResponseStatus };

export interface GatewayQuestionProps {
  /** Table field id, e.g. "S21Q01" or "S22Q05_ENTERPRISE". */
  tableId: string;
  /** Canonical `_RESPONSE_STATUS` key written to FormData. */
  statusFieldId: string;
  /** Optional override. Catalog copy is used when omitted. */
  questionPrompt?: LocalizedText | null;
  hint?: LocalizedText | null;
  /** Current `_RESPONSE_STATUS` value. */
  value: unknown;
  onChange: (statusFieldId: string, newStatus: ResponseStatus) => void;
  locale?: "fr" | "en";
  disabled?: boolean;
  errorMessage?: string;
}

/** Message keys (modernJobs.gateway.options.*) for each answer. */
const OPTIONS: { status: ResponseStatus; key: "reported" | "none" | "notApplicable" }[] = [
  { status: "REPORTED", key: "reported" },
  { status: "NONE", key: "none" },
  { status: "NOT_APPLICABLE", key: "notApplicable" },
];

export function GatewayQuestion({
  tableId,
  statusFieldId,
  questionPrompt,
  hint,
  value,
  onChange,
  locale = "fr",
  disabled = false,
  errorMessage,
}: GatewayQuestionProps) {
  const t = useTranslations("modernJobs.gateway");
  const catalog = getGatewayCopy({ id: tableId });
  const currentStatus = typeof value === "string" ? (value as ResponseStatus) : null;
  const hasError = Boolean(errorMessage) && !currentStatus;

  const promptText = questionPrompt
    ? localized(questionPrompt, locale)
    : catalog
      ? localized(catalog.question, locale)
      : t("fallbackPrompt");

  const hintText = hint
    ? localized(hint, locale)
    : catalog
      ? localized(catalog.hint, locale)
      : null;

  const errorText =
    hasError
      ? t("chooseAnswer")
      : null;

  const paperCode = tableId.replace(/_ENTERPRISE$|_OTHER$/i, "").toUpperCase();

  return (
    <div
      data-testid={`gateway-question-${paperCode}`}
      data-gateway-status={currentStatus ?? "unanswered"}
      style={{ marginBottom: 4 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--cam-text-muted, #4a5a50)",
          }}
        >
          {paperCode}
        </span>
      </div>

      <h3
        id={`gateway-title-${paperCode}`}
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--cam-text, #0b1f14)",
          margin: "6px 0 8px",
          lineHeight: 1.35,
        }}
      >
        {promptText}
        <span
          aria-hidden="true"
          style={{
            color: "var(--cam-error, #b3261e)",
            marginLeft: 6,
            fontWeight: 700,
          }}
        >
          *
        </span>
      </h3>

      {hintText && (
        <p
          style={{
            fontSize: 14,
            color: "var(--cam-text-muted, #4a5a50)",
            margin: "0 0 14px",
            lineHeight: 1.45,
            maxWidth: 640,
          }}
        >
          {hintText}
        </p>
      )}

      <RadioGroup
        fieldId={statusFieldId}
        ariaLabel={promptText}
        value={currentStatus}
        onChange={(fieldId, next) => onChange(fieldId, next as ResponseStatus)}
        layout="vertical"
        options={OPTIONS.map((opt) => ({
          value: opt.status,
          label: t(`options.${opt.key}.label`),
          caption: t(`options.${opt.key}.caption`),
          disabled,
        }))}
      />

      {errorText && (
        <p
          id={`${statusFieldId}-error`}
          role="alert"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--cam-error, #b3261e)",
            margin: "10px 0 0",
          }}
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
