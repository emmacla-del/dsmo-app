"use client";

import { Fragment } from "react";
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
  const national = data.central != null || data.unassigned != null;

  if (data.regions.length === 0 && !national) {
    return (
      <p className="cam-admin-lede">Aucun territoire n&apos;est associé à ce compte.</p>
    );
  }

  return (
    <div className="cam-dash-table-wrap">
      <table className="cam-dash-table cam-target-table">
        <thead>
          <tr>
            <th scope="col">Territoire</th>
            <th scope="col" className="is-num">Quota</th>
            <th scope="col" className="is-num">Reçus</th>
            <th scope="col" className="is-num">Validés</th>
            <th scope="col" className="is-num">À temps</th>
            <th scope="col" className="is-num">En retard</th>
            <th scope="col" className="is-num">Écart</th>
            <th scope="col" className="is-num">Taux de quota</th>
            <th scope="col" className="is-num">Taux de réponse</th>
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
                <th scope="row">Niveau central (Administrations)</th>
                <MetricCells metrics={data.central} />
              </tr>
            )}
            {data.unassigned && data.unassigned.received > 0 && (
              <tr className="cam-target-region">
                <th scope="row">Non rattachés</th>
                <MetricCells metrics={data.unassigned} />
              </tr>
            )}
          </tbody>
        )}
        <tfoot>
          <tr className="cam-target-region" style={{ fontWeight: 600, borderTop: "2px solid var(--cam-border)" }}>
            <th scope="row">Total</th>
            <MetricCells metrics={data.totals} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MetricCells({ metrics }: { metrics: ReturnMetrics }) {
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
            title="Déclarations déposées après la date limite"
          >
            retard
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
      <td className="is-num" title={`Reçus / Répertoire actif (${fmt(metrics.received)} / ${fmt(metrics.registeredStock)})`}>
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

function fmt(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("fr-FR");
}

function fmtRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} %`;
}
