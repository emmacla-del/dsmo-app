"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CampaignReturnsTable } from "@/components/admin/CampaignReturnsTable";
import { DataState } from "@/components/admin/DataState";
import { formatCampaignDisplayName } from "@/lib/campaigns";
import { referencePeriodLabel } from "@/lib/onefop-period-label";
import {
  getActiveCollectionCampaigns,
  getCampaignReturns,
} from "@/lib/pilotage-targets";
import { asUiLocale } from "@/lib/register-i18n";

export function DossiersCoverage({
  campaignId,
  onCampaignChange,
}: {
  campaignId: string;
  onCampaignChange: (campaignId: string) => void;
}) {
  const t = useTranslations("adminDossiersPage");
  const locale = asUiLocale(useLocale());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const campaignsQuery = useQuery({
    queryKey: ["admin", "pilotage", "active-campaigns"],
    queryFn: getActiveCollectionCampaigns,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const campaigns = campaignsQuery.data ?? [];
  const selected = campaignId || campaigns[0]?.id || "";
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selected);

  const returnsQuery = useQuery({
    queryKey: ["admin", "pilotage", "returns", selected],
    queryFn: () => getCampaignReturns(selected),
    enabled: !!selected,
    refetchOnWindowFocus: false,
  });

  const toggle = (regionId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });

  const territoryHref = ({ region, department }: { region?: string; department?: string }) => {
    const params = new URLSearchParams();
    if (selected) params.set("campaignId", selected);
    if (region) params.set("region", region);
    if (department) params.set("department", department);
    const qs = params.toString();
    return `/admin/dossiers${qs ? `?${qs}` : ""}`;
  };

  if (campaignsQuery.isLoading) {
    return <DataState state="loading" resource={t("coverageResource")} />;
  }
  if (campaignsQuery.isError) {
    return (
      <DataState
        state="error"
        resource={t("coverageResource")}
        error={campaignsQuery.error}
        onRetry={() => campaignsQuery.refetch()}
      />
    );
  }
  if (!selected) {
    return <DataState state="empty" resource={t("coverageResource")} title={t("noActiveCampaigns")} />;
  }

  return (
    <div className="grid gap-4">
      <label className="cam-target-year">
        {t("coverageCampaignLabel")}
        <select
          className="cam-select"
          value={selected}
          onChange={(event) => onCampaignChange(event.target.value)}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {referencePeriodLabel(campaign.code, locale)} - {formatCampaignDisplayName(campaign.name)}
            </option>
          ))}
        </select>
      </label>

      {selectedCampaign ? (
        <p className="cam-admin-lede">
          {formatCampaignDisplayName(selectedCampaign.name)} - {referencePeriodLabel(selectedCampaign.code, locale)}
        </p>
      ) : (
        <p className="cam-admin-lede">{t("inactiveCampaign")}</p>
      )}

      {returnsQuery.isLoading ? (
        <DataState state="loading" resource={t("coverageResource")} />
      ) : returnsQuery.isError ? (
        <DataState
          state="error"
          resource={t("coverageResource")}
          error={returnsQuery.error}
          onRetry={() => returnsQuery.refetch()}
        />
      ) : returnsQuery.data ? (
        <CampaignReturnsTable
          data={returnsQuery.data}
          expanded={expanded}
          onToggle={toggle}
          territoryHref={territoryHref}
        />
      ) : null}
    </div>
  );
}
