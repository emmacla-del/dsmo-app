"use client";

import { Fragment } from "react";
import type { CoverageResponse, StockCounts } from "@/lib/pilotage-targets";
import { modeLabel } from "@/lib/pilotage-target-payload";

export function CoverageTable({
  data,
  expanded,
  onToggle,
}: {
  data: CoverageResponse;
  expanded: Set<string>;
  onToggle: (regionId: string) => void;
}) {
  const national = data.central != null || data.unassigned != null || data.nullEntityType != null;

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
            <th scope="col">Mode</th>
            <th scope="col" className="is-num">Inscrits</th>
            <th scope="col" className="is-num">Cible</th>
            <th scope="col" className="is-num">Taux</th>
            <th scope="col" className="is-num">Dans l&apos;année</th>
            <th scope="col" className="is-num">Approbation</th>
            <th scope="col" className="is-num">Instruction</th>
            <th scope="col" className="is-num">Compléments</th>
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
                  <td>{modeLabel(region.mode)}</td>
                  <CountCells
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
              <BucketRow name="Niveau central" counts={data.central} target={data.central.inscriptionTarget ?? null} rate={data.central.rate ?? null} />
            )}
            {data.unassigned && (
              <BucketRow name="Non rattachés" counts={data.unassigned} target={null} rate={null} />
            )}
            {data.nullEntityType && (
              <BucketRow name="Type d'entité manquant" counts={data.nullEntityType} target={null} rate={null} />
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
  registered,
  target,
  rate,
  registeredInYear,
  pendingApproval,
  pendingReview,
  complementsRequested,
}: {
  registered: number | null;
  target: number | null;
  rate: number | null;
  registeredInYear: number | null;
  pendingApproval: number | null;
  pendingReview: number | null;
  complementsRequested: number | null;
}) {
  return (
    <>
      <td className="is-num">{fmt(registered)}</td>
      <td className="is-num">{fmt(target)}</td>
      <td className="is-num">{fmtRate(rate)}</td>
      <td className="is-num">{fmt(registeredInYear)}</td>
      <td className="is-num">{fmt(pendingApproval)}</td>
      <td className="is-num">{fmt(pendingReview)}</td>
      <td className="is-num">{fmt(complementsRequested)}</td>
    </>
  );
}

function fmt(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("fr-FR");
}

function fmtRate(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })} %`;
}
