"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { DataState } from "@/components/admin/DataState";
import { count } from "@/lib/admin-data-state";
import { formatCampaignDate } from "@/lib/campaigns";
import { asUiLocale } from "@/lib/register-i18n";
import {
  chartGeometry,
  dayIndexAt,
  getCampaignReturnsTimeline,
  paceReading,
  type ChartBox,
} from "@/lib/pilotage-timeline";

// Pixel margins around the plot: room for the y labels on the left, the
// deadline labels on top, the date labels below.
const BOX: Omit<ChartBox, "width"> = { height: 200, left: 36, right: 40, top: 30, bottom: 22 };

/**
 * The container's width in pixels, so text stays at its real size. A
 * callback ref: the plot mounts only once the data has loaded.
 */
function useWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

/** A YYYY-MM-DD Douala day as dd/MM/yyyy. */
function dayLabel(day: string): string {
  return formatCampaignDate(`${day}T12:00:00+01:00`);
}

/**
 * How the active campaign's collection has progressed: cumulative
 * declarations received per Cameroon day, against a steady pace to the
 * deadline, with the deadline (and any extension) marked.
 *
 * Source: GET /admin/pilotage/campaigns/:id/returns/timeline, counted as
 * /returns counts, so the line ends on the headline "received" figure.
 * `registeredStock` is that headline's denominator (today's stock).
 */
export function CampaignProgressChart({
  campaignId,
  registeredStock,
}: {
  campaignId: string;
  registeredStock: number | null | undefined;
}) {
  const t = useTranslations("adminPilotagePage");
  const locale = asUiLocale(useLocale());
  const [wrapRef, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["admin", "pilotage", "returns-timeline", campaignId],
    queryFn: () => getCampaignReturnsTimeline(campaignId),
    refetchInterval: 120000,
  });
  const resource = t("progressResource");

  if (query.isError) {
    return <DataState dense state="error" resource={resource} error={query.error} onRetry={() => query.refetch()} />;
  }
  if (!query.data) {
    return <DataState dense state="loading" resource={resource} title={t("progressLoading")} />;
  }

  const timeline = query.data;
  const now = Date.now();
  const box: ChartBox = { ...BOX, width };
  const geometry = chartGeometry(timeline, registeredStock, box, now);
  const pace = paceReading(timeline, registeredStock, now);
  const delivered = timeline.days.filter((day) => day.received > 0);

  if (!geometry) {
    return <DataState dense state="empty" resource={resource} title={t("progressNoStart")} />;
  }

  const plotBottom = box.height - box.bottom;
  const hovered = hover !== null ? timeline.days[hover] : null;
  const hoverX = hover !== null ? (geometry.dayX[hover] + geometry.dayX[hover + 1]) / 2 : 0;
  const firstDay = timeline.days[0].date;
  const lastDay = timeline.days[timeline.days.length - 1].date;
  // A direct label's text runs toward the plot when its mark sits near the
  // right edge.
  const anchorFor = (x: number) => (x > width - 90 ? "end" : "start");

  return (
    <div className="cam-dash-progress">
      <h4 className="cam-dash-progress-title">{t("progressTitle")}</h4>
      {pace && (
        <p className="cam-dash-card-sub">
          {pace.ahead
            ? t("progressAhead", { received: pace.received, expected: pace.expected })
            : t("progressBehind", { received: pace.received, expected: pace.expected })}
        </p>
      )}

      <div ref={wrapRef} className="cam-dash-progress-plot">
        <svg
          className="cam-dash-progress-svg"
          width={width}
          height={box.height}
          role="img"
          aria-label={t("progressAria", { total: timeline.total, start: dayLabel(firstDay), end: dayLabel(lastDay) })}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHover(dayIndexAt(geometry.dayX, event.clientX - rect.left));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {geometry.yTicks.map((tick) => (
            <g key={tick.value}>
              <line className="cam-dash-progress-grid" x1={box.left} x2={width - box.right} y1={tick.y} y2={tick.y} />
              <text className="cam-dash-progress-axis" x={box.left - 6} y={tick.y} dy="0.32em" textAnchor="end">
                {count(tick.value, locale)}
              </text>
            </g>
          ))}

          <text className="cam-dash-progress-axis" x={geometry.dayX[0]} y={plotBottom + 16} textAnchor="start">
            {dayLabel(firstDay)}
          </text>

          {geometry.markers.map((marker, i) => (
            <g key={marker.kind}>
              <line className="cam-dash-progress-deadline" x1={marker.x} x2={marker.x} y1={box.top - 4 + i * 12} y2={plotBottom} />
              <text
                className="cam-dash-progress-label"
                x={marker.x + (anchorFor(marker.x) === "end" ? -4 : 4)}
                y={box.top - 18 + i * 12}
                dy="0.71em"
                textAnchor={anchorFor(marker.x)}
              >
                {t(marker.kind === "deadline" ? "progressDeadline" : "progressExtended", { date: formatCampaignDate(marker.date) })}
              </text>
            </g>
          ))}

          {geometry.pace && (
            <line
              className="cam-dash-progress-pace"
              x1={geometry.pace.x1}
              y1={geometry.pace.y1}
              x2={geometry.pace.x2}
              y2={geometry.pace.y2}
            />
          )}

          <path className="cam-dash-progress-line" d={geometry.line} />
          <text
            className="cam-dash-progress-value"
            x={geometry.end.x + 6}
            y={geometry.end.y}
            dy="0.32em"
            textAnchor="start"
          >
            {count(geometry.end.value, locale)}
          </text>

          {hover !== null && (
            <line className="cam-dash-progress-cross" x1={hoverX} x2={hoverX} y1={box.top} y2={plotBottom} />
          )}
        </svg>
        {hovered && (
          <div
            className="cam-dash-progress-tip"
            style={{ left: `${Math.min(Math.max(hoverX, 80), width - 80)}px` }}
            aria-hidden="true"
          >
            <strong>{dayLabel(hovered.date)}</strong>
            <span>{t("progressTipDay", { count: hovered.received })}</span>
            <span>{t("progressTipTotal", { count: hovered.cumulative })}</span>
          </div>
        )}
      </div>

      <ul className="cam-dash-progress-legend">
        <li>
          <span className="cam-dash-progress-key" aria-hidden="true" />
          {t("progressSeries")}
        </li>
        {geometry.pace && (
          <li>
            <span className="cam-dash-progress-key cam-dash-progress-key--pace" aria-hidden="true" />
            {t("progressPace")}
          </li>
        )}
      </ul>

      <details className="cam-dash-progress-details">
        <summary>{t("progressTableToggle")}</summary>
        {delivered.length === 0 ? (
          <p className="cam-dash-empty">{t("progressNone")}</p>
        ) : (
          <div className="cam-dash-table-wrap">
            <table className="cam-dash-table">
              <thead>
                <tr>
                  <th scope="col">{t("progressTableDate")}</th>
                  <th scope="col" className="is-num">{t("progressTableDay")}</th>
                  <th scope="col" className="is-num">{t("progressTableCumulative")}</th>
                </tr>
              </thead>
              <tbody>
                {delivered.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{dayLabel(day.date)}</th>
                    <td className="is-num">{count(day.received, locale)}</td>
                    <td className="is-num">{count(day.cumulative, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
