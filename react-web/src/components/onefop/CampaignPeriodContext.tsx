"use client";

import { createContext, useContext } from "react";
import type { CampaignPeriod } from "@/lib/campaign-period";

/**
 * The active round's data-collection period (lib/campaign-period.ts), for
 * the wizard pieces that print it outside the schema text — the KPI table's
 * column headers. Defaults to "not set", never to a date.
 */
export const CampaignPeriodContext = createContext<CampaignPeriod>({ start: null, end: null });

export function useCampaignPeriod(): CampaignPeriod {
  return useContext(CampaignPeriodContext);
}
