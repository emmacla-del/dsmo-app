"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { count, percent } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

export interface CoverageBarItem {
  key: string;
  name: string;
  responseRate: number | null;
  received: number;
  registered: number;
  target: number | null;
  href?: string;
}

interface CoverageBarChartProps {
  items: CoverageBarItem[];
  ariaLabel?: string;
  metric?: "response" | "quota";
  showDistribution?: boolean;
}

export function CoverageBarChart({ items, ariaLabel, metric = "response", showDistribution = false }: CoverageBarChartProps) {
  const locale = asUiLocale(useLocale());
  const t = useTranslations("adminPilotagePage");
  const tTargets = useTranslations("adminTargets");
  const hasTargets = items.some((item) => item.target != null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "rate" | "received"; direction: "ascending" | "descending" }>({
    key: "rate",
    direction: "ascending",
  });

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const filtered = items.filter((item) => item.name.toLocaleLowerCase(locale).includes(normalizedQuery));
    return filtered.sort((a, b) => {
      if (sort.key === "name") {
        const result = a.name.localeCompare(b.name, locale);
        return sort.direction === "ascending" ? result : -result;
      }

      const aValue = sort.key === "rate" ? a.responseRate : a.received;
      const bValue = sort.key === "rate" ? b.responseRate : b.received;
      if (aValue == null || bValue == null) {
        if (aValue == null && bValue == null) return a.name.localeCompare(b.name, locale);
        return aValue == null ? 1 : -1;
      }
      const result = aValue - bValue;
      return sort.direction === "ascending" ? result : -result;
    });
  }, [items, locale, query, sort]);

  const bands = [
    { key: "critical", className: "is-critical", label: t("coverageCritical"), matches: (rate: number) => rate < 30 },
    { key: "veryPoor", className: "is-very-poor", label: t("coverageVeryPoor"), matches: (rate: number) => rate >= 30 && rate < 50 },
    { key: "poor", className: "is-poor", label: t("coveragePoor"), matches: (rate: number) => rate >= 50 && rate < 75 },
    { key: "average", className: "is-average", label: t("coverageAverage"), matches: (rate: number) => rate >= 75 && rate < 90 },
    { key: "good", className: "is-good", label: t("coverageGood"), matches: (rate: number) => rate >= 90 && rate < 100 },
    { key: "excellent", className: "is-excellent", label: t("coverageExcellent"), matches: (rate: number) => rate >= 100 },
  ];

  const toggleSort = (key: "name" | "rate" | "received") => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="cam-dash-barchart" role="region" aria-label={ariaLabel}>
      <label className="cam-dash-coverage-search">
        <span>{t("coverageSearchLabel")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("coverageSearchPlaceholder")}
        />
      </label>

      <div className="cam-dash-barchart-legend" aria-label={
        metric === "quota" ? tTargets("quotaCoverageDistributionLabel") : t("coverageLegendLabel")
      }>
        {bands.map((band) => (
          <span key={band.key}>
            <i className={band.className} />{band.label}
            {showDistribution && (
              <strong className="ms-1 tabular-nums">
                {count(visibleItems.filter((item) => item.responseRate != null && band.matches(item.responseRate)).length, locale)}
              </strong>
            )}
          </span>
        ))}
        {hasTargets && <span><i className="is-target-line" />{t("coverageTargetLine")}</span>}
      </div>

      <div className="cam-dash-coverage-table-wrap">
        <table className="cam-dash-table cam-dash-coverage-table">
          <thead>
            <tr>
              {([
                ["name", t("coverageTerritoryColumn")],
                ["rate", metric === "quota" ? tTargets("quotaCoverageRateColumn") : t("coverageRateColumn")],
                ["received", metric === "quota" ? tTargets("quotaCoverageCountsColumn") : t("coverageCountsColumn")],
              ] as const).map(([key, label]) => (
                <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction : "none"}>
                  <button type="button" onClick={() => toggleSort(key)}>
                    {label}<span aria-hidden="true">{sort.key === key ? (sort.direction === "ascending" ? " ↑" : " ↓") : " ↕"}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
          const rate = item.responseRate != null ? Math.min(100, Math.max(0, item.responseRate)) : 0;
          const target = item.target;
          const grade = item.responseRate == null
            ? "is-no-data"
            : item.responseRate < 30
              ? "is-critical"
              : item.responseRate < 50
              ? "is-very-poor"
              : item.responseRate < 75
                ? "is-poor"
                : item.responseRate < 90
                  ? "is-average"
                  : item.responseRate < 100
                    ? "is-good"
                    : "is-excellent";
          const targetRate = target != null && item.registered > 0 ? (target / item.registered) * 100 : null;
          const detail = `${count(item.received, locale)}/${count(item.registered, locale)}`;
          return (
            <tr key={item.key}>
              <th scope="row" className="cam-dash-coverage-name">
                {item.href ? <Link href={item.href}>{item.name}</Link> : item.name}
              </th>
              <td>
                <div className="cam-dash-coverage-rate-cell">
                  <strong className={`cam-dash-barchart-pct ${grade}`}>{percent(item.responseRate, 1, locale, 0)}</strong>
                  <div className={`cam-dash-barchart-track ${grade}`} aria-hidden="true">
                    {targetRate != null && <span className="cam-dash-barchart-target" style={{ left: `${Math.min(100, Math.max(0, targetRate))}%` }} />}
                    <div className={`cam-dash-barchart-fill ${grade}`} style={{ width: `${rate}%` }} />
                  </div>
                </div>
              </td>
              <td className="cam-dash-coverage-count">{detail}</td>
            </tr>
          );
            })}
            {visibleItems.length === 0 && (
              <tr><td colSpan={3} className="cam-dash-coverage-empty">{t("coverageNoMatches")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
