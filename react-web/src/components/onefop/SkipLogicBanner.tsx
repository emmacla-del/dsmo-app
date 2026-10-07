"use client";

import React from "react";

interface SkipLogicBannerProps {
  title?: string;
  message: string;
  reassurance?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SkipLogicBanner provides visual reassurance to self-respondents when conditional
 * branches or entire sections are skipped (e.g., S2Q01 = "Non" -> no recruits this quarter).
 * Instead of questions abruptly vanishing, this card confirms that skipping is intended
 * and the section is safely accounted for.
 */
export function SkipLogicBanner({
  title,
  message,
  reassurance,
  className,
  style,
}: SkipLogicBannerProps) {
  return (
    <div
      role="status"
      className={className}
      style={{
        background: "var(--cam-surface)",
        border: "1px solid var(--vt-accent-soft, #c6e3d0)",
        borderRadius: "var(--cam-radius-md, 8px)",
        padding: "var(--cam-space-4, 16px)",
        marginBottom: "var(--cam-space-4, 16px)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--cam-space-3, 12px)",
        boxShadow: "0 1px 2px rgba(26, 92, 58, 0.05)",
        ...style,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--vt-accent-soft, #eaf3ec)",
          color: "var(--cam-green)",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        ℹ
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <h4
            style={{
              fontSize: "var(--cam-font-size-base, 14px)",
              fontWeight: 700,
              color: "var(--cam-green)",
              margin: "0 0 4px",
            }}
          >
            {title}
          </h4>
        )}
        <p
          style={{
            fontSize: "var(--cam-font-size-sm, 13px)",
            color: "var(--cam-text)",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {message}
        </p>

        {reassurance && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: "var(--cam-space-2, 8px)",
              padding: "2px 8px",
              borderRadius: "var(--cam-radius-sm, 4px)",
              background: "var(--cam-success-bg)",
              border: "1px solid var(--cam-green)",
              color: "var(--cam-green)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <span aria-hidden="true">✓</span>
            {reassurance}
          </div>
        )}
      </div>
    </div>
  );
}
