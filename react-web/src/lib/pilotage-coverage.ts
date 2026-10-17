import { isRegistrationCampaign, type Campaign } from "./campaigns";
import type { CampaignReturnsResponse, EntityTypeReturnRow } from "./pilotage-targets";

/**
 * The campaign the dashboard's coverage section reads: the active ONEFOP
 * collection campaign. The header pill takes the first active campaign of any
 * kind, but returns exist only for a collection campaign (the backend refuses
 * a registration one with 400), so a registration campaign is never picked.
 */
export function pickCoverageCampaign(campaigns: readonly Campaign[] | undefined): Campaign | undefined {
  return (campaigns ?? []).find(
    (campaign) =>
      campaign.status === "ACTIVE" && campaign.collectionType === "ONEFOP" && !isRegistrationCampaign(campaign),
  );
}

export interface CoverageRow {
  key: string;
  name: string;
  /** "central" is the national administrations row, labelled by the page. */
  kind: "region" | "department" | "central";
  received: number;
  late: number;
  /** 0–1, null when the territory has no registered establishment. */
  responseRate: number | null;
}

/**
 * The rows of the dashboard's coverage table, at the level that tells the
 * reader something. GET .../returns is territory-scoped server-side: a
 * national account gets every region (and the central level), a regional
 * account gets its one region. One region row says no more than the
 * headline, so a single-region answer is shown by department instead.
 */
export function coverageRows(data: CampaignReturnsResponse): CoverageRow[] {
  if (data.regions.length === 1) {
    return data.regions[0].departments.map((department) => ({
      key: department.departmentId,
      name: department.name,
      kind: "department",
      received: department.received,
      late: department.late,
      responseRate: department.responseRate,
    }));
  }
  const rows: CoverageRow[] = data.regions.map((region) => ({
    key: region.regionId,
    name: region.name,
    kind: "region",
    received: region.received,
    late: region.late,
    responseRate: region.responseRate,
  }));
  if (data.central) {
    rows.push({
      key: "central",
      name: "",
      kind: "central",
      received: data.central.received,
      late: data.central.late,
      responseRate: data.central.responseRate,
    });
  }
  return rows;
}

/**
 * The rows of the dashboard's breakdown by entity type, as the server lists
 * them (registration-screen order, zero rows included — a type nobody
 * declared is information). Empty when the backend predates the field, so
 * the page shows no table rather than a table of zeros.
 */
export function entityTypeRows(data: CampaignReturnsResponse): EntityTypeReturnRow[] {
  return data.byEntityType ?? [];
}

/** A 0–1 ratio as the 0–100 value the shared percent/meter helpers take. */
export function ratioToPercent(ratio: number | null | undefined): number | null {
  return ratio == null || Number.isNaN(ratio) ? null : ratio * 100;
}
