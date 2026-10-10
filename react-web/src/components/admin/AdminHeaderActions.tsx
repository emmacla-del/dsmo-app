"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/auth-store";
import { listCampaigns } from "@/lib/campaigns";
import { referencePeriodPhrases } from "@/lib/onefop-period-label";
import { CAMPAIGN_ROLES, hasRole } from "@/lib/roles";
import { NotificationBell } from "./NotificationBell";

import { computeUserScopeLabel } from "@/lib/admin-data-state";
import { asUiLocale } from "@/lib/register-i18n";

/**
 * The active campaign, or undefined when there is none or the user's role
 * cannot read campaigns. Shares its query key with every other caller, so the
 * header and page content trigger a single GET /campaigns?status=ACTIVE.
 */
export function useActiveCampaign() {
  const user = useAuthStore((s) => s.user);
  const canReadCampaigns = hasRole(user?.role, CAMPAIGN_ROLES);
  const query = useQuery({
    queryKey: ["campaigns", "ACTIVE"],
    queryFn: () => listCampaigns("ACTIVE"),
    enabled: canReadCampaigns,
  });
  return { canReadCampaigns, activeCampaign: query.data?.[0], isLoading: query.isLoading };
}

/**
 * Configuration options for right-hand header actions.
 */
export interface AdminHeaderActionsProps {
  showCampaignPill?: boolean;
  showBell?: boolean;
  showSearchInput?: boolean;
}

/**
 * Right-hand chips shared by every admin page header: active campaign pill,
 * the account's territorial scope.
 */
export function AdminHeaderActions({
  showCampaignPill = true,
  showBell = true,
  showSearchInput = false,
}: AdminHeaderActionsProps = {}) {
  const router = useRouter();
  const t = useTranslations("adminHeaderActions");
  const tCommon = useTranslations("common");
  const locale = asUiLocale(useLocale());
  const user = useAuthStore((s) => s.user);
  const { activeCampaign, isLoading: campaignLoading, canReadCampaigns } = useActiveCampaign();

  const scope = computeUserScopeLabel(user, locale);

  const rawCampaignName = activeCampaign?.name || activeCampaign?.code || null;
  // Plain words, never the stored code: "Campagne du 4e trimestre 2026", not
  // "Campagne QUARTERLY_2026_T4_001". The code stays in the tooltip.
  const campaignName = (() => {
    if (!rawCampaignName) return null;
    const phrase = referencePeriodPhrases(activeCampaign?.code, locale)?.campaign;
    if (phrase) return phrase;
    const m = rawCampaignName.match(/(PREMIER|DEUXIEME|TROISIEME|QUATRIEME)\s+TRIMESTRE\s+(\d{4})/i);
    if (m) {
      const qMap: Record<string, number> = { premier: 1, deuxieme: 2, troisieme: 3, quatrieme: 4 };
      return t("campaignQuarter", { year: m[2], quarter: qMap[m[1].toLowerCase()] || 1 });
    }
    if (rawCampaignName.length > 22) {
      return rawCampaignName.slice(0, 20) + "…";
    }
    return rawCampaignName;
  })();

  return (
    <div className="cam-admin-header-actions">
      {/* Campaign pill */}
      {showCampaignPill && canReadCampaigns && (
        <Link
          href="/admin/campagnes"
          className="cam-admin-campaign-pill"
          title={activeCampaign ? `${rawCampaignName} (${activeCampaign.code})` : t("noActiveCampaign")}
        >
          <span className={`cam-admin-campaign-pill-dot${activeCampaign ? " is-active" : ""}`} aria-hidden="true" />
          <span>
            {campaignLoading ? tCommon("loading") : activeCampaign ? campaignName : t("noActiveCampaign")}
          </span>
        </Link>
      )}

      {/* Territorial scope, stated. It was a chevroned link to /admin/cibles —
          it looked like a scope selector, and 403'd for AUDITOR. The scope is
          fixed by the account; there is nothing to select. */}
      <span className="cam-admin-scope" title={t("scopeTitle")}>
        {t("scopeChip", { scope })}
      </span>

      {/* Notification bell — the caller's own in-app inbox (Phase 3). Opens a
          preview panel; /admin/notifications is the full history. It
          previously linked to /admin/activite, which is dossier alerts, not
          notifications addressed to this user. */}
      {showBell && <NotificationBell />}

      {/* Search element: text input box or compact button */}
      {showSearchInput ? (
        <div className="cam-admin-header-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            aria-label={t("searchAriaLabel")}
            placeholder={t("searchPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const query = e.currentTarget.value.trim();
                router.push(query ? `/admin/dossiers?q=${encodeURIComponent(query)}` : "/admin/dossiers");
              }
            }}
          />
        </div>
      ) : (
        <Link
          href="/admin/dossiers"
          className="cam-admin-icon-button"
          aria-label={t("searchAriaLabel")}
          title={t("searchTitle")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      )}
    </div>
  );
}
