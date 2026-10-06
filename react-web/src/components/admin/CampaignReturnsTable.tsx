"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import type {
  CampaignReturnsResponse,
  ReturnMetrics,
} from "@/lib/pilotage-targets";

export function CampaignReturnsTable({
  data,
  expanded,
  onToggle,
}: {
  data: CampaignReturnsResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
}) {
  const t = useTranslations("adminTargets");
  const national = data.central != null || data.unassigned != null;

  if (data.regions.length === 0 && !national) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  return (
    <div className="cam-dash-table-wrap">
      <table className="cam-dash-table cam-target-table">
        <thead>
          <tr>
            <th scope="col">{t("territoryColumn")}</th>
            <th scope="col" className="is-num">{t("quotaColumn")}</th>
            <th scope="col" className="is-num">{t("receivedColumn")}</th>
            <th scope="col" className="is-num">{t("validatedColumn")}</th>
            <th scope="col" className="is-num">{t("onTimeColumn")}</th>
            <th scope="col" className="is-num">{t("lateColumn")}</th>
            <th scope="col" className="is-num">{t("gapColumn")}</th>
            <th scope="col" className="is-num">{t("quotaRateColumn")}</th>
            <th scope="col" className="is-num">{t("responseRateColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {data.regions.map((region) => {
            const open = expanded.has(region.regionId);
            return (
              <Fragment key={region.regionId}>
                <tr className="cam-target-region">
                  <th scope="row">
                    <button
                      type="button"
                      className="cam-target-expand"
                      onClick={() => onToggle(region.regionId)}
                      aria-expanded={open}
                    >
                      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                      {region.name}
                    </button>
                  </th>
                  <MetricCells metrics={region} />
                </tr>
                {open &&
                  region.departments.map((department) => (
                    <tr key={department.departmentId} className="cam-target-dept">
                      <th scope="row">{department.name}</th>
                      <MetricCells metrics={department} />
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        {national && (
          <tbody>
            {data.central && (
              <tr className="cam-target-region">
                <th scope="row">{t("centralAdministrations")}</th>
                <MetricCells metrics={data.central} />
              </tr>
            )}
            {data.unassigned && data.unassigned.received > 0 && (
              <tr className="cam-target-region">
                <th scope="row">{t("unassigned")}</th>
                <MetricCells metrics={data.unassigned} />
              </tr>
            )}
          </tbody>
        )}
        <tfoot>
          <tr className="cam-target-region" style={{ fontWeight: 600, borderTop: "2px solid var(--cam-border)" }}>
            <th scope="row">{t("total")}</th>
            <MetricCells metrics={data.totals} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MetricCells({ metrics }: { metrics: ReturnMetrics }) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const fmt = (value: number | null | undefined) => formatCount(value, locale);
  const fmtRate = (rate: number | null | undefined) => formatRate(rate, locale);
  return (
    <>
      <td className="is-num">{fmt(metrics.quota)}</td>
      <td className="is-num">{fmt(metrics.received)}</td>
      <td className="is-num">{fmt(metrics.approved)}</td>
      <td className="is-num">{fmt(metrics.onTime)}</td>
      <td className="is-num">
        {fmt(metrics.late)}
        {metrics.late > 0 && (
          <span
            className="cam-badge cam-badge-warning"
            style={{ marginLeft: "var(--cam-space-2)", fontSize: "10px", padding: "1px 4px" }}
            title={t("lateTitle")}
          >
            {t("lateBadge")}
          </span>
        )}
      </td>
      <td className="is-num">{fmt(metrics.gap)}</td>
      <td className="is-num">
        {metrics.quotaRate != null ? (
          <span className={`cam-badge ${quotaRateBadge(metrics.quotaRate)}`}>
            {fmtRate(metrics.quotaRate)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="is-num" title={t("responseRateTitle", { received: fmt(metrics.received), stock: fmt(metrics.registeredStock) })}>
        {fmtRate(metrics.responseRate)}
      </td>
    </>
  );
}

function quotaRateBadge(rate: number): string {
  if (rate >= 1.0) return "cam-badge-success";
  if (rate >= 0.75) return "cam-badge-info";
  if (rate >= 0.5) return "cam-badge-warning";
  return "cam-badge-error";
}

function formatCount(value: number | null | undefined, locale: UiLocale): string {
  if (value == null) return "—";
  return value.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}

function formatRate(rate: number | null | undefined, locale: UiLocale): string {
  if (rate == null) return "—";
  const digits = (rate * 100).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return locale === "en" ? `${digits}%` : `${digits} %`;
}
