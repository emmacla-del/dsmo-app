"use client";

import React from "react";
import { pinnedSubsectionHeadStyle } from "../form/FormSection";
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
        borderRadius: "var(--cam-radius-md)",
        padding: "var(--cam-space-5)",
        marginBottom: "var(--cam-space-5)",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "var(--cam-shadow-sm, 0 1px 2px rgba(20, 30, 20, 0.04))",
        ...style,
      }}
    >
      {(title || badge || status) && (
        <div
          style={{
            ...(title ? pinnedSubsectionHeadStyle : { marginBottom: 16 }),
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            {badge && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "var(--cam-font-size-2xs)",
                  fontWeight: "var(--cam-font-weight-bold)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--cam-green-dark)",
                  marginBottom: 4,
                }}
              >
                {badge}
              </span>
            )}
            {/* The group's own heading. It was a muted <div> in small
                capitals, smaller than the questions under it — so it ranked
                below what it headed and shouted while doing it. A heading
                element in the page's own voice, as afbd0ed5 set for the
                wizards' group headings. */}
            {title && (
              <h2
                style={{
                  fontSize: "var(--cam-font-size-xl)",
                  fontWeight: "var(--cam-font-weight-bold)",
                  lineHeight: "var(--cam-line-height-title)",
                  color: "var(--cam-text)",
                  margin: 0,
                }}
              >
                {title}
              </h2>
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
