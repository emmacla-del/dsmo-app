"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { count } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

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
  const t = useTranslations("adminKpiTile");
  const locale = asUiLocale(useLocale());
  const unavailable = value === null;
  const body = (
    <>
      <span className="cam-kpi-tile-text">
        <span className="cam-kpi-tile-value">{unavailable ? "—" : count(value, locale)}</span>
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
    <div className={className} title={unavailable ? t("unavailableTitle") : undefined}>
      {body}
    </div>
  );
}
