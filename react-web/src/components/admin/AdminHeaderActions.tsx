"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns } from "@/lib/campaigns";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";
import { CAMPAIGN_ROLES, hasRole } from "@/lib/roles";
import { computeUserScopeLabel } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";
import { NotificationBell } from "./NotificationBell";

/** The active campaign, shared with page content through one query key. */
export function useActiveCampaign() {
  const user = useAuthStore((s) => s.user);
  const canReadCampaigns = hasRole(user?.role, CAMPAIGN_ROLES);
  const query = useQuery({
    queryKey: ["campaigns", "ACTIVE"],
    queryFn: () => listCampaigns("ACTIVE"),
    enabled: canReadCampaigns,
  });
  return { canReadCampaigns, activeCampaign: query.data?.[0], isLoading: !user || (canReadCampaigns && query.isPending) };
}

export interface AdminHeaderActionsProps {
  showCampaignPill?: boolean;
}

/** Page-header action for the active campaign. */
export function AdminHeaderActions({ showCampaignPill = true }: AdminHeaderActionsProps = {}) {
  const t = useTranslations("adminHeaderActions");
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  const { activeCampaign, isLoading: campaignLoading, canReadCampaigns } = useActiveCampaign();
  const rawCampaignName = activeCampaign?.name || activeCampaign?.code || null;
  const campaignName = (() => {
    if (!rawCampaignName) return null;
    const phrase = referencePeriodPhrases(activeCampaign?.code, locale)?.campaign;
    if (phrase) return phrase;
    const match = rawCampaignName.match(/(PREMIER|DEUXIEME|TROISIEME|QUATRIEME)\s+TRIMESTRE\s+(\d{4})/i);
    if (match) {
      const quarterByName: Record<string, number> = { premier: 1, deuxieme: 2, troisieme: 3, quatrieme: 4 };
      return t("campaignQuarter", { year: match[2], quarter: quarterByName[match[1].toLowerCase()] || 1 });
    }
    return rawCampaignName.length > 22 ? `${rawCampaignName.slice(0, 20)}…` : rawCampaignName;
  })();

  return (
    <div className="cam-admin-header-actions">
      {showCampaignPill && canReadCampaigns && (
        <Link
          href="/admin/campagnes"
          className="cam-admin-campaign-pill"
          title={activeCampaign ? `${rawCampaignName} (${activeCampaign.code})` : campaignLoading ? undefined : t("noActiveCampaign")}
        >
          <span className={`cam-admin-campaign-pill-dot${activeCampaign ? " is-active" : ""}`} aria-hidden="true" />
          <span>{campaignLoading ? tCommon("loading") : activeCampaign ? campaignName : t("noActiveCampaign")}</span>
        </Link>
      )}
    </div>
  );
}

/** Persistent scope and utility actions at the top of the sidebar. */
export function AdminRailActions() {
  const t = useTranslations("adminHeaderActions");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  const scope = computeUserScopeLabel(user, locale);

  return (
    <div className="cam-admin-rail-tools-row">
      <span className="cam-admin-scope" title={t("scopeTitle")}>
        {t("scopeChip", { scope })}
      </span>
      <NotificationBell placement="rail" />
      <Link href="/admin/dossiers" className="cam-admin-icon-button" aria-label={t("searchAriaLabel")} title={t("searchTitle")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </Link>
    </div>
  );
}
