"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { count } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

export interface StatusSegment {
  key: string;
  label: string;
  value: number;
  tone: "pending" | "correction" | "approved" | "rejected";
}

interface StatusDonutChartProps {
  segments: StatusSegment[];
  total: number;
  hrefBase?: string;
  ariaLabel?: string;
}

const TONE_COLORS: Record<StatusSegment["tone"], string> = {
  approved: "var(--cam-success)",
  pending: "var(--cam-warning)",
  correction: "var(--cam-border-strong)",
  rejected: "var(--cam-error)",
};

export function StatusDonutChart({
  segments,
  total,
  hrefBase = "/admin/dossiers",
  ariaLabel,
}: StatusDonutChartProps) {
  const locale = asUiLocale(useLocale());
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const radius = 68;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  // Active slice or default total reading
  const activeSegment = segments.find((s) => s.key === activeKey) ?? null;

  // Cumulative offset calculations for SVG strokes
  let accumulated = 0;
  const slices = segments.map((seg) => {
    const ratio = total > 0 ? seg.value / total : 0;
    const arcLength = Math.max(0, ratio * circumference);
    const gap = seg.value > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
    const strokeDash = `${Math.max(0, arcLength - gap).toFixed(2)} ${(circumference - Math.max(0, arcLength - gap)).toFixed(2)}`;
    const strokeOffset = (-accumulated).toFixed(2);
    accumulated += arcLength;
    const pct = total > 0 ? Math.round(ratio * 100) : 0;
    return {
      ...seg,
      ratio,
      pct,
      strokeDash,
      strokeOffset,
      color: TONE_COLORS[seg.tone],
    };
  });

  return (
    <div className="cam-dash-donut-layout">
      {/* Donut graphic */}
      <div className="cam-dash-donut-wrap">
        <svg
          className="cam-dash-donut-svg"
          viewBox="0 0 200 200"
          role="img"
          aria-label={ariaLabel ?? `Répartition des statuts: ${total} dossiers`}
          onPointerLeave={() => setActiveKey(null)}
        >
          {/* Background circle track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--cam-border)"
            strokeWidth={strokeWidth}
          />

          {/* Slices group rotated so arc starts at 12 o'clock */}
          <g transform="rotate(-90 100 100)">
            {slices.map((slice) => {
              if (slice.value <= 0) return null;
              const isHovered = activeKey === slice.key;
              return (
                <circle
                  key={slice.key}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={slice.strokeDash}
                  strokeDashoffset={slice.strokeOffset}
                  className="cam-dash-donut-slice"
                  style={{
                    cursor: "pointer",
                    transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                    opacity: activeKey && !isHovered ? 0.65 : 1,
                  }}
                  onPointerEnter={() => setActiveKey(slice.key)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.label}: ${count(slice.value, locale)} (${slice.pct}%)`}
                  onFocus={() => setActiveKey(slice.key)}
                  onBlur={() => setActiveKey(null)}
                />
              );
            })}
          </g>

          {/* Center text reading */}
          <g className="cam-dash-donut-center" pointerEvents="none">
            {activeSegment ? (
              <>
                <text
                  x="100"
                  y="92"
                  textAnchor="middle"
                  className="cam-dash-donut-number"
                  fill={TONE_COLORS[activeSegment.tone]}
                >
                  {count(activeSegment.value, locale)}
                </text>
                <text
                  x="100"
                  y="112"
                  textAnchor="middle"
                  className="cam-dash-donut-sub"
                  fill="var(--cam-text-muted)"
                >
                  {total > 0 ? `${Math.round((activeSegment.value / total) * 100)}%` : "0%"} · {activeSegment.label}
                </text>
              </>
            ) : (
              <>
                <text
                  x="100"
                  y="94"
                  textAnchor="middle"
                  className="cam-dash-donut-number"
                  fill="var(--cam-text)"
                >
                  {count(total, locale)}
                </text>
                <text
                  x="100"
                  y="114"
                  textAnchor="middle"
                  className="cam-dash-donut-sub"
                  fill="var(--cam-text-muted)"
                >
                  dossiers
                </text>
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Accompanying interactive status cards */}
      <div className="cam-dash-donut-cards">
        {slices.map((slice) => {
          const isHovered = activeKey === slice.key;
          return (
            <Link
              key={slice.key}
              href={`${hrefBase}?status=${encodeURIComponent(slice.key)}`}
              className={`cam-dash-stage-card ${isHovered ? "is-active" : ""}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                borderLeftWidth: "3px",
                borderLeftStyle: "solid",
                borderLeftColor: slice.color,
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onPointerEnter={() => setActiveKey(slice.key)}
              onPointerLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(slice.key)}
              onBlur={() => setActiveKey(null)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--cam-space-2)" }}>
                <span className="cam-dash-stage-label" style={{ fontWeight: 600 }}>
                  {slice.label}
                </span>
                <span className="cam-dash-detail-text" style={{ fontWeight: 700, color: slice.color }}>
                  {slice.pct}%
                </span>
              </div>
              <strong style={{ color: slice.color, fontSize: "var(--cam-font-size-xl)", marginTop: "var(--cam-space-1)" }}>
                {count(slice.value, locale)}
              </strong>
              <small className="cam-dash-stage-note">
                {count(slice.value, locale)} sur {count(total, locale)} dossiers
              </small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
