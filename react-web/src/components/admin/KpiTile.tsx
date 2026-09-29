"use client";

import Link from "next/link";

export type KpiTone = "warning" | "info" | "error";

export interface KpiTileProps {
  /** null = no data source yet; renders "—" and the tile is not navigable */
  value: number | null;
  label: string;
  tone: KpiTone;
  href?: string;
}

/**
 * "À traiter" tile (Figma dashboard): big count, label, coloured left edge,
 * arrow when it links to the matching work queue.
 */
export function KpiTile({ value, label, tone, href }: KpiTileProps) {
  const unavailable = value === null;
  const body = (
    <>
      <span className="cam-kpi-tile-text">
        <span className="cam-kpi-tile-value">{unavailable ? "—" : value.toLocaleString("fr-FR")}</span>
        <span className="cam-kpi-tile-label">{label}</span>
      </span>
      {href && !unavailable && <span className="cam-kpi-tile-arrow" aria-hidden="true">→</span>}
    </>
  );

  const className = `cam-kpi-tile cam-kpi-tile--${tone}${unavailable ? " is-unavailable" : ""}`;

  if (href && !unavailable) {
    return <Link href={href} className={className}>{body}</Link>;
  }
  return (
    <div className={className} title={unavailable ? "Donnée non disponible" : undefined}>
      {body}
    </div>
  );
}
