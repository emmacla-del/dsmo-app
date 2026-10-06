"use client";

import { Fragment } from "react";
import { useLocale, useTranslations } from "next-intl";
import { asUiLocale, type UiLocale } from "@/lib/register-i18n";
import type { CoverageResponse, StockCounts } from "@/lib/pilotage-targets";
import { formatCoverageCount, modeLabel } from "@/lib/pilotage-target-payload";

export function CoverageTable({
  data,
  expanded,
  onToggle,
}: {
  data: CoverageResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
}) {
  const t = useTranslations("adminTargets");
  const locale = asUiLocale(useLocale());
  const national = data.central != null || data.unassigned != null || data.nullEntityType != null;

  if (data.regions.length === 0 && !national) {
    return <p className="cam-admin-lede">{t("noTerritory")}</p>;
  }

  return (
    <div className="cam-dash-table-wrap">
      <table className="cam-dash-table cam-target-table">
        <thead>
          <tr>
            <th scope="col">{t("territoryColumn")}</th>
            <th scope="col">{t("modeColumn")}</th>
            <th scope="col" className="is-num">{t("registeredColumn")}</th>
            <th scope="col" className="is-num">{t("coverageTargetColumn")}</th>
            <th scope="col" className="is-num">{t("rateColumn")}</th>
            <th scope="col" className="is-num">{t("inYearColumn")}</th>
            <th scope="col" className="is-num">{t("approvalColumn")}</th>
            <th scope="col" className="is-num">{t("reviewColumn")}</th>
            <th scope="col" className="is-num">{t("complementsColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {data.regions.map((region) => {
            const open = expanded.has(region.regionId);
            return (
              <Fragment key={region.regionId}>
                <tr className="cam-target-region">
                  <th scope="row">
                    <button type="button" className="cam-target-expand" onClick={() => onToggle(region.regionId)} aria-expanded={open}>
                      <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                      {region.name}
                    </button>
                  </th>
                  <td>{modeLabel(region.mode, locale)}</td>
                  <CountCells
                    companyCount={region.companyCount}
                    registered={region.registered}
                    target={region.inscriptionTarget}
                    rate={region.rate}
                    registeredInYear={region.registeredInYear}
                    pendingApproval={region.pendingApproval}
                    pendingReview={region.pendingReview}
                    complementsRequested={region.complementsRequested}
                  />
                </tr>
                {open &&
                  region.departments.map((department) => (
                    <tr key={department.departmentId} className="cam-target-dept">
                      <th scope="row">{department.name}</th>
                      <td></td>
                      <CountCells
                        companyCount={department.companyCount}
                        registered={department.registered}
                        target={department.inscriptionTarget}
                        rate={department.rate}
                        registeredInYear={department.registeredInYear}
                        pendingApproval={department.pendingApproval}
                        pendingReview={department.pendingReview}
                        complementsRequested={department.complementsRequested}
                      />
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        {national && (
          <tbody>
            {data.central && (
              <BucketRow name={t("centralLevel")} counts={data.central} target={data.central.inscriptionTarget ?? null} rate={data.central.rate ?? null} />
            )}
            {data.unassigned && (
              <BucketRow name={t("unassigned")} counts={data.unassigned} target={null} rate={null} />
            )}
            {data.nullEntityType && (
              <BucketRow name={t("missingEntityType")} counts={data.nullEntityType} target={null} rate={null} />
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}

function BucketRow({
  name,
  counts,
  target,
  rate,
}: {
  name: string;
  counts: StockCounts;
  target: number | null;
  rate: number | null;
}) {
  return (
    <tr className="cam-target-region">
      <th scope="row">{name}</th>
      <td>—</td>
      <CountCells
        companyCount={counts.companyCount}
        registered={counts.registered}
        target={target}
        rate={rate}
        registeredInYear={counts.registeredInYear}
        pendingApproval={counts.pendingApproval}
        pendingReview={counts.pendingReview}
        complementsRequested={counts.complementsRequested}
      />
    </tr>
  );
}

function CountCells({
  companyCount,
  registered,
  target,
  rate,
  registeredInYear,
  pendingApproval,
  pendingReview,
  complementsRequested,
}: {
  companyCount: number | null;
  registered: number | null;
  target: number | null;
  rate: number | null;
  registeredInYear: number | null;
  pendingApproval: number | null;
  pendingReview: number | null;
  complementsRequested: number | null;
}) {
  const locale = asUiLocale(useLocale());
  return (
    <>
      <td className="is-num">{formatCoverageCount(registered, companyCount, locale)}</td>
      <td className="is-num">{fmt(target, locale)}</td>
      <td className="is-num">{fmtRate(rate, locale)}</td>
      <td className="is-num">{formatCoverageCount(registeredInYear, companyCount, locale)}</td>
      <td className="is-num">{formatCoverageCount(pendingApproval, companyCount, locale)}</td>
      <td className="is-num">{formatCoverageCount(pendingReview, companyCount, locale)}</td>
      <td className="is-num">{formatCoverageCount(complementsRequested, companyCount, locale)}</td>
    </>
  );
}

function fmt(value: number | null | undefined, locale: UiLocale): string {
  if (value == null) return "—";
  return value.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}

function fmtRate(rate: number | null | undefined, locale: UiLocale): string {
  if (rate == null) return "—";
  const digits = (rate * 100).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return locale === "en" ? `${digits}%` : `${digits} %`;
}
