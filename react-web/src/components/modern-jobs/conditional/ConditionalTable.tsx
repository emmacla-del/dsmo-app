"use client";

import React from "react";
import type { FormData, OnefopField } from "@/lib/onefop-schema";
import { localized } from "@/lib/onefop-schema";
import { SkipLogicBanner } from "@/components/onefop/SkipLogicBanner";
import { GatewayQuestion, type ResponseStatus } from "./GatewayQuestion";
import {
  getGatewayCopy,
  resolveTableStatusFieldId,
} from "./gateway-catalog";

export { isCompanionHiddenByGateway, resolveTableStatusFieldId } from "./gateway-catalog";

export interface ConditionalTableProps {
  tableField: OnefopField;
  data: FormData;
  onChange: (fieldId: string, value: unknown) => void;
  locale?: "fr" | "en";
  errorMessage?: string;
  children: React.ReactNode;
}

export function ConditionalTable({
  tableField,
  data,
  onChange,
  locale = "fr",
  errorMessage,
  children,
}: ConditionalTableProps) {
  const catalog = getGatewayCopy(tableField);
  const statusFieldId = resolveTableStatusFieldId(tableField, data);
  const rawStatus = data[statusFieldId];
  const currentStatus = typeof rawStatus === "string" ? (rawStatus as ResponseStatus) : null;

  const handleStatusChange = (_id: string, newStatus: ResponseStatus) => {
    onChange(statusFieldId, newStatus);
  };

  const followUp = catalog ? localized(catalog.followUp, locale) : null;

  // Rule 6: Hide NONE and NOT_APPLICABLE tables on saisie (no SkipLogicBanner walls)
  if (currentStatus === "NONE" || currentStatus === "NOT_APPLICABLE") {
    return null;
  }

  // When REPORTED, render the table directly without the banner wall
  if (currentStatus === "REPORTED") {
    return (
      <div
        style={{
          marginBottom: "var(--cam-space-6, 32px)",
          paddingBottom: "var(--cam-space-5, 24px)",
          borderBottom: "1px solid var(--cam-border, #d8ddd3)",
        }}
      >
        {followUp && (
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--cam-text, #0b1f14)",
              margin: "0 0 12px",
              lineHeight: 1.4,
            }}
          >
            {followUp}
          </p>
        )}
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              marginBottom: 12,
              borderRadius: "var(--cam-radius-sm, 4px)",
              background: "rgba(179, 38, 30, 0.08)",
              border: "1px solid rgba(179, 38, 30, 0.3)",
              color: "var(--cam-error, #b3261e)",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: "var(--cam-space-6, 32px)",
        paddingBottom: "var(--cam-space-5, 24px)",
        borderBottom: "1px solid var(--cam-border, #d8ddd3)",
      }}
    >
      <GatewayQuestion
        tableId={tableField.id}
        statusFieldId={statusFieldId}
        questionPrompt={catalog?.question}
        hint={catalog?.hint}
        value={currentStatus}
        onChange={handleStatusChange}
        locale={locale}
        errorMessage={errorMessage}
      />
    </div>
  );
}
