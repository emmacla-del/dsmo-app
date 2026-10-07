"use client";

import React from "react";
import { StatusChip, type FormStatus } from "../form/StatusChip";

interface FormSectionCardProps {
  id?: string;
  title?: string;
  description?: string;
  status?: FormStatus;
  statusLabel?: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FormSectionCard provides structured card containment for questionnaire subsections.
 * Prevents "endless form fatigue" by chunking fields into visually distinct,
 * well-proportioned institutional modules with optional progress status chips.
 */
export function FormSectionCard({
  id,
  title,
  description,
  status,
  statusLabel,
  badge,
  children,
  className,
  style,
}: FormSectionCardProps) {
  return (
    <div
      id={id}
      className={className}
      style={{
        background: "var(--cam-surface)",
        border: "1px solid var(--cam-border)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "var(--cam-space-5, 24px)",
        marginBottom: "var(--cam-space-5, 24px)",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "var(--cam-shadow-sm, 0 1px 2px rgba(20, 30, 20, 0.04))",
        ...style,
      }}
    >
      {(title || badge || status) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            {badge && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "var(--cam-font-size-2xs, 0.6875rem)",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--cam-green-dark)",
                  marginBottom: 4,
                }}
              >
                {badge}
              </span>
            )}
            {title && (
              <div
                style={{
                  fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                  fontWeight: 600,
                  color: "var(--cam-text-muted)",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {title}
              </div>
            )}
            {description && (
              <p
                style={{
                  fontSize: "var(--cam-font-size-xs, 0.8125rem)",
                  color: "var(--cam-text-muted)",
                  margin: "var(--cam-space-1, 4px) 0 0",
                  lineHeight: 1.4,
                }}
              >
                {description}
              </p>
            )}
          </div>

          {status && statusLabel && (
            <div style={{ alignSelf: "flex-start" }}>
              <StatusChip status={status} label={statusLabel} />
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
