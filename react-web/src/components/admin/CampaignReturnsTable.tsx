"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import { count, percent } from "@/lib/admin-data-state";
import type {
  CampaignReturnsResponse,
  ReturnMetrics,
} from "@/lib/pilotage-targets";

export interface CampaignTerritoryTarget {
  region?: string;
  department?: string;
}

export function CampaignReturnsTable({
  data,
  expanded,
  onToggle,
  territoryHref,
  regionFilter = "",
  searchTerm = "",
  showTotals = true,
  emptyMessage,
}: {
  data: CampaignReturnsResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
  /** When given, each territory name links to its files under the campaign. */
  territoryHref?: (target: CampaignTerritoryTarget) => string;
  /** Optional client-side view filters over names already returned by the API. */
  regionFilter?: string;
  searchTerm?: string;
  showTotals?: boolean;
  emptyMessage?: string;
}) {
  const t = useTranslations("adminTargets");
  const tDossiers = useTranslations("adminDossiersPage");
  const locale = asUiLocale(useLocale());
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase(locale);
  const filtered = Boolean(regionFilter || normalizedSearch);
  const regions = data.regions.flatMap((region): Array<typeof region & { departmentOnly: boolean }> => {
    if (regionFilter && region.regionId !== regionFilter) return [];
    if (!normalizedSearch) return [{ ...region, departmentOnly: false }];
    const regionMatches = region.name.toLocaleLowerCase(locale).includes(normalizedSearch);
    const departments = regionMatches
      ? region.departments
      : region.departments.filter((department) => department.name.toLocaleLowerCase(locale).includes(normalizedSearch));
    return regionMatches || departments.length > 0 ? [{ ...region, departments, departmentOnly: !regionMatches && departments.length > 0 }] : [];
  });
  const central = filtered ? null : data.central;
  const unassigned = filtered ? null : data.unassigned;
  const national = central != null || unassigned != null;
  const scopeLink = (target: CampaignTerritoryTarget, name: string) =>
    territoryHref ? (
      <Link
        href={territoryHref(target)}
        className="cam-target-scope-link"
        aria-label={tDossiers("openTerritoryFilesAria", { territory: name })}
      >
        {tDossiers("openTerritoryFiles")}
      </Link>
    ) : null;

  if (regions.length === 0 && !national) {
    return <p className="cam-admin-lede">{emptyMessage ?? t("noTerritory")}</p>;
  }

  return (
    <div className="cam-dash-table-wrap">
      <table className="cam-dash-table cam-target-table">
        <thead>
          <tr>
            <th scope="col">{t("territoryColumn")}</th>
            <th scope="col" className="is-num text-right">{t("quotaColumn")}</th>
            <th scope="col" className="is-num text-right">{t("receivedColumn")}</th>
            <th scope="col" className="is-num text-right">{t("validatedColumn")}</th>
            <th scope="col" className="is-num text-right">{t("onTimeColumn")}</th>
            <th scope="col" className="is-num text-right">{t("lateColumn")}</th>
            <th scope="col" className="is-num text-right">{t("gapColumn")}</th>
            <th scope="col" className="is-num text-right">{t("quotaRateColumn")}</th>
            <th scope="col" className="is-num text-right">{t("responseRateColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((region) => {
            const open = Boolean(normalizedSearch) || expanded.has(region.regionId);
            return (
              <Fragment key={region.regionId}>
                <tr className="cam-target-region">
                  <th scope="row">
                    <button
                      type="button"
                      className="cam-target-expand"
                      onClick={() => onToggle(region.regionId)}
                      aria-expanded={open}
                      title={region.name}
                    >
                      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                      {region.name}
                    </button>
                    {scopeLink({ region: region.name }, region.name)}
                  </th>
                  {region.departmentOnly ? <td colSpan={8} className="text-muted-foreground">{tDossiers("departmentMatchesOnly")}</td> : <MetricCells metrics={region} />}
                </tr>
                {open &&
                  region.departments.map((department) => (
                    <tr key={department.departmentId} className="cam-target-dept">
                      <th scope="row">
                        {department.name}
                        {scopeLink({ region: region.name, department: department.name }, department.name)}
                      </th>
                      <MetricCells metrics={department} />
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        {national && (
          <tbody>
            {central && (
              <tr className="cam-target-region">
                <th scope="row">{t("centralAdministrations")}</th>
                <MetricCells metrics={central} />
              </tr>
            )}
            {unassigned && unassigned.received > 0 && (
              <tr className="cam-target-region">
                <th scope="row">{t("unassigned")}</th>
                <MetricCells metrics={unassigned} />
              </tr>
            )}
          </tbody>
        )}
        {showTotals && !filtered && <tfoot>
          <tr className="cam-target-region">
            <th scope="row">{t("total")}</th>
            <MetricCells metrics={data.totals} />
          </tr>
        </tfoot>}
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
      <td className="is-num text-right">{fmt(metrics.quota)}</td>
      <td className="is-num text-right">{fmt(metrics.received)}</td>
      <td className="is-num text-right">{fmt(metrics.approved)}</td>
      <td className="is-num text-right">{fmt(metrics.onTime)}</td>
      <td className="is-num text-right">
        {fmt(metrics.late)}
        {metrics.late > 0 && (
          <span
            className="cam-badge cam-badge-warning"
            style={{ marginLeft: "var(--cam-space-2)" }}
            title={t("lateTitle")}
          >
            {t("lateBadge")}
          </span>
        )}
      </td>
      <td className="is-num text-right">{fmt(metrics.gap)}</td>
      <td className="is-num text-right">
        {metrics.quotaRate != null ? (
          <span className={`cam-badge ${quotaRateBadge(metrics.quotaRate)}`}>
            {fmtRate(metrics.quotaRate)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="is-num text-right" title={t("responseRateTitle", { received: fmt(metrics.received), stock: fmt(metrics.registeredStock) })}>
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

// Shared formatters (G12): one locale decision, in lib/admin-data-state.
function formatCount(value: number | null | undefined, locale: UiLocale): string {
  return count(value, locale);
}

// A 0–1 ratio as a percentage with at most one decimal: "50 %", "50,5 %".
function formatRate(rate: number | null | undefined, locale: UiLocale): string {
  return percent(rate == null ? null : rate * 100, 1, locale, 0);
}
