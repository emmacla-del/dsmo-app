"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { DataState } from "@/components/admin/DataState";
import { count } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";
import { getCampaignReturnsActivity } from "@/lib/pilotage-timeline";

const HEIGHT = 300;
type Granularity = "daily" | "weekly" | "monthly";
type ActivityDay = { date: string; submitted: number; approved: number; correctionRequested: number };
type ActivityBucket = ActivityDay;

const SERIES = [
  { key: "submitted", className: "submitted", color: "primary", label: "submissionTrendSubmittedSeries" },
  { key: "approved", className: "approved", color: "success", label: "submissionTrendApprovedSeries" },
  { key: "correctionRequested", className: "correction", color: "warning", label: "submissionTrendCorrectionSeries" },
] as const;

function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function bucketsFor(days: ActivityDay[], granularity: Granularity): ActivityBucket[] {
  const limit = granularity === "daily" ? 14 : granularity === "weekly" ? 6 : 12;
  if (granularity === "daily") return days.slice(-limit);
  const buckets = new Map<string, ActivityBucket>();
  for (const day of days) {
    const key = granularity === "weekly" ? weekStart(day.date) : day.date.slice(0, 7);
    const bucket = buckets.get(key) ?? { date: key, submitted: 0, approved: 0, correctionRequested: 0 };
    bucket.submitted += day.submitted;
    bucket.approved += day.approved;
    bucket.correctionRequested += day.correctionRequested;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].slice(-limit);
}

function dateLabel(key: string, granularity: Granularity, locale: string): string {
  const day = granularity === "monthly" ? `${key}-01` : key;
  return new Intl.DateTimeFormat(locale, granularity === "monthly"
    ? { month: "short", year: "numeric" }
    : { day: "numeric", month: "short" },
  ).format(new Date(`${day}T12:00:00+01:00`));
}

/** Three activity series for the active survey collection campaign. */
export function CampaignActivityTrendChart({ campaignId }: { campaignId: string }) {
  const t = useTranslations("adminPilotagePage");
  const locale = asUiLocale(useLocale());
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const query = useQuery({
    queryKey: ["admin", "pilotage", "returns-activity", campaignId],
    queryFn: () => getCampaignReturnsActivity(campaignId),
    refetchInterval: 120000,
  });

  if (query.isError) {
    return <DataState dense state="error" resource={t("submissionTrendTitle")} error={query.error} onRetry={() => query.refetch()} />;
  }
  if (!query.data) {
    return <DataState dense state="loading" resource={t("submissionTrendTitle")} title={t("submissionTrendLoading")} />;
  }
  const points = bucketsFor(query.data.days, granularity);
  if (!points.length || query.data.days.every((day) => SERIES.every(({ key }) => day[key] === 0))) {
    return <DataState dense state="empty" resource={t("submissionTrendTitle")} title={t("submissionTrendEmpty")} />;
  }

  const chartDescription = t("submissionTrendAria", {
    start: dateLabel(points[0].date, granularity, locale),
    end: dateLabel(points[points.length - 1].date, granularity, locale),
  });

  return (
    <figure className="cam-registration-trend" aria-labelledby="submission-trend-title">
      <figcaption className="cam-dash-progress-header">
        <div>
          <h3 id="submission-trend-title" className="cam-dash-progress-title">
            {t(`submissionTrendTitle${granularity[0].toUpperCase()}${granularity.slice(1)}`)}
          </h3>
          <p className="cam-dash-progress-description">{t("submissionTrendContext")}</p>
        </div>
        <div className="cam-dash-progress-periods" role="group" aria-label={t("submissionTrendGranularityLabel")}>
          {(["daily", "weekly", "monthly"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={granularity === option} onClick={() => setGranularity(option)}>
              {t(`registrationTrendGranularity${option[0].toUpperCase()}${option.slice(1)}`)}
            </button>
          ))}
        </div>
      </figcaption>
      <ul className="cam-dash-progress-legend" aria-label={t("submissionTrendLegendLabel")}>
        {SERIES.map((series) => (
          <li key={series.key}>
            <span className={`cam-dash-progress-key cam-dash-progress-series--${series.className}`} aria-hidden="true" />
            {t(series.label)}
          </li>
        ))}
      </ul>
      <div className="cam-dash-progress-plot cam-dash-progress-plot--weekly">
        <LineChart
          className="cam-dash-progress-chart"
          style={{ width: "100%", height: HEIGHT }}
          responsive
          accessibilityLayer
          data={points}
          margin={{ top: 16, right: 18, bottom: 12, left: 8 }}
          desc={chartDescription}
        >
          <CartesianGrid className="cam-dash-progress-grid" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => dateLabel(String(value), granularity, locale)}
            tick={{ className: "cam-dash-progress-axis" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis
            width={42}
            allowDecimals={false}
            domain={[0, "dataMax"]}
            tickFormatter={(value) => count(Number(value), locale)}
            tick={{ className: "cam-dash-progress-axis" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            labelFormatter={(value) => dateLabel(String(value), granularity, locale)}
            formatter={(value, name) => [count(Number(value), locale), String(name)]}
            contentStyle={{
              backgroundColor: "var(--cam-surface)",
              borderColor: "var(--cam-border)",
              borderRadius: "var(--cam-radius-sm)",
              color: "var(--cam-text)",
              fontSize: "var(--cam-font-size-xs)",
            }}
            labelStyle={{ color: "var(--cam-text-muted)" }}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={t(series.label)}
              stroke={`var(--cam-${series.color})`}
              strokeWidth={2.25}
              dot={{ r: 3.5, fill: "var(--cam-surface)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>
    </figure>
  );
}
