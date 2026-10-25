"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/admin/DataState";
import { count } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";
import { getCompanyRegistrationTrend } from "@/lib/companies-directory";
import {
  computeYTicks,
  niceMax,
} from "@/lib/pilotage-timeline";

const HEIGHT = 300;
const MARGIN = { top: 34, right: 18, bottom: 42, left: 46 };
type Granularity = "daily" | "weekly" | "monthly";
const POINTS_TO_SHOW: Record<Granularity, number> = { daily: 14, weekly: 6, monthly: 12 };
type SeriesKey = "submitted" | "approved" | "correctionRequested";
type SeriesPoint = { index: number; series: SeriesKey; x: number; y: number; value: number };
type SelectedPoint = Pick<SeriesPoint, "index" | "series">;

const SERIES: Array<{ key: SeriesKey; className: string; labelKey: string }> = [
  { key: "submitted", className: "submitted", labelKey: "registrationTrendSubmittedSeries" },
  { key: "approved", className: "approved", labelKey: "registrationTrendApprovedSeries" },
  { key: "correctionRequested", className: "correction", labelKey: "registrationTrendCorrectionSeries" },
];

type RegistrationActivityDay = {
  date: string;
  submitted: number;
  approved: number;
  correctionRequested: number;
};

type ActivityBucket = {
  key: string;
  submitted: number;
  approved: number;
  correctionRequested: number;
};

function useWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((next: HTMLDivElement | null) => {
    setNode(next);
    const initial = next ? Math.round(next.getBoundingClientRect().width) : 0;
    if (initial > 0) setWidth(initial);
  }, []);
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [ref, width];
}

function dateAtDoualaNoon(day: string): Date {
  return new Date(`${day}T12:00:00+01:00`);
}

function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sinceMonday);
  return date.toISOString().slice(0, 10);
}

function activityBuckets(days: RegistrationActivityDay[], granularity: Granularity): ActivityBucket[] {
  if (granularity === "daily") {
    return days.slice(-POINTS_TO_SHOW.daily).map((day) => ({
      key: day.date,
      submitted: day.submitted,
      approved: day.approved,
      correctionRequested: day.correctionRequested,
    }));
  }

  const byPeriod = new Map<string, ActivityBucket>();
  for (const day of days) {
    const key = granularity === "weekly" ? weekStart(day.date) : day.date.slice(0, 7);
    const bucket = byPeriod.get(key) ?? { key, submitted: 0, approved: 0, correctionRequested: 0 };
    bucket.submitted += day.submitted;
    bucket.approved += day.approved;
    bucket.correctionRequested += day.correctionRequested;
    byPeriod.set(key, bucket);
  }
  return [...byPeriod.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-POINTS_TO_SHOW[granularity]);
}

/**
 * Draw a smooth, shape-preserving curve. The previous Catmull–Rom-style
 * controls could overshoot flat zero segments and make non-negative counts
 * appear below the chart baseline.
 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const secants = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return secants[0];
    if (index === points.length - 1) return secants[secants.length - 1];
    const before = secants[index - 1];
    const after = secants[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    return (2 * before * after) / (before + after);
  });

  // Limit endpoint tangents per interval so each cubic stays between its two
  // observations, including when a series turns sharply or reaches zero.
  for (let index = 0; index < secants.length; index += 1) {
    const slope = secants[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const alpha = tangents[index] / slope;
    const beta = tangents[index + 1] / slope;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[index] = scale * alpha * slope;
      tangents[index + 1] = scale * beta * slope;
    }
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const step = end.x - start.x;
    const c1x = start.x + step / 3;
    const c1y = start.y + tangents[index] * step / 3;
    const c2x = end.x - step / 3;
    const c2y = end.y - tangents[index + 1] * step / 3;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  }
  return path;
}

function bucketLabel(key: string, granularity: Granularity, locale: string, full = false): string {
  const date = dateAtDoualaNoon(granularity === "monthly" ? `${key}-01` : key);
  return new Intl.DateTimeFormat(locale, {
    ...(granularity === "monthly" ? { month: "short", ...(full ? { year: "numeric" as const } : {}) } : { day: "numeric", month: "short", ...(full ? { year: "numeric" as const } : {}) }),
  }).format(date);
}

/** Registration submissions, approvals, and correction requests over time. */
export function RegistrationTrendChart() {
  const t = useTranslations("adminPilotagePage");
  const locale = asUiLocale(useLocale());
  const [wrapRef, width] = useWidth();
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [hovered, setHovered] = useState<SelectedPoint | null>(null);
  const [selected, setSelected] = useState<SelectedPoint | null>(null);

  const query = useQuery({
    queryKey: ["companies", "registration-trend", "activity", 365],
    queryFn: getCompanyRegistrationTrend,
    refetchInterval: 120000,
  });
  const resource = t("registrationTrendTitle");

  if (query.isError) {
    return <DataState dense state="error" resource={resource} error={query.error} onRetry={() => query.refetch()} />;
  }
  if (!query.data) {
    return <DataState dense state="loading" resource={resource} title={t("registrationTrendLoading")} />;
  }
  const activity = query.data.days;
  const buckets = activityBuckets(activity, granularity);
  if (buckets.length === 0 || activity.every((day) => SERIES.every(({ key }) => day[key] === 0))) {
    return <DataState dense state="empty" resource={resource} title={t("registrationTrendEmpty")} />;
  }

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotBottom = HEIGHT - MARGIN.bottom;
  const max = niceMax(Math.max(1, ...buckets.flatMap((bucket) => SERIES.map(({ key }) => bucket[key]))));
  const yTicks = computeYTicks(max).map((value) => ({ value, y: plotBottom - (value / max) * plotHeight }));
  const xForBucket = (index: number) => MARGIN.left + (buckets.length === 1 ? plotWidth / 2 : (index / (buckets.length - 1)) * plotWidth);
  const yForValue = (value: number) => plotBottom - (value / max) * plotHeight;
  const seriesPoints = SERIES.map((series) => ({
    ...series,
    points: buckets.map((bucket, index) => ({
      index,
      series: series.key,
      x: xForBucket(index),
      y: yForValue(bucket[series.key]),
      value: bucket[series.key],
    })),
  }));
  const allPoints = seriesPoints.flatMap((series) => series.points);
  const active = selected ?? hovered;
  const activeBucket = active ? buckets[active.index] : null;
  const activeSeries = active ? SERIES.find((series) => series.key === active.series) : null;
  const tickCount = Math.min(6, buckets.length);
  const tickIndexes = Array.from({ length: tickCount }, (_, index) =>
    tickCount === 1 ? 0 : Math.round((index * (buckets.length - 1)) / (tickCount - 1)),
  ).filter((index, position, indexes) => position === 0 || index !== indexes[position - 1]);

  function pointAt(clientX: number, clientY: number, svg: SVGSVGElement): SelectedPoint | null {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    const y = ((clientY - rect.top) / rect.height) * HEIGHT;
    if (x < MARGIN.left || x > width - MARGIN.right || y < MARGIN.top || y > plotBottom) return null;
    const nearest = allPoints.reduce((best, point) =>
      Math.hypot(point.x - x, point.y - y) < Math.hypot(best.x - x, best.y - y) ? point : best,
    allPoints[0]);
    return { index: nearest.index, series: nearest.series };
  }

  return (
    <figure className="cam-registration-trend" aria-labelledby="registration-trend-title">
      <figcaption className="cam-dash-progress-header">
        <div>
          <h3 id="registration-trend-title" className="cam-dash-progress-title">
            {t(`registrationTrendTitle${granularity[0].toUpperCase()}${granularity.slice(1)}`)}
          </h3>
          <p className="cam-dash-progress-description">{t("registrationTrendContext")}</p>
        </div>
        <div className="cam-dash-progress-periods" role="group" aria-label={t("registrationTrendGranularityLabel")}>
          {(["daily", "weekly", "monthly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={granularity === option}
              onClick={() => {
                setGranularity(option);
                setHovered(null);
                setSelected(null);
              }}
            >
              {t(`registrationTrendGranularity${option[0].toUpperCase()}${option.slice(1)}`)}
            </button>
          ))}
        </div>
      </figcaption>

      <ul className="cam-dash-progress-legend" aria-label={t("registrationTrendLegendLabel")}>
        {SERIES.map((series) => (
          <li key={series.key}>
            <span className={`cam-dash-progress-key cam-dash-progress-series--${series.className}`} aria-hidden="true" />
            {t(series.labelKey)}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="cam-dash-progress-plot cam-dash-progress-plot--weekly">
        <svg
          className="cam-dash-progress-svg"
          style={width > 0 ? undefined : { display: "none" }}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t("registrationTrendAria", {
            start: bucketLabel(buckets[0].key, granularity, locale, true),
            end: bucketLabel(buckets[buckets.length - 1].key, granularity, locale, true),
          })}
          tabIndex={0}
          onPointerMove={(event) => setHovered(pointAt(event.clientX, event.clientY, event.currentTarget))}
          onPointerLeave={() => setHovered(null)}
          onClick={(event) => {
            const point = pointAt(event.clientX, event.clientY, event.currentTarget);
            if (point) setSelected((current) => current?.index === point.index && current.series === point.series ? null : point);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setSelected(null);
              setHovered(null);
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const current = selected ?? hovered;
              const index = current
                ? Math.max(0, Math.min(buckets.length - 1, current.index + (event.key === "ArrowRight" ? 1 : -1)))
                : event.key === "ArrowRight" ? 0 : buckets.length - 1;
              setSelected({ index, series: current?.series ?? "submitted" });
            }
          }}
        >
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line className="cam-dash-progress-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={tick.y} y2={tick.y} />
              <text className="cam-dash-progress-axis" x={MARGIN.left - 8} y={tick.y} dy="0.32em" textAnchor="end">
                {count(tick.value, locale)}
              </text>
            </g>
          ))}
          {tickIndexes.map((index, position) => (
            <text key={buckets[index].key} className="cam-dash-progress-axis" x={xForBucket(index)} y={plotBottom + 24} textAnchor={position === 0 ? "start" : position === tickIndexes.length - 1 ? "end" : "middle"}>
              {bucketLabel(buckets[index].key, granularity, locale)}
            </text>
          ))}
          {seriesPoints.map((series) => (
            <g key={series.key}>
              <path
                className={`cam-dash-progress-line cam-dash-progress-series--${series.className}`}
                d={smoothPath(series.points)}
              />
              {series.points.map((point) => (
                <circle
                  key={point.index}
                  className={`cam-dash-progress-point cam-dash-progress-series--${series.className}${active?.index === point.index && active.series === series.key ? " is-active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={active?.index === point.index && active.series === series.key ? 5 : 3.5}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <p className="cam-dash-progress-selection" aria-live="polite">
        {activeBucket
          ? t("registrationTrendSelectedPoint", {
            date: bucketLabel(activeBucket.key, granularity, locale, true),
            series: activeSeries ? t(activeSeries.labelKey) : t("registrationTrendSubmittedSeries"),
            count: count(activeSeries ? activeBucket[activeSeries.key] : activeBucket.submitted, locale),
          })
          : t("registrationTrendPointHint")}
      </p>
    </figure>
  );
}
